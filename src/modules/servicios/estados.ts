import type { Cotizacion, EstadoCita, EstadoCotizacion } from './tipos';

/**
 * Estados de las citas y de las cotizaciones: etiquetas, color (pares del tema) y quién puede cambiar a qué.
 * Es lógica pura: la pantalla la usa para mostrar solo los botones que corresponden, y el servicio la vuelve a
 * consultar antes de escribir.
 */

export type Actor = 'cliente' | 'tienda';
/** Color de la insignia: usa los pares fondo+texto del tema (--aviso, --ok, --peligro, --brand-blue-soft, --surface-2) */
export type TonoEstado = 'aviso' | 'ok' | 'peligro' | 'info' | 'neutro';

/* ------------------------------ Citas ------------------------------ */

export const ETIQUETA_CITA: Record<EstadoCita, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  rechazada: 'Rechazada',
};

export const TONO_CITA: Record<EstadoCita, TonoEstado> = {
  pendiente: 'aviso',
  confirmada: 'ok',
  completada: 'info',
  cancelada: 'neutro',
  rechazada: 'peligro',
};

const TRANSICIONES_CITA: Record<EstadoCita, Partial<Record<Actor, EstadoCita[]>>> = {
  pendiente: { tienda: ['confirmada', 'rechazada', 'cancelada'], cliente: ['cancelada'] },
  confirmada: { tienda: ['completada', 'cancelada'], cliente: ['cancelada'] },
  completada: {},
  cancelada: {},
  rechazada: {},
};

export const puedeCambiarCita = (de: EstadoCita, a: EstadoCita, quien: Actor): boolean =>
  (TRANSICIONES_CITA[de]?.[quien] ?? []).includes(a);

export const accionesDeCita = (de: EstadoCita, quien: Actor): EstadoCita[] => [...(TRANSICIONES_CITA[de]?.[quien] ?? [])];

/** Estados en los que la cita sigue reteniendo su horario (los demás lo liberan) */
export const citaOcupaHorario = (e: EstadoCita): boolean => e === 'pendiente' || e === 'confirmada' || e === 'completada';

/** ¿Es un estado final (ya no cambia)? */
export const citaTerminada = (e: EstadoCita): boolean => !Object.keys(TRANSICIONES_CITA[e]).length;

/* ------------------------------ Cotizaciones ------------------------------ */

export const ETIQUETA_COTIZACION: Record<EstadoCotizacion, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  cotizada: 'Cotizada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
  completada: 'Completada',
};

export const TONO_COTIZACION: Record<EstadoCotizacion, TonoEstado> = {
  pendiente: 'aviso',
  en_revision: 'info',
  cotizada: 'info',
  aceptada: 'ok',
  rechazada: 'peligro',
  vencida: 'neutro',
  completada: 'ok',
};

const TRANSICIONES_COTIZACION: Record<EstadoCotizacion, Partial<Record<Actor, EstadoCotizacion[]>>> = {
  pendiente: { tienda: ['en_revision', 'cotizada', 'rechazada'] },
  en_revision: { tienda: ['cotizada', 'rechazada'] },
  cotizada: { cliente: ['aceptada', 'rechazada'], tienda: ['rechazada'] },
  aceptada: { tienda: ['completada'] },
  rechazada: {},
  vencida: {},
  completada: {},
};

export const puedeCambiarCotizacion = (de: EstadoCotizacion, a: EstadoCotizacion, quien: Actor): boolean =>
  (TRANSICIONES_COTIZACION[de]?.[quien] ?? []).includes(a);

export const accionesDeCotizacion = (de: EstadoCotizacion, quien: Actor): EstadoCotizacion[] => [...(TRANSICIONES_COTIZACION[de]?.[quien] ?? [])];

/**
 * Estado real hoy: una cotización "cotizada" cuya vigencia ya pasó está VENCIDA (no hace falta que nadie lo escriba).
 * `hoy` en AAAA-MM-DD; el último día de vigencia todavía cuenta.
 */
export function estadoEfectivoCotizacion(c: Pick<Cotizacion, 'estado' | 'respuesta'>, hoy: string): EstadoCotizacion {
  if (c.estado === 'cotizada' && c.respuesta?.venceEl && c.respuesta.venceEl < hoy) return 'vencida';
  return c.estado;
}
