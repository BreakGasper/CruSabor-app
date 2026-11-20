/**
 * Webhook de Telegram.
 *
 *   POST /telegram/webhook   Telegram avisa de cada mensaje (con la cabecera secreta). Se responde 200
 *                            al instante y el mensaje se atiende aparte.
 *   GET  /telegram/estado    { activo, faltan }: qué variables faltan (sin revelar valores).
 *
 * Al arrancar, si hay API_PUBLIC_URL, el webhook se registra solo en Telegram (no hay que hacerlo a mano).
 * Sin las variables queda apagado y el resto del servidor sigue igual.
 */
import { Router } from 'express';
import { crearAgente } from '../asistente/agente.ts';
import { crearGemini, type Cerebro } from '../asistente/gemini.ts';
import { crearAlmacen, type Almacen } from '../pagos/almacen.ts';
import { subirACloudinary } from '../whatsapp/router.ts';
import { actualizacion, crearCanalTelegram, secretoValido, SECRETO_VALIDO, type CanalTelegram } from './canal.ts';

export function faltantesTelegram(env: NodeJS.ProcessEnv = process.env): string[] {
  const f = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'GEMINI_API_KEY'].filter((k) => !env[k]);
  if (env.TELEGRAM_WEBHOOK_SECRET && !SECRETO_VALIDO.test(env.TELEGRAM_WEBHOOK_SECRET)) f.push('TELEGRAM_WEBHOOK_SECRET (solo letras, números, _ y -)');
  return f;
}

export interface OpcionesTelegram {
  env?: NodeJS.ProcessEnv;
  canal?: CanalTelegram;
  cerebro?: Cerebro;
  almacen?: () => Promise<Almacen>;
  subirImagen?: (bytes: Buffer, mime: string) => Promise<string>;
  log?: (...a: any[]) => void;
}

export function crearRouterTelegram(op: OpcionesTelegram = {}) {
  const env = op.env ?? process.env;
  const log = op.log ?? console.log;
  const router = Router();
  const faltan = faltantesTelegram(env);
  const activo = faltan.length === 0;

  router.get('/estado', (_req, res) => res.json({ activo, faltan }));

  if (!activo) {
    log(`Telegram: desactivado (faltan ${faltan.join(', ')})`);
    router.all('/webhook', (_req, res) => res.status(503).json({ error: 'Telegram no está configurado' }));
    return router;
  }

  const canal = op.canal ?? crearCanalTelegram();
  const agente = crearAgente({
    canal,
    cerebro: op.cerebro ?? crearGemini(),
    almacen: op.almacen ?? crearAlmacen,
    subirImagen: op.subirImagen ?? ((b, m) => subirACloudinary(b, m)),
    urlApp: env.FRONTEND_URL || 'https://mrapp-b8d1e.web.app',
    log,
  });

  const vistos = new Map<number, number>();
  const yaVisto = (id: number) => {
    const ahora = Date.now();
    for (const [k, t] of vistos) if (ahora - t > 3_600_000) vistos.delete(k);
    if (vistos.has(id)) return true;
    vistos.set(id, ahora);
    return false;
  };

  router.post('/webhook', (req, res) => {
    if (!secretoValido(req.get('x-telegram-bot-api-secret-token'), env.TELEGRAM_WEBHOOK_SECRET!)) return res.sendStatus(401);
    res.sendStatus(200);
    const a = actualizacion(req.body);
    if (!a || yaVisto(a.updateId)) return;
    if (a.callbackId) void canal.responderCallback(a.callbackId).catch(() => {});
    if (a.mensaje) void agente.procesar(a.mensaje);
  });

  // Registro automático del webhook (necesita la URL pública del servidor)
  const publica = (env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (publica) {
    canal
      .registrarWebhook(`${publica}/telegram/webhook`, env.TELEGRAM_WEBHOOK_SECRET!)
      .then(() => log(`Telegram: webhook registrado en ${publica}/telegram/webhook ✅`))
      .catch((e) => log('Telegram: no se pudo registrar el webhook:', e?.message ?? e));
  } else {
    log('Telegram: falta API_PUBLIC_URL, el webhook no se registra solo');
  }

  log('Telegram: activo ✅');
  return router;
}
