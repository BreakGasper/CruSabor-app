import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, push, set, update, remove, onValue, type Unsubscribe } from 'firebase/database';

/**
 * Banners promocionales del carrusel de la portada (arriba de "Explorar").
 * Viven en `banners/{id}`. Los administra el admin y los muestra la app en vivo.
 *
 *   banners/{id}: { id, imagenUrl, titulo, subtitulo, enlace, activo, orden, fechaInicio, fechaFin, creadoEn }
 *
 * - `enlace`: a dónde lleva al tocar el banner. Ruta interna (empieza con "/") o URL externa (http...).
 * - `activo` + vigencia (`fechaInicio`/`fechaFin`, formato YYYY-MM-DD, ambos opcionales) deciden si se muestra.
 * - `orden`: menor primero en el carrusel.
 */
export interface Banner {
  id: string;
  imagenUrl: string;
  titulo?: string;
  subtitulo?: string;
  enlace?: string;
  activo: boolean;
  orden: number;
  fechaInicio?: string; // YYYY-MM-DD (opcional)
  fechaFin?: string; // YYYY-MM-DD (opcional)
  creadoEn?: string;
}

/** Fecha de hoy en America/Mexico_City como YYYY-MM-DD (para comparar vigencia) */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Regla pura: ¿el banner debe mostrarse hoy? (activo y dentro de su vigencia) */
export function bannerVigente(b: Pick<Banner, 'activo' | 'fechaInicio' | 'fechaFin'>, hoy: string = hoyISO()): boolean {
  if (b.activo === false) return false;
  if (b.fechaInicio && hoy < b.fechaInicio) return false; // aún no empieza
  if (b.fechaFin && hoy > b.fechaFin) return false; // ya venció
  return true;
}

const ordenar = (lista: Banner[]) =>
  [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.creadoEn).localeCompare(String(b.creadoEn)));

function aLista(data: Record<string, any> | null): Banner[] {
  if (!data) return [];
  return Object.entries(data).map(([id, b]) => ({
    id,
    imagenUrl: String(b?.imagenUrl || ''),
    titulo: b?.titulo || '',
    subtitulo: b?.subtitulo || '',
    enlace: b?.enlace || '',
    activo: b?.activo !== false,
    orden: Number.isFinite(Number(b?.orden)) ? Number(b.orden) : 0,
    fechaInicio: b?.fechaInicio || '',
    fechaFin: b?.fechaFin || '',
    creadoEn: b?.creadoEn || '',
  }));
}

/* -------- Solo para pruebas: fija los banners sin Firebase -------- */
let bannersDePrueba: Banner[] | null = null;
export function __setBanners(lista: Banner[] | null) {
  bannersDePrueba = lista;
}

/** Banners que se muestran HOY en la portada (activos, vigentes, ordenados). En vivo. */
export function useBannersActivos(): { banners: Ref<Banner[]>; cargando: Ref<boolean> } {
  const banners = ref<Banner[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;

  onMounted(() => {
    if (bannersDePrueba) {
      banners.value = ordenar(bannersDePrueba.filter((b) => bannerVigente(b)));
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, 'banners'), (snap) => {
      banners.value = ordenar(aLista(snap.val()).filter((b) => bannerVigente(b)));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { banners, cargando };
}

/** Todos los banners (para el admin), en vivo y ordenados */
export function useBannersAdmin(): { banners: Ref<Banner[]>; cargando: Ref<boolean> } {
  const banners = ref<Banner[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    off = onValue(dbRef(db, 'banners'), (snap) => {
      banners.value = ordenar(aLista(snap.val()));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { banners, cargando };
}

type DatosBanner = Omit<Banner, 'id' | 'creadoEn'>;

/** Crea un banner. Si no se da `orden`, lo pone al final. Devuelve su id. */
export async function crearBanner(datos: Partial<DatosBanner> & { imagenUrl: string }): Promise<string> {
  if (!datos.imagenUrl) throw new Error('El banner necesita una imagen');
  let orden = datos.orden;
  if (orden === undefined || orden === null) {
    const snap = await get(dbRef(db, 'banners'));
    orden = snap.exists() ? Object.keys(snap.val()).length : 0;
  }
  const nuevo = push(dbRef(db, 'banners'));
  const id = nuevo.key!;
  await set(nuevo, {
    id,
    imagenUrl: datos.imagenUrl,
    titulo: datos.titulo?.trim() || '',
    subtitulo: datos.subtitulo?.trim() || '',
    enlace: datos.enlace?.trim() || '',
    activo: datos.activo !== false,
    orden,
    fechaInicio: datos.fechaInicio || '',
    fechaFin: datos.fechaFin || '',
    creadoEn: new Date().toISOString(),
  });
  return id;
}

/** Actualiza campos de un banner */
export async function actualizarBanner(id: string, cambios: Partial<DatosBanner>): Promise<void> {
  const limpio: Record<string, any> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) continue;
    limpio[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (!Object.keys(limpio).length) return;
  await update(dbRef(db, `banners/${id}`), limpio);
}

/** Activa o desactiva un banner sin borrarlo */
export async function alternarBannerActivo(id: string, activo: boolean): Promise<void> {
  await update(dbRef(db, `banners/${id}`), { activo });
}

/** Elimina un banner */
export async function eliminarBanner(id: string): Promise<void> {
  await remove(dbRef(db, `banners/${id}`));
}
