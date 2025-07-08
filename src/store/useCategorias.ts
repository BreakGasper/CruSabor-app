import { defineStore } from "pinia";
import { ref } from "vue";
import type { Ref } from "vue";
import { db } from "@/firebase";
import { ref as dbRef, onValue } from "firebase/database";

/**
 * Interfaz que define la estructura de un artículo.
 */
interface Articulo {
  nombre: string;
  precio: number;
  descripcion: string;
  imagen?: string; // Propiedad opcional para la URL de la imagen
  categoriaId: string; // ID de la categoría a la que pertenece
  articuloId: string; // ID único del artículo
  [key: string]: any; // Para permitir otros campos adicionales que puedan venir de Firebase
}

/**
 * Store de Pinia para manejar las categorías y sus artículos.
 */
export const useCategoriasStore = defineStore("categorias", () => {
  // Estado reactivo que contiene la lista de artículos
  const categorias: Ref<Articulo[]> = ref([]);

  // Estado reactivo que indica si la carga está en proceso
  const loading = ref(true);

  /**
   * Función que consulta la base de datos Firebase Realtime Database
   * para obtener las categorías y sus artículos.
   */
  function fetchCategorias() {
    // Referencia a la ruta "Categoria" en la base de datos
    const categoriaRef = dbRef(db, "Categoria");

    // Listener para escuchar cambios en tiempo real en la base de datos
    onValue(
      categoriaRef,
      (snapshot) => {
        // Obtener los datos de la instantánea
        const data = snapshot.val();

        // Si no hay datos, limpiar el arreglo y marcar carga como falsa
        if (!data) {
          categorias.value = [];
          loading.value = false;
          return;
        }

        const result: Articulo[] = [];

        // Recorrer cada categoría
        for (const catId in data) {
          const categoria = data[catId];
          // Obtener los artículos de la categoría, o un objeto vacío si no hay
          const articulos = categoria.articulos || {};

          // Recorrer cada artículo dentro de la categoría
          for (const artId in articulos) {
            result.push({
              ...articulos[artId], // Propiedades del artículo
              categoriaId: catId, // Agregar el ID de la categoría
              articuloId: artId, // Agregar el ID del artículo
            });
          }
        }

        // Actualizar el estado reactivo con los artículos procesados
        categorias.value = result;

        // Marcar que la carga ha terminado
        loading.value = false;
      },
      (error) => {
        // Manejo de errores: mostrar en consola y detener la carga
        console.error("❌ Error leyendo datos:", error);
        loading.value = false;
      }
    );
  }

  // Exponer el estado y la función para que puedan ser usados desde los componentes
  return {
    categorias,
    loading,
    fetchCategorias,
  };
});
