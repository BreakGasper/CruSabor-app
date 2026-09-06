<template>
  <section v-if="categorias.length" class="categorias-scroll">
    <div class="pista">
      <button
        v-for="cat in categorias"
        :key="cat.id"
        type="button"
        class="categoria"
        :title="cat.nombre"
        @click="verCategoria(cat)"
      >
        <span class="icono-wrap">
          <img loading="lazy" :src="cat.icono || defaultIcon" :alt="cat.nombre" @error="onImgError" />
        </span>
        <span class="nombre">{{ cat.nombre }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
/** Categorías en un carrusel horizontal (solo icono y nombre), arriba de "Explorar" */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { obtenerCategorias, type CategoriaData } from '@/composables/useCategorias';
import defaultIcon from '@/assets/icons/default_articulo.png';

const router = useRouter();
const categorias = ref<CategoriaData[]>([]);

onMounted(async () => {
  const todas = await obtenerCategorias();
  // Solo categorías principales, en orden alfabético
  categorias.value = todas
    .filter((c) => !c.padreId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
});

function verCategoria(cat: CategoriaData) {
  router.push({ name: 'categoriaArticulos', params: { id: cat.id, categoriaNombre: cat.nombre } });
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultIcon;
}
</script>

<style scoped>
.categorias-scroll {
  padding: 0.25rem 0 0;
}
.pista {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 6px 1rem 10px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.pista::-webkit-scrollbar {
  display: none;
}
.categoria {
  flex: 0 0 auto;
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  cursor: pointer;
  scroll-snap-align: start;
}
.icono-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 2px 8px var(--color-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.15s;
}
.categoria:hover .icono-wrap {
  transform: translateY(-2px);
}
.icono-wrap img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}
.nombre {
  font-size: 0.7rem;
  line-height: 1.15;
  text-align: center;
  max-width: 72px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
