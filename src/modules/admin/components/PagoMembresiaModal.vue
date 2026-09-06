<template>
  <div v-if="visible" class="modal-overlay" @click.self="cerrar">
    <form class="modal" novalidate @submit.prevent="guardar">
      <h3 class="modal-title">Registrar pago de membresía</h3>
      <p class="modal-sub">{{ tienda?.nombreTienda }}</p>

      <div class="row">
        <div class="form-group">
          <label for="pago-plan">Plan</label>
          <select id="pago-plan" v-model="form.plan" class="form-input" @change="recalcular">
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pago-monto">Monto (MXN)</label>
          <input
            id="pago-monto"
            v-model="form.monto"
            type="number"
            min="1"
            step="0.01"
            inputmode="decimal"
            class="form-input"
            :class="{ 'input-error': errores.monto }"
            placeholder="0.00"
          />
          <small v-if="precioSugerido > 0" class="hint">Precio configurado: ${{ precioSugerido.toFixed(2) }}</small>
          <small v-if="errores.monto" class="error-text">{{ errores.monto }}</small>
        </div>
      </div>

      <div class="row">
        <div class="form-group">
          <label for="pago-metodo">Método</label>
          <select id="pago-metodo" v-model="form.metodo" class="form-input">
            <option v-for="m in METODOS_PAGO_MEMBRESIA" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pago-ref">Referencia (opcional)</label>
          <input
            id="pago-ref"
            v-model="form.referencia"
            type="text"
            class="form-input"
            maxlength="60"
            placeholder="Folio, transferencia..."
          />
        </div>
      </div>

      <div class="form-group">
        <label for="pago-hasta">Vigente hasta</label>
        <input
          id="pago-hasta"
          v-model="form.vigenteHasta"
          type="date"
          class="form-input"
          :class="{ 'input-error': errores.vigenteHasta }"
        />
        <small class="hint">
          Se cuenta desde {{ calculo.desde }}. Puedes ajustar la fecha si el pago cubre otro periodo.
        </small>
        <small v-if="errores.vigenteHasta" class="error-text">{{ errores.vigenteHasta }}</small>
      </div>

      <p v-if="errores.general" class="error-banner">{{ errores.general }}</p>

      <div class="actions">
        <button type="button" class="btn-outline" :disabled="guardando" @click="cerrar">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando">
          {{ guardando ? 'Guardando...' : 'Registrar pago' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue';
import {
  registrarPago,
  calcularVigencia,
  METODOS_PAGO_MEMBRESIA,
  type TiendaControl,
  type PlanMembresia,
  type PagoRegistrado,
} from '@/composables/useAdminTiendas';
import { useConfiguracion, precioPlan } from '@/composables/useConfiguracion';

const props = defineProps<{
  visible: boolean;
  tienda: TiendaControl | null;
  /** Prellenado cuando el pago viene de un aviso "Ya pagué" de la tienda */
  planInicial?: PlanMembresia;
  referenciaInicial?: string;
  metodoInicial?: string;
}>();
const emit = defineEmits<{ close: []; saved: [pago: PagoRegistrado] }>();

const form = reactive({
  plan: 'mensual' as PlanMembresia,
  monto: '' as string | number,
  metodo: 'Efectivo' as string,
  referencia: '',
  vigenteHasta: '',
});
const errores = reactive<{ monto?: string; vigenteHasta?: string; general?: string }>({});
const guardando = ref(false);

const calculo = computed(() => calcularVigencia(props.tienda?.membresia?.vigenteHasta, form.plan));
const { configuracion } = useConfiguracion();
const precioSugerido = computed(() => precioPlan(configuracion.value, form.plan));

function recalcular() {
  form.vigenteHasta = calculo.value.hasta;
  // El monto sugerido sigue al plan mientras el admin no haya escrito otro
  if (!montoEditado.value) form.monto = precioSugerido.value > 0 ? precioSugerido.value : '';
}
const montoEditado = ref(false);
watch(() => form.monto, (v) => { if (Number(v) !== precioSugerido.value) montoEditado.value = true; });

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    form.plan = props.planInicial ?? ((props.tienda?.membresia?.plan as PlanMembresia) === 'anual' ? 'anual' : 'mensual');
    montoEditado.value = false;
    form.monto = '';
    form.metodo = props.metodoInicial ?? 'Efectivo';
    form.referencia = props.referenciaInicial ?? '';
    errores.monto = errores.vigenteHasta = errores.general = undefined;
    recalcular();
  },
  { immediate: true },
);

function cerrar() {
  if (!guardando.value) emit('close');
}

async function guardar() {
  errores.monto = errores.vigenteHasta = errores.general = undefined;
  const monto = Number(form.monto);
  if (!(monto > 0)) errores.monto = 'Indica un monto mayor a cero';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.vigenteHasta)) errores.vigenteHasta = 'Fecha inválida';
  else if (form.vigenteHasta < calculo.value.desde) errores.vigenteHasta = 'La vigencia no puede ser anterior al inicio del periodo';
  if (errores.monto || errores.vigenteHasta || !props.tienda) return;

  guardando.value = true;
  try {
    const pago = await registrarPago(props.tienda, {
      monto,
      metodo: form.metodo,
      referencia: form.referencia,
      plan: form.plan,
      vigenteHasta: form.vigenteHasta,
    });
    emit('saved', pago);
  } catch (e: any) {
    errores.general = e?.message || 'No se pudo registrar el pago';
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  width: 100%;
  max-width: 460px;
  background: #fff;
  border-radius: 18px;
  padding: 1.5rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  box-sizing: border-box;
}
.modal-title {
  margin: 0;
  font-size: 1.15rem;
  color: #111827;
}
.modal-sub {
  margin: -0.6rem 0 0;
  color: #5b6472;
  font-size: 0.9rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.form-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.form-group label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #333;
  margin-bottom: 5px;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #ccc;
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
  background: #fff;
}
.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.input-error {
  border-color: #d9534f !important;
}
.hint {
  margin-top: 4px;
  font-size: 0.78rem;
  color: #5b6472;
}
.error-text {
  color: #d9534f;
  font-size: 0.8rem;
  margin-top: 4px;
}
.error-banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffebee;
  border: 1px solid #f5c2c0;
  color: #b71c1c;
  font-size: 0.85rem;
  text-align: center;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 0.25rem;
}
.actions button {
  flex: 1;
}
.btn-primary,
.btn-outline {
  padding: 12px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #047857);
}
.btn-outline {
  border: 2px solid #111827;
  background: #fff;
  color: #111827;
}
.btn-primary:disabled,
.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
@media (max-width: 420px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
