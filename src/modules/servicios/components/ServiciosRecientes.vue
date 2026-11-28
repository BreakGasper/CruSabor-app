<template>
  <section v-if="lista.length" class="recientes" data-testid="servicios-recientes">
    <div class="cabecera">
      <h2 class="title">Servicios recientes</h2>
      <button type="button" class="ver-todos" data-testid="ver-todos-servicios" @click="router.push('/servicios')">Ver todos ›</button>
    </div>
    <div class="grid">
      <button v-for="r in lista" :key="r.servicio.id" type="button" class="tarjeta" :data-servicio="r.servicio.id" @click="router.push(`/servicio/${r.servicio.tiendaId}/${r.servicio.id}`)">
        <span class="foto"><img v-if="r.servicio.fotos[0]" :src="r.servicio.fotos[0]" :alt="r.servicio.nombre" loading="lazy" /><span v-else aria-hidden="true">✨</span></span>
        <strong class="nombre">{{ r.servicio.nombre }}</strong>
        <span class="tienda">{{ r.tienda.nombreTienda }}</span>
        <span class="precio">{{ etiquetaPrecio(r.servicio) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTiendas } from '@/composables/useTiendas';
import { etiquetaPrecio, leerTodosLosServicios } from '../catalogo';
import { serviciosRecientes, tiendasDeServicios } from '../descubrir';
import type { Servicio } from '../tipos';

/** Portada: los servicios más nuevos, junto a los productos */
const router = useRouter();
const { tiendas, cargarTiendas } = useTiendas();
const todos = ref<Servicio[]>([]);

onMounted(async () => {
  cargarTiendas();
  try {
    todos.value = await leerTodosLosServicios();
  } catch {
    todos.value = [];
  }
});

const lista = computed(() => serviciosRecientes(tiendasDeServicios(tiendas.value), todos.value, 8));
</script>

<style scoped>
.recientes { padding: 0 16px; margin: 8px 0 16px; text-align: left; }
.cabecera { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.title { margin: 0 0 10px; color: var(--text); font-size: 1.15rem; }
.ver-todos { border: 0; background: transparent; color: var(--brand-blue-text); font: inherit; font-weight: 700; cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 700px) { .grid { grid-template-columns: repeat(4, 1fr); } }
.tarjeta { display: flex; flex-direction: column; gap: 3px; padding: 0 0 10px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; overflow: hidden; }
.foto { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; background: var(--surface-2); font-size: 2rem; }
.foto img { width: 100%; height: 100%; object-fit: cover; }
.nombre, .tienda, .precio { padding: 0 10px; }
.nombre { margin-top: 6px; font-size: 0.95rem; line-height: 1.2; }
.tienda { color: var(--text-muted); font-size: 0.8rem; }
.precio { color: var(--brand-blue-text); font-weight: 800; font-size: 0.9rem; }
</style>
