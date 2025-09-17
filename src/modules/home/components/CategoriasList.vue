<template>
  <div class="categorias-container">
    <!-- Header con flecha y título -->
    <div class="header">
      <div class="back-btn" style="width: 40px">
        <ArrowBack @click="$router.back()" />
      </div>

      <h2 class="carousel-title">Categorías</h2>
    </div>

    <!-- Grid de categorías -->
    <div class="grid">
      <div
        class="categoria-item"
        v-for="cat in categorias"
        :key="cat.categoriaId"
        @click="verCategoria(cat)"
      >
        <div class="img-container">
          <img
            loading="lazy"
            :src="
              FIREBASE_STORAGE_BASE_URL +
                'Categoria%2F' +
                cat.icono +
                '.png?alt=media&token=6255f15a-d081-4add-98b1-2a46f9a89b48' ||
              defaultIcon
            "
            :alt="cat.categoriaNombre"
          />
        </div>
        <p class="nombre">{{ cat.categoriaNombre }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import ArrowBack from "@/components/ArrowBack.vue";
import { useArticulos } from "@/composables/useArticulos";
import type { Producto } from "@/types/Producto";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";

// Nueva interfaz de categoría
interface Categoria {
  categoriaId: string;
  categoriaNombre: string;
  icono?: string;
}

// Icono por defecto si no hay icono en la categoría
const defaultIcon = "https://via.placeholder.com/100?text=Icon";
const router = useRouter();
// Traemos todos los artículos desde Firebase
const { articulos, loading } = useArticulos();
const categoriaSeleccionada = ref<string | null>(null);
// Computed para extraer categorías únicas
const categorias = computed<Categoria[]>(() => {
  const map: Record<string, Categoria> = {};

  articulos.value.forEach((art: Producto) => {
    if (art.categoriaId && !map[art.categoriaId]) {
      map[art.categoriaId] = {
        categoriaId: art.categoriaId,
        categoriaNombre: art.categoria || art.categoria || "Sin nombre",
        icono: art.icono || "",
      };
    }
  });

  return Object.values(map);
});

// Computed que filtra artículos por categoría
const articulosFiltrados = computed<Producto[]>(() => {
  if (!categoriaSeleccionada.value) return [];
  return articulos.value.filter(
    (art) => art.categoriaId === categoriaSeleccionada.value
  );
});

// Función para navegar a la vista de productos filtrados por categoría
const verCategoria = (cat: Categoria) => {
  categoriaSeleccionada.value = cat.categoriaId;
  //console.log("Artículos de la categoría:", cat.categoriaNombre);
  // console.log("Artículos filtrados:", articulosFiltrados.value);
  router.push({
    name: "categoriaArticulos",
    params: { id: cat.categoriaId, categoriaNombre: cat.categoriaNombre },
  });
  // $router.push(`/categoria/${cat.categoriaId}`);
};

onMounted(() => {
  if (loading.value) console.log("Cargando categorías...");
});
</script>

<style scoped>
.categorias-container {
  padding: 1rem;
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
.carousel-title {
  font-size: 1.5rem;
  text-align: center;
}

/* Grid 2 columnas */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.categoria-item {
  background: white;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}
.categoria-item:hover {
  transform: translateY(-2px);
}

.img-container {
  width: 80px; /* tamaño fijo deseado */
  height: 80px;
  margin: 0 auto 0.5rem auto;
}

.img-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.nombre {
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}
</style>
