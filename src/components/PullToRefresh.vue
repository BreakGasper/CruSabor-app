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
 *  - lienzos (el editor de diseños, mapas);
 *  - el CONTENIDO de una pantalla marcada con `data-sin-recarga` (formulario a medias): ahí solo se puede empezar
 *    desde la cabecera, y al soltar la app pide confirmar antes de recargar para no perder lo capturado.
 */
/** Campos de texto: excluidos en el contenido, pero NO en la cabecera (p. ej. el buscador de la portada ocupa casi toda la barra) mientras no estén enfocados */
const SELECTOR_CAMPOS = 'input, textarea, select, [contenteditable="true"]';

export const SELECTOR_EXCLUIDO = [
  'canvas',
  '[role="dialog"]',
  '.swal2-container',
  '.p-dialog-mask',
  '.p-dialog',
  '.rec-overlay',
  '.vp-overlay',
].join(',');

/**
 * Cabeceras de página desde las que se puede deslizar para actualizar: las barras de arriba de cada pantalla de
 * cliente, tienda y administrador. NO el contenido: al deslizar a la mitad de la pantalla solo se desplaza la página.
 *
 * Son las cabeceras de página, no las de tarjetas, paneles ni modales (`.panel-head`, `.grupo-header`,
 * `.se-header`, `.cmp-head` quedan fuera a propósito).
 */
export const SELECTOR_CABECERA = [
  '.page-header', // PageHeader.vue: barra azul de listas y detalles
  '.top-bar-fija', // TopBarFija.vue: píldora de login, registro, checkout, perfil…
  '.top-bar-top', // barra superior de la portada (menú · buscador · carrito · perfil)
  '.admin-topbar', // AdminTopbar.vue: panel de administración
  '.store-banner', // portada del perfil de tienda, que hace de cabecera
  '.detalle-header', // imagen superior del detalle de producto, con su botón de volver
  '.login-header', // encabezado de inicio de sesión (cliente, tienda)
  '.register-header', // encabezado de registro y del formulario de artículo
  '.profile-header', // encabezado del perfil del cliente
  '.checkout-header',
  '.cart-header',
  '[data-pull-refresh]', // escotilla: cualquier pantalla puede habilitar su propia zona
].join(',');

/**
 * Franja de arriba de la pantalla (px desde el borde superior): en una pantalla cuya cabecera no está en la lista
 * de arriba (o que aún no cargó), tocar aquí también cuenta como cabecera, siempre que el contenido esté arriba.
 */
export const ALTO_FRANJA_CABECERA = 120;

/**
 * ¿Puede empezar el gesto aquí?
 *  - solo desde una cabecera (SELECTOR_CABECERA) o, si no la hay, desde la franja de arriba de la pantalla;
 *  - nunca en campos de texto, diálogos, lienzos ni zonas `data-sin-recarga`;
 *  - con la página arriba del todo (y, en la franja, también el contenido: aquí el que se desplaza es el <body>);
 *  - sin un contenedor con scroll ya desplazado bajo el dedo.
 */
export function puedeIniciarGesto(objetivo: EventTarget | null, clientY = 0, scrollY = window.scrollY): boolean {
  if (scrollY > 0 || document.documentElement.scrollTop > 0) return false;
  const el = objetivo instanceof Element ? objetivo : null;
  if (el?.closest(SELECTOR_EXCLUIDO)) return false;
  const enCabecera = !!el?.closest(SELECTOR_CABECERA);
  if (!enCabecera && el?.closest(SELECTOR_CAMPOS)) return false;
  if (!enCabecera && el?.closest('[data-sin-recarga]')) return false;
  // Fuera de una cabecera conocida solo cuenta la franja de arriba, y con el contenido arriba del todo
  if (!enCabecera && (clientY > ALTO_FRANJA_CABECERA || document.body.scrollTop > 0)) return false;
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
 * Deslizar hacia abajo para actualizar (móvil), **desde la cabecera de cualquier pantalla de la app**.
 *
 * Funciona como un F5: al soltar después del umbral se emite `refresh` y App.vue recarga la página.
 * El gesto solo empieza en la cabecera (o en la franja de arriba de la pantalla) y con la página arriba del todo:
 * en el resto de la pantalla, deslizar solo desplaza el contenido, nunca recarga por accidente. Tampoco empieza
 * en un campo de texto, un diálogo, un lienzo ni una zona con `data-sin-recarga` (ver arriba), y un arrastre
 * horizontal lo cancela.
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
  if (!puedeIniciarGesto(e.target, e.touches[0].clientY)) {
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
