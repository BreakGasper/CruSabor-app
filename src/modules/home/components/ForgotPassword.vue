<template>
  <div class="forgot-password-container">
    <h2>Recuperar contraseña</h2>

    <!-- Formulario (solo si aún no se ha enviado el correo con éxito) -->
    <div v-if="!emailSent">
      <p>Ingresa tu número de teléfono para restablecer tu contraseña</p>
      <p v-if="mensaje" class="mensaje" style="font-size: 12px; color: red">
        {{ mensaje }}
      </p>
      <form @submit.prevent="enviarCodigo">
        <div class="input-telefono">
          <!-- Prefijo visual +52 -->
          <span class="prefijo">+52</span>

          <!-- Input del teléfono -->
          <input
            type="tel"
            v-model="telefono"
            placeholder="Número de teléfono"
            required
          />

          <!-- Icono PNG a la derecha -->
          <img
            src="@/assets/icons/smartphone.png"
            alt="Teléfono"
            class="icono-telefono"
          />
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? "Enviando..." : "Enviar código" }}
        </button>
      </form>
    </div>

    <!-- Mensaje de éxito y entrada de código -->
    <div v-else>
      <div v-if="!resultadoOk">
        <p class="mensaje">📩 Código enviado a tu correo correctamente</p>

        <form @submit.prevent="verificarCodigoIngresado">
          <div
            ref="codigoContainer"
            style="
              display: flex;
              justify-content: center;
              gap: 0.5rem;
              margin-top: 1rem;
            "
          >
            <input
              v-for="(digito, index) in 4"
              :key="index"
              type="text"
              v-model="codigoInputs[index]"
              maxlength="1"
              inputmode="numeric"
              pattern="[0-9]*"
              @input="onInputCodigo(index)"
              style="
                width: 3rem;
                height: 3.5rem;
                text-align: center;
                font-size: 1.5rem;
              "
            />
          </div>

          <button type="submit" style="margin-top: 0.5rem">
            Verificar código
          </button>
        </form>

        <!-- Mensaje de error o resultado -->
        <p v-if="resultado" class="resultado" :class="{ ok: resultadoOk }">
          {{ resultado }}
        </p>
      </div>
      <div v-else>
        <ChangePasswordModal
          :visible="resultadoOk"
          :user-id="usuarioEncontrado?.userId!"
          @close="handleSuccess(true)"
          @success="handleSuccess(false)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import ChangePasswordModal from "./ChangePasswordModal.vue";
import { getEmailByPhone } from "@/composables/useAuth";

const telefono = ref("");
const mensaje = ref("");
const loading = ref(false);
const emailSent = ref(false);
const codigoCorrecto = ref("");
const codigoContainer = ref<HTMLDivElement | null>(null);
const resultado = ref("");
const resultadoOk = ref(false);
const correoUsuario = ref("");
const codigoInputs = ref(["", "", "", ""]);

const usuarioEncontrado = ref<{
  email: string | null;
  valid: boolean;
  userId?: string;
} | null>(null);

const emit = defineEmits<{
  (e: "success", userId: string): void;
  (e: "close"): void;
}>();

// Limitar solo números y 10 dígitos
watch(telefono, (val) => {
  let soloNumeros = val.replace(/\D/g, "");
  if (soloNumeros.length > 10) soloNumeros = soloNumeros.slice(0, 10);
  if (soloNumeros !== val) telefono.value = soloNumeros;
});

const handleSuccess = (isclose: boolean) => {
  if (isclose) {
    emit("close");
    return;
  }
  resultadoOk.value = false;
  emit("success", usuarioEncontrado.value?.userId!);
};
const onInputCodigo = (index: number) => {
  codigoInputs.value[index] = codigoInputs.value[index].replace(/\D/, "");
  if (codigoInputs.value[index] && index < 3) {
    const inputs =
      codigoContainer.value?.querySelectorAll<HTMLInputElement>("input");
    inputs?.[index + 1]?.focus();
  }
};

/**
 * Envía el código al correo asociado al número de teléfono
 */
const enviarCodigo = async () => {
  loading.value = true;
  mensaje.value = "";
  resultado.value = "";
  emailSent.value = false;

  try {
    const res = await getEmailByPhone(telefono.value);

    if (!res.valid || !res.email) {
      mensaje.value = "❌ Número de teléfono no está asociado a una cuenta.";
      loading.value = false;
      return;
    }

    usuarioEncontrado.value = res;
    correoUsuario.value = res.email;

    const codigo = Math.floor(1000 + Math.random() * 9000).toString();
    codigoCorrecto.value = codigo.trim();

    // Enviar correo con el código
    await fetch("http://localhost:3000/recuperar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: correoUsuario.value,
        codigo: codigoCorrecto.value,
      }),
    });

    emailSent.value = true;
  } catch (error) {
    console.error(error);
    mensaje.value = "❌ Error al enviar el código.";
  } finally {
    loading.value = false;
  }
};

const verificarCodigoIngresado = () => {
  const codigoUsuario = codigoInputs.value.join("");
  if (codigoUsuario === codigoCorrecto.value) {
    resultado.value = "✅ Código correcto";
    resultadoOk.value = true;
  } else {
    resultado.value = "❌ Código incorrecto";
    resultadoOk.value = false;
  }
};
</script>

<style scoped>
/* Se mantiene todo igual que tu archivo original */
.forgot-password-container {
  max-width: 360px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.forgot-password-container h2 {
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
  color: var(--color-bg-blue-dark);
}

.forgot-password-container p {
  font-size: 0.9rem;
  color: #555;
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
  border: 1px solid #ccc;
  font-size: 0.95rem;
  outline: none;
}

.forgot-password-container input:focus {
  border-color: var(--color-bg-blue-dark);
}

.forgot-password-container button {
  padding: 0.6rem 0.8rem;
  background: var(--color-bg-blue-dark);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.forgot-password-container button:disabled {
  background: #7ea7f2;
  cursor: not-allowed;
}

.resultado {
  margin-top: 1rem;
  font-weight: bold;
}
.resultado.ok {
  color: green;
}
.resultado:not(.ok) {
  color: red;
}

.input-telefono {
  position: relative;
  display: flex;
  align-items: center;
}

.input-telefono .prefijo {
  position: absolute;
  left: 10px;
  color: #555;
  font-weight: bold;
}

.input-telefono input {
  padding-left: 50px;
  padding-right: 40px;
  border-radius: 8px;
  border: 1px solid #ccc;
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
