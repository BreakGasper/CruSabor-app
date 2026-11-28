<template>
  <div class="cal" data-testid="calendario">
    <header class="cal-cab">
      <button type="button" class="nav" aria-label="Mes anterior" data-testid="mes-anterior" :disabled="!puedeRetroceder" @click="cambiar(-1)">‹</button>
      <strong class="titulo" data-testid="titulo-mes">{{ titulo }}</strong>
      <button type="button" class="nav" aria-label="Mes siguiente" data-testid="mes-siguiente" :disabled="!puedeAvanzar" @click="cambiar(1)">›</button>
    </header>
    <div class="semana" aria-hidden="true"><span v-for="(d, i) in ['L', 'M', 'M', 'J', 'V', 'S', 'D']" :key="i">{{ d }}</span></div>
    <div class="dias" role="grid">
      <span v-for="n in huecos" :key="'h' + n" class="hueco" />
      <button
        v-for="d in dias"
        :key="d.fecha"
        type="button"
        class="dia"
        :class="{ sel: d.fecha === seleccionada, hoy: d.fecha === hoy, marca: d.marcada }"
        :disabled="!d.habil"
        :data-fecha="d.fecha"
        :aria-label="d.fecha"
        :aria-pressed="d.fecha === seleccionada"
        @click="$emit('seleccionar', d.fecha)"
      >
        {{ d.numero }}<i v-if="d.marcada" class="punto" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ahoraEnZona } from '../disponibilidad';

/**
 * Calendario de un mes (lunes primero). `habilitadas` = días que se pueden elegir (sin esa propiedad, todos los que
 * estén entre `min` y `max`); `marcadas` = días con un punto (por ejemplo, con citas).
 */
const props = defineProps<{
  /** AAAA-MM del mes que se muestra */
  mes: string;
  seleccionada?: string;
  habilitadas?: ReadonlySet<string>;
  marcadas?: ReadonlySet<string>;
  min?: string;
  max?: string;
}>();
const emit = defineEmits<{ seleccionar: [fecha: string]; 'cambiar-mes': [mes: string] }>();

const hoy = ahoraEnZona().fecha;
const [anio, mesNum] = [computed(() => Number(props.mes.slice(0, 4))), computed(() => Number(props.mes.slice(5, 7)))];
const titulo = computed(() => new Date(Date.UTC(anio.value, mesNum.value - 1, 1)).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
/** Casillas vacías antes del día 1 (lunes = 0) */
const huecos = computed(() => (new Date(Date.UTC(anio.value, mesNum.value - 1, 1)).getUTCDay() + 6) % 7);
const total = computed(() => new Date(Date.UTC(anio.value, mesNum.value, 0)).getUTCDate());
const dias = computed(() =>
  Array.from({ length: total.value }, (_, i) => {
    const fecha = `${props.mes}-${String(i + 1).padStart(2, '0')}`;
    const dentro = (!props.min || fecha >= props.min) && (!props.max || fecha <= props.max);
    return { fecha, numero: i + 1, habil: dentro && (!props.habilitadas || props.habilitadas.has(fecha)), marcada: !!props.marcadas?.has(fecha) };
  }),
);
const primerDia = computed(() => `${props.mes}-01`);
const ultimoDia = computed(() => `${props.mes}-${String(total.value).padStart(2, '0')}`);
const puedeRetroceder = computed(() => !props.min || props.min < primerDia.value);
const puedeAvanzar = computed(() => !props.max || ultimoDia.value < props.max);

function cambiar(delta: number) {
  const f = new Date(Date.UTC(anio.value, mesNum.value - 1 + delta, 1));
  emit('cambiar-mes', `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`);
}
</script>

<style scoped>
.cal { padding: 10px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); }
.cal-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.titulo { text-transform: capitalize; font-size: 0.98rem; }
.nav { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--text); font-size: 1.2rem; cursor: pointer; }
.nav:disabled { opacity: 0.35; cursor: not-allowed; }
.semana, .dias { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.semana span { text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); padding: 2px 0; }
.dia { position: relative; aspect-ratio: 1 / 1; border: 0; border-radius: 10px; background: transparent; color: var(--text); font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.dia:disabled { color: var(--text-muted); opacity: 0.4; cursor: not-allowed; }
.dia:not(:disabled) { background: var(--surface-2); }
.dia.hoy { outline: 1.5px solid var(--brand-blue-text); }
.dia.sel { background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.punto { position: absolute; left: 50%; bottom: 4px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--brand-blue-text); }
.dia.sel .punto { background: var(--on-primary); }
</style>
