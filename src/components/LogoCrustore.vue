<template>
  <svg
    class="logo-crustore"
    :class="[`fondo-${fondo}`, { animado }]"
    :style="{ '--tam': typeof tamano === 'number' ? `${tamano}px` : tamano }"
    viewBox="0 0 120 120"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
    focusable="false"
  >
    <!--
      Logo de Crustore (carrito con chispa), dibujado aquí mismo para que sus destellos
      tomen los colores de la paleta activa (tokens --logo-* en ColorsVarCss.css).
      - fondo "claro":  carrito en tinta #1F2430, para superficies claras
      - fondo "oscuro": carrito en blanco, para cabeceras y logins oscuros
      - fondo "auto":   sigue el tema del sistema, como las superficies de la app
      Sin tokens (p. ej. en pruebas) usa los colores originales del kit.
    -->
    <!-- Carrito -->
    <path class="trazo arco" d="M78.5 41.4 A28 28 0 1 0 78.5 77.6" fill="none" stroke-width="12" stroke-linecap="round" pathLength="1" />
    <path class="trazo asa" d="M78.5 41.4 L92 32" stroke-width="12" stroke-linecap="round" pathLength="1" />
    <circle class="relleno rueda" cx="48" cy="104" r="7" />
    <circle class="relleno rueda r2" cx="72" cy="104" r="7" />
    <!-- Destellos: cambian con la paleta -->
    <path class="estrella" d="M60 49 Q60 60 71 60 Q60 60 60 71 Q60 60 49 60 Q60 60 60 49 Z" />
    <path class="destello" d="M98 6 Q98 14 106 14 Q98 14 98 22 Q98 14 90 14 Q98 14 98 6 Z" />
    <path class="chispa" d="M20 16 Q20 22 26 22 Q20 22 20 28 Q20 22 14 22 Q20 22 20 16 Z" />
    <circle class="punto" cx="104" cy="54" r="4.5" />
    <circle class="destello d2" cx="36" cy="10" r="3.5" />
  </svg>
</template>

<script setup lang="ts">
import { NOMBRE_APP } from '@/constants/marca';

withDefaults(
  defineProps<{
    /** Fondo sobre el que va el logo */
    fondo?: 'claro' | 'oscuro' | 'auto';
    /** Lado: número en px, o cualquier medida CSS ("1.4em" para que siga al texto) */
    tamano?: number | string;
    /** Texto alternativo; vacío si va junto al nombre escrito */
    alt?: string;
    /** Animación de "cargando": el carrito se dibuja, las ruedas brincan y los destellos titilan */
    animado?: boolean;
  }>(),
  { fondo: 'auto', tamano: 32, alt: NOMBRE_APP, animado: false },
);
</script>

<style scoped>
.logo-crustore {
  display: inline-block;
  width: var(--tam);
  height: var(--tam);
  flex-shrink: 0;
  vertical-align: middle;
  overflow: visible;
}
.trazo { stroke: var(--l-trazo); }
.relleno { fill: var(--l-trazo); }
.estrella { fill: var(--l-estrella); }
.destello { fill: var(--l-destello); }
.chispa { fill: var(--l-chispa); }
.punto { fill: var(--l-punto); }
.estrella, .destello, .chispa, .punto { transition: fill 0.3s ease; }

/* Sobre fondo claro (también "auto" en modo claro) */
.fondo-claro,
.fondo-auto {
  --l-trazo: #1f2430;
  --l-estrella: var(--logo-claro-estrella, #ff2e97);
  --l-destello: var(--logo-claro-destello, #00a9c2);
  --l-chispa: var(--logo-claro-chispa, #f5a300);
  --l-punto: var(--logo-claro-punto, #7c4dff);
}
/* Sobre fondo oscuro */
.fondo-oscuro {
  --l-trazo: #ffffff;
  --l-estrella: var(--logo-oscuro-estrella, #ff2e97);
  --l-destello: var(--logo-oscuro-destello, #00e5ff);
  --l-chispa: var(--logo-oscuro-chispa, #ffc233);
  --l-punto: var(--logo-oscuro-punto, #a78bfa);
}
@media (prefers-color-scheme: dark) {
  .fondo-auto {
    --l-trazo: #ffffff;
    --l-estrella: var(--logo-oscuro-estrella, #ff2e97);
    --l-destello: var(--logo-oscuro-destello, #00e5ff);
    --l-chispa: var(--logo-oscuro-chispa, #ffc233);
    --l-punto: var(--logo-oscuro-punto, #a78bfa);
  }
}
/* ---------- Animación de carga ---------- */
.animado .estrella,
.animado .destello,
.animado .chispa,
.animado .punto,
.animado .rueda {
  transform-box: fill-box;
  transform-origin: center;
}
/* El carrito se dibuja y se borra en un ciclo continuo */
.animado .arco {
  stroke-dasharray: 1;
  animation: dibujar 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
.animado .asa {
  stroke-dasharray: 1;
  animation: dibujar 1.8s cubic-bezier(0.65, 0, 0.35, 1) 0.15s infinite;
}
.animado .rueda {
  animation: rodar 0.9s ease-in-out infinite;
}
.animado .rueda.r2 {
  animation-delay: 0.15s;
}
/* La estrella del centro gira y late; los destellos titilan uno tras otro */
.animado .estrella {
  animation: latir 1.8s ease-in-out infinite;
}
.animado .destello {
  animation: titilar 1.8s ease-in-out infinite;
}
.animado .destello.d2 {
  animation-delay: 0.9s;
}
.animado .chispa {
  animation: titilar 1.8s ease-in-out 0.45s infinite;
}
.animado .punto {
  animation: titilar 1.8s ease-in-out 1.35s infinite;
}
@keyframes dibujar {
  0% { stroke-dashoffset: 1; }
  45%, 60% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -1; }
}
@keyframes rodar {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes latir {
  0% { transform: scale(0.85) rotate(0deg); }
  50% { transform: scale(1.25) rotate(90deg); }
  100% { transform: scale(0.85) rotate(180deg); }
}
@keyframes titilar {
  0%, 100% { opacity: 0.25; transform: scale(0.6); }
  50% { opacity: 1; transform: scale(1.2); }
}

@media (prefers-reduced-motion: reduce) {
  .estrella, .destello, .chispa, .punto { transition: none; }
  /* Sin movimiento: solo un pulso suave de los destellos */
  .animado .arco,
  .animado .asa,
  .animado .rueda,
  .animado .estrella {
    animation: none;
    stroke-dasharray: none;
  }
  .animado .destello,
  .animado .chispa,
  .animado .punto {
    animation: pulso 1.6s ease-in-out infinite;
  }
  @keyframes pulso {
    0%, 100% { opacity: 0.35; transform: none; }
    50% { opacity: 1; transform: none; }
  }
}
</style>
