import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, set, update, push, onValue, query, orderByChild, equalTo, runTransaction, type Unsubscribe } from '@/services/baseDatos';
import { estadoEfectivo } from '@/composables/useMembresia';
import { numeroParaWhatsapp } from '@/utils/whatsappCliente';
import {
  ahoraEnZona,
  aHora,
  aMinutos,
  bloquesDeCita,
  duracionValida,
  esFechaISO,
  horaFin,
  puedeReservar,
  rutasOcupacion,
  semanaDesdeHorarioTienda,
  validarSemana,
  claveBloque,
  BLOQUE_MIN,
  type Ahora,
} from './disponibilidad';
import { citaOcupaHorario, puedeCambiarCita, type Actor } from './estados';
import { atiendeADomicilio, ofreceServicios } from './negocio';
import { ErrorServicio, sePuedeAgendar } from './catalogo';
import { registrarActividadCliente } from './clientes';
import { PROFESIONAL_PRINCIPAL, type Cita, type Disponibilidad, type EstadoCita, type EventoHistorial, type Profesional, type Servicio } from './tipos';

/**
 * Agenda de citas.
 *
 *  - Profesionales: `profesionales/{tiendaId}/{profId}`. La persona dueña siempre existe como «principal».
 *  - Disponibilidad: `disponibilidad/{tiendaId}/{profId}` (horario semanal, descansos, bloqueos, vacaciones).
 *  - Citas: `citas/{tiendaId}/{citaId}`, índice del cliente en `citasPorCliente/{clienteId}/{citaId}`.
 *  - Ocupación: `ocupacion/{tiendaId}/{profId}/{fecha}/{HHmm}` = id de la cita, un nodo por bloque de 15 min.
 *
 * ANTI RESERVAS DOBLES: reservar es UNA escritura multi-ruta atómica (cita + índice + todos sus bloques) y las reglas de
 * la base (database.rules.json) rechazan cualquier bloque que ya exista. Si dos clientes piden el mismo horario, la base
 * deja pasar a uno y rechaza TODA la escritura del otro, que recibe un aviso claro. La lectura previa de esta capa solo
 * sirve para dar un mensaje amable en el caso normal; la garantía la da la base.
 */

export const MAX_CITAS_ABIERTAS = 5; // por cliente y tienda
const MENSAJE_OCUPADO = 'Ese horario acaba de ocuparse. Elige otro, por favor.';

/* ------------------------------ Profesionales ------------------------------ */

function aProfesional(tiendaId: string, id: string, v: any): Profesional {
  return { id, tiendaId, nombre: String(v?.nombre ?? ''), fotoUrl: v?.fotoUrl || '', especialidad: v?.especialidad || '', activo: v?.activo !== false };
}

/** Siempre incluye a la persona dueña («principal»), aunque no haya guardado nada */
function conPrincipal(tiendaId: string, nombreTienda: string, docs: Record<string, any>): Profesional[] {
  const lista = Object.entries(docs).map(([id, v]) => aProfesional(tiendaId, id, v));
  if (!lista.some((p) => p.id === PROFESIONAL_PRINCIPAL)) lista.unshift({ id: PROFESIONAL_PRINCIPAL, tiendaId, nombre: nombreTienda || 'Mi agenda', activo: true });
  return lista.sort((a, b) => (a.id === PROFESIONAL_PRINCIPAL ? -1 : b.id === PROFESIONAL_PRINCIPAL ? 1 : a.nombre.localeCompare(b.nombre)));
}

export async function listarProfesionales(tiendaId: string): Promise<Profesional[]> {
  const [p, t] = await Promise.all([get(dbRef(db, `profesionales/${tiendaId}`)), get(dbRef(db, `tiendas/${tiendaId}/nombreTienda`))]);
  return conPrincipal(tiendaId, t.exists() ? String(t.val()) : '', p.val() ?? {});
}

/** Equipo de la tienda en vivo */
export function useProfesionales(tiendaId: () => string | undefined): { profesionales: Ref<Profesional[]>; cargando: Ref<boolean> } {
  const profesionales = ref<Profesional[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(async () => {
    const id = tiendaId();
    if (!id) {
      cargando.value = false;
      return;
    }
    const nombre = await get(dbRef(db, `tiendas/${id}/nombreTienda`)).then((s) => (s.exists() ? String(s.val()) : ''));
    off = onValue(dbRef(db, `profesionales/${id}`), (snap) => {
      profesionales.value = conPrincipal(id, nombre, snap.val() ?? {});
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { profesionales, cargando };
}

export interface DatosProfesional {
  nombre: string;
  especialidad?: string;
  fotoUrl?: string;
  activo?: boolean;
}

export async function guardarProfesional(tiendaId: string, id: string | null, d: DatosProfesional): Promise<string> {
  const nombre = d.nombre.trim();
  if (!nombre) throw new ErrorServicio('Escribe el nombre del profesional.');
  if (nombre.length > 60) throw new ErrorServicio('El nombre es demasiado largo (máximo 60).');
  const doc = { nombre, especialidad: (d.especialidad ?? '').trim(), fotoUrl: d.fotoUrl || '', activo: d.activo !== false };
  if (id === PROFESIONAL_PRINCIPAL && doc.activo === false) throw new ErrorServicio('La persona dueña de la tienda no se puede desactivar.');
  const clave = id ?? push(dbRef(db, `profesionales/${tiendaId}`)).key!;
  await set(dbRef(db, `profesionales/${tiendaId}/${clave}`), doc);
  return clave;
}

/* ------------------------------ Disponibilidad ------------------------------ */

const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : Object.values((v as object) ?? {}) as T[]);

/** La del profesional; si aún no la configura, parte del horario que la tienda capturó al registrarse */
export async function leerDisponibilidad(tiendaId: string, profesionalId: string): Promise<Disponibilidad> {
  const s = await get(dbRef(db, `disponibilidad/${tiendaId}/${profesionalId}`));
  if (s.exists()) {
    const v = s.val();
    return { semana: v.semana ?? {}, anticipacionMin: v.anticipacionMin, maxDiasAdelante: v.maxDiasAdelante, bloqueos: lista(v.bloqueos), vacaciones: lista(v.vacaciones) };
  }
  const h = await get(dbRef(db, `tiendas/${tiendaId}/horario`));
  return { semana: semanaDesdeHorarioTienda(h.val()) };
}

export async function guardarDisponibilidad(tiendaId: string, profesionalId: string, d: Disponibilidad): Promise<void> {
  const errores = validarSemana(d.semana);
  if (errores.length) throw new ErrorServicio(errores[0]);
  for (const v of d.vacaciones ?? []) if (!esFechaISO(v.desde) || !esFechaISO(v.hasta) || v.hasta < v.desde) throw new ErrorServicio('Revisa las fechas de las vacaciones.');
  for (const b of d.bloqueos ?? []) if (!esFechaISO(b.fecha)) throw new ErrorServicio('Revisa la fecha de un bloqueo.');
  const semana: Record<string, unknown> = {};
  for (const [dia, h] of Object.entries(d.semana)) {
    semana[dia] = h ? { abre: h.abre, cierra: h.cierra, ...(h.descansos?.length ? { descansos: h.descansos } : {}) } : null;
  }
  const limpiar = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
  await set(dbRef(db, `disponibilidad/${tiendaId}/${profesionalId}`), {
    semana,
    anticipacionMin: d.anticipacionMin ?? 60,
    maxDiasAdelante: d.maxDiasAdelante ?? 60,
    ...(d.bloqueos?.length ? { bloqueos: d.bloqueos.map((b) => limpiar({ fecha: b.fecha, desde: b.desde, hasta: b.hasta, motivo: b.motivo })) } : {}),
    ...(d.vacaciones?.length ? { vacaciones: d.vacaciones.map((v) => limpiar({ desde: v.desde, hasta: v.hasta, motivo: v.motivo })) } : {}),
  });
}

/** Bloques ocupados de un profesional por fecha: { '2026-12-01': Set('0900','0915',…) } */
export async function leerOcupacion(tiendaId: string, profesionalId: string): Promise<Record<string, Set<string>>> {
  const s = await get(dbRef(db, `ocupacion/${tiendaId}/${profesionalId}`));
  const salida: Record<string, Set<string>> = {};
  for (const [fecha, bloques] of Object.entries(s.val() ?? {})) salida[fecha] = new Set(Object.keys(bloques as object));
  return salida;
}

/* ------------------------------ Reservar ------------------------------ */

export interface SolicitudCita {
  servicio: Pick<Servicio, 'id' | 'nombre' | 'duracionMin' | 'precio' | 'tipoPrecio' | 'modalidad' | 'contratacion' | 'profesionalIds'>;
  profesionalId: string;
  fecha: string;
  inicio: string;
  cliente: { id: string; nombre?: string; telefono?: string };
  comentarios?: string;
  adomicilio: boolean;
  direccion?: string;
}

export function validarSolicitudCita(s: SolicitudCita): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s.cliente.id) e.cliente = 'Inicia sesión para agendar.';
  if (!(s.cliente.nombre ?? '').trim()) e.nombre = 'Escribe tu nombre.';
  if (String(s.cliente.telefono ?? '').replace(/\D/g, '').length < 10) e.telefono = 'Escribe un celular de 10 dígitos.';
  if (!sePuedeAgendar(s.servicio)) e.servicio = 'Este servicio no se agenda: pide una cotización.';
  if (!duracionValida(s.servicio.duracionMin)) e.servicio = 'Este servicio no tiene una duración definida.';
  if (s.servicio.profesionalIds?.length && !s.servicio.profesionalIds.includes(s.profesionalId)) e.profesional = 'Ese profesional no ofrece este servicio.';
  if (!esFechaISO(s.fecha)) e.fecha = 'Elige una fecha.';
  if (aMinutos(s.inicio) === null) e.inicio = 'Elige una hora.';
  if ((s.comentarios ?? '').length > 500) e.comentarios = 'Los comentarios son demasiado largos (máximo 500).';
  if (s.adomicilio && !atiendeADomicilio(s.servicio.modalidad)) e.adomicilio = 'Este servicio solo se da en el establecimiento.';
  else if (s.adomicilio && (s.direccion ?? '').trim().length < 5) e.direccion = 'Escribe la dirección donde se haría el servicio.';
  return e;
}

const evento = (estado: string, por: EventoHistorial['por'], nota?: string, ahora = new Date()): EventoHistorial => ({
  fecha: ahora.toISOString(),
  estado,
  por,
  ...(nota ? { nota } : {}),
});

/** ¿Un error de Firebase es "la regla lo rechazó"? (un bloque ya estaba ocupado) */
const esRechazoDeRegla = (e: unknown) => /permission[_ ]denied/i.test(String((e as any)?.code ?? '') + String((e as any)?.message ?? ''));

/**
 * Reserva una cita (queda «pendiente» de confirmación). Devuelve su id.
 * Lanza ErrorServicio con un mensaje listo para mostrar.
 */
export async function reservarCita(tiendaId: string, s: SolicitudCita, ahora: Date = new Date()): Promise<string> {
  const primero = Object.values(validarSolicitudCita(s))[0];
  if (primero) throw new ErrorServicio(primero);

  const t = await get(dbRef(db, `tiendas/${tiendaId}`));
  if (!t.exists()) throw new ErrorServicio('Esta tienda ya no existe.');
  const tienda = t.val();
  if (!ofreceServicios(tienda)) throw new ErrorServicio('Esta tienda no ofrece servicios.');
  if (estadoEfectivo({ estatus: tienda.estatus, membresia: tienda.membresia }, ahora) !== 'activa') throw new ErrorServicio('Esta tienda no está disponible por el momento.');

  const profesionales = await listarProfesionales(tiendaId);
  const prof = profesionales.find((p) => p.id === s.profesionalId);
  if (!prof || !prof.activo) throw new ErrorServicio('Ese profesional no está disponible.');

  const hoy = ahoraEnZona(ahora);
  const [disp, ocupacion] = await Promise.all([leerDisponibilidad(tiendaId, s.profesionalId), leerOcupacion(tiendaId, s.profesionalId)]);
  if (!puedeReservar({ disp, fecha: s.fecha, duracionMin: s.servicio.duracionMin, inicio: s.inicio, ocupados: ocupacion[s.fecha], ahora: hoy })) throw new ErrorServicio(MENSAJE_OCUPADO);

  // Tope de citas abiertas del mismo cliente en la misma tienda
  const previas = await get(query(dbRef(db, `citas/${tiendaId}`), orderByChild('clienteId'), equalTo(s.cliente.id)));
  const abiertas = Object.values(previas.val() ?? {}).filter((c: any) => (c?.estado === 'pendiente' || c?.estado === 'confirmada') && c.fecha >= hoy.fecha).length;
  if (abiertas >= MAX_CITAS_ABIERTAS) throw new ErrorServicio('Ya tienes varias citas pendientes con esta tienda. Espera a que pasen o cancela alguna.');

  const id = push(dbRef(db, `citas/${tiendaId}`)).key!;
  const doc: Record<string, unknown> = {
    tiendaNombre: String(tienda.nombreTienda ?? ''),
    tiendaTelefono: String(tienda.telefono ?? ''),
    servicioId: s.servicio.id,
    servicioNombre: s.servicio.nombre,
    profesionalId: s.profesionalId,
    profesionalNombre: prof.nombre,
    clienteId: s.cliente.id,
    clienteNombre: (s.cliente.nombre ?? '').trim(),
    clienteTelefono: String(s.cliente.telefono ?? '').replace(/\D/g, '').slice(-10),
    fecha: s.fecha,
    inicio: s.inicio,
    fin: horaFin(s.inicio, s.servicio.duracionMin),
    duracionMin: s.servicio.duracionMin,
    tipoPrecio: s.servicio.tipoPrecio,
    precio: s.servicio.precio,
    adomicilio: !!s.adomicilio,
    estado: 'pendiente',
    creadaEn: ahora.toISOString(),
    historial: { inicio: evento('pendiente', 'cliente', undefined, ahora) },
  };
  if (s.adomicilio && s.direccion?.trim()) doc.direccion = s.direccion.trim();
  if (s.comentarios?.trim()) doc.comentarios = s.comentarios.trim();

  try {
    // TODO O NADA: la cita, su índice y todos sus bloques en una sola escritura. Si algún bloque ya existe, la base rechaza todo.
    await update(dbRef(db), {
      [`citas/${tiendaId}/${id}`]: doc,
      [`citasPorCliente/${s.cliente.id}/${id}`]: { tiendaId },
      ...rutasOcupacion(tiendaId, s.profesionalId, s.fecha, s.inicio, s.servicio.duracionMin, id),
    });
  } catch (e) {
    if (esRechazoDeRegla(e)) throw new ErrorServicio(MENSAJE_OCUPADO);
    throw e;
  }
  await registrarActividadCliente(tiendaId, s.cliente, 'cita', ahora);
  return id;
}

/* ------------------------------ Estados ------------------------------ */

/** ¿La cita ya empezó? (fecha y hora de inicio en la zona de la agenda) */
export function citaYaEmpezo(c: Pick<Cita, 'fecha' | 'inicio'>, ahora: Ahora = ahoraEnZona()): boolean {
  return c.fecha < ahora.fecha || (c.fecha === ahora.fecha && (aMinutos(c.inicio) ?? 0) <= ahora.minutos);
}

/** Libera los bloques de una cita (solo los que son suyos) */
async function liberarBloques(c: Pick<Cita, 'tiendaId' | 'profesionalId' | 'fecha' | 'inicio' | 'duracionMin'>, id: string) {
  const rutas = rutasOcupacion(c.tiendaId, c.profesionalId, c.fecha, c.inicio, c.duracionMin, null);
  const actuales = await Promise.all(Object.keys(rutas).map((r) => get(dbRef(db, r))));
  const propias: Record<string, null> = {};
  Object.keys(rutas).forEach((r, i) => {
    if (actuales[i].val() === id) propias[r] = null;
  });
  if (Object.keys(propias).length) await update(dbRef(db), propias);
}

/**
 * Cambia el estado de una cita con una TRANSACCIÓN: si la tienda y el cliente actúan a la vez, solo uno gana y el otro
 * recibe un aviso claro. Cancelar o rechazar libera el horario. El cliente solo puede cancelar citas que aún no empiezan;
 * la tienda solo puede marcar «completada» una cita que ya empezó.
 */
export async function cambiarEstadoCita(tiendaId: string, citaId: string, nuevo: EstadoCita, quien: Actor, nota?: string, ahora: Date = new Date()): Promise<void> {
  let error: string | null = null;
  const reloj = ahoraEnZona(ahora);
  const r = await runTransaction(dbRef(db, `citas/${tiendaId}/${citaId}`), (actual: any) => {
    if (actual === null) return actual;
    if (!puedeCambiarCita(actual.estado, nuevo, quien)) {
      error = `Esta cita ya está «${actual.estado}»: no se puede pasar a «${nuevo}».`;
      return undefined;
    }
    if (quien === 'cliente' && nuevo === 'cancelada' && citaYaEmpezo(actual, reloj)) {
      error = 'Esta cita ya empezó: contacta a la tienda.';
      return undefined;
    }
    if (nuevo === 'completada' && !citaYaEmpezo(actual, reloj)) {
      error = 'Solo puedes marcar como completada una cita que ya empezó.';
      return undefined;
    }
    const clave = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    return { ...actual, estado: nuevo, historial: { ...(actual.historial ?? {}), [clave]: evento(nuevo, quien, nota, ahora) } };
  });
  if (!r.committed) throw new ErrorServicio(error ?? 'No se pudo actualizar la cita. Intenta de nuevo.');
  if (!r.snapshot.exists()) throw new ErrorServicio('Esta cita ya no existe.');
  const c = { ...r.snapshot.val(), tiendaId };
  if (!citaOcupaHorario(nuevo)) await liberarBloques(c, citaId);
}

/**
 * Reprograma una cita (la tienda). Orden pensado para no perder ni duplicar horarios:
 *  1) se ocupan los bloques NUEVOS (la base rechaza si alguno ya existe);
 *  2) una transacción cambia la fecha/hora de la cita solo si sigue pendiente o confirmada y sin moverse;
 *  3) si ese paso falla, se devuelven los bloques nuevos; si sale bien, se liberan los viejos.
 */
export async function reprogramarCita(tiendaId: string, citaId: string, nueva: { fecha: string; inicio: string }, ahora: Date = new Date()): Promise<void> {
  const snap = await get(dbRef(db, `citas/${tiendaId}/${citaId}`));
  if (!snap.exists()) throw new ErrorServicio('Esta cita ya no existe.');
  const vieja = { ...snap.val(), tiendaId } as Cita;
  if (!(vieja.estado === 'pendiente' || vieja.estado === 'confirmada')) throw new ErrorServicio(`Una cita «${vieja.estado}» no se puede reprogramar.`);
  if (nueva.fecha === vieja.fecha && nueva.inicio === vieja.inicio) throw new ErrorServicio('Elige una fecha u hora distinta.');

  const [disp, ocupacion] = await Promise.all([leerDisponibilidad(tiendaId, vieja.profesionalId), leerOcupacion(tiendaId, vieja.profesionalId)]);
  // Para validar, los bloques de la propia cita no cuentan como ocupados
  const propios = new Set(bloquesDeCita(vieja.inicio, vieja.duracionMin));
  const ocupados = new Set([...(ocupacion[nueva.fecha] ?? [])].filter((b) => !(nueva.fecha === vieja.fecha && propios.has(b))));
  if (!puedeReservar({ disp, fecha: nueva.fecha, duracionMin: vieja.duracionMin, inicio: nueva.inicio, ocupados, ahora: ahoraEnZona(ahora) })) throw new ErrorServicio(MENSAJE_OCUPADO);

  const bloquesNuevos = rutasOcupacion(tiendaId, vieja.profesionalId, nueva.fecha, nueva.inicio, vieja.duracionMin, citaId);
  const bloquesViejos = rutasOcupacion(tiendaId, vieja.profesionalId, vieja.fecha, vieja.inicio, vieja.duracionMin, null);
  const soloNuevos = Object.fromEntries(Object.entries(bloquesNuevos).filter(([ruta]) => !(ruta in bloquesViejos)));
  const soloViejos = Object.fromEntries(Object.entries(bloquesViejos).filter(([ruta]) => !(ruta in bloquesNuevos)));

  try {
    if (Object.keys(soloNuevos).length) await update(dbRef(db), soloNuevos);
  } catch (e) {
    if (esRechazoDeRegla(e)) throw new ErrorServicio(MENSAJE_OCUPADO);
    throw e;
  }

  let error: string | null = null;
  const r = await runTransaction(dbRef(db, `citas/${tiendaId}/${citaId}`), (actual: any) => {
    if (actual === null) return actual;
    if (!(actual.estado === 'pendiente' || actual.estado === 'confirmada')) {
      error = `La cita cambió a «${actual.estado}» mientras tanto.`;
      return undefined;
    }
    if (actual.fecha !== vieja.fecha || actual.inicio !== vieja.inicio) {
      error = 'La cita ya se movió mientras tanto.';
      return undefined;
    }
    const clave = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    return {
      ...actual,
      fecha: nueva.fecha,
      inicio: nueva.inicio,
      fin: horaFin(nueva.inicio, vieja.duracionMin),
      historial: { ...(actual.historial ?? {}), [clave]: evento(actual.estado, 'tienda', `Reprogramada de ${vieja.fecha} ${vieja.inicio} a ${nueva.fecha} ${nueva.inicio}`, ahora) },
    };
  });
  if (!r.committed) {
    // Se devuelven los bloques nuevos: no quedan horarios retenidos por una cita que no se movió
    if (Object.keys(soloNuevos).length) await update(dbRef(db), Object.fromEntries(Object.keys(soloNuevos).map((k) => [k, null])));
    throw new ErrorServicio(error ?? 'No se pudo reprogramar la cita. Intenta de nuevo.');
  }
  if (Object.keys(soloViejos).length) await update(dbRef(db), soloViejos);
}

/* ------------------------------ Lectura ------------------------------ */

function aCita(tiendaId: string, id: string, v: any): Cita {
  return {
    id,
    tiendaId,
    tiendaNombre: v?.tiendaNombre || '',
    tiendaTelefono: v?.tiendaTelefono || '',
    servicioId: String(v?.servicioId ?? ''),
    servicioNombre: String(v?.servicioNombre ?? ''),
    profesionalId: String(v?.profesionalId ?? PROFESIONAL_PRINCIPAL),
    profesionalNombre: v?.profesionalNombre || '',
    clienteId: String(v?.clienteId ?? ''),
    clienteNombre: String(v?.clienteNombre ?? ''),
    clienteTelefono: String(v?.clienteTelefono ?? ''),
    fecha: String(v?.fecha ?? ''),
    inicio: String(v?.inicio ?? ''),
    fin: String(v?.fin ?? ''),
    duracionMin: Number(v?.duracionMin) || 0,
    precio: Number(v?.precio) || 0,
    tipoPrecio: v?.tipoPrecio,
    adomicilio: !!v?.adomicilio,
    direccion: v?.direccion || '',
    comentarios: v?.comentarios || '',
    estado: v?.estado ?? 'pendiente',
    creadaEn: String(v?.creadaEn ?? ''),
    historial: v?.historial,
  };
}

/** Por fecha y hora (la más próxima primero) */
export const porFechaAsc = (l: Cita[]) => [...l].sort((a, b) => `${a.fecha} ${a.inicio}`.localeCompare(`${b.fecha} ${b.inicio}`));

/** Citas de la tienda en vivo */
export function useCitasTienda(tiendaId: () => string | undefined): { citas: Ref<Cita[]>; cargando: Ref<boolean> } {
  const citas = ref<Cita[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    const id = tiendaId();
    if (!id) {
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, `citas/${id}`), (snap) => {
      citas.value = porFechaAsc(Object.entries(snap.val() || {}).map(([cid, v]) => aCita(id, cid, v)));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { citas, cargando };
}

/** Citas de un cliente (de todas las tiendas). Se recarga al cambiar el índice y con `recargar()`. */
export function useCitasCliente(clienteId: () => string | undefined): { citas: Ref<Cita[]>; cargando: Ref<boolean>; recargar: () => Promise<void> } {
  const citas = ref<Cita[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  async function recargar() {
    const cid = clienteId();
    if (!cid) {
      citas.value = [];
      cargando.value = false;
      return;
    }
    const indice = await get(dbRef(db, `citasPorCliente/${cid}`));
    const entradas = Object.entries(indice.val() ?? {}) as Array<[string, { tiendaId: string }]>;
    const docs = await Promise.all(entradas.map(([id, { tiendaId }]) => get(dbRef(db, `citas/${tiendaId}/${id}`)).then((s) => (s.exists() ? aCita(tiendaId, id, s.val()) : null))));
    citas.value = porFechaAsc(docs.filter((c): c is Cita => !!c));
    cargando.value = false;
  }
  onMounted(() => {
    const cid = clienteId();
    if (!cid) {
      cargando.value = false;
      return;
    }
    off = onValue(dbRef(db, `citasPorCliente/${cid}`), () => void recargar());
  });
  onUnmounted(() => off?.());
  return { citas, cargando, recargar };
}

/* ------------------------------ Contacto y conteos ------------------------------ */

const primerNombre = (n: unknown) => String(n ?? '').trim().split(/\s+/)[0] ?? '';

/** WhatsApp sobre una cita, de la tienda al cliente o del cliente a la tienda. '' si el celular no sirve. */
export function enlaceWhatsappCita(celular: unknown, c: Pick<Cita, 'servicioNombre' | 'clienteNombre' | 'tiendaNombre' | 'fecha' | 'inicio'>, desde: Actor): string {
  const n = numeroParaWhatsapp(celular);
  if (!n) return '';
  const cuando = `${c.fecha} a las ${c.inicio}`;
  const texto =
    desde === 'tienda'
      ? `Hola${c.clienteNombre ? ` ${primerNombre(c.clienteNombre)}` : ''}, te escribimos${c.tiendaNombre ? ` de ${c.tiendaNombre}` : ''} sobre tu cita de «${c.servicioNombre}» (${cuando}) en Crustore.`
      : `Hola${c.tiendaNombre ? `, ${c.tiendaNombre}` : ''}. Te escribo por mi cita de «${c.servicioNombre}» (${cuando}) en Crustore.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** Citas que esperan confirmación de la tienda */
export const citasPorConfirmar = (l: Pick<Cita, 'estado'>[]) => l.filter((c) => c.estado === 'pendiente').length;

/** Citas confirmadas (o por confirmar) de hoy en adelante, dentro de `dias` días */
export function citasProximas(l: Cita[], ahora: Ahora = ahoraEnZona(), dias = 7): Cita[] {
  const hasta = new Date(Date.UTC(+ahora.fecha.slice(0, 4), +ahora.fecha.slice(5, 7) - 1, +ahora.fecha.slice(8, 10) + dias)).toISOString().slice(0, 10);
  return porFechaAsc(l.filter((c) => (c.estado === 'confirmada' || c.estado === 'pendiente') && c.fecha >= ahora.fecha && c.fecha <= hasta && !(c.fecha === ahora.fecha && aMinutos(c.fin)! <= ahora.minutos)));
}

export { aHora, claveBloque, BLOQUE_MIN };
