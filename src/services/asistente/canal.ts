/**
 * Lo que el agente necesita de un canal de chat (WhatsApp, Telegram…). El agente no sabe de cuál
 * viene el mensaje: cada canal traduce sus avisos a `MensajeEntrante` y envía con `Canal`.
 */
export interface Canal {
  enviarTexto: (a: string, texto: string) => Promise<void>;
  enviarBotones: (a: string, texto: string, botones: { id: string; titulo: string }[]) => Promise<void>;
  descargarImagen: (id: string) => Promise<{ mime: string; bytes: Buffer }>;
  /**
   * Solo canales que NO entregan el celular por sí solos (Telegram): pide compartirlo con un botón.
   * Si existe, el login espera un mensaje `contacto` con el celular verificado por el canal.
   */
  pideTelefono?: (a: string, texto: string) => Promise<void>;
  /** Solo canales que permiten borrar el mensaje del usuario (Telegram): se usa con la contraseña */
  borrarMensaje?: (a: string, idMensaje: string) => Promise<void>;
}

export interface MensajeEntrante {
  /** Único por mensaje (para ignorar reintentos) */
  id: string;
  /** Identificador del chat: a él se responde y con él se lleva la sesión */
  de: string;
  tipo: 'texto' | 'imagen' | 'boton' | 'contacto' | 'otro';
  texto: string;
  /** Identificador de la foto, para descargarla */
  mediaId?: string;
  /** Celular (cualquier formato) verificado por el canal, solo en `contacto` */
  telefono?: string;
  /** Para poder borrar el mensaje (la contraseña) en canales que lo permiten */
  idMensaje?: string;
}
