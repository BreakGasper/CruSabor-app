/**
 * Promoción: quien paga su PRIMERA membresía mientras su prueba gratis sigue vigente recibe 1 mes gratis extra.
 * Se prueba la regla, el pago manual del admin, el pago automático (servidor) y los avisos a la tienda.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { bonoPrimerPagoDisponible, avisoEstadoTienda, MESES_BONO_PRIMER_PAGO } from '@/composables/useMembresia';
import { registrarPago, calcularVigencia, mesesBonoDe, aYMD } from '@/composables/useAdminTiendas';
import { cambiosParaPagoAprobado, mesesBonoPrimerPago, calcularVigencia as vigenciaServidor } from '@/services/pagos/logicaPago';
import PagoMembresiaModal from '@/modules/admin/components/PagoMembresiaModal.vue';

const HOY = new Date(2026, 8, 6); // 6 sep 2026
const enDias = (n: number) => aYMD(new Date(2026, 8, 6 + n));
const real = (n: number) => { const h = new Date(); return aYMD(new Date(h.getFullYear(), h.getMonth(), h.getDate() + n)); };
const prueba = (vigenteHasta: string, extra: Record<string, any> = {}) => ({
  nombreTienda: 'Mi tienda',
  estatus: 'activa',
  membresia: { plan: 'prueba', vigenteHasta, ...extra },
});

beforeEach(() => {
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
});
afterEach(() => {
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('regla del mes gratis', () => {
  it('es 1 mes', () => expect(MESES_BONO_PRIMER_PAGO).toBe(1));

  it('aplica con la prueba vigente (incluido el último día) y sin pagos previos', () => {
    expect(bonoPrimerPagoDisponible(prueba(enDias(10)), HOY)).toBe(true);
    expect(bonoPrimerPagoDisponible(prueba(enDias(0)), HOY)).toBe(true);
  });

  it('no aplica con la prueba terminada, con un pago previo, en otros planes o sin membresía', () => {
    expect(bonoPrimerPagoDisponible(prueba(enDias(-1)), HOY)).toBe(false);
    expect(bonoPrimerPagoDisponible(prueba(enDias(10), { ultimoPago: { fecha: 'x', monto: 1, metodo: 'Efectivo' } }), HOY)).toBe(false);
    expect(bonoPrimerPagoDisponible({ estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: enDias(10) } }, HOY)).toBe(false);
    expect(bonoPrimerPagoDisponible({ estatus: 'activa' }, HOY)).toBe(false);
    expect(bonoPrimerPagoDisponible(null, HOY)).toBe(false);
    expect(bonoPrimerPagoDisponible({ ...prueba(enDias(10)), estatus: 'bloqueada' } as any, HOY)).toBe(false);
  });

  it('calcularVigencia suma los meses extra sobre el fin de la prueba', () => {
    // prueba termina el 21 sep → mensual normal = 21 oct; con 1 mes gratis = 21 nov
    expect(calcularVigencia('2026-09-21', 'mensual', HOY)).toEqual({ desde: '2026-09-21', hasta: '2026-10-21' });
    expect(calcularVigencia('2026-09-21', 'mensual', HOY, 1)).toEqual({ desde: '2026-09-21', hasta: '2026-11-21' });
    expect(calcularVigencia('2026-09-21', 'anual', HOY, 1)).toEqual({ desde: '2026-09-21', hasta: '2027-10-21' });
    expect(calcularVigencia('2026-09-21', 'mensual', HOY, -3).hasta).toBe('2026-10-21'); // nunca resta
  });
});

describe('avisos a la tienda durante la prueba', () => {
  it('mencionan el mes gratis mientras la prueba corre', () => {
    const largo = avisoEstadoTienda(prueba(enDias(12)), HOY)!;
    expect(largo.detalle).toContain('1 mes gratis');
    const corto = avisoEstadoTienda(prueba(enDias(3)), HOY)!;
    expect(corto.detalle).toContain('1 mes gratis');
  });

  it('una vez terminada la prueba ya no se ofrece', () => {
    const vencida = avisoEstadoTienda(prueba(enDias(-2)), HOY)!;
    expect(vencida.detalle).not.toContain('gratis');
  });
});

describe('pago manual (administrador)', () => {
  beforeEach(() => __reset({ tiendas: { t1: prueba(real(10)), t2: prueba(real(-5)), t3: { estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: real(10) } } } }));
  const t = (id: string) => ({ ...__getAt(`tiendas/${id}`), tiendaId: id });

  it('primer pago en prueba: vigencia = fin de la prueba + 1 mes pagado + 1 mes gratis, y queda anotado', async () => {
    const pago = await registrarPago(t('t1'), { monto: 300, metodo: 'Efectivo', plan: 'mensual' });
    const esperado = calcularVigencia(real(10), 'mensual', new Date(), 1).hasta;
    expect(pago.vigenteHasta).toBe(esperado);
    expect(pago.mesesGratis).toBe(1);
    expect(__getAt('tiendas/t1/membresia/vigenteHasta')).toBe(esperado);
    expect(__getAt('tiendas/t1/membresia/plan')).toBe('mensual');
    expect(Object.values(__getAt('tiendas/t1/pagosMembresia') as any)[0]).toMatchObject({ mesesGratis: 1 });
  });

  it('con la prueba vencida o en una tienda que ya pagó, no hay mes gratis', async () => {
    const vencida = await registrarPago(t('t2'), { monto: 300, metodo: 'Efectivo', plan: 'mensual' });
    expect(vencida.mesesGratis).toBeUndefined();
    const normal = await registrarPago(t('t3'), { monto: 300, metodo: 'Efectivo', plan: 'mensual' });
    expect(normal.mesesGratis).toBeUndefined();
    expect(normal.vigenteHasta).toBe(calcularVigencia(real(10), 'mensual').hasta);
  });

  it('el segundo pago ya no recibe bono (el primero cambió el plan y dejó ultimoPago)', async () => {
    await registrarPago(t('t1'), { monto: 300, metodo: 'Efectivo', plan: 'mensual' });
    const otro = await registrarPago(t('t1'), { monto: 300, metodo: 'Efectivo', plan: 'mensual' });
    expect(otro.mesesGratis).toBeUndefined();
  });

  it('mesesBonoDe', () => {
    expect(mesesBonoDe(prueba(real(5)))).toBe(1);
    expect(mesesBonoDe(prueba(real(-5)))).toBe(0);
  });

  it('el modal muestra el aviso y propone la fecha con el mes gratis', async () => {
    __reset({ tiendas: { t1: prueba(real(10)) } });
    const w = mount(PagoMembresiaModal, { props: { visible: true, tienda: t('t1') as any } });
    await flushPromises();
    expect(w.find('[data-testid="bono-primer-pago"]').exists()).toBe(true);
    expect((w.find('#pago-hasta').element as HTMLInputElement).value).toBe(calcularVigencia(real(10), 'mensual', new Date(), 1).hasta);

    const sin = mount(PagoMembresiaModal, { props: { visible: true, tienda: { ...t('t1'), membresia: { plan: 'mensual', vigenteHasta: real(10) } } as any } });
    await flushPromises();
    expect(sin.find('[data-testid="bono-primer-pago"]').exists()).toBe(false);
  });
});

describe('pago automático (servidor, Mercado Pago)', () => {
  const AHORA = new Date('2026-09-06T18:00:00Z');
  const base = { intento: { id: 'i1', plan: 'mensual' as const, monto: 300 }, mpPago: { id: 987, transaction_amount: 300 }, config: {}, ahora: AHORA, pagoId: 'p1', historialId: 'h1' };

  it('mesesBonoPrimerPago: solo con prueba vigente y sin pagos previos', () => {
    expect(mesesBonoPrimerPago({ estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-09-20' } }, '2026-09-06')).toBe(1);
    expect(mesesBonoPrimerPago({ estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-09-06' } }, '2026-09-06')).toBe(1);
    expect(mesesBonoPrimerPago({ estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-09-05' } }, '2026-09-06')).toBe(0);
    expect(mesesBonoPrimerPago({ estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-09-20', ultimoPago: {} } }, '2026-09-06')).toBe(0);
    expect(mesesBonoPrimerPago({ estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2026-09-20' } }, '2026-09-06')).toBe(0);
    expect(mesesBonoPrimerPago({ estatus: 'bloqueada', membresia: { plan: 'prueba', vigenteHasta: '2026-09-20' } }, '2026-09-06')).toBe(0);
    expect(mesesBonoPrimerPago(null, '2026-09-06')).toBe(0);
  });

  it('primer pago en prueba suma 1 mes gratis y lo anota; sin prueba no cambia nada', () => {
    const conBono = cambiosParaPagoAprobado({ ...base, tiendaId: 't1', tienda: { estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-09-20' } } });
    expect(conBono.cambios['tiendas/t1/membresia/vigenteHasta']).toBe('2026-11-20');
    expect(conBono.pago).toMatchObject({ vigenteDesde: '2026-09-20', vigenteHasta: '2026-11-20', mesesGratis: 1 });

    const sinBono = cambiosParaPagoAprobado({ ...base, tiendaId: 't1', tienda: { estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2026-09-20' } } });
    expect(sinBono.cambios['tiendas/t1/membresia/vigenteHasta']).toBe('2026-10-20');
    expect((sinBono.pago as any).mesesGratis).toBeUndefined();
  });

  it('calcularVigencia del servidor con meses extra', () => {
    expect(vigenciaServidor('2026-09-20', 'anual', '2026-09-06', 1).hasta).toBe('2027-10-20');
  });
});
