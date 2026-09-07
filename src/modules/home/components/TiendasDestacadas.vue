<template>
  <section v-if="tiendasVisibles.length" class="tiendas-destacadas">
    <div class="encabezado">
      <h2 class="titulo">Tiendas</h2>
      <button type="button" class="ver-todas" @click="router.push('/tiendas')">Ver más tiendas ›</button>
    </div>

    <!-- Carrusel horizontal: hasta MAXIMO tiendas; el resto en /tiendas -->
    <div class="pista">
      <TiendaCard v-for="t in tiendasVisibles" :key="t.tiendaId" :tienda="t" @abrir="verTienda" />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Tiendas en la portada: carrusel horizontal con la tarjeta compartida (banner, nombre,
 * favorito y estrellas de lectura). Solo tiendas que pueden vender, mejor calificadas primero.
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TiendaCard from './TiendaCard.vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { useEstadoTiendas } from '@/composables/useMembresia';
import { useCalificaciones } from '@/composables/useCalificaciones';

/** Máximo de tiendas en la portada; el resto se ve en /tiendas */
const MAXIMO_TIENDAS_PORTADA = 10;

const props = withDefaults(defineProps<{ maximo?: number }>(), { maximo: MAXIMO_TIENDAS_PORTADA });

const router = useRouter();
const { tiendas, cargarTiendas } = useTiendas();
const { noPuedeVender } = useEstadoTiendas();
const { resumenDe } = useCalificaciones('tiendas');

onMounted(cargarTiendas);

const tiendasVisibles = computed(() =>
  tiendas.value
    .filter((t) => t.tiendaId && t.nombreTienda && !noPuedeVender(t.tiendaId))
    .sort((a, b) => {
      const ra = resumenDe(a.tiendaId);
      const rb = resumenDe(b.tiendaId);
      return rb.promedio - ra.promedio || rb.total - ra.total || a.nombreTienda.localeCompare(b.nombreTienda, 'es');
    })
    .slice(0, props.maximo),
);

function verTienda(t: Tienda) {
  router.push(`/store/profile/${t.tiendaId}`);
}
</script>

<style scoped>
.tiendas-destacadas {
  padding: 0.5rem 0 0.25rem;
}
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.titulo {
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  text-align: left;
}
.ver-todas {
  border: 0;
  background: none;
  padding: 0;
  font-size: 0.85rem;
  color: var(--brand-blue-text);
  cursor: pointer;
}
.pista {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.pista::-webkit-scrollbar {
  display: none;
}
.pista > * {
  flex: 0 0 min(260px, 78vw);
  scroll-snap-align: start;
}
</style>
