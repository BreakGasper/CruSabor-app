<template>
  <div class="articulos-categoria-container">
    <!-- Header con flecha y título -->
    <div class="header">
      <div class="back-btn" style="width: 40px">
        <ArrowBack @click="$router.back()" />
      </div>

      <h2 class="carousel-title">{{ categoriaNombre }}</h2>
    </div>

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
            :src="FIREBASE_STORAGE_BASE_URL + art.url || default_articulo"
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
            @click.stop="aumentarCantidad(art)"
          >
            +
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
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import default_articulo from "@/assets/icons/default_articulo.png";
import { db } from "@/db";
import { sessionUsuarioValidation, sessionUser } from "@/utils/sessionUser";
import { sessionPedidoId, generarNuevoPedidoId } from "@/utils/sessionPedido";

// ✅ Importamos useHorizontalCarousel solo para favoritos
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import ArrowBack from "@/components/ArrowBack.vue";

import { FontAwesomeIcon } from "@/plugins/fontawesome";

const { toggleFavoritoLocal, estaFavorito, verDetalle } =
  useHorizontalCarousel();

// Props
const props = defineProps<{ id: string; categoriaNombre?: string }>();
const { articulos, loading } = useArticulos();

// Filtrado por categoría
const articulosFiltrados = computed<Producto[]>(() =>
  articulos.value.filter((art) => art.categoriaId === props.id)
);

const categoriaNombre = ref(props.categoriaNombre || "");
watch(
  () => props.categoriaNombre,
  (newName) => {
    if (newName) categoriaNombre.value = newName;
  }
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
      url: producto.url || "",
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
  color: #666;
  font-size: 0.95rem;
  margin-top: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.articulo-item {
  background: white;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}
.articulo-item:hover {
  transform: translateY(-2px);
}

.img-container {
  width: 100%;
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

.nombre {
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}

.precio {
  font-size: 0.85rem;
  color: #555;
}

.acciones {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
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
  color: #333;
}
</style>
