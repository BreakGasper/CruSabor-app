/**
 * Calificación con estrellas de artículos y tiendas: regla pura del promedio, voto por
 * cliente en Firebase, componente de estrellas y portada (categorías y tiendas destacadas).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { flush } from './helpers';
import { sessionUser } from '@/utils/sessionUser';
import { resumirVotos, useCalificaciones, __setVotos } from '@/composables/useCalificaciones';
import { __setControlPorTienda } from '@/composables/useMembresia';
import StarRating from '@/components/StarRating.vue';
import TiendasDestacadas from '@/modules/home/components/TiendasDestacadas.vue';
import CategoriasScroll from '@/modules/home/components/CategoriasScroll.vue';
import { routerMock } from './setup';

beforeEach(() => {
  __reset({
    calificaciones: {},
    tiendas: {
      t1: { nombreTienda: 'Pastelería Lola', categoria: 'Postres', bannerUrl: 'https://cdn.test/b1.jpg', logoUrl: 'https://cdn.test/l1.png', estatus: 'activa' },
      t2: { nombreTienda: 'Muebles America', categoria: 'Hogar', estatus: 'activa' },
      t3: { nombreTienda: 'Bloqueada', estatus: 'bloqueada' },
    },
    categorias: {
      c1: { id: 'c1', nombre: 'Ropa', icono: 'https://cdn.test/ropa.png' },
      c2: { id: 'c2', nombre: 'Alimentos', icono: '' },
      c3: { id: 'c3', nombre: 'Sub', padreId: 'c1' },
    },
  });
  sessionUser.value = null as any;
  __setVotos('articulos', null);
  __setVotos('tiendas', null);
  routerMock.push.mockClear();
});
afterEach(() => __setControlPorTienda(null));

describe('resumirVotos', () => {
  it('promedia a un decimal e ignora valores inválidos', () => {
    expect(resumirVotos(null)).toEqual({ promedio: 0, total: 0 });
    expect(
      resumirVotos({
        a: { estrellas: 5, fecha: '' },
        b: { estrellas: 4, fecha: '' },
        c: { estrellas: 9, fecha: '' }, // fuera de rango: se ignora
        d: { estrellas: 'x' as any, fecha: '' },
      }),
    ).toEqual({ promedio: 4.5, total: 2 });
    expect(resumirVotos({ a: { estrellas: 4, fecha: '' }, b: { estrellas: 3, fecha: '' }, c: { estrellas: 3, fecha: '' } }).promedio).toBe(3.3);
  });
});

describe('useCalificaciones', () => {
  it('sin sesión de cliente no guarda y devuelve false', async () => {
    const { calificar } = useCalificaciones('articulos');
    expect(await calificar('art-1', 5)).toBe(false);
    expect(__getAt('calificaciones/articulos/art-1')).toBeUndefined();
  });

  it('con sesión guarda un voto por cliente, lo reemplaza y el promedio se actualiza en vivo', async () => {
    sessionUser.value = { id: 'cli-1', nombre: 'Ana' };
    const { calificar, resumenDe, miVoto } = useCalificaciones('articulos');
    expect(await calificar('art-1', 5)).toBe(true);
    await flush();
    expect(__getAt('calificaciones/articulos/art-1/cli-1/estrellas')).toBe(5);
    expect(resumenDe('art-1')).toEqual({ promedio: 5, total: 1 });
    expect(miVoto('art-1')).toBe(5);

    await calificar('art-1', 7); // se acota a 5
    await calificar('art-1', 3); // reemplaza
    await flush();
    expect(resumenDe('art-1')).toEqual({ promedio: 3, total: 1 });

    sessionUser.value = { id: 'cli-2', nombre: 'Beto' };
    await calificar('art-1', 5);
    await flush();
    expect(resumenDe('art-1')).toEqual({ promedio: 4, total: 2 });
    expect(miVoto('art-1')).toBe(5);
  });
});

describe('StarRating', () => {
  it('pinta el promedio y emite rate al pulsar una estrella cuando es editable', async () => {
    const w = mount(StarRating, { props: { promedio: 3.5, total: 4, editable: true } });
    const estrellas = w.findAll('.estrella');
    expect(estrellas).toHaveLength(5);
    expect(estrellas[2].classes()).toContain('llena');
    expect(estrellas[3].classes()).toContain('media');
    expect(estrellas[4].classes()).not.toContain('llena');
    expect(w.find('.valor').text()).toBe('3.5');
    expect(w.find('.total').text()).toBe('(4)');
    await estrellas[4].trigger('click');
    expect(w.emitted('rate')).toEqual([[5]]);
  });

  it('sin editable las estrellas están deshabilitadas y no emite', async () => {
    const w = mount(StarRating, { props: { promedio: 0, total: 0 } });
    expect(w.find('.valor').text()).toBe('—');
    expect(w.find('.estrella').attributes('disabled')).toBeDefined();
    await w.find('.estrella').trigger('click');
    expect(w.emitted('rate')).toBeUndefined();
  });
});

describe('Portada', () => {
  it('CategoriasScroll muestra solo categorías principales con icono y nombre, y navega', async () => {
    const w = mount(CategoriasScroll);
    await flushPromises();
    const items = w.findAll('.categoria');
    expect(items.map((i) => i.text())).toEqual(['Alimentos', 'Ropa']);
    expect(items[1].find('img').attributes('src')).toBe('https://cdn.test/ropa.png');
    await items[1].trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith({ name: 'categoriaArticulos', params: { id: 'c1', categoriaNombre: 'Ropa' } });
  });

  it('TiendasDestacadas lista en vertical banner, nombre, corazón y estrellas solo de lectura de tiendas que pueden vender', async () => {
    __setControlPorTienda({ t1: { estatus: 'activa' }, t2: { estatus: 'activa' }, t3: { estatus: 'bloqueada' } });
    __setVotos('tiendas', { t2: { u1: { estrellas: 5, fecha: '' } } });
    const w = mount(TiendasDestacadas, { global: { stubs: { FontAwesomeIcon: true } } });
    await flushPromises();
    const cards = w.findAll('.tienda-card');
    // t2 primero por mejor calificación (orden), t3 bloqueada no aparece
    expect(cards.map((c) => c.find('.nombre').text())).toEqual(['Muebles America', 'Pastelería Lola']);
    expect(cards[1].find('.banner img').attributes('src')).toBe('https://cdn.test/b1.jpg');
    expect(cards[0].find('.corazon').exists()).toBe(true);
    // Las estrellas se ven pero están deshabilitadas: no se califica desde la portada
    expect(cards[0].find('.star-rating .valor').text()).toBe('5.0');
    expect(cards[0].find('.star-rating').classes()).not.toContain('editable');
    expect(cards[1].find('.estrella').attributes('disabled')).toBeDefined();
    sessionUser.value = { id: 'cli-9', nombre: 'Cli' };
    await cards[1].findAll('.estrella')[3].trigger('click');
    await flushPromises();
    expect(__getAt('calificaciones/tiendas/t1')).toBeUndefined();

    // Click en la tarjeta abre el perfil de la tienda
    await cards[0].trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/store/profile/t2');
  });
});
