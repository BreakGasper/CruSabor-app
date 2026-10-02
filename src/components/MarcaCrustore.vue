<template>
  <span class="marca" role="img" :aria-label="NOMBRE_APP + (sufijo ? ` ${sufijo}` : '')">
    <!--
      Logotipo escrito: el icono hace de "C" y le sigue "rustore", pegado.
      Para lectores de pantalla se anuncia completo como "Crustore".
      Hereda el tamaño de letra de donde se ponga (el icono mide 1.4em).
    -->
    <LogoCrustore :fondo="fondo" tamano="1.4em" alt="" />
    <span class="resto" aria-hidden="true">
      <template v-if="acento">ru<span class="acento">store</span></template>
      <template v-else>{{ NOMBRE_SIN_C }}</template>
      <span v-if="sufijo" class="sufijo">{{ sufijo }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import LogoCrustore from './LogoCrustore.vue';
import { NOMBRE_APP, NOMBRE_SIN_C } from '@/constants/marca';

withDefaults(
  defineProps<{
    /** Fondo sobre el que va (decide el color del carrito y de los destellos) */
    fondo?: 'claro' | 'oscuro' | 'auto';
    /** "store" en el color de marca de la paleta */
    acento?: boolean;
    /** Texto después del nombre, p. ej. "· Admin" */
    sufijo?: string;
  }>(),
  { fondo: 'auto', acento: false, sufijo: '' },
);
</script>

<style scoped>
.marca {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  line-height: 1;
}
/* Pegado al icono: la "r" queda justo después del punto del carrito */
.resto {
  margin-left: -0.04em;
}
.acento {
  color: var(--brand-blue-text);
}
.sufijo {
  margin-left: 0.3em;
}
</style>
