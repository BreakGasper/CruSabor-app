/**
 * Campana de la tienda: pedidos por atender y alertas de stock; pausar venta y dar de baja
 * artículos, y su efecto en catálogo, carrito y pedido.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { flush, withSetup } from './helpers';
import { routerMock, swalMock } from './setup';
import { sessionUser } from '@/utils/sessionUser';
import {
  resumenStock,
  ventaBloqueada,
  variantesConStock,
  normalizarStock,
  actualizarStockArticulo,
  pausarVentaArticulo,
  darDeBajaArticulo,
  useArticulos,
  UMBRAL_STOCK_BAJO,
} from '@/composables/useArticulos';
import { alertasDeStock, pedidosSinAtenderDe, useAlertasTienda } from '@/composables/useAlertasTienda';
import { guardarPedidos, ArticuloNoDisponibleError, type Pedido } from '@/composables/usePedidos';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { __setControlPorTienda } from '@/composables/useMembresia';
import CampanaTienda from '@/modules/store/components/CampanaTienda.vue';
import type { Producto } from '@/types/Producto';

const T = 'tienda-A';
const art = (id: string, extra: Record<string, any> = {}) => ({
  articuloId: id,
  nombre: id,
  tiendaId: T,
  precio: 10,
  variantes: [{ sku: 'S1', stock: 10 }],
  ...extra,
});

beforeEach(() => {
  __reset({
    tiendas: { [T]: { nombreTienda: 'A', estatus: 'activa', envioDomicilio: true } },
    articulos: {
      ok: art('ok'),
      bajo: art('bajo', { variantes: [{ sku: 'S1', stock: 2 }, { sku: 'S2', stock: 9 }] }),
      agotado: art('agotado', { variantes: [{ sku: 'S1', stock: 0 }] }),
      ilimitado: art('ilimitado', { variantes: [{ sku: 'S1', stock: -1 }] }),
      porPedido: art('porPedido', { porPedido: true, variantes: [{ sku: 'S1', stock: 0 }] }),
      deBaja: art('deBaja', { baja: true, variantes: [{ sku: 'S1', stock: 0 }] }),
    },
    pedidos: {
      p1: { id_usuario: 'c', estatus: 'Preparacion', estatusPorTienda: { [T]: 'Preparacion' }, fecha_creacion: new Date().toISOString(), items: [{ id_articulo: 'ok', nombreProducto: 'ok', precio: 10, cantidad: 2, proveedor: T }] },
      p2: { id_usuario: 'c', estatus: 'Atendiendo', estatusPorTienda: { [T]: 'Atendiendo' }, fecha_creacion: new Date().toISOString(), items: [{ id_articulo: 'ok', nombreProducto: 'ok', precio: 10, cantidad: 1, proveedor: T }] },
      p3: { id_usuario: 'c', estatus: 'Preparacion', estatusPorTienda: { otra: 'Preparacion' }, fecha_creacion: new Date().toISOString(), items: [{ id_articulo: 'x', nombreProducto: 'x', precio: 1, cantidad: 1, proveedor: 'otra' }] },
    },
  });
  sessionUser.value = null as any;
  routerMock.push.mockClear();
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
});
afterEach(() => __setControlPorTienda(null));

describe('Reglas de stock', () => {
  it('resumenStock detecta agotado, bajo, ok y sin control', () => {
    expect(resumenStock(art('a', { variantes: [{ stock: 0 }] }) as any).estado).toBe('agotado');
    expect(resumenStock(art('a', { variantes: [{ stock: UMBRAL_STOCK_BAJO }, { stock: 20 }] }) as any)).toMatchObject({ estado: 'bajo', minimo: UMBRAL_STOCK_BAJO, total: 23 });
    expect(resumenStock(art('a') as any).estado).toBe('ok');
    expect(resumenStock(art('a', { variantes: [{ stock: -1 }] }) as any).estado).toBe('sin-control');
    expect(resumenStock(art('a', { porPedido: true, variantes: [{ stock: 0 }] }) as any).estado).toBe('sin-control');
    expect(resumenStock(null).estado).toBe('sin-control');
  });

  it('alertasDeStock avisa agotados y por agotarse, no ilimitados, bajo pedido ni dados de baja', () => {
    const lista = Object.values(__getAt('articulos')).map((a: any) => a as Producto);
    const alertas = alertasDeStock(lista);
    expect(alertas.map((a) => a.articulo.articuloId)).toEqual(['agotado', 'bajo']); // agotado primero
  });

  it('pedidosSinAtenderDe cuenta solo la parte de la tienda en Preparacion', () => {
    const lista = Object.entries(__getAt('pedidos')).map(([id, p]: any) => ({ id_pedido: id, ...p }) as Pedido);
    expect(pedidosSinAtenderDe(lista, T).map((p) => p.id_pedido)).toEqual(['p1']);
  });

  it('useAlertasTienda junta todo en vivo', async () => {
    const { result, unmount } = withSetup(() => useAlertasTienda(T));
    await flush();
    expect(result.pedidosSinAtender.value).toHaveLength(1);
    expect(result.agotados.value).toHaveLength(1);
    expect(result.porAgotarse.value).toHaveLength(1);
    expect(result.total.value).toBe(3);
    unmount();
  });
});

describe('Pausar venta y dar de baja', () => {
  it('escriben el estado en el artículo y ventaBloqueada lo detecta', async () => {
    await pausarVentaArticulo('ok', true);
    expect(__getAt('articulos/ok/ventaPausada')).toBe(true);
    expect(ventaBloqueada(__getAt('articulos/ok'))).toBe(true);
    await pausarVentaArticulo('ok', false);
    expect(ventaBloqueada(__getAt('articulos/ok'))).toBe(false);

    await darDeBajaArticulo('ok', true);
    expect(__getAt('articulos/ok/baja')).toBe(true);
    expect(ventaBloqueada(__getAt('articulos/ok'))).toBe(true);
  });

  it('el catálogo público oculta los dados de baja; la tienda los sigue viendo', async () => {
    __setControlPorTienda({ [T]: { estatus: 'activa' } });
    const publico = withSetup(() => useArticulos());
    await flush();
    expect(publico.result.articulos.value.map((a) => a.articuloId)).not.toContain('deBaja');
    publico.unmount();

    const propio = withSetup(() => {
      const u = useArticulos();
      u.cargarArticulosPorTienda(T);
      return u;
    });
    await flush();
    expect(propio.result.articulos.value.map((a) => a.articuloId)).toContain('deBaja');
    propio.unmount();
  });

  it('el carrito rápido no agrega un artículo con venta pausada', async () => {
    sessionUser.value = { id: 'cli', nombre: 'C' };
    const { result, unmount } = withSetup(() => useCarritoRapido());
    const p = { ...art('ok'), ventaPausada: true } as Producto;
    expect(result.ventaPausada(p)).toBe(true);
    await result.aumentar(p);
    expect(result.cantidadEnCarrito['ok'] || 0).toBe(0);
    expect(swalMock.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Venta pausada' }));
    unmount();
  });

  it('guardarPedidos rechaza artículos pausados o de baja y conserva el stock', async () => {
    sessionUser.value = { id: 'cli', nombre: 'C' };
    await pausarVentaArticulo('ok', true);
    const carrito = [{ id_articulo: 'ok', sku: 'S1', cantidad: 1, id_tienda: T, precio: 10, nombre: 'ok', url: '', categoria: 'x' }];
    const dom = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '0' };
    await expect(guardarPedidos(carrito, 'Efectivo', dom)).rejects.toBeInstanceOf(ArticuloNoDisponibleError);
    expect(__getAt('articulos/ok/variantes/0/stock')).toBe(10);
  });
});

describe('CampanaTienda', () => {
  it('muestra el total de avisos y, al abrir, pedidos y stock con acciones', async () => {
    const w = mount(CampanaTienda, { props: { tiendaId: T }, attachTo: document.body });
    await flushPromises();
    expect(w.find('.badge').text()).toBe('3');
    await w.find('.campana').trigger('click');
    await flushPromises();
    // El panel se teleporta a <body>, así que se consulta el documento
    const panel = () => document.body.querySelector('.panel-fondo') as HTMLElement;
    const texto = () => panel().textContent || '';
    expect(texto()).toContain('Pedidos por atender');
    expect(texto()).toContain('1 sin stock');
    expect(texto()).toContain('1 por agotarse');
    const filas = () => Array.from(panel().querySelectorAll('.tarjeta.stock')) as HTMLElement[];
    expect(filas()).toHaveLength(2);
    expect(filas()[0].textContent).toContain('agotado');

    // Pausar venta desde la campana (segundo botón: Actualizar stock · Pausar · Dar de baja)
    (filas()[0].querySelectorAll('.accion')[1] as HTMLElement).click();
    await flushPromises();
    expect(__getAt('articulos/agotado/ventaPausada')).toBe(true);

    // Dar de baja (confirmado) lo saca de la lista de alertas
    (filas()[1].querySelector('.accion.baja') as HTMLElement).click();
    await flushPromises();
    expect(__getAt('articulos/bajo/baja')).toBe(true);
    await flushPromises();
    expect(filas()).toHaveLength(1);
    expect(w.find('.badge').text()).toBe('2');

    // Ir a pedidos
    (panel().querySelector('.link') as HTMLElement).click();
    expect(routerMock.push).toHaveBeenCalledWith(`/store/pedidos/${T}`);
    w.unmount();
  });
});

/**
 * Resurtir desde la campana: el botón ya no manda al formulario completo, pide
 * las piezas en un diálogo y escribe solo el stock.
 */
describe('Actualizar stock', () => {
  describe('variantesConStock (regla pura)', () => {
    it('lista las variantes que se cuentan, con su etiqueta y lo que tienen hoy', () => {
      const p = {
        variantes: [
          { sku: 'S1', stock: 4, color: 'Rojo', tamano: 'Ch' },
          { sku: 'S2', stock: 0, detalle: 'Producto Base' },
        ],
      } as any;
      expect(variantesConStock(p)).toEqual([
        { indice: 0, etiqueta: 'Rojo · Ch', stock: 4, sku: 'S1' },
        { indice: 1, etiqueta: 'Producto Base', stock: 0, sku: 'S2' },
      ]);
    });

    it('deja fuera lo que no se cuenta: stock ilimitado y bajo pedido', () => {
      expect(variantesConStock({ variantes: [{ sku: 'S1', stock: -1 }] } as any)).toEqual([]);
      expect(variantesConStock({ porPedido: true, variantes: [{ sku: 'S1', stock: 3 }] } as any)).toEqual([]);
      expect(variantesConStock(null)).toEqual([]);
    });
  });

  describe('normalizarStock (regla pura)', () => {
    it('acepta enteros desde cero', () => {
      expect(normalizarStock('0')).toBe(0);
      expect(normalizarStock('12')).toBe(12);
      expect(normalizarStock(7)).toBe(7);
    });
    it('rechaza lo que no son piezas', () => {
      for (const malo of ['', '  ', 'x', '-1', '2.5', null, undefined]) {
        expect(normalizarStock(malo)).toBeNull();
      }
    });
  });

  describe('actualizarStockArticulo', () => {
    it('fija las piezas y deja el artículo bajo control de stock', async () => {
      await actualizarStockArticulo('agotado', { 0: 25 });
      expect(__getAt('articulos/agotado/variantes/0/stock')).toBe(25);
      expect(__getAt('articulos/agotado/variantes/0/tieneStock')).toBe(true);
    });

    it('escribe varias variantes de una vez, sin tocar el resto del artículo', async () => {
      __reset({
        articulos: {
          multi: {
            nombre: 'Multi', tiendaId: T, precio: 10, ventaPausada: true,
            variantes: [{ sku: 'S1', stock: 1 }, { sku: 'S2', stock: 2 }],
          },
        },
      });
      await actualizarStockArticulo('multi', { 0: 10, 1: 20 });

      expect(__getAt('articulos/multi/variantes/0/stock')).toBe(10);
      expect(__getAt('articulos/multi/variantes/1/stock')).toBe(20);
      // lo demás queda igual: se escribe por ruta, no se reemplaza el artículo
      expect(__getAt('articulos/multi/nombre')).toBe('Multi');
      expect(__getAt('articulos/multi/ventaPausada')).toBe(true);
      expect(__getAt('articulos/multi/variantes/0/sku')).toBe('S1');
    });

    it('un valor inválido no se escribe', async () => {
      await actualizarStockArticulo('agotado', { 0: -5 as any });
      expect(__getAt('articulos/agotado/variantes/0/stock')).toBe(0); // sin cambios
    });
  });

  describe('desde la campana', () => {
    it('el botón dice "Actualizar stock", cierra el aviso y abre el diálogo', async () => {
      const w = mount(CampanaTienda, { props: { tiendaId: T }, attachTo: document.body });
      await flushPromises();
      await w.find('.campana').trigger('click');
      await flushPromises();
      expect(document.body.querySelector('.panel-fondo')).not.toBeNull();

      const boton = document.body.querySelector('.accion.resurtir') as HTMLElement;
      expect(boton.textContent).toContain('Actualizar stock');
      boton.click();
      await flushPromises();

      // el panel de notificaciones se oculta y queda solo el diálogo
      expect(document.body.querySelector('.panel-fondo')).toBeNull();
      expect(document.body.querySelector('.stock-panel')).not.toBeNull();
      w.unmount();
    });
  });
});
