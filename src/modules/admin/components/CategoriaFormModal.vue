<template>
  <div v-if="visible" class="modal-overlay" @click.self="cerrar">
    <form class="modal" novalidate @submit.prevent="guardar">
      <h3 class="modal-title">{{ categoria ? 'Editar categoría' : 'Nueva categoría' }}</h3>

      <div class="icono-row">
        <button type="button" class="icono-btn" :title="preview ? 'Cambiar ícono' : 'Subir ícono'" @click="fileInput?.click()">
          <img v-if="preview" :src="preview" alt="" class="icono-img" />
          <span v-else class="icono-mas">+</span>
        </button>
        <div class="icono-texto">
          <strong>Ícono</strong>
          <span>PNG o JPG cuadrado. Opcional.</span>
          <button v-if="preview" type="button" class="link-quitar" @click="quitarIcono">Quitar ícono</button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="hidden-input" @change="onFile" />
      </div>

      <div class="form-group">
        <label for="cat-nombre">Nombre</label>
        <input
          id="cat-nombre"
          v-model="form.nombre"
          type="text"
          class="form-input"
          :class="{ 'input-error': errores.nombre }"
          maxlength="40"
          placeholder="Ej. Panadería"
        />
        <small v-if="errores.nombre" class="error-text">{{ errores.nombre }}</small>
      </div>

      <div class="form-group">
        <label for="cat-desc">Descripción (opcional)</label>
        <textarea id="cat-desc" v-model="form.descripcion" class="form-input" rows="2" maxlength="120" placeholder="Breve descripción"></textarea>
      </div>

      <p v-if="categoria && nombreCambia" class="aviso">
        Al cambiar el nombre se actualizará también en las tiendas y artículos que usan esta categoría.
      </p>
      <p v-if="errores.general" class="error-banner">{{ errores.general }}</p>

      <div class="actions">
        <button type="button" class="btn-outline" :disabled="guardando" @click="cerrar">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando">
          {{ guardando ? 'Guardando...' : categoria ? 'Guardar cambios' : 'Crear categoría' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue';
import type { CategoriaData } from '@/composables/useCategorias';
import { crearCategoria, editarCategoria } from '@/composables/useAdminCategorias';

const props = defineProps<{ visible: boolean; categoria: CategoriaData | null }>();
const emit = defineEmits<{ close: []; saved: [info: { id: string; nombre: string; propagados?: { tiendas: number; articulos: number } }] }>();

const form = reactive({ nombre: '', descripcion: '', icono: '' });
const iconoFile = ref<File | null>(null);
const preview = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const errores = reactive<{ nombre?: string; general?: string }>({});
const guardando = ref(false);

const nombreCambia = computed(() => !!props.categoria && form.nombre.trim() !== props.categoria.nombre);

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    form.nombre = props.categoria?.nombre || '';
    form.descripcion = props.categoria?.descripcion || '';
    form.icono = props.categoria?.icono || '';
    iconoFile.value = null;
    preview.value = form.icono;
    errores.nombre = errores.general = undefined;
    if (fileInput.value) fileInput.value.value = '';
  },
  { immediate: true },
);

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  iconoFile.value = f;
  preview.value = URL.createObjectURL(f);
}
function quitarIcono() {
  iconoFile.value = null;
  form.icono = '';
  preview.value = '';
  if (fileInput.value) fileInput.value.value = '';
}
function cerrar() {
  if (!guardando.value) emit('close');
}

async function guardar() {
  errores.nombre = errores.general = undefined;
  if (form.nombre.trim().length < 2) {
    errores.nombre = 'El nombre debe tener al menos 2 caracteres';
    return;
  }
  guardando.value = true;
  try {
    const datos = { nombre: form.nombre, descripcion: form.descripcion, iconoFile: iconoFile.value, icono: form.icono };
    if (props.categoria) {
      const propagados = await editarCategoria(props.categoria.id, datos);
      emit('saved', { id: props.categoria.id, nombre: form.nombre.trim(), propagados });
    } else {
      const id = await crearCategoria(datos);
      emit('saved', { id, nombre: form.nombre.trim() });
    }
  } catch (e: any) {
    const msg = e?.message || 'No se pudo guardar';
    if (/nombre|existe/i.test(msg)) errores.nombre = msg;
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
  max-width: 440px;
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
.icono-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.icono-btn {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  border: 2px dashed #10b981;
  background: #ecfdf5;
  color: #047857;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  flex-shrink: 0;
}
.icono-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.icono-mas {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
.icono-texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
  color: #5b6472;
}
.icono-texto strong {
  color: #111827;
}
.link-quitar {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: #b91c1c;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.hidden-input {
  display: none;
}
.form-group {
  display: flex;
  flex-direction: column;
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
  resize: vertical;
}
.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.input-error {
  border-color: #d9534f !important;
}
.error-text {
  color: #d9534f;
  font-size: 0.8rem;
  margin-top: 4px;
}
.aviso {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fff4e5;
  color: #7a4a00;
  font-size: 0.83rem;
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
</style>
