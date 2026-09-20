<template>
  <div class="articulos-categoria-container">
    <!-- Header con flecha y título -->
    <PageHeader :title="categoriaNombre || 'Categoría'" fallback="/categoria" />

    <div v-if="loading" class="loading">Cargando artículos...</div>

    <div v-else-if="articulosFiltrados.length === 0" class="no-articulos">
      No hay artículos en esta categoría.
    </div>

    <div v-else class="grid">
      <!-- Misma tarjeta que la portada y /productos: nombre, categoría, tienda,
           precio, etiquetas y carrito. Antes esta pantalla tenía su propia
           versión, con su propia lógica de carrito que además exigía sesión. -->
      <ProductCard
        v-for="art in articulosFiltrados"
        :key="art.articuloId"
        :producto="art"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Producto } from "@/types/Producto";
import { useArticulos } from "@/composables/useArticulos";
import PageHeader from "@/components/PageHeader.vue";
import ProductCard from "./ProductCard.vue";

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
</script>

<style scoped>
/* La tarjeta trae sus propios estilos (ProductCard.vue). Aquí solo el contenedor
   y la rejilla; todo lo de la tarjeta vieja se fue con ella. */
.articulos-categoria-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}

.loading,
.no-articulos {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
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
}
</style>
