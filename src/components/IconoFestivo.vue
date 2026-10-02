<template>
  <!--
    Icono de la festividad en curso (Navidad, Día de Muertos…). Es solo adorno:
    no recibe toques (pointer-events: none), los lectores de pantalla lo ignoran y,
    si no hay festividad, no ocupa espacio. Con `esquina` flota en la esquina del
    contenedor (que debe tener position: relative).
  -->
  <img
    v-if="festividad?.url"
    :src="festividad.url"
    alt=""
    aria-hidden="true"
    draggable="false"
    class="icono-festivo"
    :class="esquina ? `esquina esquina-${esquina}` : null"
    :style="{ '--tam': `${tamano}px` }"
    :title="festividad.nombre"
    data-testid="icono-festivo"
  />
</template>

<script setup lang="ts">
import { useFestividad } from '@/composables/useFestividad';

withDefaults(
  defineProps<{
    /** Lado en el que flota sobre su contenedor; sin valor va en línea (junto a un título) */
    esquina?: 'sup-izq' | 'sup-der' | 'inf-izq' | 'inf-der';
    tamano?: number;
  }>(),
  { tamano: 22 },
);

const { festividad } = useFestividad();
</script>

<style scoped>
.icono-festivo {
  width: var(--tam);
  height: var(--tam);
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35));
  animation: mecer 3.5s ease-in-out infinite alternate;
}
.esquina {
  position: absolute;
  z-index: 2;
}
.esquina-sup-izq { top: 6px; left: 6px; }
.esquina-sup-der { top: 6px; right: 6px; }
.esquina-inf-izq { bottom: 6px; left: 6px; }
.esquina-inf-der { bottom: 6px; right: 6px; }

@keyframes mecer {
  from { transform: rotate(-6deg); }
  to { transform: rotate(6deg); }
}
@media (prefers-reduced-motion: reduce) {
  .icono-festivo { animation: none; }
}
</style>
