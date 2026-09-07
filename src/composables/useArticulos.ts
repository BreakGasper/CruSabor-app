import { ref as vueRef, computed, onMounted } from "vue";
import type { Ref } from "vue";
import { useEstadoTiendas } from "@/composables/useMembresia";
import { db } from "@/firebase";
import { ref as dbRef, onValue, push, set, update } from "firebase/database";
import type { Producto } from "@/types/Producto";

/* =========================================================================
 *  DISPONIBILIDAD Y STOCK DE UN ARTÍCULO (reglas puras)
 * ========================================================================= */

/** Con esta cantidad o menos en alguna variante, el artículo se avisa como "por agotarse" */
export const UMBRAL_STOCK_BAJO = 3;

export type EstadoStock = "agotado" | "bajo" | "ok" | "sin-control";

export interface ResumenStock {
  estado: EstadoStock;
  /** Menor stock entre las variantes con control (Infinity si ninguna lo controla) */
  minimo: number;
  /** Suma del stock controlado */
  total: number;
}

/**
 * Stock de un artículo mirando todas sus variantes. Las variantes con -1 (ilimitado)
 * y los artículos bajo pedido no se controlan.
 */
export function resumenStock(p: Pick<Producto, "variantes" | "porPedido"> | null | undefined): ResumenStock {
  if (!p || p.porPedido) return { estado: "sin-control", minimo: Infinity, total: Infinity };
  const lista: any[] = Array.isArray(p.variantes) ? p.variantes : Object.values(p.variantes || {});
  const controladas = lista.map((v) => Number(v?.stock)).filter((s) => Number.isFinite(s) && s !== -1);
  if (!controladas.length) return { estado: "sin-control", minimo: Infinity, total: Infinity };
  const minimo = Math.min(...controladas);
  const total = controladas.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return { estado: "agotado", minimo, total };
  if (minimo <= UMBRAL_STOCK_BAJO) return { estado: "bajo", minimo, total };
  return { estado: "ok", minimo, total };
}

/** true si la tienda pausó la venta o dio de baja el artículo (no se puede comprar) */
export const ventaBloqueada = (p: Pick<Producto, "ventaPausada" | "baja"> | null | undefined) =>
  p?.ventaPausada === true || p?.baja === true;

export const MENSAJE_VENTA_PAUSADA = "La tienda pausó la venta de este producto por el momento (está resurtiendo).";

/** La tienda pausa o reanuda la venta de un artículo (sigue visible en el catálogo) */
export async function pausarVentaArticulo(articuloId: string, pausar: boolean) {
  await update(dbRef(db, `articulos/${articuloId}`), {
    ventaPausada: pausar,
    ventaPausadaEn: pausar ? new Date().toISOString() : null,
  });
}

/** La tienda da de baja (oculta del catálogo) o reactiva un artículo */
export async function darDeBajaArticulo(articuloId: string, baja: boolean) {
  await update(dbRef(db, `articulos/${articuloId}`), {
    baja,
    bajaEn: baja ? new Date().toISOString() : null,
  });
}






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
  const { noPuedeVender, nombreDe } = useEstadoTiendas();
  // Cuando se cargan los artículos de una sola tienda (panel de la tienda) no se filtra
  const filtrarPorTienda = vueRef(!opciones.incluirTiendasInactivas);

  // `tiendaNombre` es una copia hecha al publicar; se muestra el nombre vivo de la tienda si ya cargó
  const conNombreVivo = (a: Producto): Producto => {
    const actual = nombreDe(a.tiendaId);
    return actual && actual !== a.tiendaNombre ? { ...a, tiendaNombre: actual } : a;
  };

  // Catálogo público: fuera tiendas que no pueden vender y artículos dados de baja.
  // La tienda (cargarArticulosPorTienda) ve todo, incluidos los de baja, para reactivarlos.
  const articulos = computed<Producto[]>(() =>
    (filtrarPorTienda.value ? crudos.value.filter((a) => !noPuedeVender(a.tiendaId) && a.baja !== true) : crudos.value).map(
      conNombreVivo,
    ),
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

