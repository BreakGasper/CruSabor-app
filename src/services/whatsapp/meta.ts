/**
 * API de WhatsApp Cloud (Meta). Enviar mensajes, bajar fotos y verificar la firma del webhook.
 *
 *   WHATSAPP_TOKEN            token de acceso (de preferencia el permanente de un usuario del sistema)
 *   WHATSAPP_PHONE_NUMBER_ID  id del número en Meta (NO es el teléfono)
 *   WHATSAPP_VERIFY_TOKEN     texto que tú inventas y pegas igual en Meta al registrar el webhook
 *   WHATSAPP_APP_SECRET       secreto de la app de Meta; con él se comprueba que el aviso viene de Meta
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface Canal {
  enviarTexto: (a: string, texto: string) => Promise<void>;
  enviarBotones: (a: string, texto: string, botones: { id: string; titulo: string }[]) => Promise<void>;
  descargarImagen: (mediaId: string) => Promise<{ mime: string; bytes: Buffer }>;
}

/** Firma del webhook: HMAC-SHA256 del cuerpo CRUDO con el secreto de la app */
export function firmaValida(cuerpo: Buffer | undefined, cabecera: string | undefined, secreto: string): boolean {
  if (!cuerpo || !cabecera || !secreto) return false;
  const esperada = 'sha256=' + createHmac('sha256', secreto).update(cuerpo).digest('hex');
  const a = Buffer.from(esperada);
  const b = Buffer.from(cabecera);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function crearCanalMeta(op: { token?: string; phoneNumberId?: string; fetchFn?: typeof fetch } = {}): Canal {
  const token = op.token ?? process.env.WHATSAPP_TOKEN ?? '';
  const id = op.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const fetchFn = op.fetchFn ?? fetch;
  if (!token || !id) throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID');
  const auth = { Authorization: `Bearer ${token}` };

  async function enviar(cuerpo: any) {
    const res = await fetchFn(`${GRAPH}/${id}/messages`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`WhatsApp envío ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  return {
    enviarTexto: (a, texto) => enviar({ to: a, type: 'text', text: { body: texto.slice(0, 4000) } }),

    enviarBotones: (a, texto, botones) =>
      enviar({
        to: a,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: texto.slice(0, 1000) },
          action: { buttons: botones.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo.slice(0, 20) } })) },
        },
      }),

    async descargarImagen(mediaId) {
      const meta = await fetchFn(`${GRAPH}/${mediaId}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
      if (!meta.ok) throw new Error(`WhatsApp media ${meta.status}`);
      const { url, mime_type } = (await meta.json()) as any;
      const archivo = await fetchFn(url, { headers: auth, signal: AbortSignal.timeout(30_000) });
      if (!archivo.ok) throw new Error(`WhatsApp descarga ${archivo.status}`);
      return { mime: String(mime_type || archivo.headers.get('content-type') || ''), bytes: Buffer.from(await archivo.arrayBuffer()) };
    },
  };
}

/** Saca de un aviso de Meta los mensajes que nos interesan (texto, foto, botón) */
export interface MensajeEntrante {
  id: string;
  de: string;
  tipo: 'texto' | 'imagen' | 'boton' | 'otro';
  texto: string;
  mediaId?: string;
}

export function mensajesDelAviso(body: any): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  for (const entrada of body?.entry ?? []) {
    for (const cambio of entrada?.changes ?? []) {
      for (const m of cambio?.value?.messages ?? []) {
        const base = { id: String(m.id ?? ''), de: String(m.from ?? '') };
        if (!base.id || !base.de) continue;
        if (m.type === 'text') salida.push({ ...base, tipo: 'texto', texto: String(m.text?.body ?? '') });
        else if (m.type === 'image') salida.push({ ...base, tipo: 'imagen', texto: String(m.image?.caption ?? ''), mediaId: String(m.image?.id ?? '') });
        else if (m.type === 'interactive' && m.interactive?.button_reply)
          salida.push({ ...base, tipo: 'boton', texto: String(m.interactive.button_reply.id ?? '') });
        else salida.push({ ...base, tipo: 'otro', texto: '' });
      }
    }
  }
  return salida;
}
