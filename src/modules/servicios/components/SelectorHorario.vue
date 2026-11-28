<template>
  <section class="selector" data-testid="selector-horario">
    <CalendarioMes :mes="mes" :seleccionada="fecha" :habilitadas="diasConHorario" :min="desde" :max="hasta" @cambiar-mes="mes = $event" @seleccionar="elegirDia" />

    <div v-if="fecha" class="horas-bloque">
      <h4>{{ fechaDia(fecha) }}</h4>
      <p v-if="!horas.length" class="vacio" data-testid="sin-horas">No quedan horarios ese día. Prueba con otra fecha.</p>
      <ul v-else class="horas" aria-label="Horarios disponibles">
        <li v-for="h in horas" :key="h">
          <button type="button" class="hora" :class="{ sel: h === inicio }" :data-hora="h" :aria-pressed="h === inicio" @click="$emit('update:inicio', h)">{{ h }}</button>
        </li>
      </ul>
    </div>
    <p v-else class="vacio">Elige un día marcado para ver los horarios.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CalendarioMes from './CalendarioMes.vue';
import { ahoraEnZona, fechasConHorario, horariosDelDia, sumarDias } from '../disponibilidad';
import { fechaDia } from '../formato';
import { MAX_DIAS_ADELANTE_DEFAULT, type Disponibilidad } from '../tipos';

/**
 * Elegir día y hora: calendario con los días que tienen lugar y los horarios libres del día elegido.
 * La lógica (descansos, vacaciones, bloqueos, anticipación, bloques ocupados) es la misma que valida la reserva.
 */
const props = defineProps<{
  disp: Disponibilidad;
  duracionMin: number;
  /** Bloques ocupados por fecha (de leerOcupacion) */
  ocupacion: Record<string, ReadonlySet<string>>;
  fecha?: string;
  inicio?: string;
}>();
const emit = defineEmits<{ 'update:fecha': [f: string]; 'update:inicio': [h: string] }>();

const ahora = ahoraEnZona();
const desde = ahora.fecha;
const hasta = computed(() => sumarDias(ahora.fecha, props.disp.maxDiasAdelante ?? MAX_DIAS_ADELANTE_DEFAULT));
const mes = ref((props.fecha || ahora.fecha).slice(0, 7));

const diasConHorario = computed(() => {
  const primero = `${mes.value}-01`;
  const [y, m] = mes.value.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // último día del mes
  return new Set(
    fechasConHorario({ disp: props.disp, desde: primero < desde ? desde : primero, hasta: ultimo > hasta.value ? hasta.value : ultimo, duracionMin: props.duracionMin, ocupadosDe: (f) => props.ocupacion[f], ahora }),
  );
});
const horas = computed(() => (props.fecha ? horariosDelDia({ disp: props.disp, fecha: props.fecha, duracionMin: props.duracionMin, ocupados: props.ocupacion[props.fecha], ahora }) : []));

function elegirDia(f: string) {
  emit('update:fecha', f);
  emit('update:inicio', '');
}
// Si el horario elegido deja de estar libre (alguien lo tomó mientras tanto), se limpia
watch(horas, (h) => props.inicio && !h.includes(props.inicio) && emit('update:inicio', ''));
</script>

<style scoped>
.selector { display: flex; flex-direction: column; gap: 14px; }
.horas-bloque h4 { margin: 0 0 8px; text-transform: capitalize; color: var(--text); }
.vacio { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
.horas { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hora { width: 100%; padding: 10px 0; border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.hora.sel { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
</style>
