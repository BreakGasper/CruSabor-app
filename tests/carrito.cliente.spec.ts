/**
 * Flujo del CLIENTE con el carrito local (Dexie sobre IndexedDB en memoria):
 * agregar desde listas de tienda, límites de stock, favoritos de tiendas y
 * contador del botón de carrito.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import CartButton from '@/components/CartButton.vue';
import type { Producto } from '@/types/Producto';
import { withSetup, flush } from './helpers';
import { routerMock } from './setup';

const producto = (id: string, stock: number, extra: Partial<Producto> = {}): Producto =>
  ({
    articuloId: id,
    nombre: `Producto ${id}`,
    url: '',
    precio: 10,
    descripcion: '',
    tiendaId: 'tienda-A',
    variantes: [{ sku: `SKU-${id}`, stock, precio: 10, url: '', detalle: 'chico' } as any],
    ...extra,
  }) as Producto;

let cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
});

beforeEach(async () => {
  await db.Carrito.clear();
  await db.Favoritos.clear();
  await db.TiendasFavoritas.clear();
  routerMock.push.mockClear();
  sessionUser.value = { id: 'cliente-1', nombre: 'Cliente' };
});

describe('useCarritoRapido', () => {
  it('agrega, incrementa y disminuye la variante por defecto', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);
    const p = producto('a', 10);

    await result.aumentar(p);
    await result.aumentar(p);
    expect(result.cantidadEnCarrito['a']).toBe(2);

    const filas = await db.Carrito.where('id_usuario').equals('cliente-1').toArray();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id_articulo: 'a', sku: 'SKU-a', cantidad: 2, id_tienda: 'tienda-A', detalle: 'chico' });

    await result.disminuir(p);
    expect(result.cantidadEnCarrito['a']).toBe(1);
    await result.disminuir(p);
    expect(result.cantidadEnCarrito['a']).toBe(0);
    expect(await db.Carrito.count()).toBe(0);
  });

  it('no supera el stock de la variante y reconoce stock ilimitado', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);

    const limitado = producto('lim', 2);
    await result.aumentar(limitado);
    await result.aumentar(limitado);
    await result.aumentar(limitado); // bloqueado
    expect(result.cantidadEnCarrito['lim']).toBe(2);

    const ilimitado = producto('inf', -1);
    for (let i = 0; i < 5; i++) await result.aumentar(ilimitado);
    expect(result.cantidadEnCarrito['inf']).toBe(5);
    expect(result.stockDe(ilimitado)).toBe(Infinity);
    expect(result.sinStock(producto('cero', 0))).toBe(true);
  });

  it('sin sesión no agrega y redirige al login', async () => {
    sessionUser.value = null;
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);

    await result.aumentar(producto('a', 5));
    expect(await db.Carrito.count()).toBe(0);
    expect(routerMock.push).toHaveBeenCalledWith('/login');
  });

  it('el carrito es por usuario y se sincroniza al cambiar de sesión', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);
    await result.aumentar(producto('a', 5));

    sessionUser.value = { id: 'cliente-2' };
    await flush();
    await flush();
    expect(result.cantidadEnCarrito['a'] ?? 0).toBe(0);

    sessionUser.value = { id: 'cliente-1' };
    await flush();
    await flush();
    expect(result.cantidadEnCarrito['a']).toBe(1);
  });
});

describe('useTiendasFavoritas', () => {
  it('marca y desmarca una tienda; persiste por usuario', async () => {
    const { result, unmount } = withSetup(() => useTiendasFavoritas());
    cleanups.push(unmount);
    const tienda = { tiendaId: 't1', nombreTienda: 'Postres Lola', colonia: 'Centro', municipio: 'Ameca', telefono: '3751234567' } as any;

    await result.toggle(tienda);
    expect(result.esFavorita('t1')).toBe(true);
    expect(result.favoritas.value[0]).toMatchObject({ tiendaId: 't1', idUsuario: 'cliente-1', nombreTienda: 'Postres Lola' });

    await result.toggle(tienda);
    expect(result.esFavorita('t1')).toBe(false);
    expect(await db.TiendasFavoritas.count()).toBe(0);
  });

  it('sin sesión redirige al login', async () => {
    sessionUser.value = null;
    const { result, unmount } = withSetup(() => useTiendasFavoritas());
    cleanups.push(unmount);
    await result.toggle({ tiendaId: 't1', nombreTienda: 'x' } as any);
    expect(routerMock.push).toHaveBeenCalledWith('/login');
    expect(await db.TiendasFavoritas.count()).toBe(0);
  });
});

describe('CartButton', () => {
  it('muestra el total de unidades en vivo y navega al carrito', async () => {
    const wrapper = mount(CartButton);
    cleanups.push(() => wrapper.unmount());
    await flush();
    expect(wrapper.find('.cart-count').exists()).toBe(false);

    await db.Carrito.bulkAdd([
      { id_articulo: 'a', id_usuario: 'cliente-1', sku: 's1', cantidad: 2 } as any,
      { id_articulo: 'b', id_usuario: 'cliente-1', sku: 's2', cantidad: 3 } as any,
      { id_articulo: 'c', id_usuario: 'otro', sku: 's3', cantidad: 9 } as any, // de otro usuario
    ]);
    await new Promise((r) => setTimeout(r, 50)); // liveQuery
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.cart-count').text()).toBe('5');

    await wrapper.find('button').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/cart');
  });
});
