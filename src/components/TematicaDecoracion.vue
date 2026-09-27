<template>
  <!-- Decoración de temporada: no bloquea toques (pointer-events: none) y se queda quieta si el sistema pide menos movimiento -->
  <div
    v-if="url"
    class="tematica"
    :class="[`anim-${tematica.animacion}`, `pos-${tematica.posicion}`, { contenida }]"
    :style="{ '--tam': `${PX_TAMANO[tematica.tamano]}px` }"
    aria-hidden="true"
    data-testid="tematica"
  >
    <div class="pieza">
      <span v-if="tematica.animacion === 'colgando'" class="hilo"></span>
      <img :src="url" alt="" draggable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PX_TAMANO, type Tematica } from '@/composables/useTematicas';

defineProps<{
  tematica: Tematica;
  url: string | undefined;
  /** true = dentro de una caja (vista previa del admin) en lugar de sobre toda la pantalla */
  contenida?: boolean;
}>();
</script>

<style scoped>
.tematica {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  overflow: hidden;
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
.pos-izquierda .pieza { left: 6%; }
.pos-centro .pieza { left: calc(50% - var(--tam) / 2); }
.pos-derecha .pieza { right: 6%; }

/* Colgando de un hilo: baja desde arriba y se balancea */
.anim-colgando .pieza {
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
  animation: bajar 1.6s ease-out both, balanceo 3.2s ease-in-out 1.6s infinite alternate;
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
.anim-asomandose .pieza {
  bottom: 0;
  animation: asomarse 1.2s ease-out both, respirar 2.6s ease-in-out 1.2s infinite alternate;
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
.anim-flotando .pieza {
  top: 12%;
  animation: flotar 4s ease-in-out infinite alternate;
}
@keyframes flotar {
  0% { transform: translate(0, 0) rotate(-3deg); }
  50% { transform: translate(12px, -14px) rotate(2deg); }
  100% { transform: translate(-10px, 8px) rotate(4deg); }
}

/* Caminando por abajo de lado a lado (ignora la posición) */
.anim-caminando .pieza {
  bottom: 8px;
  left: 0;
  right: auto;
  animation: caminar 14s linear infinite;
}
@keyframes caminar {
  0% { transform: translateX(calc(-1 * var(--tam))) scaleX(1); }
  49% { transform: translateX(calc(100cqw + 0px)) scaleX(1); }
  50% { transform: translateX(calc(100cqw + 0px)) scaleX(-1); }
  100% { transform: translateX(calc(-1 * var(--tam))) scaleX(-1); }
}
.tematica.anim-caminando {
  container-type: inline-size;
}

@media (prefers-reduced-motion: reduce) {
  .pieza {
    animation: none !important;
  }
}
</style>
