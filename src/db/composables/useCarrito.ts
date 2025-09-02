import { db } from '../index';
import type { CarritoItem } from '../index';

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

  return {
    agregarCarrito,
    obtenerCarrito,
    vaciarCarrito,
  };
}
