/**
 * Temáticas de temporada (Día de Muertos, Halloween, Navidad…): una imagen o GIF
 * animado encima de ciertas pantallas, y opcionalmente otra paleta mientras dura.
 *
 * Las imágenes NO se suben a ningún servidor de imágenes: viven en
 * `src/assets/tematicas/` dentro del proyecto y Vite las empaqueta con la app al
 * compilar. Para agregar una: copia el archivo a esa carpeta, compila y publica
 * (`npm run build` + `firebase deploy --only hosting`); después aparece en
 * Admin › Apariencia › Temáticas.
 *
 * Se guardan en `configuracion/apariencia/tematicas/{id}`.
 */
export const ANIMACIONES = {
  colgando: 'Colgando de un hilo',
  asomandose: 'Asomándose desde abajo',
  flotando: 'Flotando',
  caminando: 'Caminando de lado a lado',
} as const;
export type Animacion = keyof typeof ANIMACIONES;

export const POSICIONES = { izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha' } as const;
export type Posicion = keyof typeof POSICIONES;

export const TAMANOS = { chico: 'Chico', mediano: 'Mediano', grande: 'Grande' } as const;
export type Tamano = keyof typeof TAMANOS;
export const PX_TAMANO: Record<Tamano, number> = { chico: 70, mediano: 120, grande: 180 };

/** Pantallas donde se puede mostrar una temática y las rutas que cubre cada una */
export const PANTALLAS = {
  login: { nombre: 'Login y registro de clientes', rutas: ['/login', '/register'] },
  'login-tienda': { nombre: 'Login y registro de tiendas', rutas: ['/store/login', '/store/register'] },
  'login-admin': { nombre: 'Login de administrador', rutas: ['/admin/login'] },
  inicio: { nombre: 'Portada (inicio)', rutas: ['/'] },
} as const;
export type Pantalla = keyof typeof PANTALLAS;

export interface Tematica {
  nombre: string;
  /** Nombre del archivo dentro de src/assets/tematicas/ */
  imagen: string;
  animacion: Animacion;
  posicion: Posicion;
  tamano: Tamano;
  pantallas: Pantalla[];
  /** Paleta mientras está activa ('' = no cambiar) */
  paleta: string;
  activa: boolean;
  /** Opcionales, AAAA-MM-DD: fuera de este rango no se muestra aunque esté activa */
  desde: string;
  hasta: string;
}

/* Imágenes disponibles: todo lo que haya en src/assets/tematicas al compilar */
const archivos = import.meta.glob('../assets/tematicas/*.{gif,png,webp,svg,apng,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const IMAGENES_TEMATICA: Record<string, string> = Object.fromEntries(
  Object.entries(archivos)
    .map(([ruta, url]) => [ruta.split('/').pop() as string, url])
    .sort(([a], [b]) => a.localeCompare(b)),
);

export function urlImagenTematica(archivo: string): string | undefined {
  return IMAGENES_TEMATICA[archivo];
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const de = <T extends string>(opciones: Record<T, unknown>, v: unknown, def: T): T =>
  typeof v === 'string' && v in opciones ? (v as T) : def;

export function normalizarTematica(d: any): Tematica | null {
  if (!d || typeof d !== 'object' || typeof d.imagen !== 'string' || !d.imagen) return null;
  const pantallas = Array.isArray(d.pantallas)
    ? (d.pantallas.filter((p: unknown) => typeof p === 'string' && p in PANTALLAS) as Pantalla[])
    : [];
  return {
    nombre: typeof d.nombre === 'string' && d.nombre.trim() ? d.nombre.trim() : 'Temática',
    imagen: d.imagen,
    animacion: de(ANIMACIONES, d.animacion, 'colgando'),
    posicion: de(POSICIONES, d.posicion, 'derecha'),
    tamano: de(TAMANOS, d.tamano, 'mediano'),
    pantallas: pantallas.length ? pantallas : ['login'],
    paleta: typeof d.paleta === 'string' ? d.paleta : '',
    activa: d.activa === true,
    desde: typeof d.desde === 'string' && FECHA.test(d.desde) ? d.desde : '',
    hasta: typeof d.hasta === 'string' && FECHA.test(d.hasta) ? d.hasta : '',
  };
}

/** Fecha local AAAA-MM-DD (zona horaria del dispositivo) */
export function hoyISO(ahora = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${d}`;
}

/** Activa y dentro de sus fechas (si las tiene) */
export function tematicaVigente(t: Tematica, hoy = hoyISO()): boolean {
  if (!t.activa) return false;
  if (t.desde && hoy < t.desde) return false;
  if (t.hasta && hoy > t.hasta) return false;
  return true;
}

/** La temática que se muestra ahora (la primera vigente; el admin solo deja una activa a la vez) */
export function tematicaEnCurso(tematicas: Record<string, Tematica>, hoy = hoyISO()): [string, Tematica] | null {
  return Object.entries(tematicas).find(([, t]) => tematicaVigente(t, hoy)) ?? null;
}

export function pantallaDeRuta(path: string): Pantalla | null {
  for (const [id, p] of Object.entries(PANTALLAS)) {
    if ((p.rutas as readonly string[]).includes(path)) return id as Pantalla;
  }
  return null;
}
