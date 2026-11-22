import { reactive } from 'vue';
import { DATOS_VACIOS, type DatosProducto, type Propuesta } from './motor/tipos';
import type { Imagenes } from './escena';

/** Lo que se va armando en el asistente de creación; vive mientras la pestaña esté abierta */
export interface PropuestaConMini extends Propuesta {
  mini: string;
}

export const sesion = reactive({
  /** La foto tal como la subió la persona: NUNCA se modifica */
  original: null as Blob | null,
  /** Copia de trabajo (con los giros que se le hayan aplicado) */
  trabajo: null as Blob | null,
  urlProducto: '',
  prod: { w: 0, h: 0 },
  logo: null as Blob | null,
  urlLogo: '',
  datos: { ...DATOS_VACIOS } as DatosProducto,
  formatoId: 'flyer',
  estiloId: 'fiesta',
  tanda: 0,
  propuestas: [] as PropuestaConMini[],
});

export function reiniciarSesion() {
  Object.assign(sesion, { original: null, trabajo: null, urlProducto: '', prod: { w: 0, h: 0 }, logo: null, urlLogo: '', datos: { ...DATOS_VACIOS }, tanda: 0, propuestas: [] });
}

export const imagenesDeSesion = (): Imagenes => ({ producto: sesion.urlProducto, logo: sesion.urlLogo || undefined });

/** Preferencias pequeñas (nombre de la tienda, etc.) */
const CLAVE = 'cgrat-studio:prefs';
export function leerPrefs(): { tienda: string } {
  try {
    return { tienda: '', ...(JSON.parse(localStorage.getItem(CLAVE) || '{}') as object) };
  } catch {
    return { tienda: '' };
  }
}
export function guardarPrefs(p: { tienda: string }) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
