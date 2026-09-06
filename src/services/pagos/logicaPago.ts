/**
 * Lógica pura del pago automático de membresías (lado servidor, sin Firebase ni red).
 * Espejo de registrarPago del panel (src/composables/useAdminTiendas.ts): un pago aprobado
 * en Mercado Pago deja exactamente los mismos datos que uno capturado por el administrador.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const PLANES = ['mensual', 'anual'] as const;
export type Plan = (typeof PLANES)[number];
export const PLAN_LABEL: Record<Plan, string> = { mensual: 'Mensual', anual: 'Anual' };
export const METODO_MP = 'Mercado Pago';
export const ACTOR_MP = 'mercadopago';

type EstadoEfectivo = 'pendiente' | 'activa' | 'bloqueada' | 'vencida';

/** Fecha local YYYY-MM-DD en la zona horaria de la app */
export function aYMD(d: Date, timeZone = 'America/Mexico_City'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const esYMD = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Estado efectivo de la tienda para una fecha, igual que en la app */
export function estadoTienda(tienda: any, hoy: string, diasGracia = 0): EstadoEfectivo {
  const estatus = tienda?.estatus ?? 'activa';
  if (estatus !== 'activa') return estatus;
  const hasta = tienda?.membresia?.vigenteHasta;
  if (!esYMD(hasta)) return 'activa';
  return diasEntre(hoy, hasta) + Math.max(0, diasGracia) < 0 ? 'vencida' : 'activa';
}

/** Suma meses a YYYY-MM-DD; si el mes destino es más corto cae en su último día */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

/** Nueva vigencia: desde hoy, o desde la vigencia actual si aún no venció */
export function calcularVigencia(vigenteActual: unknown, plan: Plan, hoyYMD: string) {
  const desde = esYMD(vigenteActual) && vigenteActual >= hoyYMD ? vigenteActual : hoyYMD;
  return { desde, hasta: sumarMeses(desde, plan === 'anual' ? 12 : 1) };
}

/** Precio configurado para un plan (0 si no hay) */
export function precioPlan(config: any, plan: Plan): number {
  const v = plan === 'anual' ? config?.membresia?.precioAnual : config?.membresia?.precioMensual;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const esPlan = (p: unknown): p is Plan => typeof p === 'string' && (PLANES as readonly string[]).includes(p);

/** external_reference que viaja a Mercado Pago y regresa en el webhook */
export function crearExternalReference(d: { tiendaId: string; plan: Plan; intentoId: string }) {
  return `membresia|${d.tiendaId}|${d.plan}|${d.intentoId}`;
}
export function parseExternalReference(ref: unknown): { tiendaId: string; plan: Plan; intentoId: string } | null {
  const partes = String(ref || '').split('|');
  if (partes.length !== 4 || partes[0] !== 'membresia' || !esPlan(partes[2]) || !partes[1] || !partes[3]) return null;
  return { tiendaId: partes[1], plan: partes[2], intentoId: partes[3] };
}

/**
 * Valida la firma `x-signature` de las notificaciones de Mercado Pago.
 * Formato "ts=...,v1=..." y manifiesto "id:{data.id};request-id:{x-request-id};ts:{ts};"
 * (data.id en minúsculas si es alfanumérico). Tolerancia de 10 minutos por defecto.
 */
export function validarFirmaMercadoPago(d: {
  xSignature?: string | null;
  xRequestId?: string | null;
  dataId?: string | number | null;
  secreto?: string | null;
  ahoraMs?: number;
  toleranciaMs?: number;
}): boolean {
  const { xSignature, xRequestId, dataId, secreto } = d;
  const ahoraMs = d.ahoraMs ?? Date.now();
  const toleranciaMs = d.toleranciaMs ?? 10 * 60_000;
  if (!secreto || !xSignature || dataId === undefined || dataId === null) return false;
  const partes = Object.fromEntries(
    String(xSignature)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  ) as Record<string, string>;
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(ahoraMs - tsMs) > toleranciaMs) return false;

  const id = /^[a-zA-Z0-9]+$/.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifiesto = `id:${id};${xRequestId ? `request-id:${xRequestId};` : ''}ts:${ts};`;
  const esperado = createHmac('sha256', secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(String(v1), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface Intento {
  id: string;
  plan: Plan;
  monto: number;
}

/**
 * Escrituras multi-ruta para un pago aprobado. Deja a la tienda 'activa' (autoriza
 * pendientes y reactiva bloqueadas/vencidas), igual que registrarPago en el panel.
 */
export function cambiosParaPagoAprobado(d: {
  tiendaId: string;
  tienda: any;
  intento: Intento;
  mpPago: { id: string | number; transaction_amount?: number };
  config: any;
  ahora: Date;
  pagoId: string;
  historialId: string;
}) {
  const { tiendaId, tienda, intento, mpPago, config, ahora, pagoId, historialId } = d;
  const ahoraISO = ahora.toISOString();
  const hoy = aYMD(ahora);
  const plan = intento.plan;
  const { desde, hasta } = calcularVigencia(tienda?.membresia?.vigenteHasta, plan, hoy);
  const monto = Number(mpPago.transaction_amount ?? intento.monto) || 0;
  const referencia = String(mpPago.id);

  const pago = {
    fecha: ahoraISO,
    monto,
    metodo: METODO_MP,
    referencia,
    plan,
    vigenteDesde: desde,
    vigenteHasta: hasta,
    registradoPor: ACTOR_MP,
  };

  const cambios: Record<string, any> = {
    [`tiendas/${tiendaId}/pagosMembresia/${pagoId}`]: pago,
    [`tiendas/${tiendaId}/membresia/plan`]: plan,
    [`tiendas/${tiendaId}/membresia/vigenteHasta`]: hasta,
    [`tiendas/${tiendaId}/membresia/ultimoPago`]: { fecha: ahoraISO, monto, metodo: METODO_MP, referencia, registradoPor: ACTOR_MP },
    [`pagosMercadoPago/${intento.id}/estado`]: 'aprobado',
    [`pagosMercadoPago/${intento.id}/mpPaymentId`]: referencia,
    [`pagosMercadoPago/${intento.id}/montoPagado`]: monto,
    [`pagosMercadoPago/${intento.id}/aprobadoEn`]: ahoraISO,
    [`pagosMercadoPago/${intento.id}/vigenteHasta`]: hasta,
  };

  const diasGracia = Math.max(0, Math.trunc(Number(config?.membresia?.diasGracia) || 0));
  const estadoActual: EstadoEfectivo | 'sin-estatus' = tienda?.estatus ? estadoTienda(tienda, hoy, diasGracia) : 'sin-estatus';
  if (estadoActual !== 'activa') {
    cambios[`tiendas/${tiendaId}/estatus`] = 'activa';
    cambios[`tiendas/${tiendaId}/motivoBloqueo`] = null;
    if (!tienda?.aprobadaEn) cambios[`tiendas/${tiendaId}/aprobadaEn`] = ahoraISO;
    if (!tienda?.aprobadaPor) cambios[`tiendas/${tiendaId}/aprobadaPor`] = ACTOR_MP;
    cambios[`tiendas/${tiendaId}/historialEstatus/${historialId}`] = {
      fecha: ahoraISO,
      de: estadoActual,
      a: 'activa',
      por: ACTOR_MP,
      motivo: `Pago en línea de membresía ${PLAN_LABEL[plan].toLowerCase()} · vigente hasta ${hasta}`,
    };
  }
  return { cambios, pago };
}
