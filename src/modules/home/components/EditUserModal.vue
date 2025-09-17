<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-content">
        <button class="modal-close" @click="handleCancel">✖</button>

        <h3>Editar datos del usuario</h3>

        <div class="form-group">
          <label>Nombre</label>
          <input v-model="form.nombre" type="text" />
        </div>

        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" />
        </div>

        <!-- Calle y Número -->
        <div class="form-row">
          <div class="input-wrapper calle">
            <label>Calle</label>
            <input v-model="form.calle" type="text" />
          </div>
          <div class="input-wrapper numero">
            <label>Número</label>
            <input v-model="form.numero" type="text" />
          </div>
        </div>

        <!-- Colonia y Código Postal -->
        <div class="form-row">
          <div class="input-wrapper colonia">
            <label>Colonia</label>
            <input v-model="form.lugar" type="text" />
          </div>
          <div class="input-wrapper codigoPostal">
            <label>Código Postal</label>
            <input v-model="form.codigoPostal" type="text" maxlength="10" />
          </div>
        </div>

        <!-- Municipio y Estado -->
        <div class="form-row">
          <div class="input-wrapper municipio">
            <label>Municipio</label>
            <input v-model="form.municipio" type="text" />
          </div>
          <div class="input-wrapper estado">
            <label>Estado</label>
            <input v-model="form.estado" type="text" />
          </div>
        </div>

        <span v-if="error.value" class="error-text">{{ error.value }}</span>

        <button class="modal-save" @click="saveChanges">
          Actualizar Datos
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { reactive, watch, defineProps, defineEmits } from "vue";
import type { Usuario } from "@/composables/useAuth";

const props = defineProps<{
  visible: boolean;
  userData: Usuario | null;
}>();

const emit = defineEmits<{
  (e: "save", updatedUser: Usuario): void;
  (e: "cancel"): void;
}>();

const form = reactive({
  nombre: "",
  email: "",
  celular: "",
  calle: "",
  numero: "",
  codigoPostal: "",
  lugar: "",
  municipio: "",
  estado: "",
});

const error = reactive({ value: "" });

// Sincronizar props al abrir modal
watch(
  () => props.userData,
  (newVal) => {
    if (newVal) {
      let calle = "";
      let numero = "";
      if (newVal.calleNumero) {
        const parts = newVal.calleNumero.split(" #");
        calle = parts[0];
        numero = parts[1] || "";
      }

      Object.assign(form, {
        nombre: newVal.nombre || "",
        email: newVal.email || "",
        celular: newVal.celular || "",
        calle,
        numero,
        codigoPostal: newVal.codigoPostal || "",
        lugar: newVal.lugar || "",
        municipio: newVal.municipio || "",
        estado: newVal.estado || "",
      });
    }
  },
  { immediate: true }
);

function saveChanges() {
  if (!form.nombre || !form.email) {
    error.value = "Nombre y email son obligatorios";
    return;
  }

  const updatedUser: Usuario = {
    ...props.userData!,
    nombre: form.nombre,
    email: form.email,
    celular: form.celular,
    calleNumero: `${form.calle} #${form.numero}`,
    codigoPostal: form.codigoPostal,
    lugar: form.lugar,
    municipio: form.municipio,
    estado: form.estado,
  };

  emit("save", updatedUser);
}

function handleCancel() {
  emit("cancel");
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  padding: 2rem 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group input {
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  width: 100%;
  font-size: 0.95rem;
}

/* Filas con inputs alineados */
.form-row {
  display: flex;
  gap: 0.5rem;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
}

.input-wrapper label {
  font-size: 0.9rem; /* mismo tamaño que Calle */
  margin-bottom: 2px;
}

/* Anchos proporcionales */
.input-wrapper.calle {
  flex: 7;
}
.input-wrapper.numero {
  flex: 3;
}

.input-wrapper.colonia {
  flex: 7;
}
.input-wrapper.codigoPostal {
  flex: 3;
}

.input-wrapper.municipio {
  flex: 1;
}
.input-wrapper.estado {
  flex: 1;
}

.input-wrapper input {
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

.modal-save {
  margin-top: 1rem;
  padding: 0.6rem 2rem;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-blue-dark);
  color: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
}

.error-text {
  color: #f44336;
  font-size: 0.85rem;
}
</style>
