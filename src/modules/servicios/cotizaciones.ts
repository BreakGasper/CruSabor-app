import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, update, push, onValue, query, orderByChild, equalTo, runTransaction, type Unsubscribe } from '@/services/baseDatos';
import { estadoEfectivo } from '@/composables/useMembresia';
import { numeroParaWhatsapp } from '@/utils/whatsappCliente';
import { esFechaISO, ahoraEnZona, sumarDias } from './disponibilidad';
import { estadoEfectivoCotizacion, puedeCambiarCotizacion, type Actor } from './estados';
import { ofreceServicios } from './negocio';
import { ErrorServicio, PRECIO_MAX } from './catalogo';
import type { Cotizacion, EstadoCotizacion, EventoHistorial, RespuestaCotizacion } from './tipos';

/**
 * Cotizaciones: el cliente describe lo que necesita, la tienda responde con un precio y el cliente acepta o rechaza.
 *
 *   cotizaciones/{tiendaId}/{cotId}              la solicitud (estado, respuesta, historial)
 *   cotizacionesPorCliente/{clienteId}/{cotId}   { tiendaId }  (índice para "Mis cotizaciones")
 *   clientesServicio/{tiendaId}/{clienteId}      resumen del cliente para la tienda
 *
 * Los cambios de estado se hacen con TRANSACCIÓN sobre la cotización: si la tienda y el cliente actúan a la vez, solo
 * uno gana y el otro recibe un aviso claro (por ejemplo, no se puede aceptar una cotización que ya se rechazó).
 */

export const MAX_IMAGENES_COTIZACION = 4;
export const MAX_COTIZACIONES_ABIERTAS = 5; // por cliente y tienda, contra el abuso
const ABIERTAS: readonly EstadoCotizacion[] = ['pendiente', 'en_revision', 'cotizada'];

/* ------------------------------ Solicitud del cliente ------------------------------ */

export interface SolicitudCotizacion {
  servicio: { id: string; nombre: string; modalidad?: string };
  cliente: { id: string; nombre?: string; telefono?: string };
  descripcion: string;
  imagenes: string[];
  fechaTentativa?: string;
  adomicilio: boolean;
  direccion?: string;
}

export function validarSolicitud(s: SolicitudCotizacion, hoy: string = ahoraEnZona().fecha): Record<string, string> {
  const e: Record<string, string> = {};
  const texto = s.descripcion.trim();
  if (texto.length < 10) e.descripcion = 'Cuéntanos qué necesitas (al menos 10 caracteres).';
  else if (texto.length > 2000) e.descripcion = 'El texto es demasiado largo (máximo 2000).';
  if (s.imagenes.length > MAX_IMAGENES_COTIZACION) e.imagenes = `Máximo ${MAX_IMAGENES_COTIZACION} imágenes.`;
  if (s.fechaTentativa) {
    if (!esFechaISO(s.fechaTentativa)) e.fechaTentativa = 'La fecha no es válida.';
    else if (s.fechaTentativa < hoy) e.fechaTentativa = 'La fecha tentativa no puede ser pasada.';
  }
  if (s.adomicilio && s.servicio.modalidad === 'local') e.adomicilio = 'Este servicio solo se da en el establecimiento.';
  else if (s.adomicilio && (s.direccion ?? '').trim().length < 5) e.direccion = 'Escribe la dirección donde se haría el servicio.';
  if (!s.cliente.id) e.cliente = 'Inicia sesión para pedir una cotización.';
  return e;
}

const nuevoEvento = (estado: string, por: EventoHistorial['por'], nota?: string, ahora = new Date()): EventoHistorial => ({
  fecha: ahora.toISOString(),
  estado,
  por,
  ...(nota ? { nota } : {}),
});

/** Crea la solicitud (estado «pendiente»). Devuelve el id. */
export async function crearCotizacion(tiendaId: string, s: SolicitudCotizacion, ahora: Date = new Date()): Promise<string> {
  const primero = Object.values(validarSolicitud(s, ahoraEnZona(ahora).fecha))[0];
  if (primero) throw new ErrorServicio(primero);

  const t = await get(dbRef(db, `tiendas/${tiendaId}`));
  if (!t.exists()) throw new ErrorServicio('Esta tienda ya no existe.');
  const tienda = t.val();
  if (!ofreceServicios(tienda)) throw new ErrorServicio('Esta tienda no ofrece servicios.');
  if (estadoEfectivo({ estatus: tienda.estatus, membresia: tienda.membresia }, ahora) !== 'activa') throw new ErrorServicio('Esta tienda no está disponible por el momento.');

  // Tope de solicitudes abiertas del mismo cliente en la misma tienda
  const previas = await get(query(dbRef(db, `cotizaciones/${tiendaId}`), orderByChild('clienteId'), equalTo(s.cliente.id)));
  const abiertas = Object.values(previas.val() ?? {}).filter((c: any) => ABIERTAS.includes(c?.estado) && estadoEfectivoCotizacion(c, ahoraEnZona(ahora).fecha) !== 'vencida').length;
  if (abiertas >= MAX_COTIZACIONES_ABIERTAS) throw new ErrorServicio('Ya tienes varias cotizaciones abiertas con esta tienda. Espera su respuesta antes de pedir otra.');

  const id = push(dbRef(db, `cotizaciones/${tiendaId}`)).key!;
  const doc: Record<string, unknown> = {
    tiendaNombre: String(tienda.nombreTienda ?? ''),
    tiendaTelefono: String(tienda.telefono ?? ''),
    servicioId: s.servicio.id,
    servicioNombre: s.servicio.nombre,
    clienteId: s.cliente.id,
    clienteNombre: s.cliente.nombre ?? '',
    clienteTelefono: s.cliente.telefono ?? '',
    descripcion: s.descripcion.trim(),
    adomicilio: !!s.adomicilio,
    estado: 'pendiente',
    creadaEn: ahora.toISOString(),
    historial: { inicio: nuevoEvento('pendiente', 'cliente', undefined, ahora) },
  };
  if (s.imagenes.length) doc.imagenes = s.imagenes;
  if (s.fechaTentativa) doc.fechaTentativa = s.fechaTentativa;
  if (s.adomicilio && s.direccion?.trim()) doc.direccion = s.direccion.trim();

  // Todo o nada: la solicitud y su índice del cliente en una sola escritura
  await update(dbRef(db), {
    [`cotizaciones/${tiendaId}/${id}`]: doc,
    [`cotizacionesPorCliente/${s.cliente.id}/${id}`]: { tiendaId },
  });
  await registrarClienteServicio(tiendaId, s.cliente, ahora);
  return id;
}

/** Resumen del cliente para la tienda (cuántas cotizaciones y cuándo fue lo último) */
async function registrarClienteServicio(tiendaId: string, c: { id: string; nombre?: string; telefono?: string }, ahora: Date) {
  try {
    await runTransaction(dbRef(db, `clientesServicio/${tiendaId}/${c.id}`), (actual: any) => ({
      ...(actual ?? {}),
      clienteId: c.id,
      nombre: c.nombre || actual?.nombre || 'Cliente',
      telefono: c.telefono || actual?.telefono || '',
      citas: Number(actual?.citas) || 0,
      cotizaciones: (Number(actual?.cotizaciones) || 0) + 1,
      ultimaActividad: ahora.toISOString(),
    }));
  } catch (e) {
    console.warn('No se pudo actualizar el resumen del cliente:', e); // la cotización ya quedó guardada
  }
}

/* ------------------------------ Cambios de estado (transacción) ------------------------------ */

interface Cambio {
  estado: EstadoCotizacion;
  respuesta?: RespuestaCotizacion;
  nota?: string;
}

async function transicionar(
  tiendaId: string,
  id: string,
  quien: Actor,
  cambio: Cambio,
  ahora: Date,
  precondicion?: (actual: Cotizacion) => string | null,
): Promise<void> {
  let error: string | null = null;
  const hoy = ahoraEnZona(ahora).fecha;
  const r = await runTransaction(dbRef(db, `cotizaciones/${tiendaId}/${id}`), (actual: any) => {
    if (actual === null) return actual; // aún sin datos locales: Firebase repite con el valor real
    const efectivo = estadoEfectivoCotizacion(actual, hoy);
    if (!puedeCambiarCotizacion(efectivo, cambio.estado, quien)) {
      error = efectivo === 'vencida' ? 'Esta cotización ya venció.' : `Esta cotización ya está «${efectivo.replace('_', ' ')}»: no se puede pasar a «${cambio.estado.replace('_', ' ')}».`;
      return undefined; // aborta
    }
    const motivo = precondicion?.(actual as Cotizacion);
    if (motivo) {
      error = motivo;
      return undefined;
    }
    const clave = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    return {
      ...actual,
      estado: cambio.estado,
      ...(cambio.respuesta ? { respuesta: cambio.respuesta } : {}),
      historial: { ...(actual.historial ?? {}), [clave]: nuevoEvento(cambio.estado, quien, cambio.nota, ahora) },
    };
  });
  if (!r.committed) throw new ErrorServicio(error ?? 'No se pudo actualizar la cotización. Intenta de nuevo.');
  if (!r.snapshot.exists()) throw new ErrorServicio('Esta cotización ya no existe.');
}

export interface DatosRespuesta {
  precio: number;
  descripcion?: string;
  condiciones?: string;
  /** AAAA-MM-DD: último día para aceptar */
  venceEl: string;
}

export function validarRespuesta(d: DatosRespuesta, hoy: string = ahoraEnZona().fecha): Record<string, string> {
  const e: Record<string, string> = {};
  if (!(d.precio > 0 && d.precio <= PRECIO_MAX)) e.precio = 'Escribe un precio mayor a cero.';
  if (!esFechaISO(d.venceEl)) e.venceEl = 'Elige hasta cuándo es válida.';
  else if (d.venceEl < hoy) e.venceEl = 'La vigencia no puede ser pasada.';
  if ((d.descripcion ?? '').length > 1000) e.descripcion = 'La descripción es demasiado larga (máximo 1000).';
  if ((d.condiciones ?? '').length > 1000) e.condiciones = 'Las condiciones son demasiado largas (máximo 1000).';
  return e;
}

/** Vigencia sugerida: 7 días a partir de hoy */
export const vigenciaSugerida = (ahora: Date = new Date()) => sumarDias(ahoraEnZona(ahora).fecha, 7);

/** La tienda responde con un precio (de «pendiente» o «en revisión» a «cotizada») */
export async function responderCotizacion(tiendaId: string, id: string, d: DatosRespuesta, ahora: Date = new Date()): Promise<void> {
  const primero = Object.values(validarRespuesta(d, ahoraEnZona(ahora).fecha))[0];
  if (primero) throw new ErrorServicio(primero);
  const respuesta: RespuestaCotizacion = {
    precio: Math.round(d.precio * 100) / 100,
    venceEl: d.venceEl,
    respondidaEn: ahora.toISOString(),
    ...(d.descripcion?.trim() ? { descripcion: d.descripcion.trim() } : {}),
    ...(d.condiciones?.trim() ? { condiciones: d.condiciones.trim() } : {}),
  };
  await transicionar(tiendaId, id, 'tienda', { estado: 'cotizada', respuesta }, ahora);
}

export const marcarEnRevision = (tiendaId: string, id: string, ahora = new Date()) => transicionar(tiendaId, id, 'tienda', { estado: 'en_revision' }, ahora);
export const rechazarComoTienda = (tiendaId: string, id: string, motivo?: string, ahora = new Date()) => transicionar(tiendaId, id, 'tienda', { estado: 'rechazada', nota: motivo?.trim() || undefined }, ahora);
export const completarCotizacion = (tiendaId: string, id: string, ahora = new Date()) => transicionar(tiendaId, id, 'tienda', { estado: 'completada' }, ahora);
export const aceptarCotizacion = (tiendaId: string, id: string, ahora = new Date()) => transicionar(tiendaId, id, 'cliente', { estado: 'aceptada' }, ahora);
export const rechazarComoCliente = (tiendaId: string, id: string, ahora = new Date()) => transicionar(tiendaId, id, 'cliente', { estado: 'rechazada' }, ahora);

/* ------------------------------ Lectura ------------------------------ */

function aCotizacion(tiendaId: string, id: string, v: any): Cotizacion {
  const imagenes = Array.isArray(v?.imagenes) ? v.imagenes : Object.values(v?.imagenes ?? {});
  return {
    id,
    tiendaId,
    tiendaNombre: v?.tiendaNombre || '',
    tiendaTelefono: v?.tiendaTelefono || '',
    servicioId: String(v?.servicioId ?? ''),
    servicioNombre: String(v?.servicioNombre ?? ''),
    clienteId: String(v?.clienteId ?? ''),
    clienteNombre: String(v?.clienteNombre ?? ''),
    clienteTelefono: String(v?.clienteTelefono ?? ''),
    descripcion: String(v?.descripcion ?? ''),
    imagenes: imagenes.filter((x: unknown): x is string => typeof x === 'string'),
    fechaTentativa: v?.fechaTentativa || '',
    adomicilio: !!v?.adomicilio,
    direccion: v?.direccion || '',
    estado: v?.estado ?? 'pendiente',
    respuesta: v?.respuesta,
    creadaEn: String(v?.creadaEn ?? ''),
    historial: v?.historial,
  };
}

const masNuevasPrimero = (l: Cotizacion[]) => [...l].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));

/** Solicitudes que recibió la tienda, en vivo (las más nuevas primero) */
export function useCotizacionesTienda(tiendaId: () => string | undefined): { cotizaciones: Ref<Cotizacion[]>; cargando: Ref<boolean> } {
  const cotizaciones = ref<Cotizacion[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    const id = tiendaId();
    if (!id) {
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, `cotizaciones/${id}`), (snap) => {
      cotizaciones.value = masNuevasPrimero(Object.entries(snap.val() || {}).map(([cid, v]) => aCotizacion(id, cid, v)));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { cotizaciones, cargando };
}

/** Cotizaciones que pidió un cliente (de todas las tiendas). Se recarga al cambiar el índice y con `recargar()`. */
export function useCotizacionesCliente(clienteId: () => string | undefined): { cotizaciones: Ref<Cotizacion[]>; cargando: Ref<boolean>; recargar: () => Promise<void> } {
  const cotizaciones = ref<Cotizacion[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;

  async function recargar() {
    const cid = clienteId();
    if (!cid) {
      cotizaciones.value = [];
      cargando.value = false;
      return;
    }
    const indice = await get(dbRef(db, `cotizacionesPorCliente/${cid}`));
    const entradas = Object.entries(indice.val() ?? {}) as Array<[string, { tiendaId: string }]>;
    const docs = await Promise.all(entradas.map(([id, { tiendaId }]) => get(dbRef(db, `cotizaciones/${tiendaId}/${id}`)).then((s) => (s.exists() ? aCotizacion(tiendaId, id, s.val()) : null))));
    cotizaciones.value = masNuevasPrimero(docs.filter((c): c is Cotizacion => !!c));
    cargando.value = false;
  }

  onMounted(() => {
    const cid = clienteId();
    if (!cid) {
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, `cotizacionesPorCliente/${cid}`), () => void recargar());
  });
  onUnmounted(() => off?.());
  return { cotizaciones, cargando, recargar };
}

/* ------------------------------ Contacto ------------------------------ */

const primerNombre = (n: unknown) => String(n ?? '').trim().split(/\s+/)[0] ?? '';

/** "Mandar WhatsApp" de la tienda al cliente (o del cliente a la tienda) sobre una cotización. '' si el celular no sirve. */
export function enlaceWhatsappCotizacion(celular: unknown, c: Pick<Cotizacion, 'servicioNombre' | 'clienteNombre' | 'tiendaNombre'>, desde: Actor): string {
  const n = numeroParaWhatsapp(celular);
  if (!n) return '';
  const texto =
    desde === 'tienda'
      ? `Hola${c.clienteNombre ? ` ${primerNombre(c.clienteNombre)}` : ''}, te escribimos${c.tiendaNombre ? ` de ${c.tiendaNombre}` : ''} sobre tu cotización de «${c.servicioNombre}» en Crustore.`
      : `Hola${c.tiendaNombre ? `, ${c.tiendaNombre}` : ''}. Te escribo por mi cotización de «${c.servicioNombre}» en Crustore.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** Cuántas solicitudes esperan respuesta de la tienda (pendientes y en revisión) */
export const cotizacionesPorAtender = (l: Pick<Cotizacion, 'estado'>[]) => l.filter((c) => c.estado === 'pendiente' || c.estado === 'en_revision').length;
