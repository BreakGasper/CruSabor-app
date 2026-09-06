import { ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, onValue } from 'firebase/database';

/**
 * Horario de atención de las tiendas.
 *
 * Cada tienda guarda `tiendas/{id}/horario` con una entrada por día de la semana
 * ("Lunes" … "Domingo") y horas "HH:MM" de apertura (`inicio`) y cierre (`fin`).
 * Un día sin `inicio` o sin `fin` cuenta como cerrado.
 *
 * Regla de negocio: los productos de una tienda CERRADA se pueden guardar en el
 * carrito, pero solo se pueden COMPRAR dentro de su horario. El checkout deja pasar
 * los artículos de tiendas abiertas y conserva los demás en el carrito.
 *
 * La hora se evalúa en la zona horaria de la app (America/Mexico_City), igual que
 * el servidor de pagos, para que no dependa del reloj del dispositivo.
 */

export type HorarioDia = { inicio?: string; fin?: string };
export type HorarioTienda = Record<string, HorarioDia | null | undefined>;

export const ZONA_HORARIA_APP = 'America/Mexico_City';

/** Días como los guarda la app (mismo orden que en el registro de tienda) */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export const MENSAJE_TIENDA_CERRADA =
  'La tienda está cerrada en este momento. El producto se queda en tu carrito y podrás comprarlo en su horario.';

/** "miércoles" -> "miercoles": compara nombres de día sin importar acentos ni mayúsculas */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

const esHora = (s: unknown): s is string => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s);

/** "9:05" -> 545 minutos desde medianoche */
export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Día ("Lunes"…) y minutos del día de un instante en la zona horaria indicada */
export function momentoLocal(ahora: Date = new Date(), timeZone: string = ZONA_HORARIA_APP): { dia: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value || '';
  const diaTexto = normalizar(valor('weekday'));
  const dia = DIAS_SEMANA.find((d) => normalizar(d) === diaTexto) || '';
  const hora = Number(valor('hour')) % 24; // algunos motores devuelven "24" a medianoche
  const minutos = hora * 60 + Number(valor('minute'));
  return { dia, minutos };
}

/** Horario del día indicado, o null si ese día la tienda no abre */
export function horarioDelDia(horario: HorarioTienda | null | undefined, dia: string): { inicio: string; fin: string } | null {
  if (!horario || !dia) return null;
  const clave = Object.keys(horario).find((k) => normalizar(k) === normalizar(dia));
  const h = clave ? horario[clave] : null;
  if (!h || !esHora(h.inicio) || !esHora(h.fin)) return null;
  return { inicio: h.inicio, fin: h.fin };
}

/** true si la tienda tiene al menos un día con horario válido */
export function tieneHorario(horario: HorarioTienda | null | undefined): boolean {
  return DIAS_SEMANA.some((d) => horarioDelDia(horario, d) !== null);
}

/**
 * ¿La tienda está abierta en este instante?
 * - Sin horario registrado (tiendas anteriores a la regla): abierta, para no interrumpir su operación.
 * - El cierre es exclusivo: a la hora exacta de `fin` la tienda ya está cerrada.
 * - Si `fin` es menor que `inicio` se toma como horario que cruza la medianoche.
 */
export function tiendaAbierta(
  horario: HorarioTienda | null | undefined,
  ahora: Date = new Date(),
  timeZone: string = ZONA_HORARIA_APP,
): boolean {
  if (!tieneHorario(horario)) return true;
  const { dia, minutos } = momentoLocal(ahora, timeZone);
  const hoy = horarioDelDia(horario, dia);
  if (hoy) {
    const ini = minutosDeHora(hoy.inicio);
    const fin = minutosDeHora(hoy.fin);
    if (ini < fin ? minutos >= ini && minutos < fin : minutos >= ini || minutos < fin) return true;
  }
  // Horario de ayer que cruzó la medianoche (p. ej. 20:00 - 02:00)
  const idx = DIAS_SEMANA.findIndex((d) => normalizar(d) === normalizar(dia));
  const ayer = horarioDelDia(horario, DIAS_SEMANA[(idx + 6) % 7]);
  if (ayer && minutosDeHora(ayer.fin) < minutosDeHora(ayer.inicio) && minutos < minutosDeHora(ayer.fin)) return true;
  return false;
}

/** "HH:MM" -> "h:MM a. m./p. m." para mostrar */
export function formatoHora12(hhmm: string): string {
  if (!esHora(hhmm)) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/**
 * Texto de la próxima apertura, p. ej. "Abre hoy a las 10:00 a.m." o "Abre el Lunes a las 9:00 a.m.".
 * null si la tienda no tiene horario o está abierta.
 */
export function proximaApertura(
  horario: HorarioTienda | null | undefined,
  ahora: Date = new Date(),
  timeZone: string = ZONA_HORARIA_APP,
): string | null {
  if (!tieneHorario(horario) || tiendaAbierta(horario, ahora, timeZone)) return null;
  const { dia, minutos } = momentoLocal(ahora, timeZone);
  const idx = DIAS_SEMANA.findIndex((d) => normalizar(d) === normalizar(dia));
  for (let i = 0; i <= 7; i++) {
    const d = DIAS_SEMANA[(idx + i) % 7];
    const h = horarioDelDia(horario, d);
    if (!h) continue;
    if (i === 0 && minutosDeHora(h.inicio) <= minutos) continue; // hoy ya pasó la apertura
    const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${d}`;
    return `Abre ${cuando} a las ${formatoHora12(h.inicio)}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Mapa compartido tiendaId -> horario, cargado una vez y en vivo       */
/* ------------------------------------------------------------------ */

const horarioPorTienda = ref<Record<string, HorarioTienda | null>>({});
const cargado = ref(false);
let suscrito = false;

function asegurarSuscripcion() {
  if (suscrito) return;
  suscrito = true;
  onValue(dbRef(db, 'tiendas'), (snap) => {
    const data = snap.val() || {};
    const mapa: Record<string, HorarioTienda | null> = {};
    for (const id of Object.keys(data)) mapa[id] = data[id]?.horario ?? null;
    horarioPorTienda.value = mapa;
    cargado.value = true;
  });
}

/** Solo para pruebas: fija el mapa sin Firebase (null vuelve a suscribirse) */
export function __setHorarioPorTienda(mapa: Record<string, HorarioTienda | null> | null) {
  suscrito = mapa !== null;
  cargado.value = mapa !== null;
  horarioPorTienda.value = mapa || {};
}

export function useHorarioTiendas() {
  asegurarSuscripcion();

  /**
   * true  -> la tienda está abierta ahora (o no tiene horario)
   * false -> está cerrada
   * undefined -> aún no sabemos (datos sin cargar o tienda desconocida)
   */
  const estaAbierta = (tiendaId?: string | null, ahora: Date = new Date()): boolean | undefined => {
    if (!tiendaId || !(tiendaId in horarioPorTienda.value)) return undefined;
    return tiendaAbierta(horarioPorTienda.value[tiendaId], ahora);
  };

  /** Bloquea solo cuando sabemos con certeza que la tienda está cerrada */
  const estaCerrada = (tiendaId?: string | null, ahora: Date = new Date()) => estaAbierta(tiendaId, ahora) === false;

  const horarioDe = (tiendaId?: string | null) => (tiendaId ? horarioPorTienda.value[tiendaId] ?? null : null);

  const aperturaDe = (tiendaId?: string | null, ahora: Date = new Date()) => proximaApertura(horarioDe(tiendaId), ahora);

  return { horarioPorTienda, cargado, estaAbierta, estaCerrada, horarioDe, aperturaDe };
}

/**
 * Consulta directa (sin suscripción) para el último candado antes de guardar el pedido.
 * Devuelve las tiendas que están CERRADAS ahora con su nombre y próxima apertura.
 */
export async function tiendasCerradas(
  tiendaIds: string[],
  ahora: Date = new Date(),
): Promise<{ id: string; nombre: string; abre: string | null }[]> {
  const ids = [...new Set(tiendaIds.filter(Boolean))];
  const resultado: { id: string; nombre: string; abre: string | null }[] = [];
  for (const id of ids) {
    const snap = await get(dbRef(db, `tiendas/${id}`));
    if (!snap.exists()) continue; // sin registro no hay horario que aplicar
    const t = snap.val();
    if (tiendaAbierta(t?.horario, ahora)) continue;
    resultado.push({ id, nombre: t?.nombreTienda || id, abre: proximaApertura(t?.horario, ahora) });
  }
  return resultado;
}

export class TiendaCerradaError extends Error {
  tiendas: { id: string; nombre: string; abre: string | null }[];
  constructor(tiendas: { id: string; nombre: string; abre: string | null }[]) {
    const nombres = tiendas.map((t) => (t.abre ? `${t.nombre} (${t.abre.toLowerCase()})` : t.nombre)).join(', ');
    super(
      tiendas.length === 1
        ? `La tienda ${nombres} está cerrada en este momento. Sus productos se quedan en tu carrito para comprarlos en su horario.`
        : `Las tiendas ${nombres} están cerradas en este momento. Sus productos se quedan en tu carrito para comprarlos en su horario.`,
    );
    this.name = 'TiendaCerradaError';
    this.tiendas = tiendas;
  }
}
