<template>
  <div class="articulos-list-container">
    <!-- Header -->
    <div class="header-bar" v-if="showHeader">
      <ArrowBack class="back-button" @click="$router.back()" />
      <h2 class="header-title">Productos</h2>
      <div class="header-icons">
        <button class="icon-btn icon-circle" @click="toggleFiltros">
          <img loading="lazy" src="@/assets/icons/filter.png" alt="Filtro" />
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <transition name="slide-fade" v-if="showHeader">
      <div v-show="showFiltros" class="filtros">
        <input
          type="text"
          v-model="filtroNombre"
          placeholder="Buscar producto..."
          class="filtro-input"
        />
        <select v-model="filtroCategoria" class="filtro-input">
          <option value="">Todas las categorías</option>
          <option v-for="cat in categorias" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
        <button class="icon-btn" @click="limpiarFiltros">
          <img loading="lazy" src="@/assets/icons/clean.png" alt="Limpiar" />
        </button>
      </div>
    </transition>

    <!-- Lista de artículos en cards -->
    <div class="cards-grid">
      <div
        v-for="producto in articulosPaginados"
        :key="producto.articuloId"
        class="card"
        @click="irADetalle(producto)"
      >
        <div class="img-container">
          <img
            loading="lazy"
            :src="FIREBASE_STORAGE_BASE_URL + producto.url"
            :alt="producto.nombre"
            @error="onImageError($event)"
          />
          <span
            class="heart-icon"
            :class="{ active: favoritos[producto.articuloId] }"
            @click.stop="toggleFavorito(producto.articuloId)"
          >
            ❤
          </span>
        </div>
        <div class="info">
          <h3>{{ producto.nombre }}</h3>
          <p class="subcategoria">{{ producto.categoria || "General" }}</p>
          <p class="precio">${{ producto.precio }}</p>
        </div>
      </div>
    </div>

    <p v-if="articulosFiltrados.length === 0">No se encontraron productos.</p>

    <!-- Paginación -->
    <div v-if="totalPaginas > 1 && showHeader" class="pagination">
      <button
        class="page-btn"
        :disabled="paginaActual === 1"
        @click="paginaActual--"
      >
        ◀ Anterior
      </button>
      <span class="page-info"
        >Página {{ paginaActual }} de {{ totalPaginas }}</span
      >
      <button
        class="page-btn"
        :disabled="paginaActual === totalPaginas"
        @click="paginaActual++"
      >
        Siguiente ▶
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useArticulos } from "@/composables/useArticulos";
import ArrowBack from "@/components/ArrowBack.vue";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { useRoute, useRouter } from "vue-router";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";

const route = useRoute();
const router = useRouter();
const tiendaId = route.params.id as string;

const defaultImage = userDefaultImage;
const showHeader = true;

// Filtros
const filtroNombre = ref("");
const filtroCategoria = ref("");
const showFiltros = ref(false);


// Paginación
const paginaActual = ref(1);
const itemsPorPagina = 6;

// Favoritos local
const favoritos = ref<Record<string, boolean>>({});

// Categorías dinámicas
const categorias = ref<string[]>([]);

const { articulos, cargarArticulosPorTienda } = useArticulos();

onMounted(async () => {
  await cargarArticulosPorTienda(tiendaId);

  // Extraer categorías únicas
  const cats = new Set<string>();
  articulos.value.forEach((a) => {
    if (a.categoria) cats.add(a.categoria);
  });
  categorias.value = Array.from(cats);
});

// Filtros computados
const articulosFiltrados = computed(() => {
  let filtered = articulos.value;

  if (filtroNombre.value) {
    filtered = filtered.filter((a) =>
      a.nombre?.toLowerCase().includes(filtroNombre.value.toLowerCase()),
    );
  }

  if (filtroCategoria.value) {
    filtered = filtered.filter((a) => a.categoria === filtroCategoria.value);
  }

  return filtered;
});

// Paginación
const totalPaginas = computed(() =>
  Math.ceil(articulosFiltrados.value.length / itemsPorPagina),
);

const articulosPaginados = computed(() => {
  const start = (paginaActual.value - 1) * itemsPorPagina;
  return articulosFiltrados.value.slice(start, start + itemsPorPagina);
});

// Funciones
function toggleFiltros() {
  showFiltros.value = !showFiltros.value;
}

function limpiarFiltros() {
  filtroNombre.value = "";
  filtroCategoria.value = "";
  paginaActual.value = 1;
}

function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = defaultImage;
}

function irADetalle(producto: any) {
  router.push(`/producto/${producto.articuloId}`);
}

function toggleFavorito(articuloId: string) {
  favoritos.value[articuloId] = !favoritos.value[articuloId];
}
</script>

<style scoped>
.articulos-list-container {
  width: 90%;
  max-width: 700px;
  margin: 0 auto;
  padding-bottom: 2rem;
  font-family: Arial, sans-serif;
}

/* Header */
.header-bar {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  background: var(--color-bg-blue-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem;
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-bottom: 10px;
  border-radius: 10px;
}
.back-button {
  width: 26px;
  height: 26px;
}
.header-title {
  color: white;
  font-weight: bold;
  font-size: 0.95rem;
}
.header-icons {
  display: flex;
  gap: 8px;
}
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
}
.icon-btn img {
  width: 22px;
  height: 22px;
}
.icon-circle {
  width: 36px;
  height: 36px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  border: none;
  padding: 6px;
}

/* Filtros */
.filtros {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  padding: 8px;
  background: #f2f4f8;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.filtro-input {
  flex: 1;
  min-width: 120px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
}

/* Transición filtros */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Grid de cards */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

/* Card de producto */
.card {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  background: white;
  cursor: pointer;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.img-container {
  position: relative;
}
.card img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
}

/* Corazón */
.heart-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 1.1rem;
  color: #bbb;
  background: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: color 0.2s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.heart-icon.active {
  color: red;
}
.heart-icon:hover {
  color: #e63946;
}

.info {
  padding: 0.75rem;
  text-align: center;
}
.info h3 {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.2rem;
  color: #333;
}
.subcategoria {
  font-size: 0.85rem;
  color: #777;
  margin-bottom: 0.5rem;
}
.precio {
  color: #e74c3c;
  font-weight: bold;
  font-size: 0.95rem;
}

/* Paginación */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
  gap: 12px;
}
.page-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-blue-dark);
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.page-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.page-info {
  font-size: 0.9rem;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 480px) {
  .card {
    max-width: 100%;
    width: 100%;
    margin: 0 auto;
  }

  .card img {
    height: 120px;
  }

  .info {
    padding: 0.5rem;
  }

  .info h3 {
    font-size: 0.95rem;
  }

  .subcategoria {
    font-size: 0.8rem;
  }

  .precio {
    font-size: 0.9rem;
  }
}
</style>
