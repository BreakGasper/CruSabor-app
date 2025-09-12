import { db } from '../index';
import type { CarritoItem } from '../index';
import { sessionUser } from '@/utils/sessionUser';

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
      if (!sessionUser.value?.id) return;

      // Borra solo los ítems cuyo id_usuario coincida con el usuario actual
      await db.Carrito
        .where("id_usuario")
        .equals(sessionUser.value.id)
        .delete();

      console.log("Carrito del usuario vaciado");
}
  async function obtenerCarritoByUser(): Promise<CarritoItem[]> {
  if (!sessionUser.value?.id) return []; // evita errores si no hay usuario
  return await db.Carrito
    .where("id_usuario")
    .equals(sessionUser.value.id)
    .toArray();
}

  return {
    agregarCarrito,
    obtenerCarrito,
    vaciarCarrito,
    obtenerCarritoByUser,
    vaciarCarritoPorUsuario
  };
}
