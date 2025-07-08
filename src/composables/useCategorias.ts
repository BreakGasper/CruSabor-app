import { ref as vueRef, onMounted } from "vue";
import type { Ref } from "vue";
import { db } from "@/firebase";
import { ref as dbRef, onValue } from "firebase/database";

interface Articulo {
  nombre: string;
  precio: number;
  descripcion: string;
  imagen?: string;
  categoriaId: string;
  articuloId: string;
  [key: string]: any; // Por si Firebase tiene campos adicionales
}

export function useCategorias() {
  const categorias: Ref<Articulo[]> = vueRef([]);
  const loading: Ref<boolean> = vueRef(true);

  onMounted(() => {
    const categoriaRef = dbRef(db, "Categoria");

    onValue(
      categoriaRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          loading.value = false;
          return;
        }

        const result: Articulo[] = [];

        for (const catId in data) {
          const categoria = data[catId];
          const articulos = categoria.articulos || {};

          for (const artId in articulos) {
            result.push({
              ...articulos[artId],
              categoriaId: catId,
              articuloId: artId,
            });
          }
        }

        categorias.value = result;
        loading.value = false;
      },
      (error) => {
        console.error("❌ Error leyendo datos:", error);
        loading.value = false;
      }
    );
  });

  return { categorias, loading };
}
