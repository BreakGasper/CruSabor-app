/**
 * Webhook de WhatsApp.
 *
 *   GET  /whatsapp/webhook   Meta lo llama una vez para verificar el webhook (hub.verify_token).
 *   POST /whatsapp/webhook   Meta avisa de cada mensaje. Se comprueba la firma, se responde 200 AL
 *                            INSTANTE (Meta reintenta si tarda) y el mensaje se atiende aparte.
 *   GET  /whatsapp/estado    { activo, faltan }: qué variables faltan (sin revelar valores).
 *
 * Sin las variables, el endpoint responde `activo: false` y no hace nada: el resto del servidor
 * (pagos, correo, imágenes) sigue funcionando igual.
 */
import { Router } from 'express';
import { crearAgente } from '../asistente/agente.ts';
import { crearGemini, type Cerebro } from '../asistente/gemini.ts';
import { crearCanalMeta, firmaValida, mensajesDelAviso, type Canal } from './meta.ts';
import { crearAlmacen, type Almacen } from '../pagos/almacen.ts';
import { crearRouterImagenes } from '../imagenes/router.ts';

const REQUERIDAS = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'GEMINI_API_KEY'];

export const variablesFaltantes = (env: NodeJS.ProcessEnv = process.env) => REQUERIDAS.filter((k) => !env[k]);

/** Sube la foto con el mismo upload_preset sin firmar que usa la app (no necesita la api_secret) */
export async function subirACloudinary(bytes: Buffer, mime: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const nube = process.env.CLOUDINARY_CLOUD_NAME || 'dswymzhc2';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), 'articulo');
  form.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET || 'mrapp_upload');
  const res = await fetchFn(`https://api.cloudinary.com/v1_1/${nube}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) throw new Error(`Cloudinary ${res.status}: ${data?.error?.message ?? 'sin URL'}`);
  return String(data.secure_url);
}

export interface OpcionesWhatsapp {
  env?: NodeJS.ProcessEnv;
  canal?: Canal;
  cerebro?: Cerebro;
  almacen?: () => Promise<Almacen>;
  subirImagen?: (bytes: Buffer, mime: string) => Promise<string>;
  eliminarImagenes?: (urls: string[]) => Promise<unknown>;
  log?: (...a: any[]) => void;
}

export function crearRouterWhatsapp(op: OpcionesWhatsapp = {}) {
  const env = op.env ?? process.env;
  const log = op.log ?? console.log;
  const router = Router();
  const faltan = variablesFaltantes(env);
  const activo = faltan.length === 0;

  router.get('/estado', (_req, res) => res.json({ activo, faltan }));

  if (!activo) {
    log(`WhatsApp: desactivado (faltan ${faltan.join(', ')})`);
    router.all('/webhook', (_req, res) => res.status(503).json({ error: 'WhatsApp no está configurado' }));
    return router;
  }

  const borradorDeImagenes = crearRouterImagenes({ env, almacen: op.almacen, log });
  const agente = crearAgente({
    canal: op.canal ?? crearCanalMeta({ log }),
    cerebro: op.cerebro ?? crearGemini(),
    almacen: op.almacen ?? crearAlmacen,
    subirImagen: op.subirImagen ?? ((b, m) => subirACloudinary(b, m)),
    // El mismo borrado de la app: solo quita imágenes que la base ya no usa
    eliminarImagenes: op.eliminarImagenes ?? ((urls) => borradorDeImagenes.eliminar(urls)),
    urlApp: env.FRONTEND_URL || 'https://mrapp-b8d1e.web.app',
    secreto: env.WHATSAPP_APP_SECRET,
    log,
  });

  // Meta reintenta los avisos: un mismo mensaje no debe procesarse dos veces
  const vistos = new Map<string, number>();
  const yaVisto = (id: string) => {
    const ahora = Date.now();
    for (const [k, t] of vistos) if (ahora - t > 3_600_000) vistos.delete(k);
    if (vistos.has(id)) return true;
    vistos.set(id, ahora);
    return false;
  };

  router.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN) {
      log('WhatsApp: webhook verificado por Meta ✅');
      return res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    }
    log('WhatsApp: verificación RECHAZADA (el token de verificación de Meta no coincide con WHATSAPP_VERIFY_TOKEN)');
    return res.sendStatus(403);
  });

  router.post('/webhook', (req, res) => {
    const crudo = (req as any).rawBody as Buffer | undefined;
    if (!firmaValida(crudo, req.get('x-hub-signature-256'), env.WHATSAPP_APP_SECRET!)) {
      // Casi siempre: WHATSAPP_APP_SECRET no es la clave secreta de ESTA app de Meta
      log(`WhatsApp: aviso RECHAZADO por firma inválida (revisa WHATSAPP_APP_SECRET; cuerpo ${crudo ? 'recibido' : 'ausente'})`);
      return res.sendStatus(401);
    }
    res.sendStatus(200);
    const mensajes = mensajesDelAviso(req.body);
    // Sin contenido ni números: solo para saber que el aviso llegó (los estados de entrega no traen mensajes)
    log(`WhatsApp: aviso recibido (${mensajes.length} mensaje(s): ${mensajes.map((m) => m.tipo).join(', ') || 'ninguno, solo estados'})`);
    for (const m of mensajes) {
      if (yaVisto(m.id)) continue;
      void agente.procesar(m);
    }
  });

  log('WhatsApp: activo ✅');
  return router;
}
