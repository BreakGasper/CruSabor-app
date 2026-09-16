/**
 * Panel de administración · tiendas: aprobar, bloquear, desbloquear y registrar pagos
 * de membresía, con historial. Se prueba el composable y la pantalla de lista.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';
import { withSetup } from './helpers';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { estadoEfectivo } from '@/composables/useMembresia';
import {
  aprobarTienda,
  bloquearTienda,
  desbloquearTienda,
  registrarPago,
  calcularVigencia,
  sumarMeses,
  useHistorialTienda,
} from '@/composables/useAdminTiendas';
import AdminTiendas from '@/modules/admin/views/AdminTiendas.vue';
import { __setConfiguracion } from '@/composables/useConfiguracion';

const HOY = new Date(2026, 8, 6); // 6 sep 2026
const base = { telefono: '3311111111', envioDomicilio: true, metodosPago: ['Efectivo'], horario: {}, categoria: 'Comida', municipio: 'Zapopan' };
const tiendas = () => ({
  pend: { ...base, nombreTienda: 'Pendiente SA', estatus: 'pendiente', creadaEn: '2026-09-01T10:00:00Z' },
  act: { ...base, nombreTienda: 'Activa SA', estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
  bloq: { ...base, nombreTienda: 'Bloqueada SA', estatus: 'bloqueada', motivoBloqueo: 'Sin pago' },
  venc: { ...base, nombreTienda: 'Vencida SA', estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2020-01-01' } },
  legacy: { ...base, nombreTienda: 'Legacy SA', estado: 'Jalisco' },
});

beforeEach(() => {
  __reset({ tiendas: tiendas() });
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  routeMock.query = {};
});
afterEach(() => {
  cerrarSesionAdmin();
  localStorage.clear();
});

const t = (id: string) => ({ ...__getAt(`tiendas/${id}`), tiendaId: id });
const historialDe = (id: string) => Object.values(__getAt(`tiendas/${id}/historialEstatus`) || {}) as any[];
const pagosDe = (id: string) => Object.values(__getAt(`tiendas/${id}/pagosMembresia`) || {}) as any[];

describe('fechas de vigencia', () => {
  it('sumarMeses respeta fin de mes y años', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-09-06', 1)).toBe('2026-10-06');
    expect(sumarMeses('2026-09-06', 12)).toBe('2027-09-06');
  });

  it('calcularVigencia parte de hoy si no hay vigencia o ya venció, y de la vigencia actual si sigue viva', () => {
    expect(calcularVigencia(undefined, 'mensual', HOY)).toEqual({ desde: '2026-09-06', hasta: '2026-10-06' });
    expect(calcularVigencia('2020-01-01', 'anual', HOY)).toEqual({ desde: '2026-09-06', hasta: '2027-09-06' });
    expect(calcularVigencia('2026-09-20', 'mensual', HOY)).toEqual({ desde: '2026-09-20', hasta: '2026-10-20' });
  });
});

describe('acciones del administrador', () => {
  it('aprobar deja la tienda activa, registra quién y cuándo, y escribe historial', async () => {
    await aprobarTienda(t('pend'));
    const g = t('pend');
    expect(g.estatus).toBe('activa');
    expect(g.aprobadaPor).toBe('Ana Admin');
    expect(typeof g.aprobadaEn).toBe('string');
    expect(historialDe('pend')).toMatchObject([{ de: 'pendiente', a: 'activa', por: 'Ana Admin' }]);
  });

  it('bloquear exige motivo, lo guarda y la tienda deja de vender', async () => {
    await expect(bloquearTienda(t('act'), '   ')).rejects.toThrow(/motivo/);
    await bloquearTienda(t('act'), 'Pago no recibido');
    const g = t('act');
    expect(g.estatus).toBe('bloqueada');
    expect(g.motivoBloqueo).toBe('Pago no recibido');
    expect(estadoEfectivo(g)).toBe('bloqueada');
    expect(historialDe('act')[0]).toMatchObject({ de: 'activa', a: 'bloqueada', motivo: 'Pago no recibido' });
  });

  it('desbloquear limpia el motivo y vuelve a activa', async () => {
    await desbloquearTienda(t('bloq'));
    const g = t('bloq');
    expect(g.estatus).toBe('activa');
    expect(g.motivoBloqueo).toBeUndefined();
    expect(historialDe('bloq')[0]).toMatchObject({ de: 'bloqueada', a: 'activa' });
  });

  it('una tienda sin estatus (anterior a la regla) se registra como "sin-estatus" en el historial', async () => {
    await bloquearTienda(t('legacy'), 'Revisión');
    expect(historialDe('legacy')[0]).toMatchObject({ de: 'sin-estatus', a: 'bloqueada' });
    expect(t('legacy').estado).toBe('Jalisco'); // el estado geográfico no se toca
  });

  it('registrar pago guarda el pago, actualiza la membresía y reactiva una tienda vencida', async () => {
    const pago = await registrarPago(t('venc'), { monto: 350, metodo: 'Transferencia', referencia: ' ABC123 ', plan: 'mensual' });
    const g = t('venc');
    expect(g.estatus).toBe('activa');
    expect(g.membresia.plan).toBe('mensual');
    expect(g.membresia.vigenteHasta).toBe(pago.vigenteHasta);
    expect(g.membresia.vigenteHasta > '2026-01-01').toBe(true);
    expect(g.membresia.ultimoPago).toMatchObject({ monto: 350, metodo: 'Transferencia', referencia: 'ABC123', registradoPor: 'Ana Admin' });
    expect(pagosDe('venc')).toHaveLength(1);
    expect(pagosDe('venc')[0]).toMatchObject({ monto: 350, plan: 'mensual', vigenteHasta: pago.vigenteHasta });
    expect(historialDe('venc')[0]).toMatchObject({ de: 'vencida', a: 'activa' });
    expect(estadoEfectivo(g)).toBe('activa');
  });

  it('un pago de tienda pendiente la autoriza; un pago de tienda activa solo extiende la vigencia', async () => {
    await registrarPago(t('pend'), { monto: 100, metodo: 'Efectivo', plan: 'anual' });
    expect(t('pend').estatus).toBe('activa');
    expect(historialDe('pend')).toHaveLength(1);

    await registrarPago(t('act'), { monto: 100, metodo: 'Efectivo', plan: 'mensual' });
    expect(t('act').membresia.vigenteHasta).toBe('2100-01-31'); // desde 2099-12-31 + 1 mes
    expect(historialDe('act')).toHaveLength(0);
  });

  it('valida monto, método y fecha', async () => {
    await expect(registrarPago(t('act'), { monto: 0, metodo: 'Efectivo', plan: 'mensual' })).rejects.toThrow(/monto/);
    await expect(registrarPago(t('act'), { monto: 10, metodo: '', plan: 'mensual' })).rejects.toThrow(/método/);
    await expect(registrarPago(t('act'), { monto: 10, metodo: 'Efectivo', plan: 'mensual', vigenteHasta: 'ayer' })).rejects.toThrow(/inválida/);
  });

  it('el historial en vivo se ordena del más reciente al más antiguo', async () => {
    await bloquearTienda(t('act'), 'Uno');
    await new Promise((r) => setTimeout(r, 5));
    await desbloquearTienda(t('act'));
    await registrarPago(t('act'), { monto: 50, metodo: 'Efectivo', plan: 'mensual' });

    const { result, unmount } = withSetup(() => useHistorialTienda(() => 'act'));
    result.cargar();
    await flushPromises();
    expect(result.historial.value.map((h) => h.a)).toEqual(['activa', 'bloqueada']);
    expect(result.pagos.value).toHaveLength(1);
    unmount();
  });
});

describe('pantalla AdminTiendas', () => {
  const stubs = { AdminTopbar: true, RouterLink: { template: '<a><slot /></a>' } };

  it('lista todas las tiendas con su situación y cuenta por filtro', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    expect(w.findAll('.fila')).toHaveLength(5);
    const chips = w.findAll('.chip');
    const conteo = Object.fromEntries(chips.map((c) => [c.text().replace(/\d+$/, '').trim(), Number(c.find('.chip-count').text())]));
    expect(conteo).toMatchObject({ Todas: 5, Pendientes: 1, Activas: 2, Vencidas: 1, Bloqueadas: 1 });
    expect(w.find('.fila[data-tienda="pend"] .estatus').text()).toBe('Pendiente de aprobación');
    expect(w.find('.fila[data-tienda="venc"] .estatus').text()).toBe('Membresía vencida');
    // pendientes primero
    expect(w.findAll('.fila')[0].attributes('data-tienda')).toBe('pend');
  });

  it('filtra por situación y por búsqueda', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    await w.findAll('.chip').find((c) => c.text().startsWith('Bloqueadas'))!.trigger('click');
    expect(w.findAll('.fila').map((f) => f.attributes('data-tienda'))).toEqual(['bloq']);

    await w.findAll('.chip').find((c) => c.text().startsWith('Todas'))!.trigger('click');
    await w.find('#buscar-tienda-admin').setValue('vencida');
    expect(w.findAll('.fila').map((f) => f.attributes('data-tienda'))).toEqual(['venc']);
  });

  it('abre con el filtro de la URL (?filtro=pendiente)', async () => {
    routeMock.query = { filtro: 'pendiente' };
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    expect(w.findAll('.fila').map((f) => f.attributes('data-tienda'))).toEqual(['pend']);
  });

  it('el interruptor de registro de tiendas refleja el estado y lo cambia en la configuración', async () => {
    __setConfiguracion({ registro: { tiendasAbierto: true } });
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();

    const banner = w.find('.registro-toggle');
    expect(banner.text()).toContain('Abierto');
    expect(banner.classes()).not.toContain('cerrado');

    // Cerrar el registro escribe el flag en la base (los clientes y tiendas existentes no se tocan)
    await banner.find('button').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/registro/tiendasAbierto')).toBe(false);

    __setConfiguracion(null); // vuelve a suscribirse al mock para las demás pruebas
  });

  it('muestra la acción correcta según la situación', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    expect(w.find('.fila[data-tienda="pend"] .btn-aprobar').text()).toBe('Aprobar');
    expect(w.find('.fila[data-tienda="pend"] .btn-bloquear').exists()).toBe(false);
    expect(w.find('.fila[data-tienda="bloq"] .btn-aprobar').text()).toBe('Desbloquear');
    expect(w.find('.fila[data-tienda="act"] .btn-bloquear').exists()).toBe(true);
    expect(w.find('.fila[data-tienda="venc"] .btn-bloquear').exists()).toBe(true);
    expect(w.findAll('.btn-pago')).toHaveLength(5);
  });

  it('aprobar tras confirmar actualiza la lista en vivo', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    await w.find('.fila[data-tienda="pend"] .btn-aprobar').trigger('click');
    await flushPromises();
    expect(t('pend').estatus).toBe('activa');
    expect(w.find('.fila[data-tienda="pend"] .estatus').text()).toBe('Activa');
    expect(w.find('.fila[data-tienda="pend"] .btn-bloquear').exists()).toBe(true);
  });

  it('bloquear pide el motivo y no hace nada si se cancela', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false, value: '' });
    await w.find('.fila[data-tienda="act"] .btn-bloquear').trigger('click');
    await flushPromises();
    expect(t('act').estatus).toBe('activa');

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'Adeudo de membresía' });
    await w.find('.fila[data-tienda="act"] .btn-bloquear').trigger('click');
    await flushPromises();
    expect(t('act')).toMatchObject({ estatus: 'bloqueada', motivoBloqueo: 'Adeudo de membresía' });
    expect(w.find('.fila[data-tienda="act"] .motivo').text()).toContain('Adeudo de membresía');
  });

  it('registrar pago desde el modal actualiza vigencia y situación', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    await w.find('.fila[data-tienda="venc"] .btn-pago').trigger('click');
    await flushPromises();
    expect(w.find('.modal').exists()).toBe(true);
    expect(w.find('.modal-sub').text()).toBe('Vencida SA');

    await w.find('#pago-monto').setValue('299');
    await w.find('#pago-metodo').setValue('Transferencia');
    await w.find('#pago-ref').setValue('SPEI-1');
    await w.find('.modal form, form.modal').trigger('submit');
    await flushPromises();

    expect(w.find('.modal').exists()).toBe(false);
    const g = t('venc');
    expect(g.estatus).toBe('activa');
    expect(g.membresia.ultimoPago).toMatchObject({ monto: 299, metodo: 'Transferencia', referencia: 'SPEI-1' });
    expect(w.find('.fila[data-tienda="venc"] .estatus').text()).toBe('Activa');
    expect(w.find('.fila[data-tienda="venc"] .vigencia').text()).toMatch(/Vigente hasta/);
  });

  it('el modal rechaza un monto vacío', async () => {
    const w = mount(AdminTiendas, { global: { stubs } });
    await flushPromises();
    await w.find('.fila[data-tienda="act"] .btn-pago').trigger('click');
    await flushPromises();
    await w.find('.modal form, form.modal').trigger('submit');
    await flushPromises();
    expect(w.find('.modal .error-text').text()).toMatch(/monto/);
    expect(pagosDe('act')).toHaveLength(0);
  });
});
