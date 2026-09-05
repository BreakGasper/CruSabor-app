<template>
  <form class="dir-form" novalidate @submit.prevent="guardar">
    <label class="campo campo-alias">
      <span>Nombre (Casa, Oficina...)</span>
      <input v-model="form.alias" type="text" maxlength="30" placeholder="Casa" />
    </label>

    <label class="campo campo-calle">
      <span>Calle *</span>
      <input v-model="form.calle" type="text" placeholder="Calle" :class="{ err: errores.calle }" />
    </label>
    <label class="campo campo-numero">
      <span>Número *</span>
      <input v-model="form.numero" type="text" inputmode="numeric" placeholder="#" :class="{ err: errores.numero }" />
    </label>

    <label class="campo campo-colonia">
      <span>Colonia *</span>
      <input v-model="form.colonia" type="text" placeholder="Colonia" :class="{ err: errores.colonia }" />
    </label>
    <label class="campo campo-cp">
      <span>C.P. *</span>
      <input v-model="form.cp" type="text" inputmode="numeric" maxlength="5" placeholder="00000" :class="{ err: errores.cp }" />
    </label>

    <label class="campo">
      <span>Municipio *</span>
      <input v-model="form.municipio" type="text" placeholder="Municipio" :class="{ err: errores.municipio }" />
    </label>
    <label class="campo">
      <span>Estado *</span>
      <input v-model="form.estado" type="text" placeholder="Estado" :class="{ err: errores.estado }" />
    </label>

    <label class="check">
      <input v-model="form.predeterminada" type="checkbox" />
      Usar como dirección predeterminada
    </label>

    <p v-if="mensaje" class="error-msg">{{ mensaje }}</p>

    <div class="acciones">
      <button type="button" class="btn-sec" :disabled="guardando" @click="$emit('cancel')">Cancelar</button>
      <button type="submit" class="btn-pri" :disabled="guardando">
        {{ guardando ? 'Guardando...' : 'Guardar dirección' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { DireccionInput } from '@/composables/useDirecciones';

/**
 * Formulario de alta de dirección. Emite `save` con los datos validados;
 * quien lo usa decide dónde guardarlos (Firebase) y qué hacer después.
 */
const props = withDefaults(defineProps<{ guardando?: boolean; error?: string }>(), {
  guardando: false,
  error: '',
});
const emit = defineEmits<{ (e: 'save', d: DireccionInput): void; (e: 'cancel'): void }>();

const form = reactive<DireccionInput>({
  alias: '',
  calle: '',
  numero: '',
  colonia: '',
  municipio: '',
  estado: '',
  cp: '',
  predeterminada: false,
});
const errores = reactive<Record<string, boolean>>({});
const mensaje = ref('');

function guardar() {
  mensaje.value = '';
  const obligatorios: (keyof DireccionInput)[] = ['calle', 'numero', 'colonia', 'cp', 'municipio', 'estado'];
  let ok = true;
  for (const k of obligatorios) {
    errores[k] = !String(form[k] ?? '').trim();
    if (errores[k]) ok = false;
  }
  if (!ok) {
    mensaje.value = 'Completa los campos marcados con *';
    return;
  }
  if (!/^\d{5}$/.test(String(form.cp).trim())) {
    errores.cp = true;
    mensaje.value = 'El código postal debe tener 5 dígitos';
    return;
  }
  emit('save', { ...form });
}

defineExpose({ form });
</script>

<style scoped>
.dir-form {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
  text-align: left;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.78rem;
  color: #555;
  min-width: 0;
}
.campo-alias,
.check,
.error-msg,
.acciones {
  grid-column: 1 / -1;
}
.campo input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid #d5dbe3;
  border-radius: 10px;
  font-size: 16px;
  box-sizing: border-box;
  background: #fff;
}
.campo input:focus {
  outline: none;
  border-color: var(--color-bg-blue-ligth);
  box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.15);
}
.campo input.err {
  border-color: #e74c3c;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #333;
  cursor: pointer;
}
.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-bg-blue-dark);
}
.error-msg {
  margin: 0;
  color: #c0392b;
  background: #fdecea;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
}
.acciones {
  display: flex;
  gap: 8px;
}
.btn-pri,
.btn-sec {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-pri {
  border: none;
  background: var(--color-bg-blue-dark);
  color: #fff;
}
.btn-sec {
  border: 1px solid #d5dbe3;
  background: #fff;
  color: #333;
}
.btn-pri:disabled,
.btn-sec:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
