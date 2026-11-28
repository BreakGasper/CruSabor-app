<template>
  <div v-if="visible && cotizacion" class="overlay" @click.self="cerrar">
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="resp-titulo" novalidate @submit.prevent="enviar">
      <h3 id="resp-titulo">Responder cotización</h3>
      <p class="sub">{{ cotizacion.servicioNombre }} · {{ cotizacion.clienteNombre || 'Cliente' }}</p>

      <label class="campo">
        <span>Precio (MXN) *</span>
        <input v-model.number="form.precio" type="number" min="0" step="1" inputmode="decimal" data-testid="resp-precio" :class="{ err: errores.precio }" />
        <small v-if="errores.precio" class="error">{{ errores.precio }}</small>
      </label>

      <label class="campo">
        <span>Descripción de lo que incluye</span>
        <textarea v-model="form.descripcion" rows="3" maxlength="1000" data-testid="resp-descripcion"></textarea>
      </label>

      <label class="campo">
        <span>Condiciones (anticipo, tiempos, materiales…)</span>
        <textarea v-model="form.condiciones" rows="2" maxlength="1000" data-testid="resp-condiciones"></textarea>
      </label>

      <label class="campo">
        <span>Válida hasta *</span>
        <input v-model="form.venceEl" type="date" :min="hoy" data-testid="resp-vence" :class="{ err: errores.venceEl }" />
        <small v-if="errores.venceEl" class="error">{{ errores.venceEl }}</small>
      </label>

      <p v-if="errorGeneral" class="error" role="alert">{{ errorGeneral }}</p>

      <div class="acciones">
        <button type="button" class="btn-sec" :disabled="enviando" @click="cerrar">Cancelar</button>
        <button type="submit" class="btn-pri" :disabled="enviando" data-testid="resp-enviar">{{ enviando ? 'Enviando…' : 'Enviar cotización' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ahoraEnZona } from '../disponibilidad';
import { ErrorServicio } from '../catalogo';
import { responderCotizacion, validarRespuesta, vigenciaSugerida } from '../cotizaciones';
import type { Cotizacion } from '../tipos';

/** La tienda responde una solicitud con un precio, lo que incluye, condiciones y hasta cuándo es válido */
const props = defineProps<{ visible: boolean; cotizacion: Cotizacion | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const hoy = ahoraEnZona().fecha;
const form = reactive({ precio: 0, descripcion: '', condiciones: '', venceEl: vigenciaSugerida() });
const errores = ref<Record<string, string>>({});
const errorGeneral = ref('');
const enviando = ref(false);

watch(
  () => [props.visible, props.cotizacion?.id],
  () => {
    if (!props.visible) return;
    Object.assign(form, { precio: 0, descripcion: '', condiciones: '', venceEl: vigenciaSugerida() });
    errores.value = {};
    errorGeneral.value = '';
  },
  { immediate: true },
);

const cerrar = () => !enviando.value && emit('close');

async function enviar() {
  if (enviando.value || !props.cotizacion) return;
  errores.value = validarRespuesta(form);
  if (Object.keys(errores.value).length) return;
  enviando.value = true;
  errorGeneral.value = '';
  try {
    await responderCotizacion(props.cotizacion.tiendaId, props.cotizacion.id, { ...form });
    emit('saved');
  } catch (e: any) {
    errorGeneral.value = e instanceof ErrorServicio ? e.message : 'No se pudo enviar. Intenta de nuevo.';
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(17, 24, 39, 0.55); }
.modal { width: 100%; max-width: 460px; max-height: 92vh; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding: 1.25rem; border-radius: 18px; background: var(--surface); color: var(--text); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3); text-align: left; box-sizing: border-box; }
h3 { margin: 0; }
.sub { margin: -6px 0 0; color: var(--text-muted); font-size: 0.88rem; }
.campo { display: flex; flex-direction: column; gap: 5px; font-size: 0.88rem; font-weight: 600; }
.campo input, .campo textarea { padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; font-size: 16px; }
.campo .err { border-color: var(--peligro-texto); }
.error { color: var(--peligro-texto); font-weight: 600; font-size: 0.82rem; margin: 0; }
.acciones { display: flex; gap: 10px; justify-content: flex-end; }
.btn-pri, .btn-sec { padding: 10px 16px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; }
.btn-pri { border: 0; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn-sec { border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.btn-pri:disabled, .btn-sec:disabled { opacity: 0.6; cursor: wait; }
</style>
