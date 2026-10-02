<template>
  <!--
    Indicador de carga con el logo animado. Lo controla services/carga.ts: aparece solo
    si algo que pidió el usuario tarda más de medio segundo, y bloquea los toques mientras
    tanto (así nadie manda un pedido dos veces). Si tarda mucho, avisa y deja ocultarlo.
  -->
  <Teleport to="body">
    <Transition name="cargando">
      <div v-if="visible" class="cargando" role="status" aria-live="polite" data-testid="cargando">
        <div class="tarjeta">
          <div class="halo" aria-hidden="true">
            <LogoCrustore fondo="auto" :tamano="84" alt="" animado />
          </div>
          <p class="texto">{{ lento ? 'Esto está tardando un poco más…' : 'Cargando…' }}</p>
          <p v-if="lento" class="detalle">Revisa tu conexión. Seguimos intentándolo.</p>
          <button v-if="lento" type="button" class="ocultar" data-testid="cargando-ocultar" @click="ocultarIndicador">
            Ocultar
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import LogoCrustore from './LogoCrustore.vue';
import { estadoCarga, ocultarIndicador } from '@/services/carga';

const { visible, lento } = estadoCarga;
</script>

<style scoped>
.cargando {
  position: fixed;
  inset: 0;
  z-index: 1050; /* debajo de SweetAlert (1060) para no tapar sus diálogos */
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--bg-page) 55%, transparent);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  cursor: progress;
}
.tarjeta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 180px;
  max-width: 280px;
  padding: 1.4rem 1.6rem 1.2rem;
  border-radius: 24px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: 0 18px 48px var(--color-shadow);
  text-align: center;
}
/* Resplandor suave con el color de la marca detrás del logo */
.halo {
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--brand-blue-text) 18%, transparent) 0%, transparent 70%);
}
.texto {
  margin: 0.2rem 0 0;
  font-weight: 700;
  font-size: 1rem;
}
.detalle {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.ocultar {
  margin-top: 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 16px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.cargando-enter-active,
.cargando-leave-active {
  transition: opacity 0.2s ease;
}
.cargando-enter-active .tarjeta,
.cargando-leave-active .tarjeta {
  transition: transform 0.2s ease;
}
.cargando-enter-from,
.cargando-leave-to {
  opacity: 0;
}
.cargando-enter-from .tarjeta,
.cargando-leave-to .tarjeta {
  transform: scale(0.94);
}
@media (prefers-reduced-motion: reduce) {
  .cargando-enter-active .tarjeta,
  .cargando-leave-active .tarjeta {
    transition: none;
  }
}
</style>
