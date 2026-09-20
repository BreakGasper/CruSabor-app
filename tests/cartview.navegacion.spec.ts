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
import { ID_INVITADO, adoptarCarritoInvitado } from '@/db/carritoInvitado';
import { sincronizando } from '@/db/sync';

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

/**
 * Al iniciar sesión estando en el carrito, la lista debe aparecer sola.
 *
 * El dueño del carrito cambia al instante, pero adoptar lo del invitado tarda
 * (va y viene a Firebase). Con una lectura única la pantalla se quedaba en
 * "carrito vacío" hasta salir y volver a entrar.
 */
describe('CartView al iniciar sesión', () => {
  const montar = async () => {
    const w = mount(CartView, { global: { stubs: { FontAwesomeIcon: true, ArrowBack: true } } });
    await flush();
    await flush();
    await w.vm.$nextTick();
    return w;
  };

  const lineaInvitado = (id: string) => ({
    id_articulo: id, id_usuario: ID_INVITADO, sku: 's-' + id, cantidad: 1, precio: 30,
    nombre: 'Galleta ' + id, url: '', detalle: '', id_tienda: 't-1', nombre_tienda: 'Pastelería Uno',
  });

  it('muestra el carrito del invitado sin sesión', async () => {
    await db.Carrito.clear();
    sessionUser.value = null;
    await db.Carrito.bulkAdd([lineaInvitado('x') as any]);

    const w = await montar();
    expect(w.findAll('.cart-item')).toHaveLength(1);
  });

  it('al entrar, la lista se llena sola cuando la adopción escribe: sin salir y volver', async () => {
    await db.Carrito.clear();
    sessionUser.value = null;
    await db.Carrito.bulkAdd([lineaInvitado('x') as any, lineaInvitado('y') as any]);

    const w = await montar();
    expect(w.findAll('.cart-item')).toHaveLength(2);

    // inicia sesión: el dueño del carrito cambia antes de que se adopte nada
    sessionUser.value = { id: 'cliente-9' };
    await flush();
    await w.vm.$nextTick();

    // la adopción ocurre después (como en la app, tras bajar la copia remota)
    await adoptarCarritoInvitado('cliente-9');
    await flush();
    await flush();
    await w.vm.$nextTick();

    // la pantalla se actualizó sola, sin volver a montarla
    expect(w.findAll('.cart-item')).toHaveLength(2);
  });

  it('mientras se acomoda el carrito no anuncia que está vacío', async () => {
    await db.Carrito.clear();
    sessionUser.value = { id: 'cliente-9' };
    sincronizando.value = true;

    const w = await montar();
    expect(w.text()).toContain('Cargando tu carrito');
    expect(w.text()).not.toContain('Aún no has agregado productos');

    sincronizando.value = false;
    await w.vm.$nextTick();
    expect(w.text()).toContain('Aún no has agregado productos');
  });
});
