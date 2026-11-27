<template>
  <div class="ptr-root">
    <!-- Indicador que baja con el dedo -->
    <div
      class="ptr-indicador"
      :class="{ visible: desplazamiento > 0 || refrescando, listo: listo && !refrescando, girando: refrescando }"
      :style="{ transform: `translateY(${Math.min(desplazamiento, UMBRAL + 24) - 48}px)` }"
      aria-hidden="true"
    >
      <span class="ptr-icono">{{ refrescando ? '⟳' : '↓' }}</span>
      <span class="ptr-texto">{{ refrescando ? 'Actualizando…' : listo ? 'Suelta para actualizar' : 'Desliza para actualizar' }}</span>
    </div>
    <slot />
  </div>
</template>

<script lang="ts">
/** Píxeles que debe avanzar el indicador para disparar la actualización */
export const UMBRAL = 70;

/**
 * Zonas donde el gesto NO debe empezar:
 *  - campos de texto y editables (el dedo ahí es para escribir o mover el cursor);
 *  - diálogos y ventanas encima de la pantalla (tienen su propio desplazamiento);
 *  - lienzos (el editor de diseños, mapas) y cualquier zona marcada con `data-sin-recarga`;
 *    las pantallas con un formulario a medias se marcan así para no perder lo capturado.
 */
export const SELECTOR_EXCLUIDO = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  'canvas',
  '[data-sin-recarga]',
  '[role="dialog"]',
  '.swal2-container',
  '.p-dialog-mask',
  '.p-dialog',
  '.rec-overlay',
  '.vp-overlay',
].join(',');

/** ¿Puede empezar el gesto aquí? Pantalla arriba del todo y nada con scroll propio ya desplazado bajo el dedo */
export function puedeIniciarGesto(objetivo: EventTarget | null, scrollY = window.scrollY): boolean {
  if (scrollY > 0 || document.documentElement.scrollTop > 0) return false;
  const el = objetivo instanceof Element ? objetivo : null;
  if (el?.closest(SELECTOR_EXCLUIDO)) return false;
  // Si hay un campo enfocado (teclado abierto), el gesto no se arma
  const activo = document.activeElement;
  if (activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName)) return false;
  let cursor: Element | null = el;
  while (cursor && cursor !== document.body) {
    if (cursor.scrollTop > 0) return false;
    cursor = cursor.parentElement;
  }
  return true;
}
</script>

<script setup lang="ts">
/**
 * Deslizar hacia abajo para actualizar (móvil), **desde cualquier parte de la pantalla**.
 *
 * Funciona como un F5: al soltar después del umbral se emite `refresh` y App.vue recarga la página.
 * El gesto solo se arma si la pantalla está arriba del todo, el arrastre es sobre todo vertical y no
 * empieza en un campo de texto, un diálogo, un lienzo o una zona con `data-sin-recarga` (ver arriba).
 * Un arrastre horizontal (carruseles, deslizar entre pestañas) lo cancela.
 *
 * Necesario porque la app desactiva el "pull to refresh" nativo del navegador
 * (overscroll-behavior: contain) y en modo PWA no hay botón de recargar.
 */
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{ (e: 'refresh'): void }>();
const props = defineProps<{ refrescando?: boolean }>();

const desplazamiento = ref(0);
const listo = ref(false);
let inicioY: number | null = null;
let inicioX = 0;
let activo = false;

function onStart(e: TouchEvent) {
  if (props.refrescando || e.touches.length !== 1) return;
  if (!puedeIniciarGesto(e.target)) {
    inicioY = null;
    return;
  }
  inicioY = e.touches[0].clientY;
  inicioX = e.touches[0].clientX ?? 0;
  activo = false;
}

function onMove(e: TouchEvent) {
  if (inicioY === null || props.refrescando) return;
  const t = e.touches[0];
  const delta = t.clientY - inicioY;
  if (delta <= 0) {
    desplazamiento.value = 0;
    listo.value = false;
    return;
  }
  if (!activo) {
    if (delta < 10) return; // tolerancia
    // Un arrastre más horizontal que vertical no es este gesto (carruseles, pestañas)
    if (Math.abs((t.clientX ?? 0) - inicioX) > delta * 0.8) {
      inicioY = null;
      return;
    }
  }
  activo = true;
  // Resistencia: el indicador avanza más lento que el dedo
  desplazamiento.value = Math.min(delta * 0.5, UMBRAL + 40);
  listo.value = desplazamiento.value >= UMBRAL;
  if (e.cancelable) e.preventDefault();
}

function onEnd() {
  if (inicioY === null) return;
  const disparar = listo.value && !props.refrescando;
  inicioY = null;
  activo = false;
  desplazamiento.value = 0;
  listo.value = false;
  if (disparar) emit('refresh');
}

onMounted(() => {
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
});
onUnmounted(() => {
  document.removeEventListener('touchstart', onStart);
  document.removeEventListener('touchmove', onMove);
  document.removeEventListener('touchend', onEnd);
  document.removeEventListener('touchcancel', onEnd);
});
</script>

<style scoped>
.ptr-root {
  position: relative;
  min-height: 100%;
}
.ptr-indicador {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: 3000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
  box-shadow: 0 4px 14px var(--color-shadow);
  font-size: 0.8rem;
  opacity: 0;
  pointer-events: none;
  margin-left: -90px; /* centrado sin transform (el transform lo usa el desplazamiento) */
  transition: opacity 0.15s;
}
.ptr-indicador.visible {
  opacity: 1;
}
.ptr-indicador.listo {
  color: var(--brand-blue-text);
}
.ptr-icono {
  font-size: 1.1rem;
  line-height: 1;
  display: inline-block;
  transition: transform 0.2s;
}
.ptr-indicador.listo .ptr-icono {
  transform: rotate(180deg);
}
.ptr-indicador.girando .ptr-icono {
  animation: ptr-giro 0.8s linear infinite;
}
@keyframes ptr-giro {
  to {
    transform: rotate(360deg);
  }
}
/* En escritorio con mouse no hay gesto: se oculta por si acaso */
@media (hover: hover) and (pointer: fine) {
  .ptr-indicador {
    display: none;
  }
}
</style>
