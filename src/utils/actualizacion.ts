/**
 * Que la app instalada (icono en la pantalla de inicio) siempre traiga lo último que se publicó.
 *
 * El problema: Firebase Hosting manda por defecto `Cache-Control: max-age=3600` en TODO, incluido `index.html`, y
 * el navegador del iPhone en modo "app" lo respeta aun al recargar: se quedaba con la versión vieja hasta una hora.
 * Se arregla en tres capas:
 *  1. `firebase.json`: index.html (y todo lo que no es un archivo con huella) con `no-cache`; solo `/assets/**`
 *     (con el hash en el nombre) se guarda un año.
 *  2. Cada compilación escribe `/version.json` con su identificador (vite.config.js); la app lo compara con el
 *     suyo al abrirse, al volver a primer plano y al reconectarse.
 *  3. Si hay una versión nueva se recarga sola (o, si hay un formulario a medias, avisa con un botón), y el gesto de
 *     "deslizar para actualizar" refresca primero el `index.html` guardado y luego recarga.
 */

declare const __BUILD_ID__: string | undefined;

/** Identificador de la versión que se está ejecutando ('dev' fuera de una compilación) */
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export type Consulta = typeof fetch;

/**
 * ¿Hay publicada una versión distinta de la que corre? Pregunta a `/version.json` sin usar la caché.
 * Cualquier fallo (sin red, 404, respuesta que no es JSON) cuenta como "no hay nada nuevo": jamás recarga por error.
 */
export async function hayVersionNueva(consultar: Consulta = fetch, actual: string = BUILD_ID): Promise<boolean> {
  if (actual === 'dev') return false;
  try {
    const r = await consultar(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const { id } = (await r.json()) as { id?: unknown };
    return typeof id === 'string' && id !== '' && id !== actual;
  } catch {
    return false;
  }
}

/**
 * Recarga trayendo lo último: primero se vuelve a pedir el HTML ignorando la caché (así la recarga no
 * recibe la copia vieja guardada) y después se recarga la página. Si algo falla, recarga igual.
 */
export async function recargarConLoNuevo(opciones: { consultar?: Consulta; recargar?: () => void } = {}): Promise<void> {
  const consultar = opciones.consultar ?? fetch;
  const recargar = opciones.recargar ?? (() => window.location.reload());
  marcarRecargando();
  try {
    await Promise.all([
      consultar('/index.html', { cache: 'reload' }),
      consultar(window.location.pathname || '/', { cache: 'reload' }),
    ]);
  } catch {
    /* sin red o bloqueado: se recarga de todos modos */
  }
  recargar();
}

/**
 * Se marca justo antes de recargar: al arrancar, la app ve la marca y mantiene el indicador de carga hasta que
 * la pantalla esté lista, así entre la recarga y la primera pantalla nunca se ve todo vacío.
 */
export const CLAVE_RECARGANDO = 'crustore:recargando';

export function marcarRecargando(almacen: Pick<Storage, 'setItem'> = sessionStorage) {
  try {
    almacen.setItem(CLAVE_RECARGANDO, String(Date.now()));
  } catch {
    /* sin almacenamiento: solo se pierde el indicador al arrancar */
  }
}

/** ¿Venimos de una recarga reciente (menos de 30 s)? Consume la marca. */
export function vienesDeRecarga(ahora = Date.now(), almacen: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage): boolean {
  try {
    const t = Number(almacen.getItem(CLAVE_RECARGANDO) || 0);
    almacen.removeItem(CLAVE_RECARGANDO);
    return t > 0 && ahora - t < 30_000;
  } catch {
    return false;
  }
}

/** Marca en la sesión para no entrar en un ciclo de recargas si la red aún sirve la versión vieja */
const CLAVE_ULTIMA = 'crustore:recarga-por-version';
const ESPERA_ENTRE_RECARGAS_MS = 60_000;

export function puedeRecargarPorVersion(ahora = Date.now(), almacen: Pick<Storage, 'getItem'> = sessionStorage): boolean {
  try {
    const ultima = Number(almacen.getItem(CLAVE_ULTIMA) || 0);
    return !(ultima && ahora - ultima < ESPERA_ENTRE_RECARGAS_MS);
  } catch {
    return true;
  }
}

export function marcarRecargaPorVersion(ahora = Date.now(), almacen: Pick<Storage, 'setItem'> = sessionStorage) {
  try {
    almacen.setItem(CLAVE_ULTIMA, String(ahora));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** ¿Es seguro recargar solo? No si hay un formulario a medias o se está escribiendo en un campo */
export function sePuedeRecargarSolo(doc: Document = document): boolean {
  if (doc.querySelector('[data-sin-recarga]')) return false;
  const activo = doc.activeElement;
  return !(activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName));
}

export interface OpcionesVigilancia {
  /** Se llama cuando hay versión nueva y NO es seguro recargar solo (para mostrar el aviso) */
  alHaberNueva: () => void;
  consultar?: Consulta;
  recargar?: () => void;
  /** Para pruebas */
  actual?: string;
  doc?: Document;
  ventana?: Window;
}

/**
 * Revisa si hay versión nueva al abrir, al volver a primer plano y al reconectarse.
 * Devuelve una función para dejar de vigilar.
 */
export function vigilarVersion(o: OpcionesVigilancia): () => void {
  const doc = o.doc ?? document;
  const ventana = o.ventana ?? window;
  let revisando = false;

  async function revisar() {
    if (revisando) return;
    revisando = true;
    try {
      if (!(await hayVersionNueva(o.consultar, o.actual))) return;
      if (sePuedeRecargarSolo(doc) && puedeRecargarPorVersion()) {
        marcarRecargaPorVersion();
        await recargarConLoNuevo({ consultar: o.consultar, recargar: o.recargar });
      } else {
        o.alHaberNueva();
      }
    } finally {
      revisando = false;
    }
  }

  const alVolver = () => {
    if (doc.visibilityState === 'visible') void revisar();
  };
  const alMostrarPagina = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) void revisar();
  };
  doc.addEventListener('visibilitychange', alVolver);
  ventana.addEventListener('online', revisar);
  ventana.addEventListener('pageshow', alMostrarPagina);
  const inicio = ventana.setTimeout(revisar, 2500); // al abrir, sin estorbar la carga inicial
  return () => {
    doc.removeEventListener('visibilitychange', alVolver);
    ventana.removeEventListener('online', revisar);
    ventana.removeEventListener('pageshow', alMostrarPagina);
    ventana.clearTimeout(inicio);
  };
}
