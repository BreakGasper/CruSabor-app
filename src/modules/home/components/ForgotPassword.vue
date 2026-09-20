<template>
  <div class="forgot-password-container">
    <h2>Recuperar contraseña</h2>

    <!-- Paso 1: pedir el código al correo asociado al teléfono -->
    <div v-if="paso === 'telefono'">
      <p>Ingresa tu número de teléfono para enviarte un código a tu correo.</p>
      <p v-if="mensaje" class="mensaje" style="font-size: 12px; color: red">{{ mensaje }}</p>
      <form @submit.prevent="solicitarCodigo">
        <div class="input-telefono">
          <span class="prefijo">+52</span>
          <input type="tel" v-model="telefono" placeholder="375-124-1114" maxlength="12" @input="limpiarTelefono" required />
          <img src="@/assets/icons/smartphone.png" alt="Teléfono" class="icono-telefono" />
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? "Enviando..." : "Enviar código" }}
        </button>
      </form>
    </div>

    <!-- Paso 2: código + nueva contraseña -->
    <div v-else>
      <p class="mensaje">📩 Te enviamos un código a {{ correoOculto }}</p>

      <form @submit.prevent="cambiarContrasena">
        <div ref="codigoContainer" class="codigo-inputs">
          <input
            v-for="(_, index) in 4"
            :key="index"
            type="text"
            v-model="codigoInputs[index]"
            maxlength="1"
            inputmode="numeric"
            pattern="[0-9]*"
            @input="onInputCodigo(index)"
            @keydown.backspace="onBorrar(index)"
          />
        </div>

        <div class="password-wrapper">
          <input
            :type="verPass ? 'text' : 'password'"
            v-model="nuevaContrasena"
            placeholder="Nueva contraseña"
            :maxlength="PASSWORD_MAX"
          />
          <button type="button" class="eye-btn" @click="verPass = !verPass">
            <component :is="verPass ? Eye : EyeOff" class="eye-icon" />
          </button>
        </div>
        <input
          :type="verPass ? 'text' : 'password'"
          v-model="confirmarContrasena"
          placeholder="Confirmar contraseña"
          :maxlength="PASSWORD_MAX"
        />

        <p v-if="mensaje" class="mensaje" style="font-size: 12px; color: red">{{ mensaje }}</p>

        <button type="submit" :disabled="loading || !formularioListo">
          {{ loading ? "Guardando..." : "Cambiar contraseña" }}
        </button>
        <button type="button" class="link-reenviar" @click="volverAlInicio">
          Usar otro número
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PASSWORD_MAX } from "@/composables/usePassword";
import { Eye, EyeOff } from "lucide-vue-next";

const API = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const emit = defineEmits<{ (e: "success"): void; (e: "close"): void }>();

const paso = ref<"telefono" | "codigo">("telefono");
const telefono = ref("");
const correoOculto = ref("");
const codigoInputs = ref(["", "", "", ""]);
const nuevaContrasena = ref("");
const confirmarContrasena = ref("");
const verPass = ref(false);
const loading = ref(false);
const mensaje = ref("");
const codigoContainer = ref<HTMLDivElement | null>(null);

const codigo = computed(() => codigoInputs.value.join(""));
const formularioListo = computed(
  () =>
    codigo.value.length === 4 &&
    nuevaContrasena.value.length >= 6 &&
    nuevaContrasena.value === confirmarContrasena.value,
);

// Teléfono: se muestra con guiones (375-124-1114) pero al servidor van solo los dígitos
function soloDigitosTel() {
  return telefono.value.replace(/\D/g, "").slice(0, 10);
}
function limpiarTelefono() {
  const d = soloDigitosTel();
  if (d.length <= 3) telefono.value = d;
  else if (d.length <= 6) telefono.value = `${d.slice(0, 3)}-${d.slice(3)}`;
  else telefono.value = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

const onInputCodigo = (index: number) => {
  codigoInputs.value[index] = codigoInputs.value[index].replace(/\D/, "");
  if (codigoInputs.value[index] && index < 3) {
    codigoContainer.value?.querySelectorAll<HTMLInputElement>("input")[index + 1]?.focus();
  }
};
const onBorrar = (index: number) => {
  if (!codigoInputs.value[index] && index > 0) {
    codigoContainer.value?.querySelectorAll<HTMLInputElement>("input")[index - 1]?.focus();
  }
};

async function solicitarCodigo() {
  const tel = soloDigitosTel();
  if (tel.length !== 10) {
    mensaje.value = "Ingresa un número de 10 dígitos.";
    return;
  }
  loading.value = true;
  mensaje.value = "";
  try {
    const res = await fetch(`${API}/recuperar-password/solicitar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: tel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      mensaje.value = data?.error || "No se pudo enviar el código.";
      return;
    }
    correoOculto.value = data.email || "tu correo";
    paso.value = "codigo";
  } catch {
    mensaje.value = "No se pudo conectar con el servidor.";
  } finally {
    loading.value = false;
  }
}

async function cambiarContrasena() {
  if (nuevaContrasena.value !== confirmarContrasena.value) {
    mensaje.value = "Las contraseñas no coinciden.";
    return;
  }
  if (nuevaContrasena.value.length < 6) {
    mensaje.value = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }
  loading.value = true;
  mensaje.value = "";
  try {
    const res = await fetch(`${API}/recuperar-password/cambiar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: soloDigitosTel(),
        codigo: codigo.value,
        nuevaPassword: nuevaContrasena.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      mensaje.value = data?.error || "No se pudo cambiar la contraseña.";
      return;
    }
    emit("success");
    emit("close");
  } catch {
    mensaje.value = "No se pudo conectar con el servidor.";
  } finally {
    loading.value = false;
  }
}

function volverAlInicio() {
  paso.value = "telefono";
  codigoInputs.value = ["", "", "", ""];
  nuevaContrasena.value = "";
  confirmarContrasena.value = "";
  mensaje.value = "";
}
</script>

<style scoped>
.forgot-password-container {
  max-width: 360px;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
  text-align: center;
}
.forgot-password-container h2 {
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
  color: var(--brand-navy-text);
}
.forgot-password-container p {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}
.forgot-password-container form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.forgot-password-container input {
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  font-size: 0.95rem;
  outline: none;
}
.forgot-password-container input:focus {
  border-color: var(--color-bg-blue-dark);
}
.forgot-password-container button[type="submit"] {
  padding: 0.6rem 0.8rem;
  background: var(--color-bg-blue-dark);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.forgot-password-container button[type="submit"]:disabled {
  background: #7ea7f2;
  cursor: not-allowed;
}
.link-reenviar {
  background: none;
  border: none;
  color: var(--brand-blue-text);
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: underline;
}
.codigo-inputs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.codigo-inputs input {
  width: 3rem;
  height: 3.5rem;
  text-align: center;
  font-size: 1.5rem;
}
.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrapper input {
  width: 100%;
  padding-right: 2.5rem;
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
  color: var(--text-muted);
}
.input-telefono {
  position: relative;
  display: flex;
  align-items: center;
}
.input-telefono .prefijo {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  font-weight: bold;
}
.input-telefono input {
  padding-left: 50px;
  padding-right: 40px;
  border-radius: 8px;
  border: 1px solid var(--border);
  height: 2.6rem;
  width: 100%;
  font-size: 0.95rem;
  outline: none;
}
.input-telefono input:focus {
  border-color: var(--color-bg-blue-dark);
}
.input-telefono .icono-telefono {
  position: absolute;
  right: 10px;
  width: 24px;
  height: 24px;
}
</style>
