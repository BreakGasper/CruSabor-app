import { computed, ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, push, set, update, remove } from 'firebase/database';
import type { Producto } from '@/types/Producto';

/**
 * Promociones de las tiendas: un descuento con fecha de caducidad sobre un
 * artículo que la tienda YA publicó.
 *
 *   promociones/{id}: { id, tiendaId, tiendaNombre, articuloId, titulo,
 *                       bannerUrl, precioPromo, precioOriginal, activa,
 *                       creadaEn, venceEn }
 *
 * No es un producto aparte: apunta a un artículo existente y solo le cambia el
 * precio mientras está vigente. Así el carrito, el stock, los pedidos, las
 * calificaciones y la pantalla de detalle siguen siendo los mismos, sin copias.
 *
 * Duran **un mes** desde que se crean. Al caducar solo salen de Destacados: el
 * artículo se sigue vendiendo a su precio normal, porque dejar de vender sin
 * avisar sería peor que cobrar de más. La tienda las renueva desde su panel.
 *
 * Igual que las calificaciones y las tiendas, el nodo se escucha UNA vez y lo
 * comparten todas las pantallas.
 */

export interface Promocion {
  id: string;
  tiendaId: string;
  tiendaNombre?: string;
  /** El artículo al que le aplica el descuento */
  articuloId: string;
  /** Lo que se lee en la tarjeta de Destacados */
  titulo: string;
  /** Imagen ancha de arriba de la tarjeta */
  bannerUrl: string;
  precioPromo: number;
  /** Precio del artículo cuando se creó la promoción (se muestra tachado) */
  precioOriginal: number;
  /** La tienda puede pausarla sin borrarla */
  activa: boolean;
  /** Fecha y hora de publicación, que se muestra en la tarjeta */
  creadaEn: string;
  venceEn: string;
}

export type EstadoPromocion = 'vigente' | 'pausada' | 'caducada';

/** Lo que dura una promoción sin que nadie la toque */
export const VIGENCIA_MESES = 1;

/**
 * Un mes natural después de `desde`.
 *
 * Con `setMonth` a secas, el 31 de enero se convierte en el 3 de marzo (febrero
 * no tiene 31). Cuando eso pasa se recorta al último día del mes que toca.
 */
export function vencimientoDesde(desde: Date | string = new Date()): string {
  const d = new Date(desde);
  const mesDestino = (d.getMonth() + VIGENCIA_MESES) % 12;
  d.setMonth(d.getMonth() + VIGENCIA_MESES);
  if (d.getMonth() !== mesDestino) d.setDate(0);
  return d.toISOString();
}

/** ¿Ya pasó su fecha de vencimiento? */
export function promocionCaducada(
  p: Pick<Promocion, 'venceEn'>,
  ahora: Date = new Date(),
): boolean {
  const vence = new Date(p.venceEn).getTime();
  return !Number.isFinite(vence) || vence <= ahora.getTime();
}

/** ¿Se muestra y se cobra? Solo si la tienda no la pausó y no ha caducado. */
export function promocionVigente(
  p: Pick<Promocion, 'activa' | 'venceEn'>,
  ahora: Date = new Date(),
): boolean {
  return p.activa !== false && !promocionCaducada(p, ahora);
}

export function estadoPromocion(
  p: Pick<Promocion, 'activa' | 'venceEn'>,
  ahora: Date = new Date(),
): EstadoPromocion {
  if (promocionCaducada(p, ahora)) return 'caducada';
  return p.activa === false ? 'pausada' : 'vigente';
}

/** Descuento en porcentaje entero (0 si no se puede calcular) */
export function descuentoPorcentaje(p: Pick<Promocion, 'precioPromo' | 'precioOriginal'>): number {
  const original = Number(p.precioOriginal);
  const promo = Number(p.precioPromo);
  if (!(original > 0) || !(promo >= 0) || promo >= original) return 0;
  return Math.round((1 - promo / original) * 100);
}

/** "18 de septiembre, 2:30 p.m." — la publicación que se muestra en la tarjeta */
export function fechaPublicacion(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(d);
}

/** Normaliza una fila de la base (lo que falte toma un valor seguro) */
export function normalizarPromocion(id: string, data: any): Promocion | null {
  const articuloId = String(data?.articuloId || '');
  const tiendaId = String(data?.tiendaId || '');
  if (!articuloId || !tiendaId) return null;
  const creadaEn = String(data?.creadaEn || '');
  return {
    id,
    tiendaId,
    tiendaNombre: data?.tiendaNombre ? String(data.tiendaNombre) : '',
    articuloId,
    titulo: String(data?.titulo || ''),
    bannerUrl: String(data?.bannerUrl || ''),
    precioPromo: Number(data?.precioPromo) || 0,
    precioOriginal: Number(data?.precioOriginal) || 0,
    activa: data?.activa !== false,
    creadaEn,
    venceEn: String(data?.venceEn || vencimientoDesde(creadaEn || new Date())),
  };
}

/* ---------------- Estado compartido, en vivo y una sola vez ---------------- */

const promociones = ref<Promocion[]>([]);
let suscrito = false;

function asegurarSuscripcion() {
  if (suscrito) return;
  suscrito = true;
  onValue(
    dbRef(db, 'promociones'),
    (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      promociones.value = Object.entries(data)
        .map(([id, p]) => normalizarPromocion(id, p))
        .filter((p): p is Promocion => p !== null);
    },
    (e) => console.error('❌ Error leyendo promociones:', e),
  );
}

/** Solo para pruebas: fija las promociones sin Firebase (null vuelve a suscribirse) */
export function __setPromociones(lista: Promocion[] | null) {
  suscrito = lista !== null;
  promociones.value = lista || [];
}

/* ---------------- Escrituras (panel de la tienda) ---------------- */

export interface DatosPromocion {
  tiendaId: string;
  tiendaNombre?: string;
  articuloId: string;
  titulo: string;
  bannerUrl: string;
  precioPromo: number;
  precioOriginal: number;
}

/** Crea la promoción con un mes de vigencia a partir de ahora */
export async function crearPromocion(datos: DatosPromocion): Promise<string> {
  const nueva = push(dbRef(db, 'promociones'));
  const id = nueva.key!;
  const creadaEn = new Date().toISOString();
  await set(nueva, {
    id,
    ...datos,
    activa: true,
    creadaEn,
    venceEn: vencimientoDesde(creadaEn),
  });
  return id;
}

/** Cambia lo editable. Tocar el precio NO reinicia la vigencia: eso es renovar. */
export async function actualizarPromocion(
  id: string,
  cambios: Partial<Pick<Promocion, 'titulo' | 'bannerUrl' | 'precioPromo' | 'precioOriginal' | 'activa'>>,
): Promise<void> {
  await update(dbRef(db, `promociones/${id}`), cambios);
}

export async function pausarPromocion(id: string, activa: boolean): Promise<void> {
  await update(dbRef(db, `promociones/${id}`), { activa });
}

/** Le da otro mes desde hoy y la reactiva: es lo que se hace con una caducada */
export async function renovarPromocion(id: string): Promise<void> {
  const creadaEn = new Date().toISOString();
  await update(dbRef(db, `promociones/${id}`), {
    activa: true,
    creadaEn,
    venceEn: vencimientoDesde(creadaEn),
  });
}

export async function eliminarPromocion(id: string): Promise<void> {
  await remove(dbRef(db, `promociones/${id}`));
}

/* ---------------- Lectura ---------------- */

export function usePromociones() {
  asegurarSuscripcion();

  /** Todas las vigentes, más recientes primero */
  const vigentes = computed(() =>
    promociones.value
      .filter((p) => promocionVigente(p))
      .sort((a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime()),
  );

  /** Las de una tienda, para su panel (incluye pausadas y caducadas) */
  const dePorTienda = (tiendaId: unknown) =>
    promociones.value
      .filter((p) => p.tiendaId === String(tiendaId || ''))
      .sort((a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime());

  /** La promoción vigente de un artículo, si tiene */
  const promoDeArticulo = (articuloId: unknown): Promocion | null =>
    vigentes.value.find((p) => p.articuloId === String(articuloId || '')) || null;

  /**
   * Lo que cuesta hoy un artículo: el precio de la promoción si tiene una
   * vigente, o el suyo. Es lo que ven las listas y lo que se guarda en el
   * carrito al agregarlo.
   */
  const precioDe = (producto: Pick<Producto, 'articuloId' | 'precio'>): number => {
    const promo = promoDeArticulo(producto.articuloId);
    return promo ? promo.precioPromo : Number(producto.precio) || 0;
  };

  return { promociones, vigentes, dePorTienda, promoDeArticulo, precioDe };
}
