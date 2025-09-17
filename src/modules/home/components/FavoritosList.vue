<template>
  <div class="favoritos-container">
    <!-- Header (solo si showHeader es true) -->
    <div v-if="showHeader" class="header">
      <ArrowBack class="back-button" @click="$router.back()" />
      <h2 class="carousel-title">Mis Favoritos</h2>
    </div>

    <div :class="['grid', { horizontal }]">
      <!-- No hay favoritos -->
      <div v-if="favoritos.length === 0" class="empty">
        Aún no cuentas con Favoritos
      </div>

      <!-- Lista de favoritos -->
      <div
        v-else
        class="carousel-item"
        v-for="prod in favoritos"
        :key="prod.articuloId"
        @click="verDetalle(prod)"
      >
        <div class="img-container">
          <img
            loading="lazy"
            :src="FIREBASE_STORAGE_BASE_URL + prod.url"
            :alt="prod.nombre"
          />
          <span class="btn-quitar" @click.stop="quitarFavorito(prod)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              width="16"
              height="16"
            >
              <path
                d="M3 6h18v2H3V6zm2 3h14l-1.5 12.5a1 1 0 01-1 .5H7.5a1 1 0 01-1-.5L5 9zm5 2v8h2v-8H10zm4 0v8h2v-8h-2z"
              />
            </svg>
          </span>
        </div>

        <p class="nombre">{{ prod.nombre }}</p>
        <p class="subtitulo descripcion">{{ prod.descripcion }}</p>
        <div class="precio-agregar">
          <span class="precio">${{ prod.precio.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Botón Ver todos al final -->
      <div
        v-if="limit && favoritos.length >= limit && showVerTodos"
        class="carousel-item ver-todos"
        @click.stop="$router.push('/favoritos')"
      >
        <span>Ver Mas ...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { db } from "@/db";
import type { Producto } from "@/types/Producto";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import ArrowBack from "@/components/ArrowBack.vue";
import { useFavoritos } from "@/db/composables/useFavoritos";
import { sessionUser } from "@/utils/sessionUser";

const router = useRouter();

// Props: limit, horizontal, showHeader
const {
  limit,
  horizontal,
  showHeader = true,
  showVerTodos = true,
} = defineProps<{
  limit?: number;
  horizontal?: boolean;
  showHeader?: boolean;
  showVerTodos?: boolean;
}>();

const favoritos = ref<Producto[]>([]);
const { obtenerFavoritosPorUsuario } = useFavoritos();

const cargarFavoritos = async () => {
  if (!sessionUser.value?.id) return;

  const items = await obtenerFavoritosPorUsuario(sessionUser.value.id);
  // Limitar si se pasa prop limit
  const lista = limit ? items.slice(0, limit) : items;

  favoritos.value = lista.map((f) => ({
    articuloId: f.articuloId,
    nombre: f.nombre,
    url: f.url || "",
    precio: f.precio || 0,
    descripcion: f.descripcion || "",
  }));
};

onMounted(() => cargarFavoritos());

// Ver detalle
const verDetalle = (producto: Producto) => {
  router.push({ name: "ProductoDetalle", params: { id: producto.articuloId } });
};

// Quitar favorito
const quitarFavorito = async (producto: Producto) => {
  await db.Favoritos.where("articuloId").equals(producto.articuloId).delete();
  favoritos.value = favoritos.value.filter(
    (f) => f.articuloId !== producto.articuloId
  );
};
</script>

<style scoped>
.favoritos-container {
  padding: 1rem;
}

.header {
  position: relative;
  text-align: center;
  margin-bottom: 1rem;
}

.back-button {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.5rem;
  cursor: pointer;
  z-index: 1;
}

.carousel-title {
  font-size: 1.5rem;
  text-align: center;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

/* Horizontal scroll */
.grid.horizontal {
  display: flex;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
}
.grid.horizontal .carousel-item {
  flex: 0 0 45%;
  min-width: 120px;
}
.grid.horizontal::-webkit-scrollbar {
  display: none;
}

.carousel-item {
  background: white;
  border-radius: 8px;
  padding: 0.3rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.img-container {
  position: relative;
  aspect-ratio: 1/1;
}
.img-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.btn-quitar {
  position: absolute;
  top: 6px;
  right: 6px;
  background: red;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.nombre {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.3rem 0 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.descripcion {
  font-size: 0.75rem;
  color: #666;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.3rem;
}
.precio {
  font-size: 0.8rem;
  color: #e74c3c;
  font-weight: bold;
}

.ver-todos {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #eee;
  font-weight: bold;
}
.empty {
  text-align: center;
  color: grey;
  margin-top: 2rem;
}
</style>
