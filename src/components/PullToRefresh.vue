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
 * Zonas desde las que se puede empezar el gesto: solo las cabeceras.
 *
 * Antes se escuchaba en toda la página y, en cuanto el arrastre pasaba de 10 px,
 * `onMove` hacía `preventDefault()`. Eso entorpecía el desplazamiento normal en
 * todas las pantallas. Limitándolo a la cabecera, el resto del contenido nunca
 * ve un `preventDefault` y se desplaza con total libertad.
 *
 * Son las cabeceras de página, no las de tarjetas, paneles ni modales
 * (`.panel-head`, `.grupo-header`, `.se-header`, `.cmp-head` quedan fuera a propósito).
 */
export const SELECTOR_CABECERA = [
  '.page-header', // PageHeader.vue: barra azul de listas y detalles
  '.top-bar-fija', // TopBarFija.vue: píldora de login, registro, checkout, perfil…
  '.top-bar-top', // barra superior de la portada (menú · buscador · carrito · perfil)
  '.admin-topbar', // AdminTopbar.vue: panel de administración
  '.store-banner', // portada del perfil de tienda, que hace de cabecera
  '.detalle-header', // imagen superior del detalle de producto, con su botón de volver
  '[data-pull-refresh]', // escotilla: cualquier pantalla puede habilitar su propia zona
].join(',');
</script>

<script setup lang="ts">
/**
 * Deslizar hacia abajo para actualizar (móvil).
 *
 * El gesto solo empieza **desde la cabecera** (ver SELECTOR_CABECERA). Si además la
 * pantalla está en la parte superior (ni la ventana ni el contenedor con scroll bajo
 * el dedo se han desplazado) y el usuario arrastra hacia abajo más de UMBRAL px, emite
 * `refresh`. App.vue responde volviendo a montar la vista actual, así cada pantalla
 * recarga sus datos con su propio onMounted, sin recargar la página ni perder la sesión.
 *
 * Empezar fuera de la cabecera no arma nada: el gesto se ignora por completo y el
 * desplazamiento del contenido queda intacto.
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
let activo = false;

/** ¿El dedo empezó sobre una cabecera de página? */
function enCabecera(objetivo: EventTarget | null): boolean {
  return objetivo instanceof Element && objetivo.closest(SELECTOR_CABECERA) !== null;
}

/** ¿Todo lo que hay bajo el dedo está en la parte superior de su scroll? */
function arriba(objetivo: EventTarget | null): boolean {
  if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return false;
  let el = objetivo instanceof Element ? objetivo : null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0) return false;
    el = el.parentElement;
  }
  return true;
}

function onStart(e: TouchEvent) {
  if (props.refrescando || e.touches.length !== 1) return;
  // Fuera de la cabecera el gesto ni se arma, y así onMove nunca llega a
  // preventDefault: el contenido se desplaza sin estorbos.
  if (!enCabecera(e.target) || !arriba(e.target)) {
    inicioY = null;
    return;
  }
  inicioY = e.touches[0].clientY;
  activo = false;
}

function onMove(e: TouchEvent) {
  if (inicioY === null || props.refrescando) return;
  const delta = e.touches[0].clientY - inicioY;
  if (delta <= 0) {
    desplazamiento.value = 0;
    listo.value = false;
    return;
  }
  // Un input enfocado o un arrastre horizontal no deben disparar el gesto
  if (!activo && delta < 10) return;
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
