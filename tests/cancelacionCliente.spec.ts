/**
 * Ventana para que el cliente cancele (5 min) y límite de atención de la tienda (40 min).
 *
 * El cliente cancela solo durante los primeros minutos; después la tienda ya
 * pudo empezar a comprar o cocinar, así que se cancela hablando con ella.
 * En paralelo, si la tienda no atiende en 40 minutos, el sistema cancela su parte.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { sessionUser } from '@/utils/sessionUser';
import {
  guardarPedidos,
  cancelarPedidoCliente,
  actualizarEstatusTienda,
  clientePuedeCancelar,
  dentroDeVentanaCancelacion,
  tiempoRestanteCancelacionCliente,
  MINUTOS_LIMITE_CANCELACION_CLIENTE,
  MS_LIMITE_CANCELACION_CLIENTE,
  MINUTOS_LIMITE_ATENCION,
  MS_LIMITE_ATENCION,
  MENSAJE_LIMITE_CANCELACION,
  MENSAJE_CANCELACION_VENCIDA,
  NOTA_CANCELACION_SIN_ATENDER,
  type Pedido,
} from '@/composables/usePedidos';
import { ref as dbRef, update } from 'firebase/database';

const CLIENTE = 'cli';
const A = 'tienda-A';
const domicilio = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '00000' };
const item = { id_articulo: 'art-A', sku: 'S1', cantidad: 2, id_tienda: A, precio: 10, nombre: 'Pan', url: '' };

const creado = new Date('2026-09-19T10:00:00.000Z');
const despues = (ms: number) => new Date(creado.getTime() + ms);
const MINUTO = 60_000;

/** Crea un pedido y fija su fecha de creación para poder mover el reloj */
async function crearPedido(fecha: Date | null = creado): Promise<Pedido> {
  const id = await guardarPedidos([item], 'Efectivo', domicilio);
  // null = pedido viejo, anterior a la regla: sin fecha_creacion ISO
  await update(dbRef({} as any, `pedidos/${id}`), {
    fecha_creacion: fecha ? fecha.toISOString() : null,
  });
  return { id_pedido: id, ...__getAt(`pedidos/${id}`) } as Pedido;
}

beforeEach(() => {
  __reset({
    articulos: { 'art-A': { variantes: [{ sku: 'S1', stock: 5 }] } },
    tiendas: { [A]: { nombreTienda: 'A' } },
    pedidos: {},
  });
  sessionUser.value = { id: CLIENTE };
});

describe('Los límites en minutos', () => {
  it('el cliente tiene 5 minutos y la tienda 40 para atender', () => {
    expect(MINUTOS_LIMITE_CANCELACION_CLIENTE).toBe(5);
    expect(MS_LIMITE_CANCELACION_CLIENTE).toBe(5 * MINUTO);
    expect(MINUTOS_LIMITE_ATENCION).toBe(40);
    expect(MS_LIMITE_ATENCION).toBe(40 * MINUTO);
  });

  it('las leyendas nombran los minutos, para no contradecir a la regla', () => {
    expect(MENSAJE_LIMITE_CANCELACION).toContain('5 minutos');
    expect(MENSAJE_CANCELACION_VENCIDA).toContain('5 minutos');
    expect(MENSAJE_LIMITE_CANCELACION).toMatch(/comun[ií]cate con la tienda/i);
    expect(NOTA_CANCELACION_SIN_ATENDER).toContain('40 minutos');
  });
});

describe('Ventana de cancelación del cliente', () => {
  it('recién hecho el pedido sí puede cancelar', async () => {
    const p = await crearPedido();
    expect(clientePuedeCancelar(p, creado)).toBe(true);
    expect(tiempoRestanteCancelacionCliente(p, creado)).toBe(MS_LIMITE_CANCELACION_CLIENTE);
  });

  it('justo antes de los 5 minutos todavía puede; al cumplirse, ya no', async () => {
    const p = await crearPedido();
    expect(clientePuedeCancelar(p, despues(5 * MINUTO - 1))).toBe(true);
    expect(clientePuedeCancelar(p, despues(5 * MINUTO))).toBe(false);
    expect(clientePuedeCancelar(p, despues(6 * MINUTO))).toBe(false);
  });

  it('dentro de la ventana la cancelación funciona y devuelve el stock', async () => {
    const p = await crearPedido(new Date());
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(3);

    const cancelado = await cancelarPedidoCliente(p, 'Ya no lo quiero');

    expect(cancelado.estatus).toBe('Cancelado');
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(5);
  });

  it('pasada la ventana, cancelar lanza y manda a hablar con la tienda', async () => {
    // creado hace 6 minutos: la ventana ya venció
    const p = await crearPedido(new Date(Date.now() - 6 * MINUTO));

    await expect(cancelarPedidoCliente(p)).rejects.toThrow(/tienda/i);
    // no se tocó nada: sigue en preparación y el stock no volvió
    expect(__getAt(`pedidos/${p.id_pedido}/estatus`)).toBe('Preparacion');
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(3);
  });

  it('si la tienda ya atiende, no puede cancelar aunque siga dentro de los 5 minutos', async () => {
    const p = await crearPedido(new Date());
    await actualizarEstatusTienda(p, A, 'Atendiendo');
    const atendido = { id_pedido: p.id_pedido, ...__getAt(`pedidos/${p.id_pedido}`) } as Pedido;

    expect(dentroDeVentanaCancelacion(atendido)).toBe(true); // el tiempo no es el problema
    expect(clientePuedeCancelar(atendido)).toBe(false); // la tienda sí
    await expect(cancelarPedidoCliente(atendido)).rejects.toThrow(/atendiendo/i);
  });

  it('pedidos viejos sin fecha ISO conservan su comportamiento: la regla no aplica', async () => {
    const p = await crearPedido(null);
    expect(tiempoRestanteCancelacionCliente(p)).toBeNull();
    expect(dentroDeVentanaCancelacion(p)).toBe(true);
    expect(clientePuedeCancelar(p)).toBe(true);

    const cancelado = await cancelarPedidoCliente(p);
    expect(cancelado.estatus).toBe('Cancelado');
  });
});

describe('Límite de atención de la tienda: 40 minutos', () => {
  it('a los 40 minutos sin atender, el sistema cancela y devuelve el stock', async () => {
    const { tiendasSinAtender, cancelarTiendasSinAtender } = await import('@/composables/usePedidos');
    const p = await crearPedido();

    expect(tiendasSinAtender(p, despues(39 * MINUTO))).toEqual([]);
    expect(tiendasSinAtender(p, despues(40 * MINUTO))).toEqual([A]);

    await cancelarTiendasSinAtender(p, despues(40 * MINUTO));
    expect(__getAt(`pedidos/${p.id_pedido}/estatus`)).toBe('Cancelado');
    expect(__getAt('articulos/art-A/variantes/0/stock')).toBe(5);
    const hist = __getAt(`pedidos/${p.id_pedido}/historial`) as any[];
    expect(hist.at(-1).nota).toContain('40 minutos');
  });

  it('atender detiene el reloj: ya no se cancela sola', async () => {
    const { tiendasSinAtender } = await import('@/composables/usePedidos');
    const p = await crearPedido();
    await actualizarEstatusTienda(p, A, 'Atendiendo');
    const atendido = { id_pedido: p.id_pedido, ...__getAt(`pedidos/${p.id_pedido}`) } as Pedido;

    expect(tiendasSinAtender(atendido, despues(90 * MINUTO))).toEqual([]);
  });
});
