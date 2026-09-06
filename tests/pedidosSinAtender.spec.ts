/**
 * Cancelación automática: si una tienda no atiende su parte del pedido (sigue en
 * Preparacion) en HORAS_LIMITE_ATENCION, el sistema la cancela y devuelve el stock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { sessionUser } from '@/utils/sessionUser';
import {
  guardarPedidos,
  getPedidosByUser,
  getPedidosByProveedor,
  suscribirPedidosProveedor,
  tiendasSinAtender,
  tiempoRestanteAtencion,
  formatoTiempoRestante,
  cancelarTiendasSinAtender,
  expirarPedidosSinAtender,
  actualizarEstatusTienda,
  MS_LIMITE_ATENCION,
  NOTA_CANCELACION_SIN_ATENDER,
  type Pedido,
} from '@/composables/usePedidos';
import { flush } from './helpers';
import { ref as dbRef, update } from 'firebase/database';

const CLIENTE = 'cli';
const A = 'tienda-A';
const B = 'tienda-B';
const domicilio = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '00000' };

const item = (id: string, tienda: string) => ({
  id_articulo: id,
  sku: 'S1',
  cantidad: 2,
  id_tienda: tienda,
  precio: 10,
  nombre: id,
  url: '',
  categoria: 'x',
  nombre_tienda: tienda,
});

const creado = new Date('2026-09-06T10:00:00.000Z');
const despues = (ms: number) => new Date(creado.getTime() + ms);

/** Crea un pedido de dos tiendas y fija su fecha de creación para controlar el tiempo */
async function crearPedido(fecha: Date = creado): Promise<Pedido> {
  const id = await guardarPedidos([item('art-A', A), item('art-B', B)], 'Efectivo', domicilio);
  await update(dbRef({} as any, `pedidos/${id}`), { fecha_creacion: fecha.toISOString() });
  return { id_pedido: id, ...__getAt(`pedidos/${id}`) } as Pedido;
}

beforeEach(() => {
  __reset({
    articulos: {
      'art-A': { variantes: [{ sku: 'S1', stock: 5 }] },
      'art-B': { variantes: [{ sku: 'S1', stock: 5 }] },
    },
    tiendas: { [A]: { nombreTienda: 'A' }, [B]: { nombreTienda: 'B' } },
    pedidos: {},
  });
  sessionUser.value = { id: CLIENTE, nombre: 'Cliente' };
});

describe('Regla pura', () => {
  it('calcula el tiempo restante y lo formatea', async () => {
    const p = await crearPedido();
    expect(tiempoRestanteAtencion(p, A, despues(30 * 60_000))).toBe(MS_LIMITE_ATENCION - 30 * 60_000);
    expect(formatoTiempoRestante(90 * 60_000)).toBe('1 h 30 min');
    expect(formatoTiempoRestante(60 * 60_000)).toBe('1 h');
    expect(formatoTiempoRestante(5 * 60_000)).toBe('5 min');
  });

  it('antes del límite no hay tiendas sin atender; después sí', async () => {
    const p = await crearPedido();
    expect(tiendasSinAtender(p, despues(MS_LIMITE_ATENCION - 1))).toEqual([]);
    expect(tiendasSinAtender(p, despues(MS_LIMITE_ATENCION))).toEqual([A, B]);
  });

  it('una tienda que ya atendió (Enviado) no vence', async () => {
    const p = await crearPedido();
    const enviado = await actualizarEstatusTienda(p, A, 'Enviado');
    expect(tiendasSinAtender(enviado, despues(MS_LIMITE_ATENCION * 2))).toEqual([B]);
    expect(tiempoRestanteAtencion(enviado, A)).toBeNull();
  });
});

describe('cancelarTiendasSinAtender', () => {
  it('cancela solo la tienda vencida, deja historial del sistema y devuelve su stock', async () => {
    const p = await crearPedido();
    const enviado = await actualizarEstatusTienda(p, A, 'Enviado');

    const canceladas = await cancelarTiendasSinAtender(enviado, despues(MS_LIMITE_ATENCION + 1));
    expect(canceladas).toEqual([B]);

    const guardado = __getAt(`pedidos/${p.id_pedido}`) as Pedido;
    expect(guardado.estatusPorTienda).toEqual({ [A]: 'Enviado', [B]: 'Cancelado' });
    expect(guardado.estatus).toBe('Enviado'); // global: A sigue en camino
    expect(guardado.canceladoPor).toBeUndefined();
    const ultimo = guardado.historial!.at(-1)!;
    expect(ultimo).toMatchObject({ estatus: 'Cancelado', por: 'sistema', tiendaId: B, nota: NOTA_CANCELACION_SIN_ATENDER });

    expect(__getAt('articulos/art-B/variantes/0/stock')).toBe(5); // devuelto
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(3); // A sigue vendido
  });

  it('si ninguna tienda atendió, el pedido completo queda cancelado por el sistema', async () => {
    const p = await crearPedido();
    await cancelarTiendasSinAtender(p, despues(MS_LIMITE_ATENCION));
    const guardado = __getAt(`pedidos/${p.id_pedido}`) as Pedido;
    expect(guardado.estatus).toBe('Cancelado');
    expect(guardado.canceladoPor).toBe('sistema');
    expect(guardado.motivoCancelacion).toBe(NOTA_CANCELACION_SIN_ATENDER);
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(5);
    expect(__getAt('articulos/art-B/variantes/0/stock')).toBe(5);
  });

  it('no hace nada antes del límite ni repite la cancelación', async () => {
    const p = await crearPedido();
    expect(await cancelarTiendasSinAtender(p, despues(1000))).toEqual([]);
    expect(await cancelarTiendasSinAtender(p, despues(MS_LIMITE_ATENCION))).toEqual([A, B]);
    // Segunda pasada con el pedido ya cancelado en la base: no devuelve stock otra vez
    expect(await cancelarTiendasSinAtender(p, despues(MS_LIMITE_ATENCION))).toEqual([]);
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(5);
  });
});

describe('Expiración al leer pedidos', () => {
  it('getPedidosByUser devuelve el pedido ya cancelado cuando venció', async () => {
    const viejo = new Date(Date.now() - MS_LIMITE_ATENCION - 60_000).toISOString();
    const p = await crearPedido(new Date(viejo));

    const lista = await getPedidosByUser();
    expect(lista[0].estatus).toBe('Cancelado');
    expect(lista[0].canceladoPor).toBe('sistema');
  });

  it('getPedidosByProveedor y la suscripción también expiran', async () => {
    const viejo = new Date(Date.now() - MS_LIMITE_ATENCION - 60_000).toISOString();
    const p = await crearPedido(new Date(viejo));

    const lista = await getPedidosByProveedor(A);
    expect(lista[0].estatusPorTienda?.[A]).toBe('Cancelado');

    // Nuevo pedido vencido leído por suscripción
    const p2 = await crearPedido(new Date(viejo));
    const vistas: Pedido[][] = [];
    const off = suscribirPedidosProveedor(B, (l) => vistas.push(l));
    await flush();
    await flush();
    off();
    const final = __getAt(`pedidos/${p2.id_pedido}`) as Pedido;
    expect(final.estatusPorTienda?.[B]).toBe('Cancelado');
    expect(vistas.length).toBeGreaterThan(0);
  });

  it('un pedido reciente no se toca', async () => {
    const reciente = new Date(Date.now() - 10 * 60_000).toISOString();
    const p = await crearPedido(new Date(reciente));
    expect(await expirarPedidosSinAtender(await getPedidosByUser())).toEqual([]);
    expect((__getAt(`pedidos/${p.id_pedido}`) as Pedido).estatus).toBe('Preparacion');
  });
});
