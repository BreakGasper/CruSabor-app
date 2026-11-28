<template>
  <!-- Botón flotante en las tiendas que patrocinan un sorteo abierto o por empezar -->
  <button v-if="sorteo" type="button" class="boton-sorteo" data-testid="boton-sorteo" aria-label="Participar en el sorteo" @click="abrir">
    <span class="icono" aria-hidden="true">🎁</span>
    <span class="texto">Sorteo</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSorteos, sorteosVisibles, estadoSorteo, patrocinaTienda } from '@/composables/useSorteos';
import { abrirDialogoSorteo } from '@/composables/dialogoSorteo';

const props = defineProps<{ tiendaId?: string }>();
const router = useRouter();
const { sorteos } = useSorteos();

/** El sorteo que esta tienda patrocina (con código activo) y que aún recibe participantes o está por empezar */
const sorteo = computed(
  () =>
    (props.tiendaId &&
      sorteosVisibles(sorteos.value).find((s) => ['abierto', 'proximo'].includes(estadoSorteo(s)) && patrocinaTienda(s, props.tiendaId!))) ||
    null,
);

/** Al tocar el botón se abre el diálogo para escribir el código */
function abrir() {
  if (sorteo.value) void abrirDialogoSorteo(sorteo.value, { irALogin: () => router.push({ path: '/login', query: { redirect: router.currentRoute?.value?.fullPath ?? '/' } }) });
}
</script>

<style scoped>
.boton-sorteo {
  position: fixed;
  right: 14px;
  bottom: calc(18px + env(safe-area-inset-bottom));
  z-index: 998;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #db2777);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.45);
  animation: latido 2.4s ease-in-out infinite;
}
.icono { font-size: 1.25rem; }
@keyframes latido {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.07); }
}
@media (prefers-reduced-motion: reduce) {
  .boton-sorteo { animation: none; }
}
</style>
