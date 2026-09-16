/**
 * Recuperar contraseña de un cliente, con el código en el SERVIDOR.
 *
 *   POST /recuperar-password/solicitar  { telefono }
 *        → busca al cliente por celular, genera un código, lo guarda hasheado con
 *          caducidad y lo envía por correo. Responde { ok, email } (correo oculto).
 *   POST /recuperar-password/cambiar    { telefono, codigo, nuevaPassword }
 *        → verifica el código en el servidor (caducidad + intentos) y, si es correcto,
 *          escribe la nueva contraseña (hash bcrypt) en usuarios/{id}/pass.
 *
 * El navegador nunca recibe el código ni decide si es válido. El código se guarda en
 * memoria del proceso (no en la base): si el servidor se reinicia, se pide de nuevo.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Almacen } from '../pagos/almacen.ts';
import { crearAlmacen } from '../pagos/almacen.ts';
import {
  soloDigitos,
  generarCodigo,
  evaluarCodigo,
  expiraEn,
  validarPassword,
  ocultarCorreo,
  MENSAJE_ESTADO,
  MINUTOS_VIGENCIA,
  type SolicitudRecuperacion,
} from './logica.ts';

export interface OpcionesRecuperacion {
  almacen?: () => Promise<Almacen>;
  enviarCorreo?: (m: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: any }>;
  codigos?: Map<string, SolicitudRecuperacion>;
  generarCodigo?: () => string;
  ahora?: () => Date;
  log?: (...a: any[]) => void;
}

/** Busca un cliente por celular leyendo el nodo (como useAdmin: pocos registros, sin índice) */
async function buscarUsuarioPorCelular(a: Almacen, tel: string) {
  const usuarios = (await a.leer('usuarios')) as Record<string, any> | null;
  if (!usuarios) return null;
  const entrada = Object.entries(usuarios).find(([, u]) => soloDigitos(u?.celular) === tel);
  if (!entrada) return null;
  const [id, u] = entrada;
  return { id, email: (u?.email as string) || '', nombre: (u?.nombre as string) || '' };
}

export function crearRouterRecuperacion(op: OpcionesRecuperacion = {}) {
  const almacen = op.almacen ?? crearAlmacen;
  const codigos = op.codigos ?? new Map<string, SolicitudRecuperacion>();
  const nuevoCodigo = op.generarCodigo ?? generarCodigo;
  const ahora = op.ahora ?? (() => new Date());
  const log = op.log ?? console.log;
  const router = Router();

  const enviar =
    op.enviarCorreo ??
    (async (m) => {
      const { enviarCorreo } = await import('../mailService.ts');
      return enviarCorreo(m);
    });

  router.post('/solicitar', async (req, res) => {
    try {
      const tel = soloDigitos(req.body?.telefono);
      if (tel.length !== 10) {
        res.status(400).json({ error: 'Número de teléfono inválido' });
        return;
      }

      const a = await almacen();
      const usuario = await buscarUsuarioPorCelular(a, tel);
      if (!usuario || !usuario.email) {
        // Mismo mensaje que veía el usuario antes: el número no tiene cuenta/correo
        res.status(404).json({ error: 'Ese número no tiene una cuenta con correo registrado' });
        return;
      }

      const codigo = nuevoCodigo();
      codigos.set(tel, {
        codigoHash: await bcrypt.hash(codigo, 10),
        userId: usuario.id,
        email: usuario.email,
        expiraMs: expiraEn(ahora().getTime()),
        intentos: 0,
      });

      const html = `
        <p>Hola${usuario.nombre ? ' ' + usuario.nombre : ''},</p>
        <p>Tu código para recuperar la contraseña es: <b style="font-size:20px">${codigo}</b></p>
        <p>Vence en ${MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este correo.</p>`;
      const r = await enviar({ to: usuario.email, subject: 'Recuperar contraseña - CruStore', html });
      if (!r.success) {
        codigos.delete(tel);
        // Temporal: se incluye el detalle del error para diagnosticar por qué Gmail rechaza el envío
        const detalle = r.error?.response || r.error?.message || String(r.error || '');
        log('No se pudo enviar el correo:', detalle);
        res.status(502).json({ error: 'No se pudo enviar el correo. Intenta más tarde.', detalle });
        return;
      }

      res.json({ ok: true, email: ocultarCorreo(usuario.email) });
    } catch (e: any) {
      log('solicitar recuperación falló:', e?.message || e);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.post('/cambiar', async (req, res) => {
    try {
      const tel = soloDigitos(req.body?.telefono);
      const codigo = String(req.body?.codigo ?? '');
      const nuevaPassword = String(req.body?.nuevaPassword ?? '');

      const errPass = validarPassword(nuevaPassword);
      if (errPass) {
        res.status(400).json({ error: errPass });
        return;
      }

      const sol = codigos.get(tel);
      const coincide = !!sol && (await bcrypt.compare(codigo, sol.codigoHash));
      const estado = evaluarCodigo(sol, coincide, ahora().getTime());

      if (estado !== 'ok') {
        // Caducado o bloqueado: la solicitud ya no sirve, se descarta
        if (estado === 'expirado' || estado === 'bloqueado' || estado === 'sin-solicitud') codigos.delete(tel);
        else if (sol) sol.intentos += 1; // incorrecto: cuenta el intento
        res.status(estado === 'bloqueado' ? 429 : 400).json({ error: MENSAJE_ESTADO[estado] });
        return;
      }

      const a = await almacen();
      await a.actualizar({ [`usuarios/${sol!.userId}/pass`]: await bcrypt.hash(nuevaPassword, 10) });
      codigos.delete(tel);
      log('Contraseña recuperada', { userId: sol!.userId });
      res.json({ ok: true });
    } catch (e: any) {
      log('cambiar contraseña falló:', e?.message || e);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  return router;
}
