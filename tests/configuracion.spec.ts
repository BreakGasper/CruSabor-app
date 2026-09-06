/**
 * Configuración del sistema (`configuracion/`): valores por defecto, guardado por el admin,
 * días de gracia aplicados a la regla de membresía, registro cerrado, mantenimiento y
 * precio sugerido en el modal de pago.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import {
  normalizarConfiguracion,
  guardarConfiguracion,
  enMantenimientoPara,
  precioPlan,
  useConfiguracion,
  __setConfiguracion,
  CONFIG_DEFAULT,
} from '@/composables/useConfiguracion';
import { estadoEfectivo, tiendaPuedeVender, avisoEstadoTienda, diasGraciaConfigurados } from '@/composables/useMembresia';
import AdminConfiguracion from '@/modules/admin/views/AdminConfiguracion.vue';
import PagoMembresiaModal from '@/modules/admin/components/PagoMembresiaModal.vue';

const HOY = new Date(2026, 8, 6, 12); // 6 sep 2026

beforeEach(() => {
  __reset({ configuracion: {}, tiendas: {} });
  __setConfiguracion(null);
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  routeMock.query = {};
});
afterEach(() => {
  __setConfiguracion(null);
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('normalizarConfiguracion', () => {
  it('sin datos regresa los valores por defecto', () => {
    expect(normalizarConfiguracion(null)).toMatchObject(CONFIG_DEFAULT);
  });

  it('mezcla campo por campo y limpia valores inválidos', () => {
    const c = normalizarConfiguracion({
      membresia: { precioMensual: '350', diasGracia: -3 },
      mantenimiento: { activo: 'sí' },
      soporte: { whatsapp: '(33) 1234-5678 ext 9', email: '  a@b.mx ' },
    });
    expect(c.membresia).toEqual({ precioMensual: 350, precioAnual: 0, diasGracia: 0 });
    expect(c.mantenimiento.activo).toBe(false);
    expect(c.soporte).toEqual({ whatsapp: '3312345678', email: 'a@b.mx' });
    expect(c.registro.tiendasAbierto).toBe(true);
  });
});

describe('guardarConfiguracion', () => {
  it('escribe solo lo indicado, mezcla con lo existente y firma quién y cuándo', async () => {
    __reset({ configuracion: { membresia: { precioMensual: 100, precioAnual: 1000, diasGracia: 2 } } });
    await guardarConfiguracion({ membresia: { precioMensual: 350 }, mantenimiento: { activo: true } });
    const g = __getAt('configuracion');
    expect(g.membresia).toEqual({ precioMensual: 350, precioAnual: 1000, diasGracia: 2 });
    expect(g.mantenimiento.activo).toBe(true);
    expect(g.actualizadoPor).toBe('Ana Admin');
    expect(typeof g.actualizadoEn).toBe('string');
  });

  it('sin cambios no escribe nada', async () => {
    await guardarConfiguracion({});
    expect(__getAt('configuracion')).toEqual({});
  });
});

describe('días de gracia aplicados a la membresía', () => {
  const vencida = { estatus: 'activa' as const, membresia: { vigenteHasta: '2026-09-03' } }; // venció hace 3 días

  it('sin gracia la tienda vencida no vende; con 5 días de gracia sí, y el aviso lo explica', async () => {
    expect(diasGraciaConfigurados()).toBe(0);
    expect(estadoEfectivo(vencida, HOY)).toBe('vencida');

    __setConfiguracion({ membresia: { diasGracia: 5 } });
    expect(diasGraciaConfigurados()).toBe(5);
    expect(tiendaPuedeVender(vencida, HOY)).toBe(true);
    const aviso = avisoEstadoTienda(vencida, HOY);
    expect(aviso?.tipo).toBe('error');
    expect(aviso?.detalle).toMatch(/2 días más por periodo de gracia/);

    __setConfiguracion({ membresia: { diasGracia: 2 } });
    expect(tiendaPuedeVender(vencida, HOY)).toBe(false);
  });

  it('la configuración llega en vivo desde Firebase', async () => {
    const { configuracion } = useConfiguracion();
    await flushPromises();
    expect(configuracion.value.membresia.diasGracia).toBe(0);
    await guardarConfiguracion({ membresia: { diasGracia: 7 } });
    await flushPromises();
    expect(configuracion.value.membresia.diasGracia).toBe(7);
    expect(diasGraciaConfigurados()).toBe(7);
  });
});

describe('mantenimiento y precios', () => {
  it('el mantenimiento bloquea todo menos el panel de administración', () => {
    const c = normalizarConfiguracion({ mantenimiento: { activo: true } });
    expect(enMantenimientoPara(c, '/')).toBe(true);
    expect(enMantenimientoPara(c, '/store/profile')).toBe(true);
    expect(enMantenimientoPara(c, '/admin')).toBe(false);
    expect(enMantenimientoPara(c, '/admin/configuracion')).toBe(false);
    expect(enMantenimientoPara(normalizarConfiguracion(null), '/')).toBe(false);
  });

  it('precioPlan según el plan', () => {
    const c = normalizarConfiguracion({ membresia: { precioMensual: 300, precioAnual: 3000 } });
    expect(precioPlan(c, 'mensual')).toBe(300);
    expect(precioPlan(c, 'anual')).toBe(3000);
  });

  it('el modal de pago sugiere el precio configurado y lo cambia con el plan', async () => {
    __setConfiguracion({ membresia: { precioMensual: 300, precioAnual: 3000 } });
    const w = mount(PagoMembresiaModal, {
      props: { visible: true, tienda: { tiendaId: 't1', nombreTienda: 'T', estatus: 'activa' } },
    });
    await flushPromises();
    expect((w.find('#pago-monto').element as HTMLInputElement).value).toBe('300');
    await w.find('#pago-plan').setValue('anual');
    expect((w.find('#pago-monto').element as HTMLInputElement).value).toBe('3000');
    // si el admin escribe otro monto, no se sobreescribe al cambiar de plan
    await w.find('#pago-monto').setValue('2500');
    await w.find('#pago-plan').setValue('mensual');
    expect((w.find('#pago-monto').element as HTMLInputElement).value).toBe('2500');
  });
});

describe('pantalla AdminConfiguracion', () => {
  const stubs = { AdminTopbar: true };

  it('carga los valores actuales y guarda los cambios', async () => {
    __reset({ configuracion: { membresia: { precioMensual: 100, precioAnual: 1000, diasGracia: 0 } } });
    const w = mount(AdminConfiguracion, { global: { stubs } });
    await flushPromises();
    expect((w.find('#cfg-mensual').element as HTMLInputElement).value).toBe('100');
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined();

    await w.find('#cfg-mensual').setValue('350');
    await w.find('#cfg-gracia').setValue('5');
    await w.find('#cfg-wa').setValue('3312345678');
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
    await w.find('form').trigger('submit');
    await flushPromises();

    const g = __getAt('configuracion');
    expect(g.membresia).toEqual({ precioMensual: 350, precioAnual: 1000, diasGracia: 5 });
    expect(g.soporte.whatsapp).toBe('3312345678');
    expect(g.actualizadoPor).toBe('Ana Admin');
    expect(diasGraciaConfigurados()).toBe(5);
  });

  it('valida días de gracia, WhatsApp y correo antes de guardar', async () => {
    const w = mount(AdminConfiguracion, { global: { stubs } });
    await flushPromises();
    await w.find('#cfg-gracia').setValue('120');
    await w.find('#cfg-wa').setValue('331');
    await w.find('#cfg-email').setValue('no-es-correo');
    await w.find('form').trigger('submit');
    await flushPromises();
    const errores = w.findAll('.error-text').map((e) => e.text());
    expect(errores).toEqual(expect.arrayContaining([expect.stringMatching(/0 y 90/), expect.stringMatching(/10 dígitos/), expect.stringMatching(/Correo/)]));
    expect(__getAt('configuracion')).toEqual({});
  });

  it('activar mantenimiento pide confirmación y respeta la cancelación', async () => {
    const w = mount(AdminConfiguracion, { global: { stubs } });
    await flushPromises();
    await w.find('#cfg-mant').setValue(true);

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false });
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(__getAt('configuracion/mantenimiento')).toBeUndefined();

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true });
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(__getAt('configuracion/mantenimiento/activo')).toBe(true);
  });

  it('cerrar el registro guarda el aviso que verán las tiendas', async () => {
    const w = mount(AdminConfiguracion, { global: { stubs } });
    await flushPromises();
    await w.find('#cfg-registro').setValue(false);
    await w.find('#cfg-registro-msg').setValue('Cupo lleno por este mes.');
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(__getAt('configuracion/registro')).toEqual({ tiendasAbierto: false, mensajeCerrado: 'Cupo lleno por este mes.' });
  });
});
