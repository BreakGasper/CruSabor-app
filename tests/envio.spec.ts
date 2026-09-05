/**
 * Regla: no se puede agregar al carrito un producto de una tienda que NO hace
 * envíos a domicilio. Se prueba en el composable central y en las pantallas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';
import { withSetup } from './helpers';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { useEnvioTienda, __setEnvioPorTienda, MENSAJE_SIN_ENVIO } from '@/composables/useEnvioTienda';
import type { Producto } from '@/types/Producto';

vi.mock('@/composables/useAuth', () => ({ fetchUsuarioById: vi.fn(async () => null) }));

import StoreArticles from '@/modules/store/components/StoreArticles.vue';
import StoreProfile from '@/modules/store/views/StoreProfile.vue';
import ProductDetail from '@/modules/home/components/ProductDetail.vue';

const CON_ENVIO = 'tienda-envia';
const SIN_ENVIO = 'tienda-no-envia';

const producto = (id: string, tiendaId: string): Producto =>
  ({
    articuloId: id, nombre: `Prod ${id}`, url: '', precio: 10, descripcion: 'x', tiendaId, tiendaNombre: 'T',
    categoria: 'Alimentos', variantes: [{ sku: `S-${id}`, stock: 5, precio: 10, url: '', detalle: 'd', color: 'Rojo', colorCodigo: '#f00' } as any],
  }) as Producto;

const tiendas = {
  [CON_ENVIO]: { nombreTienda: 'Envía', envioDomicilio: true, telefono: '1', metodosPago: ['Efectivo'], horario: {} },
  [SIN_ENVIO]: { nombreTienda: 'No envía', envioDomicilio: false, telefono: '2', metodosPago: ['Efectivo'], horario: {} },
};
const articulos = {
  'a1': { ...producto('a1', CON_ENVIO), articuloId: undefined },
  'b1': { ...producto('b1', SIN_ENVIO), articuloId: undefined },
};

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; __setEnvioPorTienda(null); localStorage.clear(); });

beforeEach(async () => {
  __reset({ tiendas, articulos, pedidos: {} });
  __setEnvioPorTienda(null); // vuelve a suscribirse al mock de Firebase
  sessionUser.value = { id: 'cliente-1', nombre: 'Cliente' };
  await db.Carrito.clear();
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
});

const stubs = { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, transition: false };

describe('useEnvioTienda', () => {
  it('lee el flag envioDomicilio de cada tienda', async () => {
    const { result, unmount } = withSetup(() => useEnvioTienda());
    cleanups.push(unmount);
    await flushPromises();
    expect(result.permiteEnvio(CON_ENVIO)).toBe(true);
    expect(result.permiteEnvio(SIN_ENVIO)).toBe(false);
    expect(result.permiteEnvio('desconocida')).toBeUndefined();
    expect(result.sinEnvio(SIN_ENVIO)).toBe(true);
    expect(result.sinEnvio('desconocida')).toBe(false); // sin certeza no se bloquea
  });
});

describe('useCarritoRapido', () => {
  it('bloquea la tienda sin envío con aviso y deja pasar la que sí envía', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);
    await flushPromises();

    await result.aumentar(producto('b1', SIN_ENVIO));
    expect(await db.Carrito.count()).toBe(0);
    expect(swalMock.fire).toHaveBeenCalledTimes(1);
    expect((swalMock.fire.mock.calls[0][0] as any).text).toBe(MENSAJE_SIN_ENVIO);
    expect(result.sinEnvioTienda(producto('b1', SIN_ENVIO))).toBe(true);

    await result.aumentar(producto('a1', CON_ENVIO));
    expect(await db.Carrito.count()).toBe(1);
    expect(result.cantidadEnCarrito['a1']).toBe(1);
  });
});

describe('Pantallas', () => {
  it('StoreArticles: aviso y botón "Sin envío" deshabilitado', async () => {
    routeMock.params = { id: SIN_ENVIO };
    const w = mount(StoreArticles, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('.aviso-envio').exists()).toBe(true);
    const btn = w.find('.btn-agregar');
    expect(btn.text()).toBe('Sin envío');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('StoreArticles: la tienda que sí envía muestra "Agregar" habilitado', async () => {
    routeMock.params = { id: CON_ENVIO };
    const w = mount(StoreArticles, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('.aviso-envio').exists()).toBe(false);
    expect(w.find('.btn-agregar').text()).toBe('Agregar');
    expect(w.find('.btn-agregar').attributes('disabled')).toBeUndefined();
  });

  it('StoreProfile: productos de una tienda sin envío no se pueden agregar', async () => {
    routeMock.params = { id: SIN_ENVIO };
    const w = mount(StoreProfile, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('.aviso-envio').exists()).toBe(true);
    expect(w.find('.mini-add').text()).toBe('Sin envío');
    expect(w.find('.mini-add').attributes('disabled')).toBeDefined();
  });

  it('ProductDetail: botón "Sin envío a domicilio" y aviso; al intentar agregar no escribe en el carrito', async () => {
    routeMock.query = {};
    const w = mount(ProductDetail, { props: { producto: producto('b1', SIN_ENVIO) }, global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('.aviso-envio').exists()).toBe(true);
    const btn = w.find('.detalle-footer .btn-agregar');
    expect(btn.text()).toBe('Sin envío a domicilio');
    expect(btn.attributes('disabled')).toBeDefined();
    expect(await db.Carrito.count()).toBe(0);
  });

  it('ProductDetail: con envío, el botón normal sigue disponible', async () => {
    const w = mount(ProductDetail, { props: { producto: producto('a1', CON_ENVIO) }, global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('.aviso-envio').exists()).toBe(false);
    expect(w.find('.detalle-footer .btn-agregar').text()).toBe('+ Agregar al carrito');
  });
});
