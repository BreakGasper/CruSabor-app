<template>
  <span class="insignia" :class="'insignia-' + tono" data-testid="insignia-estado">{{ texto }}</span>
</template>

<script setup lang="ts">
import type { TonoEstado } from '../estados';

/** Etiqueta del estado de una cita o cotización, con los pares fondo+texto del tema (se lee en claro y en oscuro) */
defineProps<{ tono: TonoEstado; texto: string }>();
</script>

<style scoped>
.insignia {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.insignia-aviso { background: var(--aviso-fondo); color: var(--aviso-texto); }
.insignia-ok { background: var(--ok-fondo); color: var(--ok-texto); }
.insignia-peligro { background: var(--peligro-fondo); color: var(--peligro-texto); }
.insignia-info { background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.insignia-neutro { background: var(--surface-2); color: var(--text-muted); }
</style>
