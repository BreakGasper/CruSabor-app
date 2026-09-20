/**
 * Enlaces que escribe la tienda y ven todos sus clientes.
 *
 * Lo que la tienda teclea acaba en un `href` del perfil público, así que no se
 * puede usar tal cual: un `javascript:...` ahí dentro se ejecutaría en el
 * navegador de cualquiera que toque el icono. Por eso solo se aceptan http y
 * https, y todo lo demás se descarta.
 *
 * También se acepta escribirlo sin esquema ("facebook.com/mitienda"), que es
 * como la gente copia una dirección, y se completa con https.
 */

/** Esquemas que pueden acabar en un href sin riesgo */
const ESQUEMAS_PERMITIDOS = ['http:', 'https:'];

/**
 * Devuelve el enlace listo para un `href`, o null si no sirve.
 *
 * @example normalizarEnlace('facebook.com/lola')      → 'https://facebook.com/lola'
 * @example normalizarEnlace('https://instagram.com/x') → 'https://instagram.com/x'
 * @example normalizarEnlace('javascript:alert(1)')     → null
 */
export function normalizarEnlace(valor: unknown): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  // Sin esquema se asume https: es como se copia una dirección a mano
  const candidato = /^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`;

  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return null;
  }
  if (!ESQUEMAS_PERMITIDOS.includes(url.protocol)) return null;
  if (!url.hostname.includes('.')) return null; // "https://hola" no es una dirección
  return url.toString();
}

/** ¿Este texto sirve como enlace público? */
export const esEnlaceValido = (valor: unknown): boolean => normalizarEnlace(valor) !== null;

/** Cómo mostrarlo: sin esquema ni barra final, que es como lo lee la gente */
export function textoEnlace(valor: unknown): string {
  const url = normalizarEnlace(valor);
  if (!url) return String(valor ?? '').trim();
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
