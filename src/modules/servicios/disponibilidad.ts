import {
  DIAS_CLAVE,
  ANTICIPACION_MIN_DEFAULT,
  MAX_DIAS_ADELANTE_DEFAULT,
  type DiaClave,
  type Disponibilidad,
  type HorarioDiaServicio,
} from './tipos';

/**
 * Lógica PURA de la agenda (sin Firebase, sin red, sin reloj implícito): qué horarios se pueden reservar.
 * La pantalla la usa para mostrar horarios; el servicio de reservas la vuelve a usar justo antes de escribir, y la
 * base la respalda con las reglas de `database.rules.json` (cada bloque de 15 min solo se puede ocupar una vez).
 *
 * Todo se maneja en la zona horaria de la app (America/Mexico_City), igual que el resto de la plataforma.
 */

export const BLOQUE_MIN = 15;
export const ZONA_AGENDA = 'America/Mexico_City';
export const DURACION_MAX_MIN = 12 * 60;

/* ------------------------------ Fechas y horas ------------------------------ */

export const esFechaISO = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

/** "09:30" -> 570. null si no es una hora válida */
export function aMinutos(hhmm: unknown): number | null {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 570 -> "09:30" (1440 -> "24:00", para fin de día) */
export function aHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Clave de un bloque en la base: 570 -> "0930" */
export const claveBloque = (min: number): string => aHora(min).replace(':', '');

/** Suma días a AAAA-MM-DD (sin depender de la zona horaria del dispositivo) */
export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Día de la semana de una fecha (lunes primero) */
export function diaClaveDe(fecha: string): DiaClave {
  const [y, m, d] = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return DIAS_CLAVE[(dow + 6) % 7];
}

export interface Ahora {
  fecha: string; // AAAA-MM-DD en la zona de la agenda
  minutos: number; // minutos desde la medianoche
}

export function ahoraEnZona(d: Date = new Date(), zona: string = ZONA_AGENDA): Ahora {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)!.value;
  return { fecha: `${v('year')}-${v('month')}-${v('day')}`, minutos: Number(v('hour')) * 60 + Number(v('minute')) };
}

/* ------------------------------ Bloques y rutas de ocupación ------------------------------ */

/** La duración debe ser múltiplo de 15 min, entre 15 min y 12 h */
export const duracionValida = (min: unknown): min is number =>
  typeof min === 'number' && Number.isInteger(min) && min >= BLOQUE_MIN && min <= DURACION_MAX_MIN && min % BLOQUE_MIN === 0;

/** Claves de los bloques que ocupa una cita: inicio 09:30, 60 min -> ["0930","0945","1000","1015"] */
export function bloquesDeCita(inicio: string, duracionMin: number): string[] {
  const ini = aMinutos(inicio);
  if (ini === null || !duracionValida(duracionMin) || ini % BLOQUE_MIN !== 0 || ini + duracionMin > 24 * 60) return [];
  const claves: string[] = [];
  for (let m = ini; m < ini + duracionMin; m += BLOQUE_MIN) claves.push(claveBloque(m));
  return claves;
}

/**
 * Rutas de Firebase de los bloques de una cita, listas para una escritura multi-ruta ATÓMICA:
 * con `valor` = id de la cita los ocupa; con `null` los libera. Si algún bloque ya estaba ocupado, las reglas de la base
 * rechazan toda la escritura (no queda una cita a medias) y el cliente sabe que alguien se le adelantó.
 */
export function rutasOcupacion(
  tiendaId: string,
  profesionalId: string,
  fecha: string,
  inicio: string,
  duracionMin: number,
  valor: string | null,
): Record<string, string | null> {
  const rutas: Record<string, string | null> = {};
  for (const clave of bloquesDeCita(inicio, duracionMin)) rutas[`ocupacion/${tiendaId}/${profesionalId}/${fecha}/${clave}`] = valor;
  return rutas;
}

/* ------------------------------ Disponibilidad ------------------------------ */

const NOMBRE_DIA_TIENDA: Record<DiaClave, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

/**
 * Punto de partida para configurar la agenda: el horario que la tienda ya capturó al registrarse
 * (`tiendas/{id}/horario`, "Lunes".."Domingo" con inicio/fin). Un día sin horas queda cerrado.
 */
export function semanaDesdeHorarioTienda(
  horario: Record<string, { inicio?: string; fin?: string } | null | undefined> | null | undefined,
): Disponibilidad['semana'] {
  const semana: Disponibilidad['semana'] = {};
  for (const dia of DIAS_CLAVE) {
    const h = horario?.[NOMBRE_DIA_TIENDA[dia]];
    const abre = aMinutos(h?.inicio);
    const cierra = aMinutos(h?.fin);
    semana[dia] = abre !== null && cierra !== null && cierra > abre ? { abre: aHora(abre), cierra: aHora(cierra) } : null;
  }
  return semana;
}

/** Validación de un horario semanal: devuelve mensajes de error (vacío = correcto) */
export function validarSemana(semana: Disponibilidad['semana']): string[] {
  const errores: string[] = [];
  for (const dia of DIAS_CLAVE) {
    const h = semana[dia];
    if (!h) continue;
    const abre = aMinutos(h.abre);
    const cierra = aMinutos(h.cierra);
    if (abre === null || cierra === null) {
      errores.push(`${NOMBRE_DIA_TIENDA[dia]}: escribe horas válidas.`);
      continue;
    }
    if (cierra <= abre) errores.push(`${NOMBRE_DIA_TIENDA[dia]}: el cierre debe ser después de la apertura.`);
    for (const d of h.descansos ?? []) {
      const a = aMinutos(d.desde);
      const b = aMinutos(d.hasta);
      if (a === null || b === null || b <= a) errores.push(`${NOMBRE_DIA_TIENDA[dia]}: un descanso tiene horas inválidas.`);
      else if (a < abre || b > cierra) errores.push(`${NOMBRE_DIA_TIENDA[dia]}: el descanso debe quedar dentro del horario de atención.`);
    }
  }
  return errores;
}

export const estaDeVacaciones = (disp: Disponibilidad, fecha: string): boolean =>
  (disp.vacaciones ?? []).some((v) => esFechaISO(v.desde) && esFechaISO(v.hasta) && fecha >= v.desde && fecha <= v.hasta);

/** Intervalos [inicio, fin) en minutos en los que NO se atiende ese día: descansos y bloqueos (todo el día = 0..1440) */
export function intervalosNoDisponibles(disp: Disponibilidad, fecha: string): Array<[number, number]> {
  const salida: Array<[number, number]> = [];
  const h: HorarioDiaServicio | null | undefined = disp.semana[diaClaveDe(fecha)];
  for (const d of h?.descansos ?? []) {
    const a = aMinutos(d.desde);
    const b = aMinutos(d.hasta);
    if (a !== null && b !== null && b > a) salida.push([a, b]);
  }
  for (const b of disp.bloqueos ?? []) {
    if (b.fecha !== fecha) continue;
    if (!b.desde || !b.hasta) {
      salida.push([0, 24 * 60]);
      continue;
    }
    const a = aMinutos(b.desde);
    const z = aMinutos(b.hasta);
    if (a !== null && z !== null && z > a) salida.push([a, z]);
  }
  return salida;
}

export interface OpcionesHorarios {
  disp: Disponibilidad;
  fecha: string;
  duracionMin: number;
  /** Claves "HHmm" ya ocupadas ese día para ese profesional */
  ocupados?: ReadonlySet<string>;
  ahora?: Ahora;
  /** Cada cuántos minutos puede empezar una cita (30 por defecto; múltiplo de 15) */
  paso?: number;
}

/**
 * Horas de inicio que se pueden reservar ese día (en orden). Una hora cuenta si TODA la cita cabe:
 * dentro del horario, sin cruzar descansos ni bloqueos, sin bloques ocupados, y respetando la anticipación mínima
 * y el máximo de días hacia adelante. Fecha pasada, vacaciones o día cerrado -> lista vacía.
 */
export function horariosDelDia(o: OpcionesHorarios): string[] {
  const { disp, fecha, duracionMin } = o;
  const ahora = o.ahora ?? ahoraEnZona();
  const paso = o.paso && o.paso >= BLOQUE_MIN && o.paso % BLOQUE_MIN === 0 ? o.paso : 30;
  if (!esFechaISO(fecha) || !duracionValida(duracionMin)) return [];
  if (fecha < ahora.fecha) return [];
  const maxDias = disp.maxDiasAdelante ?? MAX_DIAS_ADELANTE_DEFAULT;
  if (fecha > sumarDias(ahora.fecha, maxDias)) return [];
  if (estaDeVacaciones(disp, fecha)) return [];

  const h = disp.semana[diaClaveDe(fecha)];
  const abre = aMinutos(h?.abre);
  const cierra = aMinutos(h?.cierra);
  if (!h || abre === null || cierra === null || cierra <= abre) return [];

  const noDisponible = intervalosNoDisponibles(disp, fecha);
  const minimo = fecha === ahora.fecha ? ahora.minutos + (disp.anticipacionMin ?? ANTICIPACION_MIN_DEFAULT) : 0;
  const ocupados = o.ocupados ?? new Set<string>();

  const salida: string[] = [];
  // los inicios se alinean al paso desde la hora de apertura
  for (let ini = abre; ini + duracionMin <= cierra; ini += paso) {
    if (ini < minimo) continue;
    const fin = ini + duracionMin;
    if (noDisponible.some(([a, b]) => ini < b && fin > a)) continue;
    let libre = true;
    for (let m = ini; m < fin; m += BLOQUE_MIN) {
      if (ocupados.has(claveBloque(m))) {
        libre = false;
        break;
      }
    }
    if (libre) salida.push(aHora(ini));
  }
  return salida;
}

/** ¿Se puede reservar justo esa hora? (la misma regla que usan las pantallas, para validar antes de escribir) */
export const puedeReservar = (o: OpcionesHorarios & { inicio: string }): boolean => horariosDelDia(o).includes(o.inicio);

/**
 * Fechas (entre `desde` y `hasta`, ambas incluidas) que tienen al menos un horario libre: para marcar el calendario.
 * `ocupadosDe` entrega los bloques ocupados de cada fecha.
 */
export function fechasConHorario(p: {
  disp: Disponibilidad;
  desde: string;
  hasta: string;
  duracionMin: number;
  ocupadosDe?: (fecha: string) => ReadonlySet<string> | undefined;
  ahora?: Ahora;
  paso?: number;
}): string[] {
  const salida: string[] = [];
  if (!esFechaISO(p.desde) || !esFechaISO(p.hasta)) return salida;
  for (let f = p.desde; f <= p.hasta; f = sumarDias(f, 1)) {
    if (horariosDelDia({ disp: p.disp, fecha: f, duracionMin: p.duracionMin, ocupados: p.ocupadosDe?.(f), ahora: p.ahora, paso: p.paso }).length) salida.push(f);
  }
  return salida;
}

/** "09:30" + 60 -> "10:30" */
export function horaFin(inicio: string, duracionMin: number): string {
  const ini = aMinutos(inicio);
  return ini === null ? '' : aHora(ini + duracionMin);
}
