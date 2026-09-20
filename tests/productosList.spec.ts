/**
 * "Ver más" del carrusel → /productos: lista completa ordenada por fecha
 * (más recientes primero), con buscador y otros órdenes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { sessionUser } from '@/utils/sessionUser';
import { fechaArticulo } from '@/composables/useArticulos';
import ProductosList from '@/modules/home/components/ProductosList.vue';
import HorizontalCarousel from '@/modules/home/components/HorizontalCarousel.vue';

const art = (id: string, nombre: string, fecha: string, precio: number, extra: Record<string, any> = {}) => ({
  nombre, precio, fecha_hora: fecha, url: '', categoria: 'Alimentos', tiendaId: 't1', tiendaNombre: 'Lola',
  variantes: [{ sku: 's-' + id, stock: 5, precio }], ...extra,
});

const stubs = { FontAwesomeIcon: true, ArrowBack: true, PageHeader: { template: '<div><slot /></div>' }, CartButton: true };
let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; });

beforeEach(() => {
  __reset({
    articulos: {
      viejo: art('viejo', 'Jericalla', '2026-01-10T10:00:00.000Z', 32),
      medio: art('medio', 'Chocoflan', '2026-05-07T13:00:00.000Z', 45),
      texto: art('texto', 'Mojaditos', '17/4/2026, 6:14:20 p.m.', 38), // formato viejo
      nuevo: art('nuevo', 'Pay de queso', new Date().toISOString(), 60),
      sinfecha: art('sinfecha', 'Varios', '', 220),
    },
    tiendas: { t1: { nombreTienda: 'Lola', envioDomicilio: true } },
  });
  sessionUser.value = null;
  routerMock.push.mockClear();
});

describe('fechaArticulo', () => {
  it('entiende ISO, texto local y vacío', () => {
    expect(fechaArticulo({ fecha_hora: '2026-05-07T13:00:00.000Z' })).toBe(Date.parse('2026-05-07T13:00:00.000Z'));
    const t = new Date(fechaArticulo({ fecha_hora: '17/4/2026, 6:14:20 p.m.' }));
    expect([t.getDate(), t.getMonth() + 1, t.getFullYear()]).toEqual([17, 4, 2026]);
    expect(fechaArticulo({ fecha_hora: '' })).toBe(0);
    expect(fechaArticulo(null)).toBe(0);
  });
});

describe('ProductosList', () => {
  async function montar() {
    const w = mount(ProductosList, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    return w;
  }
  const nombres = (w: any) => w.findAll('.nombre').map((n: any) => n.text());

  it('lista todos los artículos, los más recientes primero, y marca "Nuevo" el de esta semana', async () => {
    const w = await montar();
    expect(w.find('.counter').text()).toBe('5 productos');
    expect(nombres(w)).toEqual(['Pay de queso', 'Chocoflan', 'Mojaditos', 'Jericalla', 'Varios']);
    expect(w.findAll('.badge-nuevo')).toHaveLength(1);
    expect(w.findAll('.card')[0].find('.badge-nuevo').exists()).toBe(true);
    expect(w.findAll('.fecha')[1].text()).toContain('Publicado el');
  });

  it('otros órdenes y búsqueda', async () => {
    const w = await montar();
    await w.find('select.orden').setValue('antiguos');
    expect(nombres(w)).toEqual(['Varios', 'Jericalla', 'Mojaditos', 'Chocoflan', 'Pay de queso']);
    await w.find('select.orden').setValue('menor');
    expect(nombres(w)[0]).toBe('Jericalla');
    await w.find('select.orden').setValue('mayor');
    expect(nombres(w)[0]).toBe('Varios');

    await w.find('select.orden').setValue('recientes');
    await w.find('input[type=search]').setValue('choco');
    expect(nombres(w)).toEqual(['Chocoflan']);
    await w.find('input[type=search]').setValue('lola'); // por tienda
    expect(nombres(w)).toHaveLength(5);
    await w.find('input[type=search]').setValue('zzz');
    expect(w.text()).toContain('Nada coincide');
  });

  it('al tocar una tarjeta abre el detalle', async () => {
    const w = await montar();
    await w.find('.card').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/producto/nuevo');
  });
});

describe('Carrusel "Ver más"', () => {
  it('navega a /productos', async () => {
    const w = mount(HorizontalCarousel, {
      props: { productos: [art('a', 'A', '2026-01-01T00:00:00.000Z', 1) as any] },
      global: { stubs },
    });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await w.find('.ver-mas').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/productos');
  });
});

/**
 * La pantalla de una categoría usa la MISMA tarjeta que la portada y /productos.
 * Antes tenía su propia versión, con lógica de carrito duplicada que además
 * exigía sesión: el invitado veía los productos pero no podía agregarlos.
 */
describe('ArticulosCategorias · usa la tarjeta compartida', () => {
  it('muestra los artículos de la categoría con ProductCard', async () => {
    const ArticulosCategorias = (await import('@/modules/home/components/ArticulosCategorias.vue')).default;
    const ProductCard = (await import('@/modules/home/components/ProductCard.vue')).default;

    // escenario propio: el fixture compartido no trae categoriaId
    __reset({
      articulos: {
        a1: { nombre: 'Pay', precio: 50, url: '', tiendaId: 't1', categoria: 'Postres', categoriaId: 'cat-1', variantes: [{ sku: 'S1', stock: 5, precio: 50 }] },
        a2: { nombre: 'Flan', precio: 30, url: '', tiendaId: 't1', categoria: 'Postres', categoriaId: 'cat-1', variantes: [{ sku: 'S2', stock: 5, precio: 30 }] },
        otro: { nombre: 'Silla', precio: 90, url: '', tiendaId: 't1', categoria: 'Muebles', categoriaId: 'cat-9', variantes: [{ sku: 'S3', stock: 5, precio: 90 }] },
      },
      tiendas: { t1: { nombreTienda: 'Lola', envioDomicilio: true } },
    });

    const w = mount(ArticulosCategorias, {
      props: { id: 'cat-1', categoriaNombre: 'Postres' },
      global: { stubs: { FontAwesomeIcon: true, PageHeader: true, StarRating: true } },
    });
    await flushPromises();
    await flushPromises();

    const tarjetas = w.findAllComponents(ProductCard);
    expect(tarjetas).toHaveLength(2); // solo los de cat-1, la silla queda fuera
    // solo los de esa categoría
    for (const t of tarjetas) {
      expect((t.props('producto') as any).categoriaId).toBe('cat-1');
    }
    w.unmount();
  });

  it('la tarjeta muestra la categoría y la tienda, no la subcategoría', async () => {
    const ProductCard = (await import('@/modules/home/components/ProductCard.vue')).default;
    const w = mount(ProductCard, {
      props: {
        producto: {
          articuloId: 'a1', nombre: 'Pay', precio: 50, url: '',
          categoria: 'Postres', subcategoria: 'Pasteles', tiendaNombre: 'Lola',
          variantes: [{ sku: 'S1', stock: 5, precio: 50 }],
        } as any,
      },
      global: { stubs: { FontAwesomeIcon: true, StarRating: true } },
    });
    await flushPromises();

    const meta = w.find('.meta').text();
    expect(meta).toContain('Postres');
    expect(meta).toContain('Lola');
    expect(meta).not.toContain('Pasteles');
    w.unmount();
  });
});
