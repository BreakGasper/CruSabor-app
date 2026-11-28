<template>
  <div v-if="visible && cita" class="overlay" @click.self="cerrar">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rep-titulo" data-testid="reprogramar">
      <h3 id="rep-titulo">Reprogramar cita</h3>
      <p class="sub">{{ cita.servicioNombre }} · {{ cita.clienteNombre }}<br />Ahora: {{ fechaDia(cita.fecha) }} · {{ cita.inicio }}</p>

      <p v-if="!disp" class="sub">Cargando agenda…</p>
      <SelectorHorario v-else v-model:fecha="fecha" v-model:inicio="inicio" :disp="disp" :duracion-min="cita.duracionMin" :ocupacion="ocupacionSinMia" />

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="acciones">
        <button type="button" class="btn" :disabled="enviando" @click="cerrar">Cancelar</button>
        <button type="button" class="btn pri" :disabled="enviando || !inicio" data-testid="confirmar-reprogramar" @click="confirmar">{{ enviando ? 'Guardando…' : 'Reprogramar' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SelectorHorario from './SelectorHorario.vue';
import { ErrorServicio } from '../catalogo';
import { leerDisponibilidad, leerOcupacion, reprogramarCita } from '../agenda';
import { bloquesDeCita } from '../disponibilidad';
import { fechaDia } from '../formato';
import type { Cita, Disponibilidad } from '../tipos';

/** La tienda elige otro día y hora para una cita (los bloques de la propia cita cuentan como libres) */
const props = defineProps<{ visible: boolean; cita: Cita | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const disp = ref<Disponibilidad | null>(null);
const ocupacion = ref<Record<string, Set<string>>>({});
const fecha = ref('');
const inicio = ref('');
const error = ref('');
const enviando = ref(false);

/** Sin los bloques de esta misma cita: si la mueve un rato, esos horarios le siguen sirviendo */
const ocupacionSinMia = computed(() => {
  const c = props.cita;
  if (!c) return ocupacion.value;
  const propios = new Set(bloquesDeCita(c.inicio, c.duracionMin));
  const salida: Record<string, Set<string>> = { ...ocupacion.value };
  salida[c.fecha] = new Set([...(ocupacion.value[c.fecha] ?? [])].filter((b) => !propios.has(b)));
  return salida;
});

watch(
  () => [props.visible, props.cita?.id],
  async () => {
    if (!props.visible || !props.cita) return;
    fecha.value = '';
    inicio.value = '';
    error.value = '';
    disp.value = null;
    [disp.value, ocupacion.value] = await Promise.all([leerDisponibilidad(props.cita.tiendaId, props.cita.profesionalId), leerOcupacion(props.cita.tiendaId, props.cita.profesionalId)]);
  },
  { immediate: true },
);

const cerrar = () => !enviando.value && emit('close');

async function confirmar() {
  if (!props.cita || !inicio.value || enviando.value) return;
  enviando.value = true;
  error.value = '';
  try {
    await reprogramarCita(props.cita.tiendaId, props.cita.id, { fecha: fecha.value, inicio: inicio.value });
    emit('saved');
  } catch (e: any) {
    error.value = e instanceof ErrorServicio ? e.message : 'No se pudo reprogramar. Intenta de nuevo.';
    ocupacion.value = await leerOcupacion(props.cita.tiendaId, props.cita.profesionalId);
    inicio.value = '';
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(17, 24, 39, 0.55); }
.modal { width: 100%; max-width: 460px; max-height: calc(100dvh - 2rem); overflow: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 12px; padding: 1.25rem; border-radius: 18px; background: var(--surface); color: var(--text); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3); text-align: left; box-sizing: border-box; }
h3 { margin: 0; }
.sub { margin: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.4; text-transform: none; }
.error { margin: 0; color: var(--peligro-texto); font-weight: 600; font-size: 0.85rem; }
.acciones { display: flex; gap: 10px; justify-content: flex-end; }
.btn { padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
