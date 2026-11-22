/**
 * Lo que el agente necesita de un canal de chat. Hoy solo hay WhatsApp (Meta Cloud API), pero el agente
 * no sabe de dónde viene el mensaje: cada canal traduce sus avisos a `MensajeEntrante` y envía con `Canal`.
 */
export interface Canal {
  enviarTexto: (a: string, texto: string) => Promise<void>;
  /** Foto con pie de texto, desde un enlace público. Es opcional: si el canal no la tiene, se manda solo el texto */
  enviarImagen?: (a: string, url: string, pie: string) => Promise<void>;
  enviarBotones: (a: string, texto: string, botones: { id: string; titulo: string }[]) => Promise<void>;
  descargarImagen: (id: string) => Promise<{ mime: string; bytes: Buffer }>;
}

export interface MensajeEntrante {
  /** Único por mensaje (para ignorar reintentos) */
  id: string;
  /** Identificador del chat: a él se responde y con él se lleva la sesión (en WhatsApp, el celular) */
  de: string;
  tipo: 'texto' | 'imagen' | 'boton' | 'otro';
  texto: string;
  /** Identificador de la foto, para descargarla */
  mediaId?: string;
}
