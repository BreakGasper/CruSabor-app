/**
 * Enlace de "Mandar WhatsApp" para que una tienda contacte a su cliente desde la pantalla de pedidos.
 * Abre WhatsApp (app o web) con el mensaje ya escrito; no se envía nada hasta que la tienda toca "enviar".
 */

/**
 * Celular → número internacional para wa.me, solo dígitos. México: 10 dígitos → 52 + los 10.
 * Acepta con espacios, guiones, paréntesis, "+" y lada (52 / 521). '' si no parece un celular utilizable.
 */
export function numeroParaWhatsapp(celular: unknown): string {
  const d = String(celular ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`;
  return '';
}

export interface DatosMensajeCliente {
  /** Nombre del cliente (se usa solo el primer nombre) */
  cliente?: string;
  tienda?: string;
  /** Número del pedido (los últimos caracteres) */
  idPedido?: string;
  /** Nombres de los artículos bajo pedido que incluye */
  articulosBajoPedido?: string[];
}

const primerNombre = (n: unknown) => String(n ?? '').trim().split(/\s+/)[0] ?? '';

/** Mensaje inicial: saluda, dice de qué tienda y de qué pedido, y si hay artículos bajo pedido los menciona */
export function mensajeParaCliente(d: DatosMensajeCliente): string {
  const nombre = primerNombre(d.cliente);
  const saludo = nombre ? `Hola ${nombre}` : 'Hola';
  const de = d.tienda ? ` de ${d.tienda}` : '';
  const pedido = d.idPedido ? ` (pedido ${String(d.idPedido).slice(-6)})` : '';
  const l = [`${saludo}, te escribimos${de} por tu pedido en Crustore${pedido}.`];
  const bajo = (d.articulosBajoPedido ?? []).map((a) => String(a).trim()).filter(Boolean).slice(0, 5);
  if (bajo.length) l.push(`Es sobre tu artículo bajo pedido: ${bajo.join(', ')}. Queremos confirmar contigo los detalles.`);
  return l.join(' ');
}

/** https://wa.me/52…?text=… ; '' si el celular no es válido */
export function enlaceWhatsappCliente(celular: unknown, d: DatosMensajeCliente = {}): string {
  const n = numeroParaWhatsapp(celular);
  if (!n) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(mensajeParaCliente(d))}`;
}
