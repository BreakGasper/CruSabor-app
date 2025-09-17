<template>
  <div class="login-container">
    <!-- Botón volver  con SVG -->
    <ArrowBack class="btn-icon back" @click="$router.back()" />
    <!-- Encabezado -->
    <div class="login-header">
      <h1 class="title">MAVI - Store</h1>
      <p class="subtitle">Bienvenido de nuevo 👋</p>
    </div>

    <!-- Tarjeta de login -->
    <div class="login-card">
      <h2 class="card-title">Iniciar sesión</h2>

      <!-- Teléfono -->
      <div class="form-group">
        <label for="telefono">Número de teléfono</label>
        <div class="telefono-input">
          <!-- Prefijo visual +52 -->
          <span class="lada">+52</span>

          <!-- Input del teléfono -->
          <input
            v-model="telefono"
            id="telefono"
            type="tel"
            placeholder="10 dígitos"
            class="form-input telefono-field"
            :class="{ 'input-error': telefonoError }"
            @input="formatTelefono"
            maxlength="10"
          />

          <!-- Icono PNG a la derecha -->
          <img
            src="@/assets/icons/smartphone.png"
            alt="Teléfono"
            class="icono-telefono"
          />
        </div>

        <small v-if="telefonoError" class="error-text">{{
          telefonoError
        }}</small>
      </div>

      <!-- Contraseña -->
      <div class="form-group">
        <label for="password">Contraseña</label>
        <input
          v-model="password"
          id="password"
          type="password"
          placeholder="••••••••"
          class="form-input"
          :class="{ 'input-error': passwordError }"
          @input="validatePassword"
        />
        <small v-if="passwordError" class="error-text">{{
          passwordError
        }}</small>
      </div>

      <!-- Botón login -->
      <Button
        label="Entrar"
        class="modern-button p-button-info mb-3"
        @click="handleLogin"
      />

      <!-- Opciones -->
      <div class="extra-options">
        <a href="#" @click.prevent="forgotPassword"
          >¿Olvidaste tu contraseña?</a
        >
        <p>
          ¿No tienes cuenta?
          <a href="#" @click.prevent="$router.replace('/register')"
            >Regístrate aquí</a
          >
        </p>
      </div>
    </div>

    <!-- Modal ForgotPassword -->
    <div
      v-if="mostrarForgotPassword"
      class="modal-overlay"
      @click.self="mostrarForgotPassword = false"
    >
      <div class="modal-content">
        <!-- Botón cerrar X -->
        <button class="modal-close" @click="mostrarForgotPassword = false">
          ×
        </button>

        <ForgotPassword
          @cerrar="mostrarForgotPassword = false"
          @close="mostrarForgotPassword = false"
          @success="handleCambioContrasena"
        />
      </div>
    </div>

    <CustomToast
      v-if="showToast"
      message="Contraseña Cambiada con Exito"
      type="success"
      :duration="2500"
      @close="showToast = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import { findUserByPhone } from "@/composables/useAuth";
import ArrowBack from "@/components/ArrowBack.vue";
import router from "@/router";
import { validatePasswordHash } from "@/composables/usePassword";
import ForgotPassword from "./ForgotPassword.vue";
import { faL } from "@fortawesome/free-solid-svg-icons";
import CustomToast from "@/components/CustomToast.vue";
const telefono = ref("");
const password = ref("");
const telefonoError = ref("");
const passwordError = ref("");
const mostrarForgotPassword = ref(false);
const showToast = ref(false);

function formatTelefono() {
  // quitar caracteres que no son dígitos y limitar a 10
  telefono.value = telefono.value.replace(/\D/g, "").slice(0, 10);
  validateTelefono();
}
const handleCambioContrasena = () => {
  // Cierra ForgotPassword
  mostrarForgotPassword.value = false;

  // Mostrar toast con retraso
  setTimeout(() => {
    showToast.value = true;
  }, 500); // medio segundo de retraso
};

// 🔹 Validar teléfono (solo números y 10 dígitos)
function validateTelefono() {
  if (!/^\d{10}$/.test(telefono.value)) {
    telefonoError.value = "El número debe tener exactamente 10 dígitos";
  } else {
    telefonoError.value = "";
  }
}

// 🔹 Validar contraseña (mínimo 6 caracteres por ejemplo)
function validatePassword() {
  if (!password.value || password.value.length < 6) {
    passwordError.value = "La contraseña debe tener al menos 6 caracteres";
  } else {
    passwordError.value = "";
  }
}

async function handleLogin() {
  validateTelefono();
  validatePassword();

  if (telefonoError.value || passwordError.value) {
    return; // no sigue si hay errores
  }

  const user = await findUserByPhone(telefono.value);

  if (!user) {
    passwordError.value = "❌ Usuario no encontrado";
    return;
  }
  const isValid = await validatePasswordHash(password.value, user.pass);

  if (isValid) {
    localStorage.setItem(
      "usuario",
      JSON.stringify({
        id: user.id,
        nombre: user.nombre,
        telefono: user.celular,
        email: user.email,
        domicilio: user.calleNumero,
        colonia: user.lugar,
        municipio: user.municipio,
        codigpostal: user.codigoPostal,
        estado: user.estado,
      })
    );
    router.replace("/");
    // Redirigir
  } else {
    passwordError.value = "❌ Contraseña incorrecta";
  }
}

function forgotPassword() {
  // abrir modal
  mostrarForgotPassword.value = true;
}
</script>

<style scoped>
.btn-icon {
  position: absolute;
  top: 1rem;
  background: white;
  border: none;
  border-radius: 50%;
  padding: 0.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
.btn-icon.back {
  border-radius: 30%;
  width: 40px;
  height: 40px;
  left: 1rem;
  top: 1rem;
  width: 40px; /* tamaño del botón */
  height: 40px;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-icon.back svg {
  width: 50%; /* escala el SVG respecto al botón */
  height: 50%;
}

.login-container {
  background: #f8f9fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-header {
  width: 100%;
  text-align: center;
  padding: 2rem 1rem;
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  );
  color: white;
  border-radius: 0 0 40px 40px;
  margin-bottom: 2rem;
}

.title {
  font-size: 1.6rem;
  font-weight: bold;
}

.subtitle {
  font-size: 1rem;
  margin-top: 0.3rem;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-title {
  text-align: center;
  margin-bottom: 1rem;
  font-weight: bold;
  font-size: 1.6rem;
  color: var(--color-bg-blue-ligth);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.lada {
  background: green;
  padding: 0.6rem 0.8rem;
  border-radius: 12px;
  font-size: 1rem;
  border: 1px solid #ddd;
  color: white;
}

.telefono-field {
  flex: 1;
}

.form-input {
  padding: 0.8rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  font-size: 1rem;
  outline: none;
  transition: border 0.3s ease;
}

.form-input:focus {
  border-color: var(--color-bg-blue-dark);
}

.extra-options {
  text-align: center;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.extra-options a {
  color: var(--color-bg-blue-dark);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.extra-options a:hover {
  text-decoration: underline;
}

.modern-button {
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  ); /* degradado azul */
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
  padding: 0.8rem 2rem;
  border-radius: 16px;
  width: 100%; /* ocupa todo el ancho de la tarjeta */
  transition: all 0.3s ease;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.modern-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.modern-button:active {
  transform: translateY(0);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.input-error {
  border: 1px solid red !important;
}

.error-text {
  color: red;
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Botón X cerrar modal */
.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  color: var(--color-bg-blue-dark);
  line-height: 1;
  padding: 0;
  z-index: 10;
}

.modal-content {
  position: relative; /* necesario para que la X se posicione correctamente */
  background: white;
  border-radius: 16px;
  padding: 2rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.telefono-input {
  display: flex;
  align-items: center;
  position: relative;
  gap: 0.5rem;
}

/* +52 separado del input */
.telefono-input .lada {
  display: flex;
  align-items: center;
  justify-content: center;
  background: green;
  color: white;
  font-weight: bold;
  padding: 0 0.8rem;
  height: 2.6rem; /* igual altura que el input */
  border-radius: 3px 16px 16px 3px; /* solo redondea las esquinas derechas */
  border: 1px solid #ddd;
  font-size: 1rem;
}

/* Input del teléfono */
.telefono-input input {
  flex: 1;
  border-radius: 12px 0 0 12px; /* solo esquinas izquierdas redondeadas */
  border: 1px solid #ddd;
  padding-left: 0.8rem;
  height: 2.6rem;
  font-size: 1rem;
}

/* Icono a la derecha dentro del input */
.telefono-input .icono-telefono {
  position: absolute;
  right: 10px;
  width: 24px;
  height: 24px;
}

.telefono-input input:focus {
  border-color: var(--color-bg-blue-dark);
}
</style>
