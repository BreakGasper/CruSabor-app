import { ref as vueRef, computed, onMounted } from "vue";
import type { Ref } from "vue";
import { useEstadoTiendas } from "@/composables/useMembresia";
import { db } from "@/firebase";
import { ref as dbRef, onValue } from "firebase/database";
import type { Producto } from "@/types/Producto";
 
import { push, set } from "firebase/database";






/** Fecha de publicación de un artículo en ms (0 si no tiene). Acepta ISO o texto local "d/m/aaaa, h:mm". */
export function fechaArticulo(a: Pick<Producto, "fecha_hora"> | null | undefined): number {
  const f = a?.fecha_hora;
  if (!f) return 0;
  const iso = Date.parse(f);
  if (!isNaN(iso)) return iso;
  const [d, h] = f.split(",").map((s) => s.trim());
  const [dia, mes, anio] = (d || "").split("/").map(Number);
  if (!anio) return 0;
  const m = (h || "").match(/(\d+):(\d+)/);
  return new Date(anio, mes - 1, dia, m ? +m[1] : 0, m ? +m[2] : 0).getTime();
}

export interface UseArticulosOpciones {
  /**
   * Por defecto el catálogo público oculta los artículos de tiendas que no pueden
   * vender (pendientes, bloqueadas o con membresía vencida). La dueña o dueño de la
   * tienda necesita verlos todos: pasa true en esas pantallas.
   */
  incluirTiendasInactivas?: boolean;
}

export function useArticulos(opciones: UseArticulosOpciones = {}) {
  const crudos: Ref<Producto[]> = vueRef([]);
  const loading: Ref<boolean> = vueRef(true);
  const { noPuedeVender } = useEstadoTiendas();
  // Cuando se cargan los artículos de una sola tienda (panel de la tienda) no se filtra
  const filtrarPorTienda = vueRef(!opciones.incluirTiendasInactivas);

  const articulos = computed<Producto[]>(() =>
    filtrarPorTienda.value
      ? crudos.value.filter((a) => !noPuedeVender(a.tiendaId))
      : crudos.value,
  );

  onMounted(() => {
    const articulosRef = dbRef(db, "articulos");

    onValue(
      articulosRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          crudos.value = [];
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

        crudos.value = result;
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



  function cargarArticulosPorTienda(tiendaId: string) {
    loading.value = true;
    filtrarPorTienda.value = false; // la tienda ve sus artículos aunque no pueda vender
    const articulosRef = dbRef(db, "articulos");

    onValue(
      articulosRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          crudos.value = [];
          loading.value = false;
          return;
        }

        const result: Producto[] = [];
        for (const artId in data) {
          const art = data[artId];
          if (art.tiendaId === tiendaId) {
            result.push({
              ...art,
              articuloId: artId,
            });
          }
        }

        crudos.value = result;
        loading.value = false;
      },
      (error) => {
        console.error("❌ Error leyendo artículos por tienda:", error);
        loading.value = false;
      }
    );
  }

  return { articulos, loading, crearArticulo, cargarArticulosPorTienda };
}

