/**
 * Pago automático de membresías con Mercado Pago a través del servidor Express:
 * lógica pura (src/services/pagos/logicaPago.ts), endpoints del router con un almacén en
 * memoria y una API de Mercado Pago simulada, y el composable de la app.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  sumarMeses,
  calcularVigencia,
  precioPlan,
  crearExternalReference,
  parseExternalReference,
  validarFirmaMercadoPago,
  cambiosParaPagoAprobado,
} from '../src/services/pagos/logicaPago.ts';
import { crearRouterPagos } from '../src/services/pagos/router.ts';
import type { Almacen } from '../src/services/pagos/almacen.ts';
import { iniciarPagoMembresia, resultadoPagoDesdeQuery, urlApi } from '@/composables/useMercadoPago';
import { normalizarConfiguracion, useConfiguracion, __setConfiguracion } from '@/composables/useConfiguracion';

const AHORA = new Date('2026-09-06T18:00:00Z'); // 12:00 en Ciudad de México

/* ---------------- lógica pura ---------------- */
describe('lógica pura', () => {
  it('vigencia y precios coinciden con el panel', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(calcularVigencia(undefined, 'mensual', '2026-09-06')).toEqual({ desde: '2026-09-06', hasta: '2026-10-06' });
    expect(calcularVigencia('2026-09-20', 'anual', '2026-09-06')).toEqual({ desde: '2026-09-20', hasta: '2027-09-20' });
    expect(precioPlan({ membresia: { precioMensual: 300, precioAnual: '3000' } }, 'anual')).toBe(3000);
    expect(precioPlan({}, 'mensual')).toBe(0);
  });

  it('external_reference ida y vuelta', () => {
    const ref = crearExternalReference({ tiendaId: 't-1', plan: 'anual', intentoId: 'i9' });
    expect(parseExternalReference(ref)).toEqual({ tiendaId: 't-1', plan: 'anual', intentoId: 'i9' });
    expect(parseExternalReference('membresia|t-1|semanal|i9')).toBeNull();
  });

  it('firma del webhook: válida, alterada, vieja', () => {
    const secreto = 'clave';
    const ahoraMs = AHORA.getTime();
    const ts = Math.floor(ahoraMs / 1000);
    const firmar = (id: string, req: string, t: number) =>
      `ts=${t},v1=${createHmac('sha256', secreto).update(`id:${id};request-id:${req};ts:${t};`).digest('hex')}`;
    const buena = firmar('123', 'r1', ts);
    expect(validarFirmaMercadoPago({ xSignature: buena, xRequestId: 'r1', dataId: '123', secreto, ahoraMs })).toBe(true);
    expect(validarFirmaMercadoPago({ xSignature: buena, xRequestId: 'r1', dataId: '999', secreto, ahoraMs })).toBe(false);
    expect(validarFirmaMercadoPago({ xSignature: firmar('123', 'r1', ts - 3600), xRequestId: 'r1', dataId: '123', secreto, ahoraMs })).toBe(false);
    expect(validarFirmaMercadoPago({ xSignature: buena, xRequestId: 'r1', dataId: '123', secreto: '', ahoraMs })).toBe(false);
  });

  it('pago aprobado reactiva una tienda vencida y solo extiende una vigente', () => {
    const base = { intento: { id: 'i1', plan: 'mensual' as const, monto: 300 }, mpPago: { id: 987, transaction_amount: 300 }, config: {}, ahora: AHORA, pagoId: 'p1', historialId: 'h1' };
    const venc = cambiosParaPagoAprobado({ ...base, tiendaId: 't1', tienda: { estatus: 'activa', membresia: { vigenteHasta: '2026-01-31' } } });
    expect(venc.pago).toMatchObject({ metodo: 'Mercado Pago', referencia: '987', vigenteHasta: '2026-10-06', registradoPor: 'mercadopago' });
    expect(venc.cambios['tiendas/t1/estatus']).toBe('activa');
    expect(venc.cambios['tiendas/t1/historialEstatus/h1']).toMatchObject({ de: 'vencida', a: 'activa', por: 'mercadopago' });

    const vig = cambiosParaPagoAprobado({ ...base, tiendaId: 't1', tienda: { estatus: 'activa', membresia: { vigenteHasta: '2026-09-20' } } });
    expect(vig.cambios['tiendas/t1/membresia/vigenteHasta']).toBe('2026-10-20');
    expect(vig.cambios['tiendas/t1/estatus']).toBeUndefined();
  });
});

/* ---------------- endpoints ---------------- */
function almacenEnMemoria(datos: any) {
  const tree: any = JSON.parse(JSON.stringify(datos));
  let n = 0;
  const getAt = (ruta: string) => ruta.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const setAt = (ruta: string, v: any) => {
    const p = ruta.split('/').filter(Boolean);
    let o = tree;
    for (const k of p.slice(0, -1)) o = o[k] ??= {};
    if (v === null) delete o[p[p.length - 1]];
    else o[p[p.length - 1]] = v;
  };
  const a: Almacen & { tree: any } = {
    tree,
    leer: async (r) => getAt(r) ?? null,
    actualizar: async (c) => Object.entries(c).forEach(([k, v]) => setAt(k, v)),
    nuevoId: () => `id${++n}`,
  };
  return a;
}

const SECRETO = 'webhook-secreto';
const ENV = { MP_ACCESS_TOKEN: 'TEST-token', MP_WEBHOOK_SECRET: SECRETO, API_PUBLIC_URL: 'https://api.mavi.test', FRONTEND_URL: 'https://mavi.test' } as NodeJS.ProcessEnv;

let servidor: ReturnType<express.Express['listen']>;
let base = '';
let almacen: ReturnType<typeof almacenEnMemoria>;
const pagosMP: Record<string, any> = {};
const mpFalso = {
  crearPreferencia: vi.fn(async (_t: string, d: any) => ({ id: `pref-${d.idempotencyKey}`, url: `https://mp.test/checkout/${d.idempotencyKey}` })),
  obtenerPago: vi.fn(async (_t: string, id: string | number) => {
    if (!pagosMP[String(id)]) throw new Error('Mercado Pago /v1/payments: not found');
    return pagosMP[String(id)];
  }),
};

function levantar() {
  const app = express();
  app.use(express.json());
  app.use('/pagos', crearRouterPagos({ almacen: async () => almacen, env: ENV, ahora: () => AHORA, mp: mpFalso as any, log: () => {} }));
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}
const post = (ruta: string, body?: any, headers: Record<string, string> = {}) =>
  fetch(`${base}${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const firma = (dataId: string, reqId: string, ts = Math.floor(AHORA.getTime() / 1000)) =>
  `ts=${ts},v1=${createHmac('sha256', SECRETO).update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest('hex')}`;

beforeEach(() => {
  almacen = almacenEnMemoria({
    tiendas: { t1: { nombreTienda: 'Pan Lupita', email: 'lupita@pan.mx', estatus: 'activa', membresia: { vigenteHasta: '2026-01-31' } } },
    configuracion: { pagos: { modo: 'automatico' }, membresia: { precioMensual: 300, precioAnual: 3000 } },
  });
  for (const k of Object.keys(pagosMP)) delete pagosMP[k];
  mpFalso.crearPreferencia.mockClear();
  mpFalso.obtenerPago.mockClear();
  servidor?.close();
  levantar();
});
afterAll(() => servidor?.close());

describe('POST /pagos/membresia/crear', () => {
  it('crea el intento y devuelve la URL de Mercado Pago', async () => {
    const r = await post('/pagos/membresia/crear', { tiendaId: 't1', plan: 'anual', origen: 'https://mavi.test' });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toMatchObject({ intentoId: 'id1', url: 'https://mp.test/checkout/id1', monto: 3000, plan: 'anual' });
    expect(almacen.tree.pagosMercadoPago.id1).toMatchObject({ tiendaId: 't1', plan: 'anual', monto: 3000, estado: 'pendiente', preferenceId: 'pref-id1' });
    const pref = mpFalso.crearPreferencia.mock.calls[0][1];
    expect(pref.externalReference).toBe('membresia|t1|anual|id1');
    expect(pref.notificationUrl).toBe('https://api.mavi.test/pagos/membresia/webhook');
    expect(pref.backUrls.success).toBe('https://mavi.test/store/profile/t1?pago=exito');
    expect(pref.payerEmail).toBe('lupita@pan.mx');
  });

  it('valida tienda, plan, modo y precio', async () => {
    expect((await post('/pagos/membresia/crear', { tiendaId: 'no-existe', plan: 'mensual' })).status).toBe(404);
    expect((await post('/pagos/membresia/crear', { tiendaId: 't1', plan: 'semanal' })).status).toBe(400);
    expect((await post('/pagos/membresia/crear', { tiendaId: '../x', plan: 'mensual' })).status).toBe(400);
    almacen.tree.configuracion.pagos.modo = 'links';
    expect((await post('/pagos/membresia/crear', { tiendaId: 't1', plan: 'mensual' })).status).toBe(403);
    almacen.tree.configuracion.pagos.modo = 'automatico';
    almacen.tree.configuracion.membresia.precioMensual = 0;
    expect((await post('/pagos/membresia/crear', { tiendaId: 't1', plan: 'mensual' })).status).toBe(409);
  });

  it('el estado informa qué variables faltan', async () => {
    const r = await fetch(`${base}/pagos/membresia/estado`);
    expect(await r.json()).toEqual({ activo: true, faltan: [] });
  });
});

describe('POST /pagos/membresia/webhook', () => {
  async function crearIntento() {
    const d = await (await post('/pagos/membresia/crear', { tiendaId: 't1', plan: 'mensual' })).json();
    return d.intentoId as string;
  }

  it('rechaza firmas inválidas y responde 200 a eventos que no son pagos', async () => {
    expect((await post('/pagos/membresia/webhook?type=payment&data.id=55', {}, { 'x-signature': 'ts=1,v1=malo', 'x-request-id': 'r' })).status).toBe(401);
    expect((await post('/pagos/membresia/webhook?type=merchant_order&id=55', {})).status).toBe(200);
  });

  it('pago aprobado: registra el pago, extiende la vigencia y activa la tienda; el reintento no duplica', async () => {
    const intentoId = await crearIntento();
    pagosMP['555'] = { id: 555, status: 'approved', transaction_amount: 300, external_reference: `membresia|t1|mensual|${intentoId}` };
    const h = { 'x-signature': firma('555', 'req-1'), 'x-request-id': 'req-1' };

    const r = await post('/pagos/membresia/webhook?type=payment&data.id=555', { type: 'payment', data: { id: 555 } }, h);
    expect(await r.json()).toEqual({ ok: true, vigenteHasta: '2026-10-06' });
    const t = almacen.tree.tiendas.t1;
    expect(t.membresia).toMatchObject({ plan: 'mensual', vigenteHasta: '2026-10-06' });
    expect(t.membresia.ultimoPago).toMatchObject({ monto: 300, metodo: 'Mercado Pago', referencia: '555', registradoPor: 'mercadopago' });
    expect(Object.values(t.pagosMembresia)).toHaveLength(1);
    expect(Object.values(t.historialEstatus)[0]).toMatchObject({ de: 'vencida', a: 'activa', por: 'mercadopago' });
    expect(almacen.tree.pagosMercadoPago[intentoId]).toMatchObject({ estado: 'aprobado', mpPaymentId: '555' });

    const r2 = await post('/pagos/membresia/webhook?type=payment&data.id=555', {}, h);
    expect(await r2.json()).toEqual({ repetido: true });
    expect(Object.values(almacen.tree.tiendas.t1.pagosMembresia)).toHaveLength(1);
  });

  it('pago pendiente o rechazado solo actualiza el intento; monto menor no activa', async () => {
    const intentoId = await crearIntento();
    pagosMP['7'] = { id: 7, status: 'pending', transaction_amount: 300, external_reference: `membresia|t1|mensual|${intentoId}` };
    await post('/pagos/membresia/webhook?type=payment&data.id=7', {}, { 'x-signature': firma('7', 'a'), 'x-request-id': 'a' });
    expect(almacen.tree.pagosMercadoPago[intentoId].estado).toBe('pending');
    expect(almacen.tree.tiendas.t1.membresia.vigenteHasta).toBe('2026-01-31');

    pagosMP['8'] = { id: 8, status: 'approved', transaction_amount: 100, external_reference: `membresia|t1|mensual|${intentoId}` };
    const r = await post('/pagos/membresia/webhook?type=payment&data.id=8', {}, { 'x-signature': firma('8', 'b'), 'x-request-id': 'b' });
    expect(await r.json()).toEqual({ estado: 'monto-insuficiente' });
    expect(almacen.tree.tiendas.t1.membresia.vigenteHasta).toBe('2026-01-31');
  });

  it('si Mercado Pago falla responde 500 para que reintente', async () => {
    const r = await post('/pagos/membresia/webhook?type=payment&data.id=404', {}, { 'x-signature': firma('404', 'c'), 'x-request-id': 'c' });
    expect(r.status).toBe(500);
  });
});

/* ---------------- app ---------------- */
describe('app (useMercadoPago y configuración)', () => {
  beforeEach(() => __setConfiguracion(null));

  it('urlApi usa VITE_API_URL o localhost:3000', () => {
    expect(urlApi({ VITE_API_URL: 'https://api.mavi.test/' })).toBe('https://api.mavi.test');
    expect(urlApi({})).toBe('http://localhost:3000');
  });

  it('iniciarPagoMembresia llama al servidor y regresa la URL; propaga errores y caídas', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ intentoId: 'i1', url: 'https://mp.test/x', monto: 300, plan: 'mensual' }), { status: 200 }));
    const r = await iniciarPagoMembresia({ tiendaId: 't1', plan: 'mensual', origen: 'https://mavi.test' }, ok as any, 'https://api.test');
    expect(r.url).toBe('https://mp.test/x');
    expect((ok.mock.calls[0] as any)[0]).toBe('https://api.test/pagos/membresia/crear');

    const err = vi.fn(async () => new Response(JSON.stringify({ error: 'El pago automático está desactivado en la configuración' }), { status: 403 }));
    await expect(iniciarPagoMembresia({ tiendaId: 't1', plan: 'anual' }, err as any, 'https://api.test')).rejects.toThrow(/desactivado/);

    const caido = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(iniciarPagoMembresia({ tiendaId: 't1', plan: 'anual' }, caido as any, 'https://api.test')).rejects.toThrow(/servidor de pagos/);
  });

  it('resultadoPagoDesdeQuery y modo de pago en la configuración', () => {
    expect(resultadoPagoDesdeQuery({ pago: 'exito' })).toBe('exito');
    expect(resultadoPagoDesdeQuery({ pago: 'x' })).toBeNull();
    expect(normalizarConfiguracion({ pagos: { modo: 'automatico' } }).pagos.modo).toBe('automatico');
    expect(normalizarConfiguracion({ pagos: { modo: 'otro' } }).pagos.modo).toBe('links');

    const { pagoEnLineaDisponible, pagoAutomatico } = useConfiguracion();
    __setConfiguracion({ pagos: { modo: 'automatico' }, membresia: { precioMensual: 0 } });
    expect(pagoAutomatico.value).toBe(true);
    expect(pagoEnLineaDisponible.value).toBe(false);
    __setConfiguracion({ pagos: { modo: 'automatico' }, membresia: { precioMensual: 300 } });
    expect(pagoEnLineaDisponible.value).toBe(true);
    __setConfiguracion({ pagos: { modo: 'links', linkMensual: 'https://mpago.la/x' } });
    expect(pagoAutomatico.value).toBe(false);
    expect(pagoEnLineaDisponible.value).toBe(true);
  });
});
