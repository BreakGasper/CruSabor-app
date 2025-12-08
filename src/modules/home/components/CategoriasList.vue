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
        :key="cat.id"
        @click="verCategoria(cat)"
      >
        <div class="img-container">
          <img
            loading="lazy"
            :src="cat.icono || defaultIcon"
            :alt="cat.nombre"
          />
        </div>
        <p class="nombre">{{ cat.nombre }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import ArrowBack from "@/components/ArrowBack.vue";
import { obtenerCategorias } from "@/composables/useCategorias";

// Nueva interfaz de categoría
interface Categoria {
  id: string;
  nombre: string;
  icono?: string;
}

// Icono por defecto si no hay icono en la categoría
const defaultIcon = "https://via.placeholder.com/100?text=Icon";

const router = useRouter();
const categorias = ref<Categoria[]>([]);
const categoriaSeleccionada = ref<string | null>(null);

// Cargar categorías desde Firebase al montar
onMounted(async () => {
  categorias.value = await obtenerCategorias();
});

// Función para navegar a la vista de productos filtrados por categoría
const verCategoria = (cat: Categoria) => {
  categoriaSeleccionada.value = cat.id;
  router.push({
    name: "categoriaArticulos",
    params: { id: cat.id, categoriaNombre: cat.nombre },
  });
};
</script>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}
.categorias-container {
  padding: 0.5rem;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0 1rem;
}

/* Card uniforme */
.categoria-item {
  background: white;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;

  /* Esto fuerza que todos los cards tengan el mismo tamaño */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 180px; /* altura fija para uniformidad */
  width: 100%; /* ancho igual en cada columna */
}

.categoria-item:hover {
  transform: translateY(-2px);
}

.img-container {
  width: 80px;
  height: 80px;
  display: flex; /* Convertimos en flex */
  align-items: center; /* Centrar vertical */
  justify-content: center; /* Centrar horizontal */
}

.img-container img {
  max-width: 100%; /* Ajusta al contenedor sin deformar */
  max-height: 100%; /* Mantiene proporción */
  object-fit: cover;
  border-radius: 6px;
}

/* Texto */
.nombre {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
  margin-top: 2rem; /* para mantener consistencia */
}
</style>
