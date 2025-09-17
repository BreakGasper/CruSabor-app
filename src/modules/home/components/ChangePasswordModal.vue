<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-content">
        <button class="modal-close" @click="$emit('close')">✖</button>

        <h3>Cambiar contraseña</h3>

        <!-- Input nueva contraseña -->
        <div class="password-wrapper">
          <input
            :type="showNewPassword ? 'text' : 'password'"
            v-model="nuevaContrasena"
            placeholder="Nueva contraseña"
            maxlength="8"
          />
          <button
            type="button"
            class="eye-btn"
            @click="showNewPassword = !showNewPassword"
          >
            <component :is="showNewPassword ? Eye : EyeOff" class="eye-icon" />
          </button>
        </div>

        <!-- Input confirmar contraseña -->
        <div class="password-wrapper">
          <input
            :type="showConfirmPassword ? 'text' : 'password'"
            v-model="confirmarContrasena"
            placeholder="Confirmar contraseña"
            maxlength="8"
          />
          <button
            type="button"
            class="eye-btn"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <component
              :is="showConfirmPassword ? Eye : EyeOff"
              class="eye-icon"
            />
          </button>
        </div>

        <span v-if="errorContrasena" class="error-text">
          {{ errorContrasena }}
        </span>

        <button
          class="modal-save"
          :disabled="!!errorContrasena || loading"
          @click="cambiarContrasena"
        >
          {{ loading ? "Guardando..." : "Guardar" }}
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { hashPassword } from "@/composables/usePassword";
import { updateUserPassword } from "@/composables/useAuth";
import {
  cerrarSesion,
  cargarSesion,
  isLoggedIn,
  sessionUser,
  sessionUsuarioValidation,
} from "@/utils/sessionUser";

const props = defineProps<{
  visible: boolean;
  userId: string;
}>();

const emit = defineEmits(["close", "success"]);

const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const nuevaContrasena = ref("");
const confirmarContrasena = ref("");
const errorContrasena = ref("");
const loading = ref(false);

watch(nuevaContrasena, () => validarContrasena());
watch(confirmarContrasena, () => validarContrasena());

function validarContrasena() {
  if (!nuevaContrasena.value && !confirmarContrasena.value) {
    errorContrasena.value = "";
    return;
  }
  if (nuevaContrasena.value.length > 8) {
    errorContrasena.value = "La contraseña no puede exceder 8 caracteres";
  } else if (nuevaContrasena.value !== confirmarContrasena.value) {
    errorContrasena.value = "Las contraseñas no coinciden";
  } else {
    errorContrasena.value = "";
  }
}

async function cambiarContrasena() {
  if (nuevaContrasena.value.length < 6) {
    errorContrasena.value = "La contraseña debe ser más de 6 caracteres";
    return;
  }
  if (errorContrasena.value) return;

  try {
    var idUser = props.userId;
    if (props.userId === "Perfil") {
      cargarSesion();
      idUser = sessionUser.value.id;
    }
    loading.value = true;
    const encrypted = await hashPassword(nuevaContrasena.value);
    await updateUserPassword(idUser, encrypted);

    // limpiar
    nuevaContrasena.value = "";
    confirmarContrasena.value = "";

    emit("success"); // notifica al padre
    emit("close"); // cerrar modal
  } catch (err) {
    console.error(err);
    errorContrasena.value = "No se pudo cambiar la contraseña";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* mismo css que ya tenías */
.error-text {
  color: #f44336;
  font-size: 0.9rem;
  margin-top: -0.5rem;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}
.modal-content {
  position: relative;
  background: white;
  padding: 2rem 1.5rem 2.5rem 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.modal-close {
  top: 10px;
  left: 10px;
  margin-bottom: -35px;
  text-align: right;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}
.modal-save {
  margin-top: 1rem;
  align-self: center;
  padding: 0.6rem 2rem;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-blue-dark);
  color: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
}
.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrapper input {
  width: 100%;
  padding-right: 2.5rem;
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid #ccc;
}
.eye-btn {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
}
.eye-icon {
  width: 1.2rem;
  height: 1.2rem;
  color: #555;
}
</style>
