/**
 * Regresión del parpadeo en "Continuar Compra":
 * el estado que se pasa a router.push debe ser clonable por history.pushState.
 * Si se pasa un Proxy reactivo, el navegador lanza DataCloneError y Vue Router
 * recurre a location.assign (recarga completa de la página).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import CartView from '@/modules/home/components/CartView.vue';
import { routerMock } from './setup';
import { flush } from './helpers';

beforeEach(async () => {
  await db.Carrito.clear();
  routerMock.push.mockClear();
  sessionUser.value = { id: 'cliente-1' };
  await db.Carrito.bulkAdd([
    { id_articulo: 'a', id_usuario: 'cliente-1', sku: 's1', cantidad: 2, precio: 45, nombre: 'Chocoflan', url: '', detalle: '', id_tienda: 't-1', nombre_tienda: 'Pastelería Uno' } as any,
    { id_articulo: 'b', id_usuario: 'cliente-1', sku: 's2', cantidad: 1, precio: 24, nombre: 'Cheesecake', url: '', detalle: '', id_tienda: 't-2', nombre_tienda: 'Café Dos' } as any,
  ]);
});

describe('CartView → Continuar Compra', () => {
  it('pasa a /checkout un estado plano que history.pushState puede clonar', async () => {
    const wrapper = mount(CartView, {
      global: { stubs: { FontAwesomeIcon: true, ArrowBack: true } },
    });
    await flush();
    await flush();
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.cart-item')).toHaveLength(2);
    // Agrupado por tienda: un bloque por tienda con su nombre y subtotal
    const grupos = wrapper.findAll('.grupo-tienda');
    expect(grupos).toHaveLength(2);
    expect(grupos[0].find('.grupo-tienda-nombre').text()).toContain('Pastelería Uno');
    expect(grupos[0].find('.grupo-resumen').text()).toBe('2 artículos · $90.00');
    expect(grupos[1].find('.grupo-tienda-nombre').text()).toContain('Café Dos');
    expect(grupos[1].find('.grupo-resumen').text()).toBe('1 artículo · $24.00');
    await wrapper.find('.checkout-btn').trigger('click');

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    const arg = routerMock.push.mock.calls[0][0];
    expect(arg.path).toBe('/checkout');
    expect(arg.state).toMatchObject({ subtotal: 114, envio: 15, total: 129, totalArticulos: 3 });
    expect(arg.state.carritoItems).toHaveLength(2);

    // Lo que rompía: un Proxy no se puede clonar
    expect(() => structuredClone(arg.state)).not.toThrow();
    wrapper.unmount();
  });
});
