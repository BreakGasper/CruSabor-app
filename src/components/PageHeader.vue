<template>
  <header class="page-header" :class="{ sticky }">
    <ArrowBack class="page-header__back" @click="volver" />
    <h2 class="page-header__title" :title="title">{{ title }}</h2>
    <div class="page-header__actions">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ArrowBack from './ArrowBack.vue';

/**
 * Cabecera uniforme para listas y detalles: barra azul, flecha a la izquierda,
 * título centrado en blanco y un espacio a la derecha para acciones (slot).
 *
 * - `fallback`: ruta a la que ir si no hay pantalla anterior dentro de la app
 *   (entrada directa por URL). Vue Router guarda la ruta previa en history.state.back.
 * - Emite `back` si prefieres manejar el regreso tú mismo (se usa en vez del router).
 */
const props = withDefaults(
  defineProps<{
    title: string;
    sticky?: boolean;
    fallback?: string;
  }>(),
  { sticky: false, fallback: '/' },
);

const emit = defineEmits<{ (e: 'back'): void }>();
const router = useRouter();

function volver() {
  emit('back');
  if (window.history.state?.back) router.back();
  else router.push(props.fallback);
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 52px;
  padding: 0.45rem 0.6rem;
  margin: 0.5rem 0 1rem;
  background: var(--color-bg-blue-dark);
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}
.page-header.sticky {
  position: sticky;
  top: 0.5rem;
  z-index: 100;
}
.page-header__back {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
}
.page-header__title {
  flex: 1;
  margin: 0;
  text-align: center;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/* Mismo ancho mínimo que la flecha para que el título quede centrado sin acciones */
.page-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 36px;
  flex-shrink: 0;
}
@media (max-width: 480px) {
  .page-header {
    margin: 0.4rem 0 0.8rem;
  }
  .page-header__title {
    font-size: 1rem;
  }
}
</style>
