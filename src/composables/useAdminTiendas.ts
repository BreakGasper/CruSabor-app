import { ref, onUnmounted } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, update, push, onValue } from 'firebase/database';
import { sessionAdmin } from '@/utils/sessionAdmin';
import {
  estadoEfectivo,
  type ControlTienda,
  type EstadoTienda,
  type EstadoEfectivo,
  type PagoMembresia,
} from '@/composables/useMembresia';

/**
 * Acciones del administrador sobre las tiendas. Escriben los campos de control
 * que ya respeta toda la app (`estatus`, `motivoBloqueo`, `membresia`) y dejan
 * rastro en dos historiales por tienda:
 *
 *   tiendas/{id}/historialEstatus/{pushId}  { fecha, de, a, por, motivo? }
 *   tiendas/{id}/pagosMembresia/{pushId}    { fecha, monto, metodo, referencia?, plan, vigenteDesde, vigenteHasta, registradoPor }
 */

export type PlanMembresia = 'mensual' | 'anual';
export const PLAN_LABEL: Record<PlanMembresia, string> = { mensual: 'Mensual', anual: 'Anual' };
export const METODOS_PAGO_MEMBRESIA = ['Efectivo', 'Transferencia', 'Tarjeta'] as const;

export interface HistorialEstatus {
  id?: string;
  fecha: string; // ISO
  de: EstadoEfectivo | 'sin-estatus';
  a: EstadoTienda;
  por: string;
  motivo?: string;
}

export interface PagoRegistrado extends PagoMembresia {
  id?: string;
  plan: PlanMembresia;
  vigenteDesde: string; // YYYY-MM-DD
  vigenteHasta: string; // YYYY-MM-DD
}

export interface TiendaControl extends ControlTienda {
  tiendaId?: string;
  nombreTienda?: string;
}

const quienActua = () => sessionAdmin.value?.nombre || 'admin';

/** Fecha local en formato YYYY-MM-DD */
export function aYMD(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Suma meses a una fecha YYYY-MM-DD (si el mes destino es más corto, cae en su último día) */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const destino = new Date(y, m - 1 + meses, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(d, ultimoDia));
  return aYMD(destino);
}

/**
 * Nueva fecha de vigencia al registrar un pago: se cuenta desde hoy o desde la
 * vigencia actual si todavía no ha vencido (para no quitarle días a la tienda).
 */
export function calcularVigencia(
  vigenteActual: string | undefined,
  plan: PlanMembresia,
  hoy: Date = new Date(),
): { desde: string; hasta: string } {
  const hoyYMD = aYMD(hoy);
  const desde = vigenteActual && vigenteActual >= hoyYMD ? vigenteActual : hoyYMD;
  return { desde, hasta: sumarMeses(desde, plan === 'anual' ? 12 : 1) };
}

function entradaHistorial(tienda: TiendaControl, a: EstadoTienda, motivo?: string): HistorialEstatus {
  const de: HistorialEstatus['de'] = tienda.estatus ? estadoEfectivo(tienda) : 'sin-estatus';
  const h: HistorialEstatus = { fecha: new Date().toISOString(), de, a, por: quienActua() };
  if (motivo) h.motivo = motivo;
  return h;
}

function idDe(tienda: TiendaControl): string {
  if (!tienda.tiendaId) throw new Error('Tienda sin id');
  return tienda.tiendaId;
}

/** Aprueba una tienda pendiente (o reactiva una bloqueada). Queda 'activa'. */
export async function aprobarTienda(tienda: TiendaControl, motivo?: string): Promise<void> {
  const id = idDe(tienda);
  const hid = push(dbRef(db, `tiendas/${id}/historialEstatus`)).key!;
  const ahora = new Date().toISOString();
  await update(dbRef(db), {
    [`tiendas/${id}/estatus`]: 'activa',
    [`tiendas/${id}/motivoBloqueo`]: null,
    [`tiendas/${id}/aprobadaEn`]: tienda.aprobadaEn ?? ahora,
    [`tiendas/${id}/aprobadaPor`]: tienda.aprobadaPor ?? quienActua(),
    [`tiendas/${id}/historialEstatus/${hid}`]: entradaHistorial(tienda, 'activa', motivo),
  });
}

/** Bloquea la tienda: deja de vender de inmediato. El motivo lo ve la dueña o dueño. */
export async function bloquearTienda(tienda: TiendaControl, motivo: string): Promise<void> {
  const id = idDe(tienda);
  const texto = (motivo || '').trim();
  if (!texto) throw new Error('Indica el motivo del bloqueo');
  const hid = push(dbRef(db, `tiendas/${id}/historialEstatus`)).key!;
  await update(dbRef(db), {
    [`tiendas/${id}/estatus`]: 'bloqueada',
    [`tiendas/${id}/motivoBloqueo`]: texto,
    [`tiendas/${id}/historialEstatus/${hid}`]: entradaHistorial(tienda, 'bloqueada', texto),
  });
}

export const desbloquearTienda = (tienda: TiendaControl) => aprobarTienda(tienda, 'Desbloqueo manual');

export interface DatosPago {
  monto: number;
  metodo: string;
  referencia?: string;
  plan: PlanMembresia;
  /** Si no se indica, se calcula con calcularVigencia */
  vigenteHasta?: string;
}

/**
 * Registra un pago de membresía: guarda el pago en el historial, actualiza la
 * vigencia y deja la tienda 'activa' (una tienda que paga queda autorizada).
 */
export async function registrarPago(tienda: TiendaControl, datos: DatosPago): Promise<PagoRegistrado> {
  const id = idDe(tienda);
  if (!(datos.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  if (!datos.metodo) throw new Error('Indica el método de pago');

  const calc = calcularVigencia(tienda.membresia?.vigenteHasta, datos.plan);
  const hasta = datos.vigenteHasta || calc.hasta;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new Error('Fecha de vigencia inválida');

  const pago: PagoRegistrado = {
    fecha: new Date().toISOString(),
    monto: Number(datos.monto),
    metodo: datos.metodo,
    plan: datos.plan,
    vigenteDesde: calc.desde,
    vigenteHasta: hasta,
    registradoPor: quienActua(),
  };
  if (datos.referencia?.trim()) pago.referencia = datos.referencia.trim();

  const pid = push(dbRef(db, `tiendas/${id}/pagosMembresia`)).key!;
  const cambios: Record<string, any> = {
    [`tiendas/${id}/pagosMembresia/${pid}`]: pago,
    [`tiendas/${id}/membresia/plan`]: datos.plan,
    [`tiendas/${id}/membresia/vigenteHasta`]: hasta,
    [`tiendas/${id}/membresia/ultimoPago`]: {
      fecha: pago.fecha,
      monto: pago.monto,
      metodo: pago.metodo,
      referencia: pago.referencia ?? null,
      registradoPor: pago.registradoPor,
    },
  };

  // Pagar autoriza / reactiva la tienda
  if (estadoEfectivo(tienda) !== 'activa') {
    const hid = push(dbRef(db, `tiendas/${id}/historialEstatus`)).key!;
    const ahora = new Date().toISOString();
    cambios[`tiendas/${id}/estatus`] = 'activa';
    cambios[`tiendas/${id}/motivoBloqueo`] = null;
    cambios[`tiendas/${id}/aprobadaEn`] = tienda.aprobadaEn ?? ahora;
    cambios[`tiendas/${id}/aprobadaPor`] = tienda.aprobadaPor ?? quienActua();
    cambios[`tiendas/${id}/historialEstatus/${hid}`] = entradaHistorial(
      tienda,
      'activa',
      `Pago de membresía ${PLAN_LABEL[datos.plan].toLowerCase()} · vigente hasta ${hasta}`,
    );
  }

  await update(dbRef(db), cambios);
  return { ...pago, id: pid };
}

/** Historial en vivo (pagos y cambios de estatus) de una tienda. */
export function useHistorialTienda(tiendaId: () => string | undefined) {
  const pagos = ref<PagoRegistrado[]>([]);
  const historial = ref<HistorialEstatus[]>([]);
  let offs: Array<() => void> = [];

  const porFechaDesc = (a: { fecha: string }, b: { fecha: string }) => (a.fecha < b.fecha ? 1 : -1);

  function cargar() {
    offs.forEach((f) => f());
    offs = [];
    const id = tiendaId();
    pagos.value = [];
    historial.value = [];
    if (!id) return;
    offs.push(
      onValue(dbRef(db, `tiendas/${id}/pagosMembresia`), (snap) => {
        const data = snap.val() || {};
        pagos.value = Object.entries(data)
          .map(([pid, p]: [string, any]) => ({ ...p, id: pid }))
          .sort(porFechaDesc);
      }),
      onValue(dbRef(db, `tiendas/${id}/historialEstatus`), (snap) => {
        const data = snap.val() || {};
        historial.value = Object.entries(data)
          .map(([hid, h]: [string, any]) => ({ ...h, id: hid }))
          .sort(porFechaDesc);
      }),
    );
  }

  onUnmounted(() => offs.forEach((f) => f()));
  return { pagos, historial, cargar };
}
