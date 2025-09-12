import { ref } from "vue";
import { useRouter } from "vue-router";
import { useCarrito } from "@/db/composables/useCarrito";
import { useFavoritos } from "@/db/composables/useFavoritos";
import type { Producto } from "@/types/Producto";
import { db } from "@/db";
import { sessionUser } from "@/utils/sessionUser";

export function useHorizontalCarousel() {
  const scrollArea = ref<HTMLElement | null>(null);
  const router = useRouter();
 
  const { toggleFavorito, estaFavorito, favoritosIds } = useFavoritos();

  function scrollLeft() {
    scrollArea.value?.scrollBy({ left: -200, behavior: "smooth" });
  }

  function scrollRight() {
    scrollArea.value?.scrollBy({ left: 200, behavior: "smooth" });
  }

  function verDetalle(producto: Producto) {
    router.push(`/producto/${producto.articuloId}`);
  }

  function verMas() {
    router.push("/productos");
  }

function toggleFavoritoLocal(producto: Producto, idUsuario: string) {
  toggleFavorito({
    articuloId: producto.articuloId,
    categoriaId: producto.categoriaId || "",
    nombre: producto.nombre,
    precio: producto.precio,
    descripcion: producto.descripcion || "",
    unidadMedida: producto.unidadMedida || "",
    puntuacion: producto.puntuacion || 0,
    url: producto.url || "",
    almacen: producto.almacen || "",
    anticipo: producto.anticipo || 0,
    subcategoria: producto.subcategoria || "",
    categoria: producto.categoria || "",
  }, idUsuario);
}



 async function agregarAlCarritoLocal(producto: Producto) {
  try {
    // Buscar si ya existe el artículo en el carrito
    const carritoExistente = await db.Carrito
      .where("id_articulo")
      .equals(producto.articuloId)
      .first();

    if (carritoExistente) {
      // Si existe, aumentar la cantidad en 1
      await db.Carrito.update(carritoExistente.id!, {
        cantidad: carritoExistente.cantidad + 1,
        fecha_hora: new Date().toLocaleString(), // opcional: actualizar fecha
      });
      console.log(
        `Cantidad actualizada para ${producto.nombre}: ${
          carritoExistente.cantidad + 1
        }`
      );
    } else {
      // Si no existe, agregar como nuevo
      const itemCarrito = {
        almacen: producto.almacen || "",
        anticipo: producto.anticipo || 0,
        cantidad: 1,
        categoria: producto.categoria || "",
        descuentoCupon: 0,
        estatus: "Preparacion",
        fechaEntrega: "",
        fecha_hora: new Date().toLocaleString(),
        id_articulo: producto.articuloId,
        id_pedido: "0_" + Math.random().toString(36).substr(2, 9),
        id_usuario: "0-OIOifXcje3Sy0G4Ki4y",
        metodo_pago: "Efectivo",
        nombre: producto.nombre,
        precio: producto.precio,
        url: producto.url,
      };

      await db.Carrito.add(itemCarrito);
      console.log("Producto agregado al carrito:", producto.nombre);
    }
  } catch (err) {
    console.error("Error al agregar al carrito:", err);
  }
}

  return {
    scrollArea,
    favoritosIds,
    scrollLeft,
    scrollRight,
    verDetalle,
    verMas,
    toggleFavoritoLocal,
    estaFavorito,
    agregarAlCarrito: agregarAlCarritoLocal,
  };
}
