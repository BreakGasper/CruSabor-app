<template>
  <div class="top-bar-fija" role="navigation" aria-label="Regresar">
    <ArrowBack class="top-bar-fija__back" @click="$emit('back')" />
    <span v-if="titulo" class="top-bar-fija__titulo">{{ titulo }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Píldora fija en la esquina superior izquierda con la flecha de regresar y el título
 * de la pantalla. Se usa en las pantallas con cabecera grande tipo portada (login,
 * registro, checkout, formulario de producto), donde esa cabecera se desplaza con el
 * contenido: así el título y el botón de regresar nunca se pierden al bajar.
 * Las listas y detalles usan PageHeader, que es sticky por sí misma.
 */
import ArrowBack from './ArrowBack.vue';

defineProps<{ titulo?: string }>();
defineEmits<{ (e: 'back'): void }>();
</script>

<style scoped>
.top-bar-fija {
  position: fixed;
  top: max(0.6rem, env(safe-area-inset-top));
  left: 0.75rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 4px 14px var(--color-shadow);
  max-width: calc(100vw - 1.5rem);
}
.top-bar-fija__back {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.top-bar-fija__titulo {
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
