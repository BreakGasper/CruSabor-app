/**
 * Indicador de carga con el logo (services/carga.ts + baseDatos.ts + CargandoCrustore.vue)
 * y el logotipo escrito (MarcaCrustore.vue).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { __reset } from './mocks/firebaseDb';
import {
  estadoCarga,
  iniciarOperacion,
  rastrearSiInteraccion,
  marcarInteraccion,
  conCarga,
  ocultarIndicador,
  __resetCarga,
  RETRASO_MS,
  MINIMO_VISIBLE_MS,
  LENTO_MS,
  TOPE_MS,
  VENTANA_INTERACCION_MS,
} from '@/services/carga';
import { get, set, onValue, ref as dbRef } from '@/services/baseDatos';
import { db } from '@/firebase';
import CargandoCrustore from '@/components/CargandoCrustore.vue';
import MarcaCrustore from '@/components/MarcaCrustore.vue';

const { visible, lento, pendientes } = estadoCarga;

beforeEach(() => {
  vi.useFakeTimers();
  __resetCarga();
  __reset({ tiendas: { t1: { nombreTienda: 'Lola' } } });
});
afterEach(() => {
  __resetCarga();
  vi.useRealTimers();
});

describe('cuándo se ve el indicador', () => {
  it('solo si algo tarda más que el retraso; lo rápido no parpadea', () => {
    const rapido = iniciarOperacion();
    vi.advanceTimersByTime(RETRASO_MS - 50);
    rapido();
    vi.advanceTimersByTime(1000);
    expect(visible.value).toBe(false);

    const lentoOp = iniciarOperacion();
    vi.advanceTimersByTime(RETRASO_MS + 1);
    expect(visible.value).toBe(true);
    lentoOp();
    // se queda un mínimo para no ser un destello
    expect(visible.value).toBe(true);
    vi.advanceTimersByTime(MINIMO_VISIBLE_MS);
    expect(visible.value).toBe(false);
  });

  it('espera a que terminen todas las operaciones', () => {
    const a = iniciarOperacion();
    const b = iniciarOperacion();
    vi.advanceTimersByTime(RETRASO_MS + 1);
    a();
    vi.advanceTimersByTime(MINIMO_VISIBLE_MS + 10);
    expect(visible.value).toBe(true);
    b();
    vi.advanceTimersByTime(MINIMO_VISIBLE_MS + 10);
    expect(visible.value).toBe(false);
  });

  it('avisa cuando tarda mucho, se puede ocultar y nunca se queda pegado', () => {
    iniciarOperacion(); // nunca se termina a mano
    vi.advanceTimersByTime(LENTO_MS);
    expect(lento.value).toBe(true);
    ocultarIndicador();
    expect(visible.value).toBe(false);
    vi.advanceTimersByTime(TOPE_MS);
    expect(pendientes.value).toBe(0);
  });

  it('terminar dos veces la misma operación cuenta una sola', () => {
    const fin = iniciarOperacion();
    iniciarOperacion();
    fin();
    fin();
    expect(pendientes.value).toBe(1);
  });
});

describe('qué se rastrea', () => {
  it('lo que corre en segundo plano no cuenta; lo que sigue a un toque sí', async () => {
    let resolver!: () => void;
    const p = new Promise<void>((r) => (resolver = r));
    rastrearSiInteraccion(p);
    expect(pendientes.value).toBe(0);

    marcarInteraccion();
    rastrearSiInteraccion(p);
    expect(pendientes.value).toBe(1);
    resolver();
    await flushPromises();
    expect(pendientes.value).toBe(0);

    vi.advanceTimersByTime(VENTANA_INTERACCION_MS + 1);
    rastrearSiInteraccion(new Promise(() => {}));
    expect(pendientes.value).toBe(0);
  });

  it('conCarga siempre cuenta y devuelve el resultado', async () => {
    const r = conCarga(async () => 42);
    expect(pendientes.value).toBe(1);
    await expect(r).resolves.toBe(42);
    expect(pendientes.value).toBe(0);
  });

  it('get, set y la primera respuesta de onValue después de un toque', async () => {
    marcarInteraccion();
    const leido = get(dbRef(db, 'tiendas/t1'));
    expect(pendientes.value).toBe(1);
    expect((await leido).val()).toEqual({ nombreTienda: 'Lola' });
    await flushPromises();
    expect(pendientes.value).toBe(0);

    marcarInteraccion();
    await set(dbRef(db, 'tiendas/t2'), { nombreTienda: 'Ana' });
    await flushPromises();
    expect(pendientes.value).toBe(0);

    marcarInteraccion();
    const vistos: any[] = [];
    const off = onValue(dbRef(db, 'tiendas'), (snap) => vistos.push(snap.val()));
    await flushPromises();
    expect(vistos.length).toBeGreaterThan(0);
    expect(pendientes.value).toBe(0);
    off();
  });

  it('sin toque previo, la base funciona igual y no cuenta', async () => {
    const snap = await get(dbRef(db, 'tiendas/t1'));
    expect(snap.val().nombreTienda).toBe('Lola');
    expect(pendientes.value).toBe(0);
  });
});

describe('pantalla de carga', () => {
  it('muestra el logo animado y el aviso de lentitud con botón para ocultar', async () => {
    const w = mount(CargandoCrustore, { global: { stubs: { teleport: true } } });
    expect(w.find('[data-testid="cargando"]').exists()).toBe(false);

    iniciarOperacion();
    vi.advanceTimersByTime(RETRASO_MS + 1);
    await nextTick();
    const capa = w.find('[data-testid="cargando"]');
    expect(capa.exists()).toBe(true);
    expect(capa.attributes('role')).toBe('status');
    expect(w.find('svg.logo-crustore').classes()).toContain('animado');
    expect(capa.text()).toContain('Cargando');

    vi.advanceTimersByTime(LENTO_MS);
    await nextTick();
    expect(w.text()).toContain('tardando');
    await w.find('[data-testid="cargando-ocultar"]').trigger('click');
    await nextTick();
    expect(w.find('[data-testid="cargando"]').exists()).toBe(false);
  });
});

describe('logotipo escrito', () => {
  it('el icono hace de "C": se lee Crustore y se ve "rustore" junto al logo', () => {
    const w = mount(MarcaCrustore, { props: { fondo: 'oscuro' } });
    expect(w.attributes('aria-label')).toBe('Crustore');
    expect(w.find('.resto').text()).toBe('rustore');
    expect(w.find('svg').classes()).toContain('fondo-oscuro');
  });

  it('con acento pinta "store" y acepta un sufijo', () => {
    const w = mount(MarcaCrustore, { props: { acento: true, sufijo: '· Admin' } });
    expect(w.find('.acento').text()).toBe('store');
    expect(w.attributes('aria-label')).toBe('Crustore · Admin');
  });
});
