<template>
  <div class="login-container">
    <!-- Volver -->
    <ArrowBack class="btn-icon back" @click="$router.back()" />

    <!-- Encabezado -->
    <div class="login-header">
      <div class="user-emblem" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </div>
      <span class="badge">Clientes</span>
      <h1 class="title">MAVI</h1>
      <p class="subtitle">Bienvenido de nuevo 👋</p>
    </div>

    <!-- Tarjeta -->
    <form class="login-card" novalidate @submit.prevent="handleLogin">
      <h2 class="card-title">Iniciar sesión</h2>
      <p class="card-hint">Ingresa con tu número de celular</p>

      <!-- Teléfono -->
      <div class="form-group">
        <label for="telefono">Número de teléfono</label>
        <div class="telefono-input" :class="{ 'has-error': telefonoError }">
          <span class="lada">+52</span>
          <input
            v-model="telefono"
            id="telefono"
            type="tel"
            inputmode="numeric"
            autocomplete="tel-national"
            placeholder="10 dígitos"
            class="form-input telefono-field"
            maxlength="12"
            @input="formatTelefono"
          />
          <img
            src="@/assets/icons/smartphone.png"
            alt=""
            class="input-icon-right"
          />
        </div>
        <small v-if="telefonoError" class="error-text">{{
          telefonoError
        }}</small>
      </div>

      <!-- Contraseña -->
      <div class="form-group">
        <label for="password">Contraseña</label>
        <div class="password-input" :class="{ 'has-error': passwordError }">
          <img src="@/assets/icons/lock.png" alt="" class="input-icon-left" />
          <input
            v-model="password"
            id="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="••••••••"
            class="form-input password-field"
            @input="validatePassword"
          />
          <button
            type="button"
            class="toggle-password"
            :aria-label="
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            "
            @click="showPassword = !showPassword"
          >
            <img :src="showPassword ? eyeOffIcon : eyeIcon" alt="" />
          </button>
        </div>
        <small v-if="passwordError" class="error-text">{{
          passwordError
        }}</small>
      </div>

      <a href="#" class="forgot-link" @click.prevent="forgotPassword"
        >¿Olvidaste tu contraseña?</a
      >

      <!-- Acciones -->
      <button type="submit" class="btn-primary">Entrar</button>

      <button
        type="button"
        class="btn-outline"
        @click="$router.replace('/register')"
      >
        Crear cuenta
      </button>

      <p class="switch-link">
        ¿Tienes una tienda?
        <a href="#" @click.prevent="$router.push('/store/login')"
          >Ingresa aquí</a
        >
      </p>
    </form>

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
import { findUserByPhone } from "@/composables/useAuth";
import ArrowBack from "@/components/ArrowBack.vue";
import router from "@/router";
import { validatePasswordHash } from "@/composables/usePassword";
import ForgotPassword from "./ForgotPassword.vue";
import CustomToast from "@/components/CustomToast.vue";
import { guardarSesion, cerrarSesion } from "@/utils/sessionUser";
import eyeIcon from "@/assets/icons/eye.png";
import eyeOffIcon from "@/assets/icons/eye-off.png";
const telefono = ref("");
const password = ref("");
const telefonoError = ref("");
const passwordError = ref("");
const mostrarForgotPassword = ref(false);
const showPassword = ref(false);
const showToast = ref(false);

/** Solo los dígitos del teléfono (sin guiones) */
const soloDigitos = () => telefono.value.replace(/\D/g, "");

/** Formatea como 123-456-7890 mientras se escribe */
function formatTelefono() {
  const d = soloDigitos().slice(0, 10);
  telefono.value =
    d.length > 6
      ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
      : d.length > 3
        ? `${d.slice(0, 3)}-${d.slice(3)}`
        : d;
  if (telefonoError.value) validateTelefono();
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
  if (soloDigitos().length !== 10) {
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

  const user = await findUserByPhone(soloDigitos());

  if (!user) {
    passwordError.value = "❌ Usuario no encontrado";
    return;
  }
  const isValid = await validatePasswordHash(password.value, user.pass);

  if (isValid) {
    // Limpiar sesión de tienda anterior si existe
    localStorage.removeItem("tiendas");
    cerrarSesion();

    guardarSesion({
      id: user.id,
      nombre: user.nombre,
      telefono: user.celular,
      email: user.email,
      domicilio: user.calleNumero,
      colonia: user.lugar,
      municipio: user.municipio,
      codigpostal: user.codigoPostal,
      estado: user.estado,
    });
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
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #eef4fb;
  background-image:
    radial-gradient(circle at 10% 15%, rgba(1, 101, 216, 0.12), transparent 45%),
    radial-gradient(circle at 90% 85%, rgba(1, 31, 65, 0.1), transparent 50%);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  position: relative;
  padding-bottom: 2rem;
  box-sizing: border-box;
}

.btn-icon.back {
  position: absolute;
  top: 1rem;
  left: 1rem;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  z-index: 5;
}

/* Encabezado */
.login-header {
  width: 100%;
  padding: 3.5rem 1rem 2.5rem;
  text-align: center;
  color: #fff;
  background: linear-gradient(
    150deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  );
  border-radius: 0 0 40px 40px;
  box-shadow: 0 6px 20px rgba(1, 31, 65, 0.25);
  box-sizing: border-box;
}
.user-emblem {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.8rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-emblem svg {
  width: 34px;
  height: 34px;
}
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.45);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 1px;
}
.subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

/* Tarjeta */
.login-card {
  width: 90%;
  max-width: 420px;
  margin-top: -1.75rem;
  background: var(--surface);
  padding: 2rem 1.5rem;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(1, 31, 65, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  box-sizing: border-box;
}
.card-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--brand-navy-text);
  text-align: center;
  margin: 0;
}
.card-hint {
  margin: -0.4rem 0 0.4rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* Campos */
.form-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}
.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-size: 16px; /* evita zoom automático en iOS */
  box-sizing: border-box;
  background: var(--surface);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  border-color: var(--color-bg-blue-ligth);
  box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.15);
}

/* Teléfono con lada */
.telefono-input {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.lada {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--color-bg-blue-dark);
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  flex-shrink: 0;
}
.telefono-field {
  flex: 1;
  padding-right: 40px;
  letter-spacing: 0.5px;
}
.input-icon-right {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
  opacity: 0.7;
}

/* Contraseña */
.password-input {
  position: relative;
  display: flex;
}
.input-icon-left {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
  opacity: 0.7;
}
.password-field {
  flex: 1;
  padding-left: 40px;
  padding-right: 44px;
}
.toggle-password {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.toggle-password:hover {
  background: #eaf2fc;
}
.toggle-password img {
  width: 20px;
  height: 20px;
  display: block;
  opacity: 0.75;
}
/* Oculta el ojo nativo de Edge/IE para no duplicar el botón propio */
.form-input::-ms-reveal,
.form-input::-ms-clear {
  display: none;
}

/* Errores */
.has-error .form-input {
  border-color: #d9534f;
}
.error-text {
  color: #d9534f;
  font-size: 0.82rem;
  margin-top: 5px;
}

/* Enlaces */
.forgot-link {
  align-self: flex-end;
  margin-top: -0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--brand-blue-text);
  text-decoration: none;
}
.forgot-link:hover,
.switch-link a:hover {
  text-decoration: underline;
}
.switch-link {
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.switch-link a {
  color: var(--brand-blue-text);
  font-weight: 600;
  text-decoration: none;
}

/* Botones */
.btn-primary,
.btn-outline {
  width: 100%;
  padding: 13px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  );
  box-shadow: 0 6px 14px rgba(1, 101, 216, 0.3);
}
.btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
}
.btn-outline {
  border: 2px solid var(--color-bg-blue-ligth);
  background: var(--surface);
  color: var(--brand-blue-text);
}
.btn-outline:hover {
  background: var(--color-bg-blue-ligth);
  color: #fff;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  position: relative;
  background: var(--surface);
  border-radius: 16px;
  padding: 2rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}
.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  color: var(--brand-navy-text);
  line-height: 1;
  padding: 0;
  z-index: 10;
}

/* Responsive */
@media (max-width: 480px) {
  .login-header {
    padding: 3.25rem 1rem 2rem;
    border-radius: 0 0 28px 28px;
  }
  .login-card {
    width: calc(100% - 1.5rem);
    padding: 1.5rem 1rem;
    margin-top: -1.25rem;
  }
}
@media (min-width: 900px) {
  .login-container {
    justify-content: center;
    padding: 2rem 1rem;
  }
  .login-header {
    max-width: 480px;
    border-radius: 24px 24px 0 0;
    padding-top: 2.5rem;
  }
  .login-card {
    max-width: 480px;
    width: 100%;
    margin-top: 0;
    border-radius: 0 0 24px 24px;
    padding: 2.25rem 2rem;
  }
  .btn-icon.back {
    top: 1.5rem;
    left: 1.5rem;
  }
}
</style>
