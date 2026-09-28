<template>
  <!-- Decoraciones de temporada: no bloquean toques (pointer-events: none) y se quedan quietas si el sistema pide menos movimiento -->
  <div v-if="visibles.length" class="tematica" :class="{ contenida }" aria-hidden="true" data-testid="tematica">
    <div
      v-for="(p, i) in visibles"
      :key="i"
      class="pieza"
      :class="[`anim-${p.animacion}`, `pos-${p.posicion}`]"
      :style="{ '--tam': `${PX_TAMANO[p.tamano]}px`, '--retraso': `${i * 0.35}s` }"
      data-testid="pieza"
    >
      <span v-if="p.animacion === 'colgando'" class="hilo"></span>
      <img :src="p.url" alt="" draggable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PX_TAMANO, urlImagen, type Pieza } from '@/composables/useTematicas';

const props = defineProps<{
  piezas: Pieza[];
  /** true = dentro de una caja (vista previa del admin) en lugar de sobre toda la pantalla */
  contenida?: boolean;
}>();

/** Solo las piezas cuya imagen existe (un icono borrado o aún sin descargar no se pinta) */
const visibles = computed(() =>
  props.piezas.map((p) => ({ ...p, url: urlImagen(p.imagen) })).filter((p): p is Pieza & { url: string } => !!p.url),
);
</script>

<style scoped>
.tematica {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  overflow: hidden;
  container-type: size;
}
.tematica.contenida {
  position: absolute;
  z-index: 1;
}
.pieza {
  position: absolute;
  width: var(--tam);
}
.pieza img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
}

/* Posición horizontal */
.pieza.pos-izquierda { left: 6%; }
.pieza.pos-centro { left: calc(50% - var(--tam) / 2); }
.pieza.pos-derecha { right: 6%; }

/* Colgando de un hilo: baja desde arriba y se balancea */
.pieza.anim-colgando {
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
  animation: bajar 1.6s ease-out var(--retraso) both, balanceo 3.2s ease-in-out calc(1.6s + var(--retraso)) infinite alternate;
}
.hilo {
  width: 2px;
  height: calc(var(--tam) * 0.9);
  background: color-mix(in srgb, var(--text) 45%, transparent);
}
@keyframes bajar {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
@keyframes balanceo {
  from { transform: rotate(-6deg) translateY(0); }
  to { transform: rotate(6deg) translateY(10px); }
}

/* Asomándose desde abajo */
.pieza.anim-asomandose {
  bottom: 0;
  animation: asomarse 1.2s ease-out var(--retraso) both, respirar 2.6s ease-in-out calc(1.2s + var(--retraso)) infinite alternate;
}
@keyframes asomarse {
  from { transform: translateY(100%); }
  to { transform: translateY(12%); }
}
@keyframes respirar {
  from { transform: translateY(12%); }
  to { transform: translateY(4%); }
}

/* Flotando arriba */
.pieza.anim-flotando {
  top: 12%;
  animation: flotar 4s ease-in-out var(--retraso) infinite alternate;
}
@keyframes flotar {
  0% { transform: translate(0, 0) rotate(-3deg); }
  50% { transform: translate(12px, -14px) rotate(2deg); }
  100% { transform: translate(-10px, 8px) rotate(4deg); }
}

/* Caminando por abajo de lado a lado (ignora la posición) */
.pieza.anim-caminando {
  bottom: 8px;
  left: 0;
  right: auto;
  animation: caminar 14s linear calc(var(--retraso) * 6) infinite backwards;
}
@keyframes caminar {
  0% { transform: translateX(calc(-1 * var(--tam))) scaleX(1); }
  49% { transform: translateX(calc(100cqw + 0px)) scaleX(1); }
  50% { transform: translateX(calc(100cqw + 0px)) scaleX(-1); }
  100% { transform: translateX(calc(-1 * var(--tam))) scaleX(-1); }
}

@media (prefers-reduced-motion: reduce) {
  .pieza {
    animation: none !important;
  }
}
</style>
