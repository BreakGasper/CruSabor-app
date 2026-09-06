/**
 * Estatus "Atendiendo", motivos de cancelación visibles para cliente y tienda,
 * y artículos bajo pedido (sin control de stock).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { sessionUser } from '@/utils/sessionUser';
import {
  guardarPedidos,
  actualizarEstatusTienda,
  cancelarPedidoCliente,
  cancelarTiendasSinAtender,
  derivarEstatusGlobal,
  puedeTransicionar,
  motivoCancelacion,
  textoCancelacion,
  cancelacionesPorTienda,
  tieneArticulosPorPedido,
  tiempoRestanteAtencion,
  MS_LIMITE_ATENCION,
  NOTA_CANCELACION_SIN_ATENDER,
  type Pedido,
} from '@/composables/usePedidos';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import type { Producto } from '@/types/Producto';

const A = 'tienda-A';
const B = 'tienda-B';
const domicilio = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '00000' };
const item = (id: string, tienda: string, extra: Record<string, any> = {}) => ({
  id_articulo: id,
  sku: 'S1',
  cantidad: 1,
  id_tienda: tienda,
  precio: 10,
  nombre: id,
  url: '',
  categoria: 'x',
  nombre_tienda: tienda === A ? 'Pastelería A' : 'Café B',
  ...extra,
});

async function crearPedido(): Promise<Pedido> {
  const id = await guardarPedidos([item('art-A', A, { porPedido: true }), item('art-B', B)], 'Efectivo', domicilio);
  return { id_pedido: id, ...__getAt(`pedidos/${id}`) } as Pedido;
}

beforeEach(() => {
  __reset({
    articulos: {
      'art-A': { variantes: [{ sku: 'S1', stock: 5 }] },
      'art-B': { variantes: [{ sku: 'S1', stock: 5 }] },
    },
    tiendas: { [A]: { nombreTienda: 'Pastelería A' }, [B]: { nombreTienda: 'Café B' } },
    pedidos: {},
  });
  sessionUser.value = { id: 'cli', nombre: 'Cliente' };
});

describe('Estatus Atendiendo', () => {
  it('transiciones: la tienda atiende y luego envía; el cliente ya no puede cancelar', () => {
    expect(puedeTransicionar('Preparacion', 'Atendiendo', 'tienda')).toBe(true);
    expect(puedeTransicionar('Atendiendo', 'Enviado', 'tienda')).toBe(true);
    expect(puedeTransicionar('Atendiendo', 'Cancelado', 'tienda')).toBe(true);
    expect(puedeTransicionar('Atendiendo', 'Preparacion', 'tienda')).toBe(false);
    expect(puedeTransicionar('Atendiendo', 'Cancelado', 'cliente')).toBe(false);
    expect(puedeTransicionar('Preparacion', 'Cancelado', 'cliente')).toBe(true);
  });

  it('estatus global: alguna tienda atendiendo -> Atendiendo; enviado gana sobre atendiendo', () => {
    expect(derivarEstatusGlobal({ a: 'Atendiendo', b: 'Preparacion' })).toBe('Atendiendo');
    expect(derivarEstatusGlobal({ a: 'Atendiendo', b: 'Enviado' })).toBe('Enviado');
    expect(derivarEstatusGlobal({ a: 'Atendiendo', b: 'Cancelado' })).toBe('Atendiendo');
  });

  it('atender detiene el reloj de cancelación automática y bloquea la cancelación del cliente', async () => {
    const p = await crearPedido();
    const atendido = await actualizarEstatusTienda(p, A, 'Atendiendo');
    expect(atendido.estatus).toBe('Atendiendo');
    expect(atendido.historial!.at(-1)).toMatchObject({ estatus: 'Atendiendo', por: 'tienda', tiendaId: A });

    const muyTarde = new Date(new Date(p.fecha_creacion!).getTime() + MS_LIMITE_ATENCION * 3);
    expect(tiempoRestanteAtencion(atendido, A, muyTarde)).toBeNull();
    // Solo B (que no atendió) se cancela automáticamente
    expect(await cancelarTiendasSinAtender(atendido, muyTarde)).toEqual([B]);
    expect(__getAt(`pedidos/${p.id_pedido}/estatusPorTienda/${A}`)).toBe('Atendiendo');

    await expect(cancelarPedidoCliente(atendido)).rejects.toThrow(/atendiendo tu pedido/);
  });
});

describe('Motivo de cancelación', () => {
  it('cancelación por la tienda con nota: el cliente la lee, la tienda ve que fue suya', async () => {
    const p = await crearPedido();
    const cancelado = await actualizarEstatusTienda(p, A, 'Cancelado', 'Se acabó la harina');

    const m = motivoCancelacion(cancelado, A)!;
    expect(m).toMatchObject({ por: 'tienda', nota: 'Se acabó la harina' });
    expect(textoCancelacion(m, 'cliente')).toBe('Cancelado por la tienda: Se acabó la harina');
    expect(textoCancelacion(m, 'tienda')).toBe('Cancelaste este pedido: Se acabó la harina');

    // B sigue viva: no tiene motivo; el pedido completo tampoco está cancelado
    expect(motivoCancelacion(cancelado, B)).toBeNull();
    expect(motivoCancelacion(cancelado)).toBeNull();
    expect(cancelacionesPorTienda(cancelado, 'cliente')).toEqual([
      { tiendaId: A, nombre: 'Pastelería A', texto: 'Cancelado por la tienda: Se acabó la harina' },
    ]);
  });

  it('cancelación por la tienda sin nota lo dice explícitamente', async () => {
    const p = await crearPedido();
    const cancelado = await actualizarEstatusTienda(p, A, 'Cancelado');
    expect(textoCancelacion(motivoCancelacion(cancelado, A), 'cliente')).toBe('Cancelado por la tienda (sin motivo indicado)');
  });

  it('cancelación por el cliente: cada lector ve su versión', async () => {
    const p = await crearPedido();
    const cancelado = await cancelarPedidoCliente(p, 'Ya no lo necesito');
    const m = motivoCancelacion(cancelado)!;
    expect(m.por).toBe('cliente');
    expect(textoCancelacion(m, 'cliente')).toBe('Cancelaste este pedido: Ya no lo necesito');
    expect(textoCancelacion(motivoCancelacion(cancelado, B), 'tienda')).toBe('Cancelado por el cliente: Ya no lo necesito');
  });

  it('cancelación automática: mismo texto para ambos', async () => {
    const p = await crearPedido();
    await cancelarTiendasSinAtender(p, new Date(new Date(p.fecha_creacion!).getTime() + MS_LIMITE_ATENCION));
    const final = { id_pedido: p.id_pedido, ...__getAt(`pedidos/${p.id_pedido}`) } as Pedido;
    expect(textoCancelacion(motivoCancelacion(final), 'cliente')).toBe(NOTA_CANCELACION_SIN_ATENDER);
    expect(textoCancelacion(motivoCancelacion(final, B), 'tienda')).toBe(NOTA_CANCELACION_SIN_ATENDER);
  });

  it('pedidos viejos sin historial usan canceladoPor / motivoCancelacion', () => {
    const viejo = { estatus: 'Cancelado', canceladoPor: 'tienda', motivoCancelacion: 'Cerramos', items: [] } as unknown as Pedido;
    expect(textoCancelacion(motivoCancelacion(viejo), 'cliente')).toBe('Cancelado por la tienda: Cerramos');
    expect(motivoCancelacion({ estatus: 'Enviado', items: [] } as unknown as Pedido)).toBeNull();
  });
});

describe('Artículos bajo pedido', () => {
  it('viajan al pedido con la marca porPedido y se detectan por tienda', async () => {
    const p = await crearPedido();
    expect(p.items.find((i) => i.id_articulo === 'art-A')!.porPedido).toBe(true);
    expect(p.items.find((i) => i.id_articulo === 'art-B')!.porPedido).toBe(false);
    expect(tieneArticulosPorPedido(p)).toBe(true);
    expect(tieneArticulosPorPedido(p, A)).toBe(true);
    expect(tieneArticulosPorPedido(p, B)).toBe(false);
  });

  it('el carrito rápido no limita por stock un producto bajo pedido', () => {
    const { stockDe, sinStock, esPorPedido } = useCarritoRapido();
    const base = { articuloId: 'x', nombre: 'Pastel', url: '', precio: 100, descripcion: '', tiendaId: A } as Producto;
    const agotado = { ...base, variantes: [{ sku: 'S1', stock: 0, isDefault: true }] } as Producto;
    expect(sinStock(agotado)).toBe(true);
    const bajoPedido = { ...agotado, porPedido: true } as Producto;
    expect(esPorPedido(bajoPedido)).toBe(true);
    expect(stockDe(bajoPedido)).toBe(Infinity);
    expect(sinStock(bajoPedido)).toBe(false);
  });
});
