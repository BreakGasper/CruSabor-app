/**
 * Regresar sin dejar atrapado a quien llega de fuera.
 *
 * Un enlace compartido (perfil de tienda, detalle de producto) abre la app
 * directamente en esa pantalla, sin historial propio. Ahí `router.back()` no
 * tiene a dónde volver —o peor, saca de la app y regresa a WhatsApp—, así que
 * el visitante se queda sin forma de llegar al catálogo.
 *
 * Vue Router guarda en `history.state.back` la ruta anterior *dentro* de la app
 * y la deja nula cuando esta pantalla fue la primera de la sesión. Con eso se
 * decide: si hay historial propio se regresa, y si no se manda a la portada.
 */

/** Pantalla de inicio: la portada con categorías, tiendas y artículos */
export const RUTA_INICIO = '/';

/** Lo poco que se necesita del router (así las pruebas no montan uno real) */
export interface NavegadorMinimo {
  back: () => void;
  replace: (ruta: string) => void;
}

/** Estado que Vue Router deja en `window.history.state` */
export interface EstadoHistorial {
  back?: string | null;
}

const estadoActual = (): EstadoHistorial | null =>
  typeof window !== 'undefined' ? (window.history.state as EstadoHistorial) : null;

/** ¿Esta pantalla tiene una anterior dentro de la app? */
export function hayHistorialPropio(estado: EstadoHistorial | null = estadoActual()): boolean {
  return Boolean(estado?.back);
}

/**
 * Regresa a la pantalla anterior; si no hay ninguna (se llegó por un enlace
 * compartido), lleva a la portada. Se usa `replace` para no dejar en el
 * historial una entrada que no lleva a ningún lado.
 */
export function volverOInicio(
  router: NavegadorMinimo,
  inicio: string = RUTA_INICIO,
  estado: EstadoHistorial | null = estadoActual(),
): void {
  if (hayHistorialPropio(estado)) router.back();
  else router.replace(inicio);
}
