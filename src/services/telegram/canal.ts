/**
 * Canal de Telegram (Bot API). Gratis, sin Meta: el bot se crea en minutos con @BotFather.
 *
 *   TELEGRAM_BOT_TOKEN       el que entrega @BotFather al crear el bot (formato 123456:ABC…)
 *   TELEGRAM_WEBHOOK_SECRET  texto que tú inventas (letras, números, _ y -); Telegram lo manda en
 *                            cada aviso y así se sabe que viene de Telegram
 *   API_PUBLIC_URL           URL pública de este servidor; con ella el webhook se registra solo
 *
 * Solo se atienden chats PRIVADOS: en un grupo otros verían la contraseña y las fotos.
 */
import { timingSafeEqual } from 'node:crypto';
import type { Canal, MensajeEntrante } from '../asistente/canal.ts';

const API = 'https://api.telegram.org';
export const SECRETO_VALIDO = /^[A-Za-z0-9_-]{1,256}$/;

/** El agente escribe con *negritas* de WhatsApp; Telegram las entiende en HTML (y se escapa el resto) */
export function aHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
}

export function secretoValido(cabecera: string | undefined, secreto: string): boolean {
  if (!cabecera || !secreto) return false;
  const a = Buffer.from(cabecera);
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ActualizacionTelegram {
  updateId: number;
  mensaje: MensajeEntrante | null;
  /** Para quitar el "cargando" del botón que se tocó */
  callbackId?: string;
}

/** Traduce un `update` de Telegram al mensaje que entiende el agente (null = ignorar) */
export function actualizacion(u: any): ActualizacionTelegram | null {
  const updateId = Number(u?.update_id);
  if (!Number.isFinite(updateId)) return null;

  const cb = u?.callback_query;
  if (cb) {
    const chat = cb.message?.chat;
    if (chat?.type !== 'private' || cb.from?.is_bot) return { updateId, mensaje: null, callbackId: String(cb.id ?? '') };
    return {
      updateId,
      callbackId: String(cb.id ?? ''),
      mensaje: { id: `tg${updateId}`, de: String(chat.id), tipo: 'boton', texto: String(cb.data ?? '') },
    };
  }

  const m = u?.message;
  if (!m || m.chat?.type !== 'private' || m.from?.is_bot) return { updateId, mensaje: null };
  const base = { id: `tg${updateId}`, de: String(m.chat.id), idMensaje: String(m.message_id ?? '') };

  if (m.contact) {
    // Solo vale el contacto PROPIO: reenviar el de otra persona no debe permitir entrar como ella
    const propio = m.contact.user_id !== undefined && Number(m.contact.user_id) === Number(m.from?.id);
    return { updateId, mensaje: propio ? { ...base, tipo: 'contacto', texto: '', telefono: String(m.contact.phone_number ?? '') } : { ...base, tipo: 'otro', texto: '' } };
  }
  if (Array.isArray(m.photo) && m.photo.length) {
    const mayor = m.photo[m.photo.length - 1];
    return { updateId, mensaje: { ...base, tipo: 'imagen', texto: String(m.caption ?? ''), mediaId: String(mayor.file_id) } };
  }
  if (m.document && /^image\//.test(String(m.document.mime_type ?? ''))) {
    return { updateId, mensaje: { ...base, tipo: 'imagen', texto: String(m.caption ?? ''), mediaId: String(m.document.file_id) } };
  }
  if (typeof m.text === 'string') {
    // "/start" es lo primero que manda Telegram: equivale a pedir la ayuda
    const texto = /^\/start\b/i.test(m.text) ? 'ayuda' : m.text;
    return { updateId, mensaje: { ...base, tipo: 'texto', texto } };
  }
  return { updateId, mensaje: { ...base, tipo: 'otro', texto: '' } };
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export interface CanalTelegram extends Canal {
  responderCallback: (id: string) => Promise<void>;
  registrarWebhook: (url: string, secreto: string) => Promise<void>;
}

export function crearCanalTelegram(op: { token?: string; fetchFn?: typeof fetch } = {}): CanalTelegram {
  const token = op.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = op.fetchFn ?? fetch;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN');

  async function llamar(metodo: string, cuerpo: any) {
    const res = await fetchFn(`${API}/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => ({}));
    // El token va en la URL: nunca se incluye en el mensaje de error
    if (!res.ok || data.ok === false) throw new Error(`Telegram ${metodo} ${res.status}: ${String(data?.description ?? '').slice(0, 200)}`);
    return data.result;
  }
  const enviar = (a: string, texto: string, extra: any = {}) =>
    llamar('sendMessage', { chat_id: a, text: aHtml(texto).slice(0, 4000), parse_mode: 'HTML', ...extra }).then(() => {});

  return {
    enviarTexto: (a, t) => enviar(a, t, { reply_markup: { remove_keyboard: true } }),

    enviarBotones: (a, t, botones) =>
      enviar(a, t, { reply_markup: { inline_keyboard: [botones.map((b) => ({ text: b.titulo, callback_data: b.id }))] } }),

    pideTelefono: (a, t) =>
      enviar(a, t, { reply_markup: { keyboard: [[{ text: '📱 Compartir mi número', request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } }),

    borrarMensaje: (a, id) => llamar('deleteMessage', { chat_id: a, message_id: Number(id) }).then(() => {}),

    async descargarImagen(fileId) {
      const f = await llamar('getFile', { file_id: fileId });
      const ruta = String(f?.file_path ?? '');
      if (!ruta) throw new Error('Telegram getFile sin ruta');
      const res = await fetchFn(`${API}/file/bot${token}/${ruta}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Telegram descarga ${res.status}`);
      const ext = ruta.split('.').pop()?.toLowerCase() ?? '';
      return { mime: MIME[ext] ?? 'image/jpeg', bytes: Buffer.from(await res.arrayBuffer()) };
    },

    responderCallback: (id) => llamar('answerCallbackQuery', { callback_query_id: id }).then(() => {}),

    registrarWebhook: (url, secreto) =>
      llamar('setWebhook', { url, secret_token: secreto, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }).then(() => {}),
  };
}
