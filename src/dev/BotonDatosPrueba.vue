<template>
  <!--
    SOLO DESARROLLO. Se monta con defineAsyncComponent dentro de un
    `import.meta.env.DEV`, así que no existe en el build de producción.
  -->
  <button type="button" class="dev-llenar" :disabled="llenando" title="Solo aparece en npm run dev" @click="llenar">
    <span aria-hidden="true">🧪</span>
    {{ llenando ? 'Llenando…' : 'Llenar con datos de prueba' }}
    <small>solo local</small>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ alLlenar: () => void | Promise<void> }>();
const llenando = ref(false);

async function llenar() {
  llenando.value = true;
  try {
    await props.alLlenar();
  } catch (e) {
    console.error('[datos de prueba]', e);
  } finally {
    llenando.value = false;
  }
}
</script>

<style scoped>
.dev-llenar {
  position: fixed;
  left: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 4000;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 2px dashed #b45309;
  background: #fff7e6;
  color: #7a4a00;
  font: 600 0.8rem/1.2 system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.dev-llenar small {
  font-weight: 500;
  opacity: 0.75;
}
.dev-llenar:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
