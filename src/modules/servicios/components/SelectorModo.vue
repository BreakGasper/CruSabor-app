<template>
  <nav class="modo" aria-label="¿Qué buscas?" data-testid="selector-modo">
    <button type="button" class="opcion" :class="{ on: modo === 'productos' }" :aria-pressed="modo === 'productos'" data-testid="modo-productos" @click="ir('/')">
      <span aria-hidden="true">🛍️</span> Comprar productos
    </button>
    <button type="button" class="opcion" :class="{ on: modo === 'servicios' }" :aria-pressed="modo === 'servicios'" data-testid="modo-servicios" @click="ir('/servicios')">
      <span aria-hidden="true">💈</span> Encontrar servicios
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

/** Distingue lo que se busca en Crustore: comprar productos o encontrar servicios (citas y cotizaciones) */
const props = defineProps<{ modo: 'productos' | 'servicios' }>();
const router = useRouter();
const ir = (ruta: string) => {
  // Ya estás en ese modo: no hace falta navegar
  if ((ruta === '/' && props.modo === 'productos') || (ruta === '/servicios' && props.modo === 'servicios')) return;
  router.push(ruta);
};
</script>

<style scoped>
.modo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 6px; border-radius: 16px; background: var(--surface-2); }
.opcion { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 6px; border: 0; border-radius: 12px; background: transparent; color: var(--text-muted); font: inherit; font-size: 0.88rem; font-weight: 700; cursor: pointer; }
.opcion.on { background: var(--surface); color: var(--brand-blue-text); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
</style>
