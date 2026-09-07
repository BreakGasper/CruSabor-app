<template>
  <div v-if="visible" class="modal-overlay" @click.self="cerrar">
    <form class="modal" novalidate @submit.prevent="guardar">
      <h3 class="modal-title">{{ admin ? 'Editar cuenta' : 'Nueva cuenta de administrador' }}</h3>

      <div class="form-group">
        <label for="adm-nombre">Nombre</label>
        <input id="adm-nombre" v-model="form.nombre" type="text" class="form-input" :class="{ 'input-error': errores.nombre }" maxlength="60" placeholder="Nombre y apellido" />
        <small v-if="errores.nombre" class="error-text">{{ errores.nombre }}</small>
      </div>

      <div class="form-group">
        <label for="adm-telefono">Celular (10 dígitos)</label>
        <input
          id="adm-telefono"
          v-model="form.telefono"
          type="tel"
          inputmode="numeric"
          class="form-input"
          :class="{ 'input-error': errores.telefono }"
          :disabled="!!admin"
          maxlength="12"
          placeholder="331-234-5678"
          @input="formatTelefono"
        />
        <small v-if="admin" class="ayuda">El celular es la llave de acceso y no se cambia.</small>
        <small v-if="errores.telefono" class="error-text">{{ errores.telefono }}</small>
      </div>

      <div class="form-group">
        <label for="adm-rol">Rol</label>
        <select id="adm-rol" v-model="form.rol" class="form-input">
          <option value="admin">{{ ROL_LABEL.admin }} · gestiona tiendas, categorías y configuración</option>
          <option value="superadmin">{{ ROL_LABEL.superadmin }} · además administra estas cuentas</option>
        </select>
      </div>

      <div class="form-group">
        <label for="adm-pass">{{ admin ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña' }}</label>
        <div class="pass-row">
          <input
            id="adm-pass"
            v-model="form.password"
            :type="verPass ? 'text' : 'password'"
            class="form-input"
            :class="{ 'input-error': errores.password }"
            autocomplete="new-password"
            placeholder="Mínimo 6 caracteres"
          />
          <button type="button" class="btn-ver" :aria-label="verPass ? 'Ocultar' : 'Mostrar'" @click="verPass = !verPass">{{ verPass ? '🙈' : '👁️' }}</button>
        </div>
        <small v-if="errores.password" class="error-text">{{ errores.password }}</small>
      </div>

      <p v-if="errores.general" class="error-banner">{{ errores.general }}</p>

      <div class="actions">
        <button type="button" class="btn-outline" :disabled="guardando" @click="cerrar">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando">
          {{ guardando ? 'Guardando...' : admin ? 'Guardar cambios' : 'Crear cuenta' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { crearAdmin, actualizarAdmin, cambiarPasswordAdmin, ROL_LABEL, type Admin, type RolAdmin } from '@/composables/useAdmin';

const props = defineProps<{ visible: boolean; admin: Admin | null; creadoPor?: string }>();
const emit = defineEmits<{ close: []; saved: [info: { id: string; nombre: string; nuevo: boolean }] }>();

const form = reactive({ nombre: '', telefono: '', rol: 'admin' as RolAdmin, password: '' });
const errores = reactive<{ nombre?: string; telefono?: string; password?: string; general?: string }>({});
const guardando = ref(false);
const verPass = ref(false);

const soloDigitos = (s: string) => s.replace(/\D/g, '');
function formatTelefono() {
  const d = soloDigitos(form.telefono).slice(0, 10);
  form.telefono = d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    form.nombre = props.admin?.nombre || '';
    form.telefono = props.admin?.telefono || '';
    form.rol = props.admin?.rol || 'admin';
    form.password = '';
    verPass.value = false;
    errores.nombre = errores.telefono = errores.password = errores.general = undefined;
    if (form.telefono) formatTelefono();
  },
  { immediate: true },
);

function cerrar() {
  if (!guardando.value) emit('close');
}

async function guardar() {
  errores.nombre = errores.telefono = errores.password = errores.general = undefined;
  if (form.nombre.trim().length < 2) errores.nombre = 'El nombre debe tener al menos 2 caracteres';
  if (!props.admin && soloDigitos(form.telefono).length !== 10) errores.telefono = 'El celular debe tener 10 dígitos';
  if ((!props.admin || form.password) && form.password.length < 6) errores.password = 'La contraseña debe tener al menos 6 caracteres';
  if (errores.nombre || errores.telefono || errores.password) return;

  guardando.value = true;
  try {
    if (props.admin) {
      await actualizarAdmin(props.admin.id, { nombre: form.nombre, rol: form.rol });
      if (form.password) await cambiarPasswordAdmin(props.admin.id, form.password);
      emit('saved', { id: props.admin.id, nombre: form.nombre.trim(), nuevo: false });
    } else {
      const id = await crearAdmin({ nombre: form.nombre, telefono: soloDigitos(form.telefono), password: form.password, rol: form.rol, creadoPor: props.creadoPor });
      emit('saved', { id, nombre: form.nombre.trim(), nuevo: true });
    }
  } catch (e: any) {
    const msg = e?.message || 'No se pudo guardar';
    if (/celular/i.test(msg)) errores.telefono = msg;
    else if (/contraseña/i.test(msg)) errores.password = msg;
    else if (/nombre/i.test(msg)) errores.nombre = msg;
    else errores.general = msg;
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
  background: var(--surface);
  color: var(--text);
  border-radius: 18px;
  padding: 1.5rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  box-sizing: border-box;
  max-height: 92vh;
  overflow-y: auto;
}
.modal-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
label {
  font-size: 0.85rem;
  font-weight: 600;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
}
.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.form-input:disabled {
  opacity: 0.7;
}
.input-error {
  border-color: #dc2626;
}
.pass-row {
  display: flex;
  gap: 6px;
}
.btn-ver {
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 10px;
  width: 44px;
  cursor: pointer;
}
.ayuda {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.error-text {
  color: #dc2626;
  font-size: 0.8rem;
}
.error-banner {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fdecea;
  color: #b91c1c;
  font-size: 0.85rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-outline,
.btn-primary {
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-outline {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #047857);
}
.btn-primary:disabled,
.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
