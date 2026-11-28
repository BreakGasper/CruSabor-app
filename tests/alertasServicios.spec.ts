/** Campana de la tienda: también avisa de cotizaciones por responder y citas por confirmar */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { flush, withSetup } from './helpers';
import { routerMock } from './setup';
import { ahoraEnZona, sumarDias } from '@/modules/servicios/disponibilidad';
import { citasSinConfirmar, cotizacionesSinResponder, useAlertasTienda } from '@/composables/useAlertasTienda';
import CampanaTienda from '@/modules/store/components/CampanaTienda.vue';

const T = 'tS';
const HOY = ahoraEnZona().fecha;
const FUTURO = sumarDias(HOY, 3);
const cot = (estado: string, extra = {}) => ({ servicioNombre: 'Desarrollo Web', clienteNombre: 'Ana', estado, creadaEn: new Date().toISOString(), ...extra });
const cita = (estado: string, fecha: string) => ({ servicioNombre: 'Corte', clienteNombre: 'Beto', estado, fecha, inicio: '10:00', fin: '11:00', creadaEn: new Date().toISOString() });

beforeEach(() => {
  __reset({
    cotizaciones: { [T]: { q1: cot('pendiente'), q2: cot('en_revision'), q3: cot('cotizada'), q4: cot('pendiente') } },
    citas: { [T]: { c1: cita('pendiente', FUTURO), c2: cita('confirmada', FUTURO), c3: cita('pendiente', '2020-01-01') } },
  });
  routerMock.push.mockClear();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('reglas', () => {
  it('cotizaciones sin responder: solo las pendientes', () => {
    expect(cotizacionesSinResponder([{ estado: 'pendiente' }, { estado: 'en_revision' }, { estado: 'aceptada' }] as any)).toHaveLength(1);
  });
  it('citas por confirmar: pendientes que aún no pasan', () => {
    expect(citasSinConfirmar([{ estado: 'pendiente', fecha: FUTURO }, { estado: 'pendiente', fecha: '2020-01-01' }, { estado: 'confirmada', fecha: FUTURO }] as any, HOY)).toHaveLength(1);
  });
});

describe('useAlertasTienda con servicios', () => {
  it('suma cotizaciones y citas al total', async () => {
    const { result, unmount } = withSetup(() => useAlertasTienda(T));
    await flush();
    expect(result.cotizacionesPendientes.value).toHaveLength(2);
    expect(result.citasPendientes.value).toHaveLength(1);
    expect(result.total.value).toBe(3);
    unmount();
  });
});

describe('CampanaTienda con servicios', () => {
  it('muestra el conteo, lista cada aviso y lleva a su pantalla', async () => {
    const w = mount(CampanaTienda, { props: { tiendaId: T }, attachTo: document.body });
    await flushPromises();
    expect(w.find('.badge').text()).toBe('3');
    await w.find('.campana').trigger('click');
    await flushPromises();
    const panel = document.body.querySelector('.panel-fondo') as HTMLElement;
    expect(panel.querySelector('[data-testid="aviso-cotizaciones"]')?.textContent).toContain('Cotizaciones por responder');
    expect(panel.querySelector('[data-testid="aviso-cotizaciones"]')?.textContent).toContain('Desarrollo Web');
    expect(panel.querySelector('[data-testid="aviso-citas"]')?.textContent).toContain('Citas por confirmar');
    (panel.querySelector('[data-testid="aviso-cotizaciones"] .link') as HTMLElement).click();
    expect(routerMock.push).toHaveBeenCalledWith(`/store/cotizaciones/${T}`);
    await flushPromises();
    await w.find('.campana').trigger('click');
    await flushPromises();
    (document.body.querySelector('[data-testid="aviso-citas"] .tarjeta') as HTMLElement).click();
    expect(routerMock.push).toHaveBeenCalledWith(`/store/citas/${T}`);
    w.unmount();
  });

  it('sin pendientes no muestra esos bloques', async () => {
    __reset({ cotizaciones: { [T]: { q: cot('aceptada') } } });
    const w = mount(CampanaTienda, { props: { tiendaId: T }, attachTo: document.body });
    await flushPromises();
    expect(w.find('.badge').exists()).toBe(false);
    w.unmount();
  });
});
