/**
 * Pago semiautomático de membresía: links de Mercado Pago en la configuración, aviso
 * "Ya pagué" de la tienda (solicitudesPago) y atención desde el tablero del admin.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { withSetup } from './helpers';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { normalizarConfiguracion, useConfiguracion, __setConfiguracion } from '@/composables/useConfiguracion';
import { reportarPago, atenderSolicitud, useSolicitudesPago } from '@/composables/useSolicitudesPago';
import AdminDashboard from '@/modules/admin/views/AdminDashboard.vue';

const TIENDA = 'tienda-1';
const base = { nombreTienda: 'Pan Lupita', estatus: 'activa', telefono: '3311111111', envioDomicilio: true, metodosPago: [], horario: {} };

let cleanups: Array<() => void> = [];
beforeEach(() => {
  __reset({ tiendas: { [TIENDA]: base }, solicitudesPago: {}, configuracion: {} });
  __setConfiguracion(null);
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
});
afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
  __setConfiguracion(null);
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('configuración de links de pago', () => {
  it('acepta solo URLs https/http y conserva las instrucciones por defecto', () => {
    const c = normalizarConfiguracion({ pagos: { linkMensual: 'https://mpago.la/abc', linkAnual: 'no-es-url' } });
    expect(c.pagos.linkMensual).toBe('https://mpago.la/abc');
    expect(c.pagos.linkAnual).toBe('');
    expect(c.pagos.instrucciones).toMatch(/Ya pagué/);
  });

  it('pagoEnLineaDisponible depende de que exista al menos un link', () => {
    const { pagoEnLineaDisponible } = useConfiguracion();
    __setConfiguracion({ pagos: {} });
    expect(pagoEnLineaDisponible.value).toBe(false);
    __setConfiguracion({ pagos: { linkAnual: 'https://mpago.la/anual' } });
    expect(pagoEnLineaDisponible.value).toBe(true);
  });
});

describe('solicitudes de pago', () => {
  it('reportarPago crea la solicitud como "reportado" con la referencia limpia', async () => {
    const id = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'mensual', referencia: '  OP-123  ' });
    expect(__getAt(`solicitudesPago/${id}`)).toMatchObject({ tiendaId: TIENDA, plan: 'mensual', referencia: 'OP-123', estado: 'reportado' });
    const sinRef = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'anual' });
    expect(__getAt(`solicitudesPago/${sinRef}/referencia`)).toBeUndefined();
  });

  it('atenderSolicitud firma quién y cuándo', async () => {
    const id = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'mensual' });
    await atenderSolicitud(id, 'descartado', 'No aparece el cobro');
    expect(__getAt(`solicitudesPago/${id}`)).toMatchObject({ estado: 'descartado', atendidoPor: 'Ana Admin', nota: 'No aparece el cobro' });
    expect(typeof __getAt(`solicitudesPago/${id}/atendidoEn`)).toBe('string');
  });

  it('la lista en vivo filtra pendientes y por tienda', async () => {
    const a = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'mensual' });
    await reportarPago({ tiendaId: 'otra', nombreTienda: 'Otra', plan: 'anual' });
    const { result, unmount } = withSetup(() => ({
      pend: useSolicitudesPago({ soloPendientes: true }),
      mias: useSolicitudesPago({ soloPendientes: true, tiendaId: () => TIENDA }),
      todas: useSolicitudesPago(),
    }));
    cleanups.push(unmount);
    await flushPromises();
    expect(result.pend.solicitudes.value).toHaveLength(2);
    expect(result.mias.solicitudes.value.map((s) => s.id)).toEqual([a]);
    await atenderSolicitud(a, 'atendido');
    await flushPromises();
    expect(result.pend.solicitudes.value).toHaveLength(1);
    expect(result.mias.solicitudes.value).toHaveLength(0);
    expect(result.todas.solicitudes.value).toHaveLength(2);
  });
});

describe('tablero del admin', () => {
  const stubs = { AdminTopbar: true, RouterLink: { template: '<a><slot /></a>' } };

  it('muestra los avisos pendientes y registra el pago prellenado desde el aviso', async () => {
    __setConfiguracion({ membresia: { precioMensual: 300, precioAnual: 3000 } });
    const id = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'anual', referencia: 'OP-9' });
    const w = mount(AdminDashboard, { global: { stubs } });
    await flushPromises();

    const fila = w.find(`.solicitud[data-solicitud="${id}"]`);
    expect(fila.exists()).toBe(true);
    expect(fila.text()).toMatch(/Pan Lupita.*Plan Anual.*Ref\. OP-9/s);

    await fila.find('.btn-mini-ok').trigger('click');
    await flushPromises();
    expect(w.find('.modal').exists()).toBe(true);
    expect((w.find('#pago-plan').element as HTMLSelectElement).value).toBe('anual');
    expect((w.find('#pago-ref').element as HTMLInputElement).value).toBe('OP-9');
    expect((w.find('#pago-metodo').element as HTMLSelectElement).value).toBe('Transferencia');
    expect((w.find('#pago-monto').element as HTMLInputElement).value).toBe('3000');

    await w.find('form.modal').trigger('submit');
    await flushPromises();

    expect(__getAt(`tiendas/${TIENDA}/membresia/plan`)).toBe('anual');
    expect(__getAt(`tiendas/${TIENDA}/membresia/ultimoPago`)).toMatchObject({ monto: 3000, metodo: 'Transferencia', referencia: 'OP-9' });
    expect(__getAt(`solicitudesPago/${id}`)).toMatchObject({ estado: 'atendido', atendidoPor: 'Ana Admin' });
    expect(w.find('.solicitudes').exists()).toBe(false); // ya no hay pendientes
  });

  it('descartar pide confirmación y cierra el aviso', async () => {
    const id = await reportarPago({ tiendaId: TIENDA, nombreTienda: 'Pan Lupita', plan: 'mensual' });
    const w = mount(AdminDashboard, { global: { stubs } });
    await flushPromises();

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false });
    await w.find('.solicitud .btn-mini:not(.btn-mini-ok)').trigger('click');
    await flushPromises();
    expect(__getAt(`solicitudesPago/${id}/estado`)).toBe('reportado');

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'Sin cobro' });
    await w.find('.solicitud .btn-mini:not(.btn-mini-ok)').trigger('click');
    await flushPromises();
    expect(__getAt(`solicitudesPago/${id}`)).toMatchObject({ estado: 'descartado', nota: 'Sin cobro' });
  });
});
