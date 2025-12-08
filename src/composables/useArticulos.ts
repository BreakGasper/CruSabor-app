import { ref as vueRef, onMounted } from "vue";
import type { Ref } from "vue";
import { db } from "@/firebase";
import { ref as dbRef, onValue } from "firebase/database";
import type { Producto } from "@/types/Producto";
 
import { push, set } from "firebase/database";

export function useArticulos() {
  const articulos: Ref<Producto[]> = vueRef([]);
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

        const result: Producto[] = [];
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

  // ➕ Crear un artículo y asociarlo a una tienda
  async function crearArticulo(articulo: Omit<Producto, "articuloId">) {
    try {
      const articulosRef = dbRef(db, "articulos");
      const nuevoArticuloRef = push(articulosRef);
      const articuloId = nuevoArticuloRef.key!;

      await set(nuevoArticuloRef, {
        ...articulo,
        articuloId,
        fecha_hora: new Date().toISOString(),
      });

      return articuloId;
    } catch (error) {
      console.error("❌ Error creando artículo:", error);
      throw error;
    }
  }

  return { articulos, loading, crearArticulo };
}

