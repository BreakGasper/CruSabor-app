/**
 * Flujo completo de pedidos, del lado del CLIENTE y del lado de la TIENDA,
 * contra un Firebase en memoria.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { sessionUser } from '@/utils/sessionUser';
import {
  guardarPedidos,
  getPedidosByUser,
  getPedidoById,
  getPedidosByProveedor,
  actualizarEstatusTienda,
  cancelarPedidoCliente,
  estatusDeTienda,
  derivarEstatusGlobal,
  puedeTransicionar,
  fechaPedido,
  StockInsuficienteError,
  type Pedido,
} from '@/composables/usePedidos';

const CLIENTE = 'cliente-1';
const TIENDA_A = 'tienda-A';
const TIENDA_B = 'tienda-B';

const articulos = () => ({
  'art-1': {
    nombre: 'Chocoflan',
    tiendaId: TIENDA_A,
    variantes: [{ sku: 'CHO-1', stock: 5, precio: 45 }],
  },
  'art-2': {
    nombre: 'Cheesecake',
    tiendaId: TIENDA_A,
    variantes: [{ sku: 'CHE-1', stock: 2, precio: 24 }],
  },
  'art-3': {
    nombre: 'Café ilimitado',
    tiendaId: TIENDA_B,
    variantes: [{ sku: 'CAF-1', stock: -1, precio: 30 }],
  },
});

const domicilio = {
  calle: 'Av. Siempre Viva',
  numero: '742',
  colonia: 'Centro',
  municipio: 'Ameca',
  estado: 'Jalisco',
  cp: '46600',
};

const itemCarrito = (id: string, sku: string, cantidad: number, tienda: string, precio: number) => ({
  id_articulo: id,
  sku,
  cantidad,
  id_tienda: tienda,
  precio,
  nombre: id,
  url: '',
  categoria: 'Alimentos',
});

beforeEach(() => {
  __reset({ articulos: articulos(), pedidos: {} });
  sessionUser.value = { id: CLIENTE, nombre: 'Cliente Prueba' };
});

describe('Cliente: confirmar pedido', () => {
  it('crea el pedido en la colección global con estatus por tienda e historial', async () => {
    const carrito = [
      itemCarrito('art-1', 'CHO-1', 2, TIENDA_A, 45),
      itemCarrito('art-3', 'CAF-1', 1, TIENDA_B, 30),
    ];

    const id = await guardarPedidos(carrito, 'Efectivo', domicilio);
    const guardado = __getAt(`pedidos/${id}`) as Pedido;

    expect(guardado.id_usuario).toBe(CLIENTE);
    expect(guardado.estatus).toBe('Preparacion');
    expect(guardado.estatusPorTienda).toEqual({ [TIENDA_A]: 'Preparacion', [TIENDA_B]: 'Preparacion' });
    expect(guardado.historial).toHaveLength(1);
    expect(guardado.historial![0]).toMatchObject({ estatus: 'Preparacion', por: 'cliente' });
    expect(guardado.total_compra).toBe(2 * 45 + 30);
    expect(guardado.items[0]).toMatchObject({ proveedor: TIENDA_A, sku_code: 'CHO-1', cantidad: 2 });
    expect(guardado.domicilio.calleNumero).toBe('Av. Siempre Viva #742');
    expect(guardado.fecha_creacion).toBeTruthy();
  });

  it('descuenta stock de la variante correcta y respeta el stock ilimitado (-1)', async () => {
    await guardarPedidos(
      [itemCarrito('art-1', 'CHO-1', 2, TIENDA_A, 45), itemCarrito('art-3', 'CAF-1', 4, TIENDA_B, 30)],
      'Efectivo',
      domicilio,
    );
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(3);
    expect(__getAt('articulos/art-3/variantes/0/stock')).toBe(-1);
  });

  it('con stock insuficiente lanza StockInsuficienteError, no crea pedido y revierte lo descontado', async () => {
    const carrito = [
      itemCarrito('art-1', 'CHO-1', 1, TIENDA_A, 45), // hay 5, se descuenta primero
      itemCarrito('art-2', 'CHE-1', 3, TIENDA_A, 24), // solo hay 2 -> falla
    ];

    await expect(guardarPedidos(carrito, 'Efectivo', domicilio)).rejects.toBeInstanceOf(StockInsuficienteError);
    await expect(guardarPedidos(carrito, 'Efectivo', domicilio)).rejects.toThrow(/Cheesecake|art-2/);

    expect(Object.keys(__getAt('pedidos') || {})).toHaveLength(0);
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5); // rollback
    expect(__getAt('articulos/art-2/variantes/0/stock')).toBe(2);
  });

  it('rechaza sin sesión o con carrito vacío', async () => {
    await expect(guardarPedidos([], 'Efectivo', domicilio)).rejects.toThrow(/vacío/);
    sessionUser.value = null;
    await expect(guardarPedidos([itemCarrito('art-1', 'CHO-1', 1, TIENDA_A, 45)], 'Efectivo', domicilio)).rejects.toThrow(/autenticado/);
  });

  it('el cliente ve sus pedidos (y solo los suyos) desde la colección global', async () => {
    const mio = await guardarPedidos([itemCarrito('art-1', 'CHO-1', 1, TIENDA_A, 45)], 'Efectivo', domicilio);

    sessionUser.value = { id: 'otro-cliente' };
    const ajeno = await guardarPedidos([itemCarrito('art-3', 'CAF-1', 1, TIENDA_B, 30)], 'Efectivo', domicilio);

    sessionUser.value = { id: CLIENTE };
    const lista = await getPedidosByUser();
    expect(lista.map((p) => p.id_pedido)).toEqual([mio]);

    expect(await getPedidoById(mio)).not.toBeNull();
    expect(await getPedidoById(ajeno)).toBeNull(); // no es mío
  });
});

describe('Cliente: cancelar', () => {
  it('puede cancelar en preparación y el stock regresa', async () => {
    const id = await guardarPedidos([itemCarrito('art-1', 'CHO-1', 3, TIENDA_A, 45)], 'Efectivo', domicilio);
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(2);

    const pedido = (await getPedidoById(id))!;
    const cancelado = await cancelarPedidoCliente(pedido, 'Me equivoqué');

    expect(cancelado.estatus).toBe('Cancelado');
    expect(cancelado.canceladoPor).toBe('cliente');
    expect(cancelado.motivoCancelacion).toBe('Me equivoqué');
    expect(cancelado.historial!.at(-1)).toMatchObject({ estatus: 'Cancelado', por: 'cliente' });
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5);
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Cancelado');
  });

  it('NO puede cancelar si alguna tienda ya envió', async () => {
    const id = await guardarPedidos(
      [itemCarrito('art-1', 'CHO-1', 1, TIENDA_A, 45), itemCarrito('art-3', 'CAF-1', 1, TIENDA_B, 30)],
      'Efectivo',
      domicilio,
    );
    let pedido = (await getPedidoById(id))!;
    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Enviado');

    await expect(cancelarPedidoCliente(pedido)).rejects.toThrow(/en camino/);
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Enviado');
  });

  it('no puede cancelar un pedido de otro usuario', async () => {
    const id = await guardarPedidos([itemCarrito('art-1', 'CHO-1', 1, TIENDA_A, 45)], 'Efectivo', domicilio);
    const pedido = { id_pedido: id, ...(__getAt(`pedidos/${id}`) as Pedido) };
    sessionUser.value = { id: 'intruso' };
    await expect(cancelarPedidoCliente(pedido)).rejects.toThrow(/no es tuyo/);
  });
});

describe('Tienda: gestionar sus pedidos', () => {
  async function crearPedidoMixto() {
    const id = await guardarPedidos(
      [itemCarrito('art-1', 'CHO-1', 2, TIENDA_A, 45), itemCarrito('art-3', 'CAF-1', 1, TIENDA_B, 30)],
      'Efectivo',
      domicilio,
    );
    return (await getPedidoById(id))!;
  }

  it('la tienda ve solo pedidos que incluyen sus artículos, en cualquier estatus', async () => {
    await crearPedidoMixto();
    await guardarPedidos([itemCarrito('art-3', 'CAF-1', 2, TIENDA_B, 30)], 'Efectivo', domicilio);

    expect(await getPedidosByProveedor(TIENDA_A)).toHaveLength(1);
    expect(await getPedidosByProveedor(TIENDA_B)).toHaveLength(2);
    expect(await getPedidosByProveedor('tienda-inexistente')).toHaveLength(0);
  });

  it('Preparacion -> Enviado -> Entregado, con historial y estatus global derivado', async () => {
    let pedido = await crearPedidoMixto();

    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Enviado', 'Salió con repartidor');
    expect(estatusDeTienda(pedido, TIENDA_A)).toBe('Enviado');
    expect(estatusDeTienda(pedido, TIENDA_B)).toBe('Preparacion');
    expect(pedido.estatus).toBe('Enviado'); // alguna tienda envió
    expect(pedido.historial!.at(-1)).toMatchObject({ estatus: 'Enviado', por: 'tienda', tiendaId: TIENDA_A, nota: 'Salió con repartidor' });

    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Entregado');
    expect(pedido.estatus).toBe('Enviado'); // B sigue pendiente
    expect(pedido.fechaEntrega).toBeUndefined();

    pedido = await actualizarEstatusTienda(pedido, TIENDA_B, 'Enviado');
    pedido = await actualizarEstatusTienda(pedido, TIENDA_B, 'Entregado');
    expect(pedido.estatus).toBe('Entregado');
    expect(pedido.fechaEntrega).toBeTruthy();
    expect(pedido.historial).toHaveLength(5);

    // persistido
    expect(__getAt(`pedidos/${pedido.id_pedido}/estatus`)).toBe('Entregado');
  });

  it('rechaza transiciones inválidas (retroceder, cancelar entregado)', async () => {
    let pedido = await crearPedidoMixto();
    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Enviado');

    await expect(actualizarEstatusTienda(pedido, TIENDA_A, 'Preparacion')).rejects.toThrow(/No se puede pasar/);
    await expect(actualizarEstatusTienda(pedido, TIENDA_A, 'Enviado')).rejects.toThrow(/No se puede pasar/);

    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Entregado');
    await expect(actualizarEstatusTienda(pedido, TIENDA_A, 'Cancelado')).rejects.toThrow(/No se puede pasar/);
  });

  it('al cancelar, la tienda devuelve SOLO el stock de sus artículos', async () => {
    let pedido = await crearPedidoMixto();
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(3);

    pedido = await actualizarEstatusTienda(pedido, TIENDA_A, 'Cancelado', 'Sin insumos');
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5);
    expect(__getAt('articulos/art-3/variantes/0/stock')).toBe(-1);
    expect(estatusDeTienda(pedido, TIENDA_A)).toBe('Cancelado');
    expect(pedido.estatus).toBe('Preparacion'); // B sigue viva
    expect(pedido.canceladoPor).toBeUndefined(); // no está cancelado globalmente

    pedido = await actualizarEstatusTienda(pedido, TIENDA_B, 'Cancelado');
    expect(pedido.estatus).toBe('Cancelado');
    expect(pedido.canceladoPor).toBe('tienda');
  });

  it('pedidos viejos sin estatusPorTienda siguen siendo gestionables', async () => {
    __reset({
      articulos: articulos(),
      pedidos: {
        viejo1: {
          id_usuario: CLIENTE,
          estatus: 'Preparacion',
          fecha_hora: '17/4/2026, 6:14:20 p.m.',
          metodo_pago: 'Efectivo',
          total_compra: 45,
          domicilio: { calleNumero: 'x', lugar: 'x', municipio: 'x', estado: 'x', codigoPostal: 'x' },
          items: [{ id_articulo: 'art-1', nombreProducto: 'Chocoflan', precio: 45, cantidad: 1, proveedor: TIENDA_A }],
        },
      },
    });
    const [viejo] = await getPedidosByProveedor(TIENDA_A);
    expect(estatusDeTienda(viejo, TIENDA_A)).toBe('Preparacion');
    expect(new Date(fechaPedido(viejo)).getHours()).toBe(18);

    const actualizado = await actualizarEstatusTienda(viejo, TIENDA_A, 'Enviado');
    expect(actualizado.estatus).toBe('Enviado');
    expect(actualizado.estatusPorTienda).toEqual({ [TIENDA_A]: 'Enviado' });
    expect(actualizado.historial).toHaveLength(1);
  });
});

describe('Reglas puras', () => {
  it('derivarEstatusGlobal', () => {
    expect(derivarEstatusGlobal({})).toBe('Preparacion');
    expect(derivarEstatusGlobal({ a: 'Preparacion', b: 'Preparacion' })).toBe('Preparacion');
    expect(derivarEstatusGlobal({ a: 'Enviado', b: 'Preparacion' })).toBe('Enviado');
    expect(derivarEstatusGlobal({ a: 'Entregado', b: 'Enviado' })).toBe('Enviado');
    expect(derivarEstatusGlobal({ a: 'Entregado', b: 'Cancelado' })).toBe('Entregado');
    expect(derivarEstatusGlobal({ a: 'Cancelado', b: 'Cancelado' })).toBe('Cancelado');
  });

  it('puedeTransicionar por rol', () => {
    expect(puedeTransicionar('Preparacion', 'Enviado', 'tienda')).toBe(true);
    expect(puedeTransicionar('Enviado', 'Entregado', 'tienda')).toBe(true);
    expect(puedeTransicionar('Enviado', 'Cancelado', 'tienda')).toBe(true);
    expect(puedeTransicionar('Entregado', 'Cancelado', 'tienda')).toBe(false);
    expect(puedeTransicionar('Enviado', 'Preparacion', 'tienda')).toBe(false);
    expect(puedeTransicionar('Preparacion', 'Cancelado', 'cliente')).toBe(true);
    expect(puedeTransicionar('Enviado', 'Cancelado', 'cliente')).toBe(false);
    expect(puedeTransicionar('Preparacion', 'Enviado', 'cliente')).toBe(false);
  });

  it('fechaPedido entiende fechas viejas en texto y nuevas en ISO', () => {
    const d = new Date(fechaPedido({ fecha_hora: '7/5/2026, 2:52:40 p.m.' } as Pedido));
    expect([d.getDate(), d.getMonth() + 1, d.getFullYear(), d.getHours(), d.getMinutes()]).toEqual([7, 5, 2026, 14, 52]);
    expect(fechaPedido({ fecha_creacion: '2026-09-05T10:00:00.000Z' } as Pedido)).toBe(Date.parse('2026-09-05T10:00:00.000Z'));
    expect(fechaPedido({ fecha_hora: 'basura' } as Pedido)).toBe(0);
  });
});
