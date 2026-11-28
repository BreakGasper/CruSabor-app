import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, set, update, remove, push, onValue, type Unsubscribe } from '@/services/baseDatos';
import { eliminarImagenes } from '@/composables/useCloudinary';
import { tiendasSinMembresiaVigente, MENSAJE_SIN_MEMBRESIA } from '@/composables/useMembresia';
import {
  CATEGORIAS_SERVICIO,
  CONTRATACIONES,
  MODALIDADES_ATENCION,
  TIPOS_PRECIO,
  type Contratacion,
  type ModalidadAtencion,
  type Servicio,
  type TipoPrecio,
} from './tipos';
import { duracionValida, DURACION_MAX_MIN } from './disponibilidad';
import { atiendeADomicilio, atiendeEnLocal } from './negocio';

/**
 * Catálogo de servicios de una tienda (su "portafolio de trabajo"): `servicios/{tiendaId}/{servicioId}`.
 * Un servicio NO es un artículo: no va al carrito, se contrata con una cotización o con una cita.
 */

export class ErrorServicio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorServicio';
  }
}

export const MAX_FOTOS_SERVICIO = 6;
export const PRECIO_MAX = 10_000_000;

/* ------------------------------ Datos de edición ------------------------------ */

export interface DatosServicio {
  nombre: string;
  descripcion: string;
  fotos: string[];
  categoria: string;
  tipoPrecio: TipoPrecio;
  precio: number;
  /** Minutos; 0 = sin duración (solo se puede si el servicio no se agenda) */
  duracionMin: number;
  modalidad: ModalidadAtencion;
  contratacion: Contratacion;
  activo: boolean;
}

export const servicioVacio = (modalidad: ModalidadAtencion = 'local'): DatosServicio => ({
  nombre: '',
  descripcion: '',
  fotos: [],
  categoria: '',
  tipoPrecio: 'cotizar',
  precio: 0,
  duracionMin: 0,
  modalidad,
  contratacion: 'cotizacion', // la agenda de citas llega en otro módulo: por ahora se contrata cotizando
  activo: true,
});

/** Modalidades que puede elegir un servicio según dónde atiende la tienda (un servicio no puede ir más allá de ella) */
export function modalidadesPermitidas(tienda: ModalidadAtencion): ModalidadAtencion[] {
  if (tienda === 'ambas') return [...MODALIDADES_ATENCION];
  return [tienda];
}

export function validarServicio(d: DatosServicio, modalidadTienda: ModalidadAtencion = 'ambas'): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre del servicio.';
  else if (d.nombre.trim().length > 80) e.nombre = 'El nombre es demasiado largo (máximo 80).';
  if (d.descripcion.length > 1000) e.descripcion = 'La descripción es demasiado larga (máximo 1000).';
  if (!CATEGORIAS_SERVICIO.some((c) => c.id === d.categoria)) e.categoria = 'Elige una categoría.';
  if (!(TIPOS_PRECIO as readonly string[]).includes(d.tipoPrecio)) e.tipoPrecio = 'Elige cómo cobras.';
  else if (d.tipoPrecio !== 'cotizar' && !(d.precio > 0 && d.precio <= PRECIO_MAX)) e.precio = 'Escribe un precio mayor a cero.';
  if (!(CONTRATACIONES as readonly string[]).includes(d.contratacion)) e.contratacion = 'Elige cómo se contrata.';
  const seAgenda = d.contratacion === 'cita' || d.contratacion === 'ambas';
  if (seAgenda && !duracionValida(d.duracionMin)) e.duracionMin = 'Indica la duración (múltiplo de 15 minutos).';
  else if (!seAgenda && d.duracionMin && !duracionValida(d.duracionMin)) e.duracionMin = `La duración debe ser múltiplo de 15 minutos (máximo ${DURACION_MAX_MIN / 60} h).`;
  if (d.tipoPrecio === 'cotizar' && d.contratacion === 'cita') e.contratacion = 'Un servicio a cotizar no se puede agendar sin cotización: elige "cotización" o "ambas".';
  if (!modalidadesPermitidas(modalidadTienda).includes(d.modalidad)) e.modalidad = 'Tu tienda no atiende de esa forma (cámbialo en «Editar mi tienda»).';
  if (d.fotos.length > MAX_FOTOS_SERVICIO) e.fotos = `Máximo ${MAX_FOTOS_SERVICIO} fotos.`;
  return e;
}

/** Lo que se guarda (Firebase no admite undefined; lo vacío se omite) */
export function normalizarServicio(d: DatosServicio): Record<string, unknown> {
  const limpio: Record<string, unknown> = {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim(),
    fotos: d.fotos.filter((f) => typeof f === 'string' && f.trim()),
    categoria: d.categoria,
    tipoPrecio: d.tipoPrecio,
    precio: d.tipoPrecio === 'cotizar' ? 0 : Math.round(d.precio * 100) / 100,
    modalidad: d.modalidad,
    contratacion: d.contratacion,
    activo: d.activo !== false,
  };
  if (d.duracionMin > 0) limpio.duracionMin = d.duracionMin;
  return limpio;
}

/* ------------------------------ Presentación ------------------------------ */

const mxn = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** "$350", "Desde $350" o "A cotizar" */
export function etiquetaPrecio(s: Pick<Servicio, 'tipoPrecio' | 'precio'>): string {
  if (s.tipoPrecio === 'cotizar' || !(s.precio > 0)) return 'A cotizar';
  return s.tipoPrecio === 'desde' ? `Desde ${mxn(s.precio)}` : mxn(s.precio);
}

/** 45 -> "45 min", 60 -> "1 h", 90 -> "1 h 30 min"; '' si no hay duración */
export function etiquetaDuracion(min?: number): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const ETIQUETA_CONTRATACION: Record<Contratacion, string> = {
  cita: 'Con cita',
  cotizacion: 'Con cotización',
  ambas: 'Cita o cotización',
};

export const puedeCotizar = (s: Pick<Servicio, 'contratacion'>) => s.contratacion === 'cotizacion' || s.contratacion === 'ambas';
export const sePuedeAgendar = (s: Pick<Servicio, 'contratacion'>) => s.contratacion === 'cita' || s.contratacion === 'ambas';

/** Modalidades en palabras para una tarjeta: "En establecimiento", "A domicilio" o ambas */
export function etiquetaModalidad(m: ModalidadAtencion): string {
  return atiendeEnLocal(m) && atiendeADomicilio(m) ? 'En establecimiento y a domicilio' : atiendeADomicilio(m) ? 'A domicilio' : 'En establecimiento';
}

/* ------------------------------ Lectura ------------------------------ */

function aServicio(tiendaId: string, id: string, v: any): Servicio {
  return {
    id,
    tiendaId,
    nombre: String(v?.nombre ?? ''),
    descripcion: String(v?.descripcion ?? ''),
    fotos: Array.isArray(v?.fotos) ? v.fotos.filter((f: unknown) => typeof f === 'string') : Object.values(v?.fotos ?? {}).filter((f): f is string => typeof f === 'string'),
    categoria: String(v?.categoria ?? ''),
    tipoPrecio: (TIPOS_PRECIO as readonly string[]).includes(v?.tipoPrecio) ? v.tipoPrecio : 'cotizar',
    precio: Number(v?.precio) || 0,
    duracionMin: Number(v?.duracionMin) || 0,
    modalidad: (MODALIDADES_ATENCION as readonly string[]).includes(v?.modalidad) ? v.modalidad : 'local',
    contratacion: (CONTRATACIONES as readonly string[]).includes(v?.contratacion) ? v.contratacion : 'cotizacion',
    profesionalIds: Array.isArray(v?.profesionalIds) ? v.profesionalIds : [],
    activo: v?.activo !== false,
    orden: Number(v?.orden) || 0,
    creadoEn: v?.creadoEn || '',
  };
}

const ordenar = (l: Servicio[]) => [...l].sort((a, b) => a.orden - b.orden || String(a.creadoEn).localeCompare(String(b.creadoEn)));

/** Servicios de una tienda en vivo. `soloActivos` para lo que ven los clientes. */
export function useServiciosTienda(tiendaId: () => string | undefined, soloActivos = false): { servicios: Ref<Servicio[]>; cargando: Ref<boolean> } {
  const servicios = ref<Servicio[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  function observar() {
    off?.();
    off = null;
    const id = tiendaId();
    if (!id) {
      servicios.value = [];
      cargando.value = false;
      return;
    }
    cargando.value = true;
    off = onValue(dbRef(db, `servicios/${id}`), (snap) => {
      const lista = Object.entries(snap.val() || {}).map(([sid, v]) => aServicio(id, sid, v));
      servicios.value = ordenar(soloActivos ? lista.filter((s) => s.activo) : lista);
      cargando.value = false;
    });
  }
  onMounted(observar);
  watch(tiendaId, observar);
  onUnmounted(() => off?.());
  return { servicios, cargando };
}

export async function obtenerServicio(tiendaId: string, servicioId: string): Promise<Servicio | null> {
  if (!tiendaId || !servicioId) return null;
  const s = await get(dbRef(db, `servicios/${tiendaId}/${servicioId}`));
  return s.exists() ? aServicio(tiendaId, servicioId, s.val()) : null;
}

/* ------------------------------ Escritura (la tienda) ------------------------------ */

/** Crea (id null) o actualiza un servicio. Exige membresía vigente, igual que publicar un producto. */
export async function guardarServicio(tiendaId: string, id: string | null, datos: DatosServicio, modalidadTienda: ModalidadAtencion = 'ambas'): Promise<string> {
  const errores = validarServicio(datos, modalidadTienda);
  const primero = Object.values(errores)[0];
  if (primero) throw new ErrorServicio(primero);
  if ((await tiendasSinMembresiaVigente([tiendaId])).length) throw new ErrorServicio(MENSAJE_SIN_MEMBRESIA);

  const limpio = normalizarServicio(datos);
  if (id) {
    const previo = await get(dbRef(db, `servicios/${tiendaId}/${id}/fotos`));
    const antes: string[] = previo.exists() ? Object.values(previo.val()) : [];
    // `set` solo de los campos editables: no se pierde `creadoEn` ni `orden`
    await update(dbRef(db, `servicios/${tiendaId}/${id}`), { ...limpio, duracionMin: limpio.duracionMin ?? null });
    // Ya guardado: las fotos que se quitaron quedan sin uso
    void eliminarImagenes(antes.filter((f) => !datos.fotos.includes(f)));
    return id;
  }
  const nuevo = push(dbRef(db, `servicios/${tiendaId}`));
  await set(nuevo, { ...limpio, orden: Date.now(), creadoEn: new Date().toISOString() });
  return nuevo.key!;
}

export async function alternarServicio(tiendaId: string, id: string, activo: boolean): Promise<void> {
  await update(dbRef(db, `servicios/${tiendaId}/${id}`), { activo });
}

export async function eliminarServicio(tiendaId: string, id: string): Promise<void> {
  const previo = await get(dbRef(db, `servicios/${tiendaId}/${id}/fotos`));
  await remove(dbRef(db, `servicios/${tiendaId}/${id}`));
  if (previo.exists()) void eliminarImagenes(Object.values(previo.val()));
}
