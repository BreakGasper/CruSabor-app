/**
 * El nombre de la tienda vive en `tiendas/{id}/nombreTienda`; artículos y carrito solo
 * guardan una copia. Al renombrar la tienda: se propaga a sus artículos y las pantallas
 * muestran el nombre vivo aunque la copia esté vieja.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { flush, withSetup } from './helpers';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { useTiendas } from '@/composables/useTiendas';
import { useArticulos } from '@/composables/useArticulos';
import { __setControlPorTienda } from '@/composables/useMembresia';
import { __setHorarioPorTienda } from '@/composables/useHorarioTienda';
import CartView from '@/modules/home/components/CartView.vue';

const T = 'tienda-A';
const OTRA = 'tienda-B';

beforeEach(() => {
  __reset({
    tiendas: { [T]: { nombreTienda: 'c' }, [OTRA]: { nombreTienda: 'Café B' } },
    articulos: {
      a1: { tiendaId: T, tiendaNombre: 'c', nombre: 'Silla' },
      a2: { tiendaId: T, tiendaNombre: 'c', nombre: 'Mesa' },
      b1: { tiendaId: OTRA, tiendaNombre: 'Café B', nombre: 'Latte' },
    },
  });
});
afterEach(() => {
  __setControlPorTienda(null);
  __setHorarioPorTienda(null);
});

describe('Renombrar tienda', () => {
  it('actualizarTienda propaga el nombre nuevo solo a los artículos de esa tienda', async () => {
    const { actualizarTienda } = useTiendas();
    await actualizarTienda(T, { nombreTienda: 'Muebles America', descripcion: 'x' } as any);
    expect(__getAt(`tiendas/${T}/nombreTienda`)).toBe('Muebles America');
    expect(__getAt('articulos/a1/tiendaNombre')).toBe('Muebles America');
    expect(__getAt('articulos/a2/tiendaNombre')).toBe('Muebles America');
    expect(__getAt('articulos/b1/tiendaNombre')).toBe('Café B');
  });

  it('sincronizarNombreEnArticulos cuenta los artículos corregidos y no reescribe los que ya están bien', async () => {
    const { sincronizarNombreEnArticulos } = useTiendas();
    expect(await sincronizarNombreEnArticulos(T, 'Muebles America')).toBe(2);
    expect(await sincronizarNombreEnArticulos(T, 'Muebles America')).toBe(0);
  });

  it('el catálogo muestra el nombre vivo de la tienda aunque el artículo tenga la copia vieja', async () => {
    __setControlPorTienda({ [T]: { nombreTienda: 'Muebles America' }, [OTRA]: { nombreTienda: 'Café B' } });
    const { result, unmount } = withSetup(() => useArticulos());
    await flush();
    const silla = result.articulos.value.find((a) => a.articuloId === 'a1')!;
    expect(silla.tiendaNombre).toBe('Muebles America');
    expect(result.articulos.value.find((a) => a.articuloId === 'b1')!.tiendaNombre).toBe('Café B');
    unmount();
  });

  it('el carrito agrupa con el nombre vivo, no con el guardado al agregar', async () => {
    __setControlPorTienda({ [T]: { nombreTienda: 'Muebles America' } });
    __setHorarioPorTienda({ [T]: null });
    await db.Carrito.clear();
    sessionUser.value = { id: 'cli' };
    await db.Carrito.bulkAdd([
      { id_articulo: 'a1', id_usuario: 'cli', sku: 's', cantidad: 1, precio: 10, nombre: 'Silla', url: '', detalle: '', id_tienda: T, nombre_tienda: 'c' } as any,
    ]);
    const w = mount(CartView, { global: { stubs: { FontAwesomeIcon: true, ArrowBack: true } } });
    await flush();
    await flush();
    await w.vm.$nextTick();
    expect(w.find('.grupo-tienda-nombre').text()).toContain('Muebles America');
    w.unmount();
  });
});
