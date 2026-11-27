<template>
  <div class="aviso-actualizacion" role="status" data-testid="aviso-actualizacion">
    <span>Hay una versión nueva de Crustore.</span>
    <button type="button" data-testid="actualizar-ahora" @click="$emit('actualizar')">Actualizar</button>
    <button type="button" class="despues" aria-label="Más tarde" @click="$emit('cerrar')">✕</button>
  </div>
</template>

<script setup lang="ts">
/** Aviso discreto cuando hay una versión nueva y la app no puede recargarse sola (hay un formulario a medias) */
defineEmits<{ (e: 'actualizar'): void; (e: 'cerrar'): void }>();
</script>

<style scoped>
.aviso-actualizacion {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(14px + env(safe-area-inset-bottom));
  z-index: 3500;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--color-bg-blue-dark);
  color: #fff;
  font-size: 0.9rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.aviso-actualizacion span { flex: 1; text-align: left; }
.aviso-actualizacion button {
  border: 0;
  border-radius: 10px;
  padding: 8px 14px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  background: var(--color-bg-blue-ligth);
  color: var(--on-primary);
}
.aviso-actualizacion .despues { background: transparent; color: #fff; padding: 8px; opacity: 0.8; }
</style>
