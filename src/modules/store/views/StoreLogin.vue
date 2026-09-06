<template>
  <div class="login-container">
    <!-- Volver -->
    <ArrowBack class="btn-icon back" @click="$router.push('/')" />

    <!-- Encabezado -->
    <div class="login-header">
      <div class="store-emblem" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M5 11v9h14v-9" />
          <path d="M9 20v-5h6v5" />
        </svg>
      </div>
      <span class="badge">Panel de tiendas</span>
      <h1 class="title">MAVI - Store</h1>
      <p class="subtitle">Administra tus productos y pedidos</p>
    </div>

    <!-- Tarjeta -->
    <form class="login-card" novalidate @submit.prevent="login">
      <h2 class="login-title">Acceso para tiendas</h2>
      <p class="login-hint">Ingresa con el celular registrado de tu negocio</p>

      <!-- Celular -->
      <div class="form-group">
        <label for="store-phone">Celular de la tienda</label>
        <div class="telefono-input" :class="{ 'input-error': errors.username }">
          <span class="lada">+52</span>
          <input
            id="store-phone"
            v-model="form.username"
            type="tel"
            inputmode="numeric"
            autocomplete="tel-national"
            placeholder="10 dígitos"
            class="form-input telefono-field"
            maxlength="12"
            @input="formatPhone"
            @blur="validatePhone"
          />
          <img
            src="@/assets/icons/smartphone.png"
            alt=""
            class="input-icon-right"
          />
        </div>
        <span v-if="errors.username" class="error-msg">{{
          errors.username
        }}</span>
      </div>

      <!-- Contraseña -->
      <div class="form-group">
        <label for="store-pass">Contraseña</label>
        <div class="input-with-icon" :class="{ 'input-error': errors.password }">
          <img src="@/assets/icons/lock.png" alt="" class="input-icon" />
          <input
            id="store-pass"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="••••••••"
            class="form-input with-left-icon"
            @blur="validatePassword"
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
        <span v-if="errors.password" class="error-msg">{{
          errors.password
        }}</span>
      </div>

      <!-- Error general -->
      <p v-if="errors.general" class="error-banner">{{ errors.general }}</p>

      <!-- Acciones -->
      <button type="submit" class="btn-primary" :disabled="loading">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? 'Validando...' : 'Entrar' }}
      </button>

      <button
        v-if="registroTiendasAbierto"
        type="button"
        class="btn-outline-blue"
        :disabled="loading"
        @click="goRegister"
      >
        Registrar mi tienda
      </button>

      <p class="switch-link">
        ¿Eres cliente?
        <a href="#" @click.prevent="$router.push('/login')">Ingresa aquí</a>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import ArrowBack from '@/components/ArrowBack.vue';
import { findUserByPhoneStore } from '@/composables/useAuth';
import { validatePasswordHash } from '@/composables/usePassword';
import { cerrarSesion } from '@/utils/sessionUser';
import eyeIcon from '@/assets/icons/eye.png';
import eyeOffIcon from '@/assets/icons/eye-off.png';
import { useConfiguracion } from '@/composables/useConfiguracion';

const router = useRouter();
const { registroTiendasAbierto } = useConfiguracion();

const form = reactive({ username: '', password: '' });
const errors = reactive<{
  username?: string;
  password?: string;
  general?: string;
}>({});
const showPassword = ref(false);
const loading = ref(false);


const soloDigitos = () => form.username.replace(/\D/g, '');

/** Formatea como 123-456-7890 mientras se escribe */
function formatPhone() {
  const d = soloDigitos().slice(0, 10);
  form.username =
    d.length > 6
      ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
      : d.length > 3
        ? `${d.slice(0, 3)}-${d.slice(3)}`
        : d;
  if (errors.username) validatePhone();
  errors.general = undefined;
}

function validatePhone() {
  const d = soloDigitos();
  errors.username = !d
    ? 'El celular es obligatorio'
    : d.length !== 10
      ? 'El número debe tener exactamente 10 dígitos'
      : undefined;
  return !errors.username;
}

function validatePassword() {
  errors.password = !form.password
    ? 'La contraseña es obligatoria'
    : form.password.length < 6
      ? 'La contraseña debe tener al menos 6 caracteres'
      : undefined;
  return !errors.password;
}

function goRegister() {
  router.push('/store/register');
}

async function login() {
  errors.general = undefined;
  const okPhone = validatePhone();
  const okPass = validatePassword();
  if (!okPhone || !okPass || loading.value) return;

  loading.value = true;
  try {
    const tienda = await findUserByPhoneStore(soloDigitos());
    if (!tienda) {
      errors.general = 'No encontramos una tienda registrada con ese celular.';
      return;
    }

    const valida = await validatePasswordHash(
      form.password,
      tienda.password || '',
    );
    if (!valida) {
      errors.general = 'Celular o contraseña incorrectos.';
      return;
    }

    // Una sola sesión activa: al entrar como tienda se cierra la de cliente
    cerrarSesion();

    localStorage.setItem(
      'tiendas',
      JSON.stringify({
        id: tienda.id,
        nombre: tienda.nombreTienda,
        nombreTienda: tienda.nombreTienda,
        telefono: tienda.telefono,
        email: tienda.email,
        domicilio: tienda.calle,
        colonia: tienda.colonia,
        municipio: tienda.municipio,
        codigpostal: tienda.cp,
        estado: tienda.estado,
      }),
    );
    router.replace('/store/profile');
  } catch (e) {
    console.error('Error al iniciar sesión de tienda:', e);
    errors.general = 'Ocurrió un error al iniciar sesión. Intenta de nuevo.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0f1c2e;
  background-image:
    radial-gradient(circle at 15% 10%, rgba(245, 158, 11, 0.18), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(1, 101, 216, 0.25), transparent 50%);
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
  background: #fff;
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
  background: linear-gradient(160deg, #1b2f4b, #0f1c2e 70%);
  border-bottom: 3px solid #f59e0b;
  border-radius: 0 0 40px 40px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}
.store-emblem {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.8rem;
  border-radius: 18px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #0f1c2e;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);
}
.store-emblem svg {
  width: 36px;
  height: 36px;
}
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #fbbf24;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.title {
  font-size: 1.7rem;
  font-weight: 700;
  margin: 0;
}
.subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.95rem;
  opacity: 0.95;
}

/* Tarjeta */
.login-card {
  width: 90%;
  max-width: 420px;
  margin-top: -1.75rem;
  background: #fff;
  padding: 2rem 1.5rem;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  box-sizing: border-box;
}
.login-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f1c2e;
  text-align: center;
  margin: 0;
}
.login-hint {
  margin: -0.4rem 0 0.4rem;
  text-align: center;
  font-size: 0.85rem;
  color: #5b6472;
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
  color: #333;
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #ccc;
  font-size: 16px; /* evita zoom automático en iOS */
  box-sizing: border-box;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
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
  background: #0f1c2e;
  color: #fbbf24;
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
.input-with-icon {
  position: relative;
}
.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
  opacity: 0.7;
}
.with-left-icon {
  padding-left: 40px;
  padding-right: 44px;
}
.toggle-password {
  padding: 0;
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.toggle-password:hover {
  background: #fef3c7;
}
/* Oculta el ojo nativo de Edge/IE para no duplicar el botón propio */
.form-input::-ms-reveal,
.form-input::-ms-clear {
  display: none;
}
.toggle-password img {
  width: 20px;
  height: 20px;
  display: block;
  opacity: 0.75;
}

/* Errores */
.input-error .form-input {
  border-color: #d9534f;
}
.error-msg {
  color: #d9534f;
  font-size: 0.82rem;
  margin-top: 5px;
}
.error-banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffebee;
  border: 1px solid #f5c2c0;
  color: #b71c1c;
  font-size: 0.88rem;
  text-align: center;
}

/* Botones */
.btn-primary,
.btn-outline-blue {
  width: 100%;
  padding: 13px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary {
  border: none;
  color: #fff;
  color: #0f1c2e;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 6px 14px rgba(245, 158, 11, 0.35);
  margin-top: 0.3rem;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.btn-primary:disabled,
.btn-outline-blue:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.btn-outline-blue {
  border: 2px solid #0f1c2e;
  background: #fff;
  color: #0f1c2e;
}
.btn-outline-blue:hover:not(:disabled) {
  background: #0f1c2e;
  color: #fff;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(15, 28, 46, 0.3);
  border-top-color: #0f1c2e;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.switch-link {
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 0.88rem;
  color: #555;
}
.switch-link a {
  color: #0165d8;
  font-weight: 600;
  text-decoration: none;
}
.switch-link a:hover {
  text-decoration: underline;
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
