import { ref as vueRef, onMounted } from "vue";
import type { Ref } from "vue";
import { db } from "@/firebase";
import { ref as dbRef, onValue } from "firebase/database";

export interface Articulo {
  articuloId: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  url?: string;
  icono?: string;
  categoria?: string;         // Nombre de categoría (opcional)
  categoriaId?: string;
  categoriaNombre?: string;
  [key: string]: any;         // Para campos adicionales
}



export function useArticulos() {
  const articulos: Ref<Articulo[]> = vueRef([]);
  const loading: Ref<boolean> = vueRef(true);

  onMounted(() => {
    const articulosRef = dbRef(db, "articulos");

    onValue(
      articulosRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          articulos.value = [];
          loading.value = false;
          return;
        }

        const result: Articulo[] = [];

        for (const artId in data) {
          result.push({
            ...data[artId],
            articuloId: artId,
          });
        }

        articulos.value = result;
        loading.value = false;
      },
      (error) => {
        console.error("❌ Error leyendo articulos:", error);
        loading.value = false;
      }
    );
  });

  return { articulos, loading };
}
