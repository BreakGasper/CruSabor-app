/**
 * Temáticas de temporada (Día de Muertos, Halloween, Navidad…): una o varias
 * decoraciones animadas encima de ciertas pantallas, y opcionalmente otra paleta
 * mientras dura. Se guardan en `configuracion/apariencia/tematicas/{id}`.
 *
 * Cada decoración ("pieza") usa una imagen que puede venir de dos lugares:
 *
 * - Del proyecto: `src/assets/tematicas/archivo.gif`. Vite la empaqueta con la app al
 *   compilar; para agregar una hay que copiarla ahí, compilar y publicar.
 *   Se referencia por su nombre de archivo: "arana.svg".
 * - Subida desde Admin › Apariencia: se guarda como data URL en `iconosTematica/{id}`
 *   (Realtime Database, fuera de `configuracion` para que cada cliente descargue solo
 *   las que usa la temática activa). No pasa por Cloudinary. Máximo 300 KB.
 *   Se referencia como "subido:{id}".
 */
import { ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, set, onValue } from '@/services/baseDatos';
import { sessionAdmin } from '@/utils/sessionAdmin';

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

/** Una decoración dentro de la temática */
export interface Pieza {
  /** "archivo.gif" (del proyecto) o "subido:{id}" (subida desde el admin) */
  imagen: string;
  animacion: Animacion;
  posicion: Posicion;
  tamano: Tamano;
}
export const MAX_PIEZAS = 6;

export interface Tematica {
  nombre: string;
  piezas: Pieza[];
  pantallas: Pantalla[];
  /** Paleta mientras está activa ('' = no cambiar) */
  paleta: string;
  activa: boolean;
  /** Opcionales, AAAA-MM-DD: fuera de este rango no se muestra aunque esté activa */
  desde: string;
  hasta: string;
}

/* ---------------- Imágenes del proyecto ---------------- */

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

/* ---------------- Iconos subidos desde el admin ---------------- */

export interface IconoSubido {
  nombre: string;
  /** data URL de la imagen */
  datos: string;
  bytes: number;
  creadoEn: string;
  creadoPor: string;
}

export const PREFIJO_SUBIDO = 'subido:';
export const MAX_BYTES_ICONO = 300 * 1024;
export const TIPOS_ICONO = ['image/gif', 'image/png', 'image/webp', 'image/svg+xml', 'image/apng', 'image/avif'];

/** Iconos subidos ya descargados (id → icono). El admin los tiene todos; los clientes solo los que usan. */
export const iconosSubidos = ref<Record<string, IconoSubido>>({});

const esSubido = (imagen: string) => imagen.startsWith(PREFIJO_SUBIDO);
export const idSubido = (imagen: string) => imagen.slice(PREFIJO_SUBIDO.length);

/** URL para <img> de una imagen de temática, o undefined si no existe (o aún no se descarga) */
export function urlImagen(imagen: string): string | undefined {
  if (esSubido(imagen)) return iconosSubidos.value[idSubido(imagen)]?.datos;
  return IMAGENES_TEMATICA[imagen];
}

/** Nombre legible de una imagen */
export function nombreImagen(imagen: string): string {
  if (esSubido(imagen)) return iconosSubidos.value[idSubido(imagen)]?.nombre ?? 'Icono borrado';
  return imagen;
}

/** Descarga los iconos subidos que use esta lista de piezas y que falten */
export async function cargarIconosDe(piezas: Pieza[]): Promise<void> {
  const faltan = [...new Set(piezas.filter((p) => esSubido(p.imagen)).map((p) => idSubido(p.imagen)))].filter(
    (id) => !iconosSubidos.value[id],
  );
  await Promise.all(
    faltan.map(async (id) => {
      try {
        const snap = await get(dbRef(db, `iconosTematica/${id}`));
        const icono = normalizarIcono(snap.val());
        if (icono) iconosSubidos.value = { ...iconosSubidos.value, [id]: icono };
      } catch (e) {
        console.warn('No se pudo descargar el icono de la temática', id, e);
      }
    }),
  );
}

function normalizarIcono(d: any): IconoSubido | null {
  if (!d || typeof d.datos !== 'string' || !d.datos.startsWith('data:image/')) return null;
  return {
    nombre: typeof d.nombre === 'string' && d.nombre ? d.nombre : 'icono',
    datos: d.datos,
    bytes: Number(d.bytes) || 0,
    creadoEn: typeof d.creadoEn === 'string' ? d.creadoEn : '',
    creadoPor: typeof d.creadoPor === 'string' ? d.creadoPor : '',
  };
}

let suscritoAdmin = false;
/** Admin: todos los iconos subidos, en vivo */
export function suscribirIconosAdmin() {
  if (suscritoAdmin) return;
  suscritoAdmin = true;
  onValue(
    dbRef(db, 'iconosTematica'),
    (snap) => {
      const todos: Record<string, IconoSubido> = {};
      for (const [id, d] of Object.entries<any>(snap.val() || {})) {
        const i = normalizarIcono(d);
        if (i) todos[id] = i;
      }
      iconosSubidos.value = todos;
    },
    (e) => console.error('❌ Error leyendo iconosTematica:', e),
  );
}

/** Solo para pruebas */
export function __resetIconos() {
  iconosSubidos.value = {};
  suscritoAdmin = false;
}

/** Revisa tipo y tamaño antes de subir. Devuelve el motivo del rechazo o null si está bien. */
export function validarArchivoIcono(archivo: { type: string; size: number }): string | null {
  if (!TIPOS_ICONO.includes(archivo.type)) return 'Formato no permitido. Usa GIF, PNG, WebP o SVG.';
  if (archivo.size > MAX_BYTES_ICONO) {
    return `Pesa ${Math.round(archivo.size / 1024)} KB; el máximo es ${MAX_BYTES_ICONO / 1024} KB. Reduce el GIF (menos cuadros o menos tamaño) e intenta de nuevo.`;
  }
  return null;
}

function leerComoDataUrl(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

/** Sube un icono y devuelve la referencia para usarlo en una pieza ("subido:{id}") */
export async function subirIcono(archivo: File): Promise<string> {
  const error = validarArchivoIcono(archivo);
  if (error) throw new Error(error);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const icono: IconoSubido = {
    nombre: archivo.name.slice(0, 60) || 'icono',
    datos: await leerComoDataUrl(archivo),
    bytes: archivo.size,
    creadoEn: new Date().toISOString(),
    creadoPor: sessionAdmin.value?.nombre || 'admin',
  };
  await set(dbRef(db, `iconosTematica/${id}`), icono);
  iconosSubidos.value = { ...iconosSubidos.value, [id]: icono };
  return PREFIJO_SUBIDO + id;
}

export async function eliminarIcono(id: string): Promise<void> {
  await set(dbRef(db, `iconosTematica/${id}`), null);
  const { [id]: _, ...resto } = iconosSubidos.value;
  iconosSubidos.value = resto;
}

/* ---------------- Normalización y reglas ---------------- */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const de = <T extends string>(opciones: Record<T, unknown>, v: unknown, def: T): T =>
  typeof v === 'string' && v in opciones ? (v as T) : def;

function normalizarPieza(d: any): Pieza | null {
  if (!d || typeof d.imagen !== 'string' || !d.imagen) return null;
  return {
    imagen: d.imagen,
    animacion: de(ANIMACIONES, d.animacion, 'colgando'),
    posicion: de(POSICIONES, d.posicion, 'derecha'),
    tamano: de(TAMANOS, d.tamano, 'mediano'),
  };
}

/**
 * Acepta el formato actual (`piezas`) y el anterior de una sola imagen
 * (`imagen`, `animacion`, `posicion`, `tamano` en la temática).
 */
export function normalizarTematica(d: any): Tematica | null {
  if (!d || typeof d !== 'object') return null;
  // Firebase guarda los arreglos como objetos {0:…,1:…} si les faltan índices
  const crudas = Array.isArray(d.piezas) ? d.piezas : d.piezas && typeof d.piezas === 'object' ? Object.values(d.piezas) : [d];
  const piezas = crudas.map(normalizarPieza).filter((p: Pieza | null): p is Pieza => !!p).slice(0, MAX_PIEZAS);
  if (!piezas.length) return null;
  const pantallas = Array.isArray(d.pantallas)
    ? (d.pantallas.filter((p: unknown) => typeof p === 'string' && p in PANTALLAS) as Pantalla[])
    : [];
  return {
    nombre: typeof d.nombre === 'string' && d.nombre.trim() ? d.nombre.trim() : 'Temática',
    piezas,
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

/** Temáticas que usan un icono subido (para avisar antes de borrarlo) */
export function tematicasQueUsan(tematicas: Record<string, Tematica>, imagen: string): string[] {
  return Object.values(tematicas)
    .filter((t) => t.piezas.some((p) => p.imagen === imagen))
    .map((t) => t.nombre);
}
