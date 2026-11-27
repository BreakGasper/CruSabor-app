/**
 * Textos legales y de protección de Crustore, en UN solo lugar para que todas las pantallas digan lo mismo.
 * Si cambian los Términos (public/terminos.html), se sube VERSION_TERMINOS y la fecha: cada cuenta y cada pedido
 * guarda con qué versión aceptó.
 *
 * IMPORTANTE: estos textos describen cómo funciona HOY la plataforma (los pedidos se pagan directo a la tienda,
 * en efectivo o por transferencia; Crustore no cobra ni procesa esos pagos). Si algún día se cobra dentro de la
 * plataforma, hay que cambiar AVISOS_PEDIDO, AVISOS_ENTREGA y public/terminos.html.
 */

/** Cambia cada vez que se modifican los Términos o el Aviso de privacidad */
export const VERSION_TERMINOS = '2026-11-27';
export const FECHA_TERMINOS = '27 de noviembre de 2026';
export const URL_TERMINOS = '/terminos.html';
export const URL_PRIVACIDAD = '/privacidad.html';

export interface Aviso {
  id: string;
  titulo: string;
  texto: string;
}

/** Lo que se le recuerda al cliente al hacer un pedido, antes de confirmarlo */
export const AVISOS_PEDIDO: Aviso[] = [
  {
    id: 'trato-directo',
    titulo: 'El trato es directo con la tienda',
    texto: 'Crustore solo conecta a clientes con tiendas. Tu compra es un trato entre tú y la tienda: Crustore no vende, no prepara ni entrega los productos y no es parte de la compra.',
  },
  {
    id: 'pago',
    titulo: 'El pago se hace directamente a la tienda',
    texto: 'Crustore no cobra, no recibe ni procesa el pago de tus compras. Pagas a la tienda en efectivo o por transferencia, como acuerden. Verifica los datos de pago con la tienda y guarda tu comprobante.',
  },
  {
    id: 'fraude',
    titulo: 'Crustore nunca te pedirá dinero ni claves',
    texto: 'Nunca te pediremos pagos, depósitos, claves, códigos ni datos bancarios por mensaje, llamada o WhatsApp. Si alguien lo hace a nombre de Crustore, es un intento de fraude: no pagues y repórtalo.',
  },
  {
    id: 'responsabilidad',
    titulo: 'Responsabilidad',
    texto: 'Crustore no se hace responsable de la calidad, el estado, la entrega, los tiempos, el precio final ni las garantías de lo que vende cada tienda, ni de los acuerdos o pagos que hagas fuera de la plataforma. Cualquier aclaración o reclamo se resuelve directamente con la tienda.',
  },
];

/** Lo que se le recuerda al cliente al recibir su pedido */
export const AVISOS_ENTREGA: Aviso[] = [
  {
    id: 'revisar',
    titulo: 'Revisa tu pedido al recibirlo',
    texto: 'Comprueba que los productos estén completos y en buen estado antes de pagar o firmar de recibido. Si hay un problema, díselo a la tienda en ese momento.',
  },
  {
    id: 'pago-entrega',
    titulo: 'Paga solo a la tienda',
    texto: 'El pago es directo con la tienda, en efectivo o por transferencia. Crustore no cobra ni pide pagos por separado. Si alguien te pide dinero a nombre de Crustore, no pagues.',
  },
  {
    id: 'reclamos',
    titulo: 'Dudas o reclamos',
    texto: 'Comunícate con la tienda desde su perfil (teléfono o WhatsApp). La entrega, los tiempos y las garantías son responsabilidad de la tienda; Crustore no se hace responsable de ellos.',
  },
];

/** Lo que acepta una tienda al registrarse */
export const AVISOS_TIENDA: Aviso[] = [
  {
    id: 'veracidad',
    titulo: 'Información veraz',
    texto: 'Eres responsable de que tus productos, precios, existencias, horarios y datos de contacto sean reales y estén al día, y de cumplir con tus obligaciones fiscales y sanitarias.',
  },
  {
    id: 'trato-clientes',
    titulo: 'Trato directo con tus clientes',
    texto: 'La venta, el cobro, la entrega y la atención posventa son entre tú y tu cliente. Crustore no cobra por ti ni responde por tus ventas.',
  },
];

/** Texto de la casilla que se marca para aceptar */
export const TEXTO_ACEPTO_PEDIDO = 'He leído y acepto los Términos y condiciones. Entiendo que el pago y la entrega son un trato directo con la tienda y que Crustore no es responsable de ellos.';

/** Lo que se guarda con cada aceptación (cuenta o pedido) */
export function aceptacionActual(ahora: Date = new Date()): { version: string; fecha: string } {
  return { version: VERSION_TERMINOS, fecha: ahora.toISOString() };
}

/** Recordatorio corto para el aviso que sale al confirmar el pedido */
export const RECORDATORIO_PEDIDO_CONFIRMADO =
  'Recuerda: el pago es directo con la tienda (Crustore no cobra) y nunca te pediremos dinero, claves ni códigos.';
