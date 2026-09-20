/**
 * Carrito de invitado: llenar sin sesión y quedárselo al entrar.
 *
 * Quien todavía no tiene cuenta puede agregar artículos; se guardan a nombre del
 * invitado. Al iniciar sesión en ese mismo dispositivo, esos artículos pasan al
 * cliente y se juntan con los que ya tuviera, para que la compra salga a su nombre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, type CarritoItem } from '@/db';
import {
  ID_INVITADO,
  idCarritoActual,
  esCarritoInvitado,
  adoptarCarritoInvitado,
  vaciarCarritoInvitado,
} from '@/db/carritoInvitado';
import { sessionUser } from '@/utils/sessionUser';

const CLIENTE = 'cliente-1';

/** Línea de carrito mínima pero con la forma real */
function linea(over: Partial<CarritoItem> = {}): CarritoItem {
  return {
    sku: 'S-1',
    almacen: '',
    anticipo: 0,
    cantidad: 1,
    categoria: 'Postres',
    descuentoCupon: 0,
    estatus: 'Preparacion',
    fechaEntrega: '',
    fecha_hora: '2026-09-19',
    id_articulo: 'art-1',
    id_pedido: 'ped-1',
    id_usuario: ID_INVITADO,
    metodo_pago: 'Efectivo',
    nombre: 'Pastel',
    precio: 100,
    url: '',
    detalle: '',
    id_tienda: 'tienda-1',
    nombre_tienda: 'Lola',
    ...over,
  };
}

const delUsuario = (uid: string) => db.Carrito.where('id_usuario').equals(uid).toArray();

beforeEach(async () => {
  await db.Carrito.clear();
  sessionUser.value = null;
});
afterEach(() => {
  sessionUser.value = null;
});

describe('De quién es el carrito', () => {
  it('sin sesión, es del invitado', () => {
    expect(esCarritoInvitado()).toBe(true);
    expect(idCarritoActual()).toBe(ID_INVITADO);
  });

  it('con sesión, es del cliente', () => {
    sessionUser.value = { id: CLIENTE, nombre: 'Ana' };
    expect(esCarritoInvitado()).toBe(false);
    expect(idCarritoActual()).toBe(CLIENTE);
  });
});

describe('Adoptar el carrito del invitado al iniciar sesión', () => {
  it('los artículos del invitado pasan al cliente', async () => {
    await db.Carrito.add(linea({ id_articulo: 'art-1', cantidad: 2 }));
    await db.Carrito.add(linea({ id_articulo: 'art-2', sku: 'S-2' }));

    const adoptados = await adoptarCarritoInvitado(CLIENTE);

    expect(adoptados).toBe(2);
    expect(await delUsuario(ID_INVITADO)).toHaveLength(0);
    const delCliente = await delUsuario(CLIENTE);
    expect(delCliente).toHaveLength(2);
    expect(delCliente.find((i) => i.id_articulo === 'art-1')!.cantidad).toBe(2);
  });

  it('si el cliente ya tenía ese artículo y variante, se suman las cantidades', async () => {
    // lo que ya tenía el cliente (por ejemplo, bajado de su copia en Firebase)
    await db.Carrito.add(linea({ id_usuario: CLIENTE, id_articulo: 'art-1', sku: 'S-1', cantidad: 3 }));
    // lo que agregó como invitado
    await db.Carrito.add(linea({ id_articulo: 'art-1', sku: 'S-1', cantidad: 2 }));

    await adoptarCarritoInvitado(CLIENTE);

    const delCliente = await delUsuario(CLIENTE);
    expect(delCliente).toHaveLength(1); // no se duplica la línea
    expect(delCliente[0].cantidad).toBe(5);
    expect(await delUsuario(ID_INVITADO)).toHaveLength(0);
  });

  it('una variante distinta del mismo artículo es otra línea', async () => {
    await db.Carrito.add(linea({ id_usuario: CLIENTE, id_articulo: 'art-1', sku: 'S-1', cantidad: 1 }));
    await db.Carrito.add(linea({ id_articulo: 'art-1', sku: 'S-2', cantidad: 1 }));

    await adoptarCarritoInvitado(CLIENTE);

    const delCliente = await delUsuario(CLIENTE);
    expect(delCliente).toHaveLength(2);
    expect(delCliente.map((i) => i.sku).sort()).toEqual(['S-1', 'S-2']);
  });

  it('no toca el carrito de otro cliente', async () => {
    await db.Carrito.add(linea({ id_usuario: 'cliente-2', id_articulo: 'art-9' }));
    await db.Carrito.add(linea({ id_articulo: 'art-1' }));

    await adoptarCarritoInvitado(CLIENTE);

    expect(await delUsuario('cliente-2')).toHaveLength(1);
    expect(await delUsuario(CLIENTE)).toHaveLength(1);
  });

  it('sin nada del invitado no hace nada', async () => {
    await db.Carrito.add(linea({ id_usuario: CLIENTE, cantidad: 4 }));
    expect(await adoptarCarritoInvitado(CLIENTE)).toBe(0);
    expect((await delUsuario(CLIENTE))[0].cantidad).toBe(4);
  });

  it('no adopta hacia el propio invitado ni sin usuario', async () => {
    await db.Carrito.add(linea());
    expect(await adoptarCarritoInvitado(ID_INVITADO)).toBe(0);
    expect(await adoptarCarritoInvitado('')).toBe(0);
    expect(await delUsuario(ID_INVITADO)).toHaveLength(1);
  });

  it('vaciarCarritoInvitado borra solo lo del invitado', async () => {
    await db.Carrito.add(linea());
    await db.Carrito.add(linea({ id_usuario: CLIENTE }));

    await vaciarCarritoInvitado();

    expect(await delUsuario(ID_INVITADO)).toHaveLength(0);
    expect(await delUsuario(CLIENTE)).toHaveLength(1);
  });
});
