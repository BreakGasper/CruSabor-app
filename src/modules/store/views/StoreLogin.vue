<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">Iniciar Sesión</h2>

      <div class="form-group">
        <label>Celular</label>
        <div class="input-with-icon">
          <img
            src="@/assets/icons/smartphone.png"
            alt="Email"
            class="input-icon"
          />
          <input
            v-model="form.username"
            type="tel"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="Ingresa tu número de celular"
            class="form-input"
            maxlength="12"
            required
            @input="formatPhone"
          />
        </div>
        <span v-if="errors.username" class="error-msg">{{
          errors.username
        }}</span>
      </div>

      <div class="form-group">
        <label>Contraseña</label>
        <div class="input-with-icon">
          <img
            src="@/assets/icons/lock.png"
            alt="Contraseña"
            class="input-icon"
          />
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Contraseña"
            maxlength="8"
            minlength="6"
            class="form-input"
          />
          <img
            :src="showPassword ? eyeOffIcon : eyeIcon"
            alt="Mostrar/Ocultar contraseña"
            class="toggle-password-icon"
            @click="showPassword = !showPassword"
          />
        </div>
        <span v-if="errors.password" class="error-msg">{{
          errors.password
        }}</span>
      </div>

      <div class="buttons">
        <button class="btn-primary" @click="login">Entrar</button>
      </div>
      <p class="buttons">
        <button class="btn-outline-blue" @click="goRegister">
          Registrarme
        </button>
      </p>

      <p class="forgot-password">
        ¿Olvidaste tu contraseña? <a href="#">Recuperar</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { findUserByPhone, findUserByPhoneStore } from "@/composables/useAuth";
import { validatePasswordHash } from "@/composables/usePassword";
import router from "@/router";
import { cerrarSesion } from "@/utils/sessionUser";
const form = ref({
  username: "",
  password: "",
});
const showPassword = ref(false);
const eyeIcon = new URL("@/assets/icons/eye.png", import.meta.url).href;
const eyeOffIcon = new URL("@/assets/icons/eye-off.png", import.meta.url).href;

const errors = ref<{ username?: string; password?: string }>({});

function formatPhone(event: Event) {
  const input = event.target as HTMLInputElement;
  let digitsOnly = input.value.replace(/\D/g, "").slice(0, 10); // Solo números y máximo 10

  // Aplica formato 123-456-7890
  let formatted = digitsOnly;
  if (digitsOnly.length > 6) {
    formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(
      3,
      6
    )}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length > 3) {
    formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
  }

  form.value.username = formatted;

  const rawPhoneNumber = form.value.username.replace(/\D/g, ""); // Solo dígitos
  console.log("Número limpio:", rawPhoneNumber);
}
function goRegister() {
  // Aquí puedes navegar a la ruta de registro
  router.push("/store/register"); // Cambia a tu ruta real de registro
}

function validateForm() {
  errors.value = {};
  if (!form.value.username) errors.value.username = "El usuario es obligatorio";
  if (!form.value.password)
    errors.value.password = "La contraseña es obligatoria";

  return Object.keys(errors.value).length === 0;
}

async function login() {
  errors.value = {};

  // Limpiar el teléfono (solo dígitos)
  const rawPhoneNumber = form.value.username.replace(/\D/g, "");

  // Validaciones
  if (!rawPhoneNumber || rawPhoneNumber.length !== 10) {
    errors.value.username = "El número debe tener exactamente 10 dígitos";
  }
  if (!form.value.password || form.value.password.length < 6) {
    errors.value.password = "La contraseña debe tener al menos 6 caracteres";
  }

  if (Object.keys(errors.value).length > 0) {
    return;
  }

  // Buscar usuario por teléfono
  const user = await findUserByPhoneStore(rawPhoneNumber);

  if (!user) {
    errors.value.password = "❌ Usuario no encontrado";
    return;
  }

  // Validar contraseña
  const isValid = await validatePasswordHash(form.value.password, user.password
);

  if (isValid) {
    // Limpiar sesión de usuario normal si existe
    cerrarSesion();
    localStorage.removeItem("usuario");

    localStorage.setItem(
      "tiendas",
      JSON.stringify({
        id: user.id,
        nombre: user.nombreTienda,
        telefono: user.telefono,
        email: user.email,
        domicilio: user.calle,
        colonia: user.colonia,
        municipio: user.municipio,
        codigpostal: user.cp,
        estado: user.estado,
      })
    );
    router.replace("/store/profile");
  } else {
    errors.value.password = "❌ Contraseña incorrecta";
  }
}
</script>

<style scoped>
/* CONTENEDOR */
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #87cefa, #1f70b2);
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

/* CARD */
.login-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  padding: 32px 24px;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 380px;
  text-align: center;
}

/* TITULO */
.login-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 24px;
  color: #1f70b2;
}

/* FORMULARIO */
.form-group {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  text-align: left;
}
.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
}
.form-input {
  padding: 12px 14px 12px 36px;
  border-radius: 12px;
  border: 1px solid #ccc;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
}
.form-input:focus {
  border-color: #1f70b2;
  outline: none;
}
.input-with-icon {
  position: relative;
}
.input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
  z-index: 2;
}
.error-msg {
  color: #d9534f;
  font-size: 0.85rem;
  margin-top: 4px;
}

/* BOTONES */
.buttons {
  margin-top: 16px;
}
.btn-primary {
  width: 100%;
  border: none;
  padding: 12px 0;
  border-radius: 12px;
  background: #1f70b2;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.btn-primary:hover {
  background: #105a8b;
}

/* OLVIDO DE CONTRASEÑA */
.forgot-password {
  margin-top: 16px;
  font-size: 0.85rem;
  color: #333;
}
.forgot-password a {
  color: #1f70b2;
  font-weight: 600;
  text-decoration: none;
}
.forgot-password a:hover {
  text-decoration: underline;
}

.toggle-password-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  cursor: pointer;
  z-index: 2;
}

.btn-outline-blue {
  display: inline-block;
  padding: 10px 24px;
  border: 2px solid #1f70b2; /* borde azul */
  border-radius: 12px; /* borde redondeado */
  background-color: #fff; /* fondo blanco */
  color: #1f70b2; /* texto azul */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
  text-align: center;
  width: 100%;
}

.btn-outline-blue:hover {
  background-color: #1f70b2; /* azul de fondo al pasar el mouse */
  color: #fff; /* texto blanco */
  transform: translateY(-2px); /* ligero efecto hover */
}
</style>
