/**
 * Escenas de fondo con IA (gratis con la cuota diaria de Cloudflare Workers AI).
 *
 *   GET  /escenas/estado              → { activo, restantesHoy }
 *   POST /escenas/generar { descripcion } → { imagen: "data:image/...;base64,..." }
 *
 * Variables en el servidor (NUNCA en la app):
 *   CLOUDFLARE_ACCOUNT_ID   el id de la cuenta de Cloudflare
 *   CLOUDFLARE_API_TOKEN    un token con permiso «Workers AI»
 *   ESCENAS_MAX_DIA         (opcional) tope diario de imágenes, 300 por defecto
 *   ESCENAS_MAX_HORA_IP     (opcional) tope por hora y por persona, 8 por defecto
 *
 * Sin las dos primeras responde `activo: false` y la app esconde el botón: nada se rompe.
 */
import { Router } from 'express';
import { MAX_DESCRIPCION, MODELO_ESCENAS, configDesdeEntorno, crearLimitador, dataUrlDeImagen, limpiarDescripcion, promptDeEscena, type ConfigEscenas } from './logica.ts';

export interface OpcionesRouterEscenas {
  env?: NodeJS.ProcessEnv;
  ahora?: () => Date;
  /** Se inyecta en pruebas para no llamar a Cloudflare de verdad; devuelve el base64 de la imagen */
  generar?: (prompt: string, cfg: ConfigEscenas) => Promise<string>;
  log?: (...a: any[]) => void;
}

/** Llama a Workers AI (FLUX.1 schnell) y devuelve la imagen en base64 */
async function generarEnCloudflare(prompt: string, cfg: ConfigEscenas): Promise<string> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.cuenta}/ai/run/${MODELO_ESCENAS}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 6 }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`Cloudflare respondió ${r.status}`);
  const data = (await r.json()) as { result?: { image?: string }; success?: boolean };
  const imagen = data?.result?.image;
  if (!imagen) throw new Error('Cloudflare no devolvió imagen');
  return imagen;
}

export function crearRouterEscenas(op: OpcionesRouterEscenas = {}) {
  const env = op.env ?? process.env;
  const generar = op.generar ?? generarEnCloudflare;
  const log = op.log ?? console.log;
  const limitador = crearLimitador(op.ahora);
  const router = Router();

  router.get('/estado', (_req, res) => {
    const cfg = configDesdeEntorno(env);
    res.json({ activo: Boolean(cfg), restantesHoy: cfg ? limitador.restantes(cfg) : 0 });
  });

  router.post('/generar', async (req, res) => {
    const cfg = configDesdeEntorno(env);
    if (!cfg) return res.status(200).json({ activo: false, motivo: 'no-configurado' });

    const descripcion = limpiarDescripcion(req.body?.descripcion);
    if (!descripcion) return res.status(400).json({ motivo: 'descripcion', mensaje: `Describe la escena en pocas palabras (de 3 a ${MAX_DESCRIPCION} letras).` });

    const ip = String(req.ip || req.socket?.remoteAddress || 'desconocida');
    const permiso = limitador.intentar(ip, cfg);
    if (!permiso.ok) {
      return res.status(429).json({
        motivo: permiso.motivo,
        mensaje: permiso.motivo === 'dia' ? 'Por hoy ya se generaron todas las escenas gratuitas. Vuelve a intentarlo mañana.' : 'Has generado varias escenas seguidas. Espera un rato e inténtalo de nuevo.',
      });
    }

    try {
      const base64 = await generar(promptDeEscena(descripcion), cfg);
      return res.json({ imagen: dataUrlDeImagen(base64), restantesHoy: limitador.restantes(cfg) });
    } catch (e) {
      limitador.devolver(ip); // no se generó nada: no gasta el cupo
      log('Escenas: no se pudo generar', e);
      return res.status(502).json({ motivo: 'servicio', mensaje: 'No se pudo generar la escena ahora. Intenta de nuevo en un momento.' });
    }
  });

  return router;
}
