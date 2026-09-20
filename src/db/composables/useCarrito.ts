import { db } from '../index';
import type { CarritoItem } from '../index';
import { idCarritoActual } from '../carritoInvitado';

export function useCarrito() {
  // Agregar un ítem al carrito
  async function agregarCarrito(item: CarritoItem) {
    try {
      await db.Carrito.add(item);
      console.log("Producto agregado al carrito:", item);
    } catch (error) {
      console.error("Error al agregar al carrito:", error);
    }
  }

  // Obtener todos los ítems del carrito
  async function obtenerCarrito(): Promise<CarritoItem[]> {
    return await db.Carrito.toArray();
  }

  // Vaciar el carrito
  async function vaciarCarrito() {
    await db.Carrito.clear();
  }


  async function vaciarCarritoPorUsuario() {
      // Borra solo los ítems del dueño actual del carrito (cliente o invitado)
      await db.Carrito
        .where("id_usuario")
        .equals(idCarritoActual())
        .delete();

      console.log("Carrito del usuario vaciado");
}
  /** Quita del carrito del usuario solo los artículos indicados (los ya comprados) */
  async function quitarArticulosDelCarrito(idsArticulo: string[]) {
    if (!idsArticulo.length) return;
    const ids = new Set(idsArticulo.map(String));
    await db.Carrito
      .where('id_usuario')
      .equals(idCarritoActual())
      .filter((i) => ids.has(String(i.id_articulo)))
      .delete();
  }

  async function obtenerCarritoByUser(): Promise<CarritoItem[]> {
  return await db.Carrito
    .where("id_usuario")
    .equals(idCarritoActual())
    .toArray();
}

  return {
    agregarCarrito,
    obtenerCarrito,
    vaciarCarrito,
    obtenerCarritoByUser,
    vaciarCarritoPorUsuario,
    quitarArticulosDelCarrito,
  };
}
