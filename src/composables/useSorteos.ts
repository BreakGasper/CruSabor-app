import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, set, push, update, remove, onValue, runTransaction, type Unsubscribe } from '@/services/baseDatos';
import { eliminarImagenes } from '@/composables/useCloudinary';

/**
 * Sorteos patrocinados por tiendas.
 *
 * TODOS los clientes participan en el MISMO sorteo. Para entrar, el cliente escribe un código que le dio una tienda
 * patrocinadora: así se sabe qué tienda lo trajo, pero el premio y el sorteo son uno solo. Cada cliente participa una
 * vez por sorteo (su id es la llave de su participación).
 *
 *   sorteos/{id}                      { titulo, descripcion, premio, imagenUrl?, activo, fechaInicio, fechaFin, creadoEn, cerradoEn? }
 *   sorteos/{id}/codigos/{CODIGO}     { tiendaId, nombreTienda, logoUrl, activo, usos, limite, creadoEn }
 *   sorteos/{id}/ganadores/{pushId}   { clienteId, nombre, telefono, tiendaId, nombreTienda, codigo, fecha, por }
 *   sorteoParticipantes/{id}/{clienteId}  { nombre, telefono, codigo, tiendaId, nombreTienda, fecha }
 *
 * Los participantes viven aparte para que la lista pública de sorteos (que se lee en cada perfil) no los arrastre.
 */

export interface CodigoSorteo {
  codigo: string;
  tiendaId: string;
  nombreTienda: string;
  logoUrl?: string;
  activo: boolean;
  usos: number;
  /** 0 = sin límite de usos */
  limite: number;
  creadoEn?: string;
}

export interface Ganador {
  id: string;
  clienteId: string;
  nombre: string;
  telefono?: string;
  tiendaId?: string;
  nombreTienda?: string;
  codigo?: string;
  fecha: string;
  por?: string;
}

export interface Sorteo {
  id: string;
  titulo: string;
  descripcion: string;
  premio: string;
  /** Imagen del banner con la que sale en el carrusel de la pantalla principal (opcional) */
  imagenUrl?: string;
  activo: boolean;
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  creadoEn?: string;
  cerradoEn?: string;
  codigos: CodigoSorteo[];
  ganadores: Ganador[];
}

export interface Participante {
  clienteId: string;
  nombre: string;
  telefono?: string;
  codigo: string;
  tiendaId: string;
  nombreTienda?: string;
  fecha: string;
}

export interface ClienteSorteo {
  id: string;
  nombre?: string;
  telefono?: string;
}

/* ------------------------------------------------------------------ */
/* Reglas puras                                                        */
/* ------------------------------------------------------------------ */

/** Fecha de hoy en America/Mexico_City como YYYY-MM-DD */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Mayúsculas, sin espacios ni símbolos raros (se conserva el guion), máximo 24 caracteres */
export function normalizarCodigo(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L para que no se confundan al dictarlos

/** Código fácil de dictar: 4 letras del nombre de la tienda + 4 al azar. Ej. "LOLA-7K3Q" */
export function generarCodigo(nombreTienda: string, azar: () => number = Math.random): string {
  const letras = normalizarCodigo(nombreTienda).replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
  let cola = '';
  for (let i = 0; i < 4; i++) cola += ALFABETO[Math.floor(azar() * ALFABETO.length)];
  return `${letras}-${cola}`;
}

export type EstadoSorteo = 'pausado' | 'proximo' | 'abierto' | 'terminado' | 'sorteado';

/** Estado real hoy: pausado (apagado), próximo, abierto, terminado (pasó la fecha) o sorteado (ya hay ganador/cierre) */
export function estadoSorteo(s: Pick<Sorteo, 'activo' | 'fechaInicio' | 'fechaFin' | 'cerradoEn'>, hoy: string = hoyISO()): EstadoSorteo {
  if (s.cerradoEn) return 'sorteado';
  if (s.activo === false) return 'pausado';
  if (s.fechaInicio && hoy < s.fechaInicio) return 'proximo';
  if (s.fechaFin && hoy > s.fechaFin) return 'terminado';
  return 'abierto';
}

export const sorteoAbierto = (s: Parameters<typeof estadoSorteo>[0], hoy?: string) => estadoSorteo(s, hoy) === 'abierto';

export const ESTADO_SORTEO_LABEL: Record<EstadoSorteo, string> = {
  pausado: 'Pausado',
  proximo: 'Próximamente',
  abierto: 'Abierto',
  terminado: 'Participación cerrada',
  sorteado: 'Sorteado',
};

/** Tiendas patrocinadoras (una vez cada una, solo con código activo), para el carrusel de logos */
export function patrocinadores(s: Pick<Sorteo, 'codigos'>): { tiendaId: string; nombreTienda: string; logoUrl?: string }[] {
  const vistos = new Map<string, { tiendaId: string; nombreTienda: string; logoUrl?: string }>();
  for (const c of s.codigos) {
    if (!c.activo || !c.tiendaId) continue;
    const previo = vistos.get(c.tiendaId);
    if (!previo) vistos.set(c.tiendaId, { tiendaId: c.tiendaId, nombreTienda: c.nombreTienda, logoUrl: c.logoUrl });
    else if (!previo.logoUrl && c.logoUrl) previo.logoUrl = c.logoUrl;
  }
  return [...vistos.values()];
}

/** Días que un sorteo ya sorteado sigue a la vista (para que todos vean quién ganó) */
export const DIAS_VISIBLE_SORTEADO = 30;

/** Sorteos que se muestran a los clientes: todos menos los pausados; los ya sorteados solo durante un mes */
export function sorteosVisibles(lista: Sorteo[], ahora: Date = new Date()): Sorteo[] {
  const hoy = hoyISO(ahora);
  return lista.filter((s) => {
    const e = estadoSorteo(s, hoy);
    if (e === 'pausado') return false;
    if (e === 'sorteado') return !!s.cerradoEn && ahora.getTime() - new Date(s.cerradoEn).getTime() < DIAS_VISIBLE_SORTEADO * 86_400_000;
    return true;
  });
}

/** ¿Esta tienda patrocina el sorteo? (tiene un código activo) */
export const patrocinaTienda = (s: Pick<Sorteo, 'codigos'>, tiendaId: string) =>
  !!tiendaId && s.codigos.some((c) => c.activo && c.tiendaId === tiendaId);

export interface ResumenTienda {
  tiendaId: string;
  nombreTienda: string;
  participantes: number;
}

/** Cuántos participantes trajo cada tienda (de mayor a menor) */
export function participantesPorTienda(participantes: Participante[], codigos: CodigoSorteo[] = []): ResumenTienda[] {
  const mapa = new Map<string, ResumenTienda>();
  for (const c of codigos) if (c.tiendaId && !mapa.has(c.tiendaId)) mapa.set(c.tiendaId, { tiendaId: c.tiendaId, nombreTienda: c.nombreTienda, participantes: 0 });
  for (const p of participantes) {
    const r = mapa.get(p.tiendaId) ?? { tiendaId: p.tiendaId, nombreTienda: p.nombreTienda || p.tiendaId, participantes: 0 };
    r.participantes++;
    mapa.set(p.tiendaId, r);
  }
  return [...mapa.values()].sort((a, b) => b.participantes - a.participantes || a.nombreTienda.localeCompare(b.nombreTienda));
}

/** Nombre para mostrar públicamente al ganador: "María G." (no se publica el apellido completo) */
export function nombrePublico(nombre?: string): string {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Participante';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Entero al azar en [0, n) con el generador criptográfico del navegador/Node (más justo que Math.random) */
export function enteroAlAzar(n: number): number {
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (!c?.getRandomValues) return Math.floor(Math.random() * n);
  const tope = Math.floor(0x100000000 / n) * n; // evita sesgo
  const buf = new Uint32Array(1);
  do c.getRandomValues(buf);
  while (buf[0] >= tope);
  return buf[0] % n;
}

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

function aSorteo(id: string, s: any): Sorteo {
  const codigos: CodigoSorteo[] = Object.entries(s?.codigos ?? {}).map(([codigo, c]: [string, any]) => ({
    codigo,
    tiendaId: String(c?.tiendaId ?? ''),
    nombreTienda: String(c?.nombreTienda ?? ''),
    logoUrl: c?.logoUrl || '',
    activo: c?.activo !== false,
    usos: Number(c?.usos) || 0,
    limite: Number(c?.limite) || 0,
    creadoEn: c?.creadoEn || '',
  }));
  const ganadores: Ganador[] = Object.entries(s?.ganadores ?? {})
    .map(([gid, g]: [string, any]) => ({ id: gid, ...g }) as Ganador)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return {
    id,
    titulo: String(s?.titulo ?? ''),
    descripcion: String(s?.descripcion ?? ''),
    premio: String(s?.premio ?? ''),
    imagenUrl: s?.imagenUrl || '',
    activo: s?.activo !== false,
    fechaInicio: s?.fechaInicio || '',
    fechaFin: s?.fechaFin || '',
    creadoEn: s?.creadoEn || '',
    cerradoEn: s?.cerradoEn || '',
    codigos: codigos.sort((a, b) => a.nombreTienda.localeCompare(b.nombreTienda) || a.codigo.localeCompare(b.codigo)),
    ganadores,
  };
}

const masNuevosPrimero = (l: Sorteo[]) => [...l].sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));

/** Todos los sorteos, en vivo (panel de administración y perfil del cliente: el cliente filtra por estado) */
export function useSorteos(): { sorteos: Ref<Sorteo[]>; cargando: Ref<boolean> } {
  const sorteos = ref<Sorteo[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    off = onValue(dbRef(db, 'sorteos'), (snap) => {
      const v = snap.val() || {};
      sorteos.value = masNuevosPrimero(Object.entries(v).map(([id, s]) => aSorteo(id, s)));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { sorteos, cargando };
}

/** Participantes de un sorteo, en vivo (solo el panel de administración) */
export function useParticipantes(sorteoId: () => string | null): { participantes: Ref<Participante[]>; cargando: Ref<boolean>; observar: () => void } {
  const participantes = ref<Participante[]>([]);
  const cargando = ref(false);
  let off: Unsubscribe | null = null;
  function observar() {
    off?.();
    off = null;
    const id = sorteoId();
    participantes.value = [];
    if (!id) return;
    cargando.value = true;
    off = onValue(dbRef(db, `sorteoParticipantes/${id}`), (snap) => {
      participantes.value = Object.entries(snap.val() || {}).map(([clienteId, p]: [string, any]) => ({
        clienteId,
        nombre: String(p?.nombre ?? ''),
        telefono: p?.telefono || '',
        codigo: String(p?.codigo ?? ''),
        tiendaId: String(p?.tiendaId ?? ''),
        nombreTienda: p?.nombreTienda || '',
        fecha: String(p?.fecha ?? ''),
      }));
      cargando.value = false;
    });
  }
  onUnmounted(() => off?.());
  return { participantes, cargando, observar };
}

/** ¿Este cliente ya participa en el sorteo? */
export async function yaParticipa(sorteoId: string, clienteId: string): Promise<boolean> {
  if (!sorteoId || !clienteId) return false;
  const s = await get(dbRef(db, `sorteoParticipantes/${sorteoId}/${clienteId}`));
  return s.exists();
}

/* ------------------------------------------------------------------ */
/* Cliente: participar                                                 */
/* ------------------------------------------------------------------ */

export class ErrorSorteo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorSorteo';
  }
}

/**
 * El cliente entra al sorteo con el código de una tienda. Una participación por cliente y sorteo.
 * Lanza ErrorSorteo con un mensaje listo para mostrar si algo no cuadra.
 */
export async function participarEnSorteo(
  sorteoId: string,
  cliente: ClienteSorteo | null | undefined,
  codigoTexto: string,
  ahora: Date = new Date(),
): Promise<{ nombreTienda: string; codigo: string }> {
  if (!cliente?.id) throw new ErrorSorteo('Inicia sesión para participar.');
  const codigo = normalizarCodigo(codigoTexto);
  if (!codigo) throw new ErrorSorteo('Escribe el código que te dio la tienda.');

  const snap = await get(dbRef(db, `sorteos/${sorteoId}`));
  if (!snap.exists()) throw new ErrorSorteo('Este sorteo ya no existe.');
  const sorteo = aSorteo(sorteoId, snap.val());
  const estado = estadoSorteo(sorteo, hoyISO(ahora));
  if (estado === 'proximo') throw new ErrorSorteo(`Este sorteo empieza el ${sorteo.fechaInicio}.`);
  if (estado !== 'abierto') throw new ErrorSorteo('Este sorteo ya no está recibiendo participantes.');

  if (await yaParticipa(sorteoId, cliente.id)) throw new ErrorSorteo('Ya estás participando en este sorteo. ¡Mucha suerte!');

  const c = sorteo.codigos.find((x) => x.codigo === codigo);
  if (!c || !c.activo) throw new ErrorSorteo('Ese código no es válido. Revísalo o pídeselo de nuevo a la tienda.');

  // El contador de usos se aparta con una transacción para respetar el límite aunque entren varios a la vez
  const tx = await runTransaction(dbRef(db, `sorteos/${sorteoId}/codigos/${codigo}/usos`), (actual: number | null) => {
    const usos = Number(actual) || 0;
    if (c.limite > 0 && usos >= c.limite) return undefined; // aborta
    return usos + 1;
  });
  if (!tx.committed) throw new ErrorSorteo('Ese código ya alcanzó su límite de usos.');

  try {
    await set(dbRef(db, `sorteoParticipantes/${sorteoId}/${cliente.id}`), {
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      codigo,
      tiendaId: c.tiendaId,
      nombreTienda: c.nombreTienda,
      fecha: ahora.toISOString(),
    });
  } catch (e) {
    // No quedó registrado: se devuelve el uso apartado
    await runTransaction(dbRef(db, `sorteos/${sorteoId}/codigos/${codigo}/usos`), (a: number | null) => Math.max(0, (Number(a) || 0) - 1));
    throw e;
  }
  return { nombreTienda: c.nombreTienda, codigo };
}

/* ------------------------------------------------------------------ */
/* Administrador                                                       */
/* ------------------------------------------------------------------ */

export interface DatosSorteo {
  titulo: string;
  descripcion?: string;
  premio?: string;
  imagenUrl?: string;
  activo?: boolean;
  fechaInicio?: string;
  fechaFin?: string;
}

function validarDatos(d: DatosSorteo) {
  if (!String(d.titulo ?? '').trim()) throw new ErrorSorteo('Escribe el nombre del sorteo.');
  if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) throw new ErrorSorteo('La fecha de fin no puede ser anterior a la de inicio.');
}

const limpiar = (d: DatosSorteo) => ({
  titulo: d.titulo.trim(),
  descripcion: (d.descripcion ?? '').trim(),
  premio: (d.premio ?? '').trim(),
  imagenUrl: d.imagenUrl || '',
  activo: d.activo !== false,
  fechaInicio: d.fechaInicio || '',
  fechaFin: d.fechaFin || '',
});

export async function crearSorteo(d: DatosSorteo): Promise<string> {
  validarDatos(d);
  const nuevo = push(dbRef(db, 'sorteos'));
  await set(nuevo, { ...limpiar(d), creadoEn: new Date().toISOString() });
  return nuevo.key!;
}

export async function actualizarSorteo(id: string, d: DatosSorteo): Promise<void> {
  validarDatos(d);
  await update(dbRef(db, `sorteos/${id}`), limpiar(d));
}

/** Borra el sorteo con sus códigos, ganadores y participantes */
export async function eliminarSorteo(id: string): Promise<void> {
  const previo = await get(dbRef(db, `sorteos/${id}/imagenUrl`));
  await update(dbRef(db), { [`sorteos/${id}`]: null, [`sorteoParticipantes/${id}`]: null });
  // Ya borrado el sorteo, su imagen queda sin uso (el servidor solo la quita si nada más la usa)
  if (previo.exists()) void eliminarImagenes([previo.val()]);
}

export async function alternarSorteo(id: string, activo: boolean): Promise<void> {
  await update(dbRef(db, `sorteos/${id}`), { activo });
}

/** Crea el código de una tienda (el que se indique, o uno generado). El código es único dentro del sorteo. */
export async function agregarCodigo(
  sorteoId: string,
  tienda: { tiendaId: string; nombreTienda: string; logoUrl?: string },
  opciones: { codigo?: string; limite?: number } = {},
): Promise<string> {
  if (!tienda.tiendaId) throw new ErrorSorteo('Elige una tienda.');
  const existentes = await get(dbRef(db, `sorteos/${sorteoId}/codigos`));
  const usados = new Set(Object.keys(existentes.val() ?? {}));
  let codigo = normalizarCodigo(opciones.codigo);
  if (opciones.codigo && !codigo) throw new ErrorSorteo('El código solo puede llevar letras, números y guion.');
  if (codigo) {
    if (codigo.length < 4) throw new ErrorSorteo('El código debe tener al menos 4 caracteres.');
    if (usados.has(codigo)) throw new ErrorSorteo('Ese código ya existe en este sorteo.');
  } else {
    do codigo = generarCodigo(tienda.nombreTienda);
    while (usados.has(codigo));
  }
  const limite = Math.max(0, Math.trunc(Number(opciones.limite) || 0));
  await set(dbRef(db, `sorteos/${sorteoId}/codigos/${codigo}`), {
    tiendaId: tienda.tiendaId,
    nombreTienda: tienda.nombreTienda,
    logoUrl: tienda.logoUrl || '',
    activo: true,
    usos: 0,
    limite,
    creadoEn: new Date().toISOString(),
  });
  return codigo;
}

export async function alternarCodigo(sorteoId: string, codigo: string, activo: boolean): Promise<void> {
  await update(dbRef(db, `sorteos/${sorteoId}/codigos/${codigo}`), { activo });
}

/** Quitar el código impide que se use de nuevo; quienes ya entraron con él siguen participando */
export async function eliminarCodigo(sorteoId: string, codigo: string): Promise<void> {
  await remove(dbRef(db, `sorteos/${sorteoId}/codigos/${codigo}`));
}

/**
 * Saca un ganador al azar entre todos los participantes que aún no han ganado en este sorteo.
 * Guarda el ganador y cierra el sorteo (ya no entra nadie más).
 */
export async function sortearGanador(sorteoId: string, por = 'admin'): Promise<Ganador> {
  const [ps, gs] = await Promise.all([get(dbRef(db, `sorteoParticipantes/${sorteoId}`)), get(dbRef(db, `sorteos/${sorteoId}/ganadores`))]);
  const yaGanaron = new Set(Object.values(gs.val() ?? {}).map((g: any) => String(g?.clienteId)));
  const candidatos = Object.entries(ps.val() ?? {}).filter(([clienteId]) => !yaGanaron.has(clienteId));
  if (!candidatos.length) {
    throw new ErrorSorteo(yaGanaron.size ? 'Ya ganaron todos los participantes.' : 'Aún no hay participantes para sortear.');
  }
  const [clienteId, p] = candidatos[enteroAlAzar(candidatos.length)] as [string, any];
  const fecha = new Date().toISOString();
  const nuevo = push(dbRef(db, `sorteos/${sorteoId}/ganadores`));
  const ganador = {
    clienteId,
    nombre: String(p?.nombre ?? ''),
    telefono: p?.telefono || '',
    tiendaId: String(p?.tiendaId ?? ''),
    nombreTienda: p?.nombreTienda || '',
    codigo: String(p?.codigo ?? ''),
    fecha,
    por,
  };
  await update(dbRef(db), { [`sorteos/${sorteoId}/ganadores/${nuevo.key}`]: ganador, [`sorteos/${sorteoId}/cerradoEn`]: fecha });
  return { id: nuevo.key!, ...ganador };
}
