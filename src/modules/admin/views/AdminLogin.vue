<template>
  <div class="login-container">
    <!-- Volver -->
    <ArrowBack class="btn-icon back" @click="$router.push('/')" />

    <!-- Encabezado -->
    <div class="login-header">
      <div class="admin-emblem" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
          <path d="M9.5 12l2 2 3.5-4" />
        </svg>
      </div>
      <span class="badge">Administración</span>
      <h1 class="title">MAVI - Admin</h1>
      <p class="subtitle">Control de tiendas, membresías y sistema</p>
    </div>

    <!-- Tarjeta -->
    <form class="login-card" novalidate @submit.prevent="login">
      <h2 class="login-title">Acceso restringido</h2>
      <p class="login-hint">Solo personal autorizado</p>

      <!-- Celular -->
      <div class="form-group">
        <label for="admin-phone">Celular</label>
        <div class="telefono-input" :class="{ 'input-error': errors.username }">
          <span class="lada">+52</span>
          <input
            id="admin-phone"
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
        <label for="admin-pass">Contraseña</label>
        <div class="input-with-icon" :class="{ 'input-error': errors.password }">
          <img src="@/assets/icons/lock.png" alt="" class="input-icon" />
          <input
            id="admin-pass"
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
        {{ loading ? 'Validando...' : 'Entrar al panel' }}
      </button>

      <p class="switch-link">
        ¿No eres administrador?
        <a href="#" @click.prevent="$router.push('/login')">Ir al inicio de sesión</a>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import ArrowBack from '@/components/ArrowBack.vue';
import { loginAdmin } from '@/composables/useAdmin';
import { guardarSesionAdmin } from '@/utils/sessionAdmin';
import { cerrarSesion } from '@/utils/sessionUser';
import { RUTA_ADMIN_HOME } from '../adminRoutes';
import eyeIcon from '@/assets/icons/eye.png';
import eyeOffIcon from '@/assets/icons/eye-off.png';

const router = useRouter();

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

const MENSAJES = {
  'no-encontrado': 'No hay un administrador registrado con ese celular.',
  inactivo: 'Esta cuenta de administrador está desactivada.',
  password: 'Celular o contraseña incorrectos.',
} as const;

async function login() {
  errors.general = undefined;
  const okPhone = validatePhone();
  const okPass = validatePassword();
  if (!okPhone || !okPass || loading.value) return;

  loading.value = true;
  try {
    const r = await loginAdmin(soloDigitos(), form.password);
    if (!r.ok) {
      errors.general = MENSAJES[r.motivo];
      return;
    }

    // Una sola sesión activa: al entrar como admin se cierran las de cliente y tienda
    cerrarSesion();
    localStorage.removeItem('tiendas');

    guardarSesionAdmin({
      id: r.admin.id,
      nombre: r.admin.nombre,
      telefono: r.admin.telefono,
      rol: r.admin.rol,
      inicio: new Date().toISOString(),
    });
    router.replace(RUTA_ADMIN_HOME);
  } catch (e) {
    console.error('Error al iniciar sesión de administrador:', e);
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
  background: #111827;
  background-image:
    radial-gradient(circle at 15% 10%, rgba(16, 185, 129, 0.2), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(55, 65, 81, 0.6), transparent 55%);
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
  background: linear-gradient(160deg, #1f2937, #111827 70%);
  border-bottom: 3px solid #10b981;
  border-radius: 0 0 40px 40px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
}
.admin-emblem {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.8rem;
  border-radius: 18px;
  background: linear-gradient(135deg, #34d399, #059669);
  color: #052e16;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
}
.admin-emblem svg {
  width: 36px;
  height: 36px;
}
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.5);
  color: #6ee7b7;
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
  opacity: 0.8;
}

/* Tarjeta */
.login-card {
  width: 90%;
  max-width: 420px;
  margin-top: -1.75rem;
  background: var(--surface);
  padding: 2rem 1.5rem;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  box-sizing: border-box;
}
.login-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  text-align: center;
  margin: 0;
}
.login-hint {
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
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
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
  background: #111827;
  color: #6ee7b7;
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
  background: #d1fae5;
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
.btn-primary {
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
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #047857);
  box-shadow: 0 6px 14px rgba(16, 185, 129, 0.35);
  margin-top: 0.3rem;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
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
  color: var(--text-muted);
}
.switch-link a {
  color: #047857;
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
