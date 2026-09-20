/**
 * ProductCard: la tarjeta de la lista del inicio, la misma en teléfono (dos por
 * renglón) y en escritorio. Botón Agregar → contador con menos / más, respeta
 * stock y envío a domicilio, favorito real y clic abre el detalle.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises as fp } from '@vue/test-utils';
// Dexie (fake-indexeddb) resuelve en timers: esperamos un tick real además de las microtareas
const flushPromises = async () => { await fp(); await new Promise((r) => setTimeout(r, 25)); await fp(); };
import { __reset } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { db } from '@/db';
import { ID_INVITADO } from '@/db/carritoInvitado';
import { sessionUser } from '@/utils/sessionUser';
import { __setEnvioPorTienda } from '@/composables/useEnvioTienda';
import ProductCard from '@/modules/home/components/ProductCard.vue';
import type { Producto } from '@/types/Producto';

const producto = (extra: Partial<Producto> = {}): Producto =>
  ({
    articuloId: 'a1', nombre: 'Chocoflan', url: 'https://cdn.test/a.jpg', precio: 45, descripcion: '', categoria: 'Postres',
    tiendaId: 'tienda-A', variantes: [{ sku: 'S1', stock: 2, precio: 45, url: '', detalle: '' } as any], ...extra,
  }) as Producto;

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; __setEnvioPorTienda(null); });

beforeEach(async () => {
  __reset({ tiendas: { 'tienda-A': { envioDomicilio: true }, 'tienda-B': { envioDomicilio: false } } });
  __setEnvioPorTienda(null);
  await db.Carrito.clear();
  await db.Favoritos.clear();
  sessionUser.value = { id: 'cliente-1' };
  routerMock.push.mockClear();
});

const stubs = { FontAwesomeIcon: true };
async function montar(p: Producto = producto()) {
  const w = mount(ProductCard, { props: { producto: p }, global: { stubs } });
  cleanups.push(() => w.unmount());
  await flushPromises();
  await flushPromises();
  return w;
}

describe('ProductCard', () => {
  it('Agregar → contador; el más se bloquea al llegar al stock; el menos en 1 es basura y vacía', async () => {
    const w = await montar();
    expect(w.find('.btn-agregar').text()).toBe('Agregar');

    await w.find('.btn-agregar').trigger('click');
    await flushPromises();
    expect(w.find('.contador').exists()).toBe(true);
    expect(w.find('.cantidad').text()).toBe('1');
    expect(w.find('.btn-c.menos').classes()).toContain('basura');

    await w.find('.btn-c.mas').trigger('click');
    await flushPromises();
    expect(w.find('.cantidad').text()).toBe('2');
    expect(w.find('.btn-c.mas').attributes('disabled')).toBeDefined(); // stock 2
    expect(w.find('.btn-c.menos').classes()).not.toContain('basura');
    expect(await db.Carrito.count()).toBe(1);

    await w.find('.btn-c.menos').trigger('click');
    await flushPromises();
    await w.find('.btn-c.menos').trigger('click');
    await flushPromises();
    expect(w.find('.contador').exists()).toBe(false);
    expect(w.find('.btn-agregar').exists()).toBe(true);
    expect(await db.Carrito.count()).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalled(); // los clics no abrieron el detalle
  });

  it('sin stock y tienda sin envío muestran su etiqueta y bloquean', async () => {
    const w1 = await montar(producto({ variantes: [{ sku: 'S1', stock: 0, precio: 45 } as any] }));
    expect(w1.find('.tag.agotado').exists()).toBe(true);
    expect(w1.find('.btn-agregar').text()).toBe('Sin stock');
    expect(w1.find('.btn-agregar').attributes('disabled')).toBeDefined();

    const w2 = await montar(producto({ articuloId: 'b1', tiendaId: 'tienda-B' }));
    expect(w2.find('.tag.sin-envio').exists()).toBe(true);
    expect(w2.find('.btn-agregar').text()).toBe('Sin envío');
    expect(w2.find('.btn-agregar').attributes('disabled')).toBeDefined();
  });

  it('favorito real y navegación al detalle', async () => {
    const w = await montar();
    await w.find('.heart-icon').trigger('click');
    await flushPromises();
    expect(w.find('.heart-icon').classes()).toContain('active');
    expect(await db.Favoritos.count()).toBe(1);

    await w.find('.card').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/producto/a1');
  });

  it('sin sesión: no hay corazón, pero Agregar sí llena el carrito del invitado', async () => {
    sessionUser.value = null;
    const w = await montar();
    // los favoritos siguen siendo de clientes con sesión
    expect(w.find('.heart-icon').exists()).toBe(false);

    await w.find('.btn-agregar').trigger('click');
    await flushPromises();

    const items = await db.Carrito.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].id_usuario).toBe(ID_INVITADO);
    expect(routerMock.push).not.toHaveBeenCalledWith('/login');
  });
});
