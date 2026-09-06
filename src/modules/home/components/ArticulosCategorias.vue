<template>
  <div class="articulos-categoria-container">
    <!-- Header con flecha y título -->
    <PageHeader :title="categoriaNombre || 'Categoría'" fallback="/categoria" />

    <div v-if="loading" class="loading">Cargando artículos...</div>

    <div v-else-if="articulosFiltrados.length === 0" class="no-articulos">
      No hay artículos en esta categoría.
    </div>

    <div v-else class="grid">
      <div
        v-for="art in articulosFiltrados"
        :key="art.articuloId"
        class="articulo-item"
      >
        <div class="img-container" @click="verDetalle(art)">
          <img
            loading="lazy"
            :src="imagenUrl(art.url) || default_articulo"
            @error="onImgError"
            :alt="art.nombre"
          />

          <!-- ❤️ FAVORITOS -->
          <div v-if="sessionUsuarioValidation()">
            <span
              class="heart-icon"
              :class="{ active: estaFavorito(art.articuloId) }"
              @click.stop="toggleFavoritoLocal(art, sessionUser.id)"
            >
              <FontAwesomeIcon
                :icon="
                  estaFavorito(art.articuloId)
                    ? ['fas', 'heart']
                    : ['far', 'heart']
                "
              />
            </span>
          </div>
        </div>

        <p class="nombre">{{ art.nombre }}</p>
        <p class="precio">${{ art.precio.toFixed(2) }}</p>

        <div class="acciones" v-if="sessionUsuarioValidation()">
          <button
            v-if="!(cantidadEnCarrito[art.articuloId] > 0)"
            class="btn-agregar"
            :class="{ 'sin-envio': sinEnvio(art.tiendaId) }"
            :disabled="sinEnvio(art.tiendaId)"
            :title="sinEnvio(art.tiendaId) ? 'Esta tienda no envía a domicilio' : 'Agregar al carrito'"
            @click.stop="aumentarCantidad(art)"
          >
            {{ sinEnvio(art.tiendaId) ? 'Sin envío' : '+' }}
          </button>

          <div v-else class="contador-carrito">
            <button
              class="btn-carrito btn-mas"
              @click.stop="aumentarCantidad(art)"
            >
              +
            </button>

            <span class="cantidad">{{
              cantidadEnCarrito[art.articuloId]
            }}</span>

            <button
              class="btn-carrito"
              :class="
                cantidadEnCarrito[art.articuloId] > 1
                  ? 'btn-menos'
                  : 'btn-basura'
              "
              @click.stop="
                cantidadEnCarrito[art.articuloId] > 1
                  ? disminuirCantidad(art)
                  : eliminarArticulo(art)
              "
            >
              <template v-if="cantidadEnCarrito[art.articuloId] > 1"
                >-</template
              >
              <template v-else>
                <FontAwesomeIcon :icon="['fas', 'trash-can']" />
              </template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import type { Producto } from "@/types/Producto";
import { useArticulos } from "@/composables/useArticulos";
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from "@/constants/firebase_util";
import default_articulo from "@/assets/icons/default_articulo.png";
import { db } from "@/db";
import { sessionUsuarioValidation, sessionUser } from "@/utils/sessionUser";
import { sessionPedidoId, generarNuevoPedidoId } from "@/utils/sessionPedido";

// ✅ Importamos useHorizontalCarousel solo para favoritos
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import { useEnvioTienda, MENSAJE_SIN_ENVIO } from "@/composables/useEnvioTienda";
import Swal from "sweetalert2";
import PageHeader from "@/components/PageHeader.vue";

import { FontAwesomeIcon } from "@/plugins/fontawesome";

const { toggleFavoritoLocal, estaFavorito, verDetalle } =
  useHorizontalCarousel();
const { sinEnvio } = useEnvioTienda();

// Props
const props = defineProps<{ id: string; categoriaNombre?: string }>();
const { articulos, loading } = useArticulos();

const categoriaNombre = ref(props.categoriaNombre || "");
watch(
  () => props.categoriaNombre,
  (newName) => {
    if (newName) categoriaNombre.value = newName;
  }
);

// Filtrado por categoría (los artículos ya traen categoriaId; ver scripts/migrar-categoriaId.mjs)
const articulosFiltrados = computed<Producto[]>(() =>
  articulos.value.filter((art) => art.categoriaId === props.id)
);

// --- CARRITO ---
const cantidadEnCarrito = reactive<Record<string, number>>({});

const sincronizarCarrito = async () => {
  if (!sessionUser.value?.id) {
    for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
    return;
  }

  const items = await db.Carrito.where("id_usuario")
    .equals(sessionUser.value.id)
    .toArray();

  for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  for (const item of items) cantidadEnCarrito[item.id_articulo] = item.cantidad;
};

const aumentarCantidad = async (producto: Producto) => {
  if (sinEnvio(producto.tiendaId)) {
    Swal.fire({ icon: "info", title: "Sin envío a domicilio", text: MENSAJE_SIN_ENVIO, confirmButtonColor: "#0165d8" });
    return;
  }
  if (!sessionPedidoId.value) generarNuevoPedidoId(sessionUser.value.id);

  const item = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([producto.articuloId, sessionUser.value?.id || ""])
    .first();

  if (item) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad + 1 });
    cantidadEnCarrito[producto.articuloId] = item.cantidad + 1;
  } else {
   const newItem = {
      almacen: producto.almacen || "",
      anticipo: producto.anticipo || 0,
      cantidad: 1,
      categoria: producto.categoria || "",
      descuentoCupon: 0,
      estatus: "Preparacion",
      fechaEntrega: "",
      fecha_hora: new Date().toLocaleString(),
      id_articulo: producto.articuloId,
      id_pedido: sessionPedidoId.value!,
      id_usuario: sessionUser.value?.id || "anon",
      metodo_pago: "Efectivo",
      nombre: producto.nombre,
      precio: producto.precio,
      url: producto.url,
      sku: producto.variantes[0]?.sku || "",
      detalle: producto.variantes[0]?.detalle || "",
      id_tienda: producto.tiendaId || "",
      nombre_tienda: producto.tiendaNombre || "",
    };
    await db.Carrito.add(newItem);
    cantidadEnCarrito[producto.articuloId] = 1;
  }
};

const disminuirCantidad = async (producto: Producto) => {
  const item = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([producto.articuloId, sessionUser.value?.id || ""])
    .first();
  if (!item) return;

  if (item.cantidad > 1) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad - 1 });
    cantidadEnCarrito[producto.articuloId] = item.cantidad - 1;
  } else {
    await db.Carrito.delete(item.id!);
    cantidadEnCarrito[producto.articuloId] = 0;
  }
};
const eliminarArticulo = async (producto: Producto) => {
  const item = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([producto.articuloId, sessionUser.value?.id || ""])
    .first();
  if (!item) return;

  await db.Carrito.delete(item.id!);
  cantidadEnCarrito[producto.articuloId] = 0;
};

onMounted(() => {
  sincronizarCarrito();
});
watch(
  () => sessionUser.value?.id,
  () => sincronizarCarrito()
);

/** Si la imagen no carga, se muestra la imagen por defecto */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = default_articulo;
}
</script>

<style scoped>
.articulos-categoria-container {
  padding: 1rem;
}

.categoria-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.loading,
.no-articulos {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.articulo-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface);
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  height: 300px; /* altura fija del card */
}
.articulo-item:hover {
  transform: translateY(-2px);
}

.img-container {
  width: 100%;
  flex: 0 0 150px; /* altura fija de la imagen */
  aspect-ratio: 1 / 1;
  margin-bottom: 0.5rem;
  position: relative;
}

.img-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.heart-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 1.2rem;
  color: #f44336;
  cursor: pointer;
}
.heart-icon.active {
  color: #d32f2f;
}

.nombre,
.precio {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nombre {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  margin-bottom: 0.2rem;
}

.precio {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

/* Mantener botones al final */
.acciones {
  margin-top: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}
/* Header con flecha y título */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  position: relative;
}
.back-btn {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.btn-agregar {
  background: black;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
}
.btn-agregar.sin-envio,
.btn-agregar:disabled {
  background: #ccc;
  color: var(--text-muted);
  cursor: not-allowed;
  font-size: 0.75rem;
}

.contador-carrito {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.btn-carrito {
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: bold;
}

.btn-mas {
  background-color: #4caf50;
}
.btn-menos {
  background-color: var(--color-bg-blue-ligth);
}
.btn-basura {
  background-color: #f44336; /* Rojo para eliminar */
  display: flex;
  align-items: center;
  justify-content: center;
}
.cantidad {
  font-weight: 600;
  color: var(--text);
}

/* ===== Responsive ===== */
.articulos-categoria-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  box-sizing: border-box;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 1.25rem;
  }
}
@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .articulo-item {
    height: auto;
    min-height: 260px;
  }
  .img-container {
    flex: 0 0 auto;
  }
}
</style>
