<template>
  <div class="register-container">
    <!-- Volver -->
    <TopBarFija titulo="Crear cuenta" @back="$router.back()" />

    <!-- Encabezado -->
    <div class="register-header">
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
          <path d="M19 3v4M17 5h4" />
        </svg>
      </div>
      <span class="badge">Clientes</span>
      <h1 class="title">Crea tu cuenta</h1>
      <p class="step-indicator">Paso {{ step }} de 4 · {{ stepTitles[step - 1] }}</p>
      <div
        class="progress-bar"
        role="progressbar"
        :aria-valuenow="step"
        aria-valuemin="1"
        aria-valuemax="4"
      >
        <div class="progress" :style="{ width: `${(step / 4) * 100}%` }"></div>
      </div>
    </div>

    <!-- Tarjeta -->
    <form class="register-card" novalidate @submit.prevent="onSubmit">
      <!-- Paso 1: Datos personales -->
      <div v-if="step === 1" class="step">
        <h2 class="card-title">Datos personales</h2>

        <div class="form-group">
          <label for="nombre">Nombre completo</label>
          <input
            v-model="nombre"
            id="nombre"
            type="text"
            class="form-input"
            :class="{ 'input-error': errors.nombre }"
            maxlength="50"
            autocomplete="name"
            placeholder="Ej. Daniela Buenrostro"
          />
          <small v-if="errors.nombre" class="error-text">{{
            errors.nombre
          }}</small>
        </div>

        <div class="form-group">
          <label for="email">Correo electrónico</label>
          <div class="input-with-icon">
            <img src="@/assets/icons/email.png" alt="" class="input-icon" />
            <input
              v-model="email"
              id="email"
              type="email"
              class="form-input with-icon"
              :class="{ 'input-error': errors.email }"
              maxlength="100"
              autocomplete="email"
              placeholder="ejemplo@correo.com"
            />
          </div>
          <small v-if="errors.email" class="error-text">{{
            errors.email
          }}</small>
        </div>

        <div class="form-group">
          <label for="fechaNacimiento">Fecha de nacimiento</label>
          <input
            v-model="fechaNacimiento"
            id="fechaNacimiento"
            type="date"
            class="form-input"
            :class="{ 'input-error': errors.fechaNacimiento }"
            @input="onFechaNacimientoInput"
          />
          <small v-if="errors.fechaNacimiento" class="error-text">{{
            errors.fechaNacimiento
          }}</small>
        </div>

        <div class="form-group">
          <label>Género</label>
          <div class="gender-options">
            <button
              v-for="option in genderOptions"
              :key="option.value"
              type="button"
              class="gender-option"
              :class="{
                selected: genero === option.value,
                'input-error': errors.genero,
              }"
              @click="genero = option.value"
            >
              <img
                loading="lazy"
                :src="option.icon"
                :alt="option.label"
                class="gender-icon"
              />
              <span class="gender-label">{{ option.label }}</span>
            </button>
          </div>
          <small v-if="errors.genero" class="error-text">{{
            errors.genero
          }}</small>
        </div>

        <div class="button-row">
          <button type="submit" class="btn-primary">Siguiente</button>
        </div>
      </div>

      <!-- Paso 2: Domicilio -->
      <div v-if="step === 2" class="step">
        <h2 class="card-title">Domicilio</h2>

        <div class="address-grid">
          <div class="form-group col-large">
            <label for="calle">Calle</label>
            <div class="input-with-icon">
              <img src="@/assets/icons/street.png" alt="" class="input-icon" />
              <input
                v-model="calle"
                id="calle"
                type="text"
                class="form-input with-icon"
                :class="{ 'input-error': errors.calle }"
                maxlength="50"
                autocomplete="address-line1"
                placeholder="Calle"
              />
            </div>
            <small v-if="errors.calle" class="error-text">{{
              errors.calle
            }}</small>
          </div>

          <div class="form-group col-small">
            <label for="numero">Número</label>
            <input
              v-model="numero"
              id="numero"
              type="text"
              class="form-input"
              :class="{ 'input-error': errors.numero }"
              maxlength="50"
              placeholder="Núm."
              inputmode="numeric"
              @input="onNumeroInput"
            />
            <small v-if="errors.numero" class="error-text">{{
              errors.numero
            }}</small>
          </div>

          <div class="form-group col-large">
            <label for="lugar">Colonia</label>
            <div class="input-with-icon">
              <img src="@/assets/icons/colonia.png" alt="" class="input-icon" />
              <input
                v-model="lugar"
                id="lugar"
                type="text"
                class="form-input with-icon"
                :class="{ 'input-error': errors.lugar }"
                maxlength="50"
                placeholder="Ej. Camajapita"
              />
            </div>
            <small v-if="errors.lugar" class="error-text">{{
              errors.lugar
            }}</small>
          </div>

          <div class="form-group col-small">
            <label for="codigoPostal">C.P.</label>
            <input
              v-model="codigoPostal"
              id="codigoPostal"
              type="text"
              class="form-input"
              :class="{ 'input-error': errors.codigoPostal }"
              maxlength="5"
              placeholder="45100"
              inputmode="numeric"
              autocomplete="postal-code"
              @input="onCodigoPostalInput"
            />
            <small v-if="errors.codigoPostal" class="error-text">{{
              errors.codigoPostal
            }}</small>
          </div>

          <div class="form-group col-full">
            <label for="municipio">Municipio</label>
            <div class="input-with-icon">
              <img
                src="@/assets/icons/municipio.png"
                alt=""
                class="input-icon"
              />
              <input
                v-model="municipio"
                id="municipio"
                type="text"
                class="form-input with-icon"
                :class="{ 'input-error': errors.municipio }"
                maxlength="30"
                autocomplete="address-level2"
                placeholder="Ej. Zapopan"
              />
            </div>
            <small v-if="errors.municipio" class="error-text">{{
              errors.municipio
            }}</small>
          </div>

          <div class="form-group col-full">
            <label for="estado">Estado</label>
            <div class="input-with-icon">
              <img src="@/assets/icons/estado.png" alt="" class="input-icon" />
              <input
                v-model="estado"
                id="estado"
                type="text"
                class="form-input with-icon"
                :class="{ 'input-error': errors.estado }"
                maxlength="20"
                autocomplete="address-level1"
                placeholder="Ej. Jalisco"
              />
            </div>
            <small v-if="errors.estado" class="error-text">{{
              errors.estado
            }}</small>
          </div>
        </div>

        <div class="button-row">
          <button type="button" class="btn-outline" @click="prevStep">
            Anterior
          </button>
          <button type="submit" class="btn-primary">Siguiente</button>
        </div>
      </div>

      <!-- Paso 3: Contacto y contraseña -->
      <div v-if="step === 3" class="step">
        <h2 class="card-title">Contacto y contraseña</h2>

        <div class="form-group">
          <label for="telefono">Número de teléfono</label>
          <div class="telefono-input">
            <span class="lada">+52</span>
            <input
              v-model="telefono"
              id="telefono"
              type="tel"
              class="form-input telefono-field"
              :class="{ 'input-error': errors.telefono }"
              maxlength="10"
              placeholder="10 dígitos"
              inputmode="numeric"
              autocomplete="tel-national"
              @input="onTelefonoInput"
            />
            <img
              src="@/assets/icons/smartphone.png"
              alt=""
              class="input-icon-right"
            />
          </div>
          <small v-if="errors.telefono" class="error-text">{{
            errors.telefono
          }}</small>
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <div class="password-input">
            <img src="@/assets/icons/lock.png" alt="" class="input-icon" />
            <input
              v-model="password"
              id="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input password-field"
              :class="{ 'input-error': errors.password }"
              :maxlength="PASSWORD_MAX"
              autocomplete="new-password"
              :placeholder="`Máx. ${PASSWORD_MAX} caracteres`"
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
          <small v-if="errors.password" class="error-text">{{
            errors.password
          }}</small>
        </div>

        <div class="button-row">
          <button type="button" class="btn-outline" @click="prevStep">
            Anterior
          </button>
          <button type="submit" class="btn-primary">Siguiente</button>
        </div>
      </div>

      <!-- Paso 4: Foto de perfil y términos -->
      <div v-if="step === 4" class="step">
        <h2 class="card-title">Foto de perfil y términos</h2>

        <div class="form-group avatar-group">
          <label>Foto de perfil (opcional)</label>
          <div class="avatar-upload" @click="triggerFileInput">
            <img
              loading="lazy"
              :src="fotoPreview || defaultAvatar"
              alt="Foto de perfil"
              class="avatar-img"
            />
            <div class="avatar-overlay">
              <span>📷</span>
            </div>
          </div>
          <span class="avatar-hint">Toca para elegir una imagen</span>
          <input
            type="file"
            ref="fileInput"
            @change="handleFileChange"
            accept="image/*"
            class="hidden-input"
          />
        </div>

        <div class="form-group">
          <label class="terms-label" :class="{ 'terms-error': termsError }">
            <input type="checkbox" v-model="aceptaTerminos" />
            <span>
              Acepto los
              <a href="#" target="_blank">Términos y Privacidad</a>
            </span>
          </label>
          <small v-if="termsError" class="error-text">{{ termsError }}</small>
        </div>

        <div class="button-row">
          <button type="button" class="btn-outline" @click="prevStep">
            Anterior
          </button>
          <button type="submit" class="btn-primary">Crear cuenta</button>
        </div>
      </div>

      <p class="switch-link">
        ¿Ya tienes cuenta?
        <a href="#" @click.prevent="$router.replace('/login')">Inicia sesión</a>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { saveUser, findUserByPhone, type Usuario } from "@/composables/useAuth";
import { useRouter } from "vue-router";
import GFemale from "@/assets/icons/g-female.png";
import GMale from "@/assets/icons/g-male.png";
import GOther from "@/assets/icons/g-other.png";
import AvatarIcon from "@/assets/icons/user_back_profile.png";
import { uploadUserImage } from "@/composables/useStorage";
import TopBarFija from "@/components/TopBarFija.vue";
import { hashPassword, errorLongitudPassword, PASSWORD_MAX } from "@/composables/usePassword";
import eyeIcon from "@/assets/icons/eye.png";
import eyeOffIcon from "@/assets/icons/eye-off.png";
const router = useRouter();
const step = ref(1);
const stepTitles = ["Datos personales", "Domicilio", "Contacto", "Perfil"];
const showPassword = ref(false);
const termsError = ref("");

const fileInput = ref<HTMLInputElement | null>(null);
const fotoPreview = ref<string | null>(null);
const defaultAvatar = new URL(AvatarIcon, import.meta.url).href;

// Campos de usuario
const nombre = ref("");
const email = ref("");
const telefono = ref("");
const password = ref("");
const fechaNacimiento = ref("");
const genero = ref("");
const foto = ref<File | null>(null);

const calle = ref("");
const numero = ref("");
const lugar = ref("");
const municipio = ref("");
const codigoPostal = ref("");
const estado = ref("");

const aceptaTerminos = ref(false);

const errors = reactive({
  nombre: "",
  email: "",
  fechaNacimiento: "",
  genero: "",
  calle: "",
  numero: "",
  lugar: "",
  municipio: "",
  codigoPostal: "",
  estado: "",
  telefono: "",
  password: "",
});

// Género
const genderOptions = [
  {
    value: "M",
    label: "Masculino",
    icon: new URL(GMale, import.meta.url).href,
  },
  {
    value: "F",
    label: "Femenino",
    icon: new URL(GFemale, import.meta.url).href,
  },
  { value: "O", label: "Otro", icon: new URL(GOther, import.meta.url).href },
];

function triggerFileInput() {
  fileInput.value?.click();
}
//Solo numeros input
function onCodigoPostalInput(event: Event) {
  const target = event.target as HTMLInputElement;
  codigoPostal.value = target.value.replace(/\D/g, "");
}

function onNumeroInput(event: Event) {
  const target = event.target as HTMLInputElement;
  numero.value = target.value.replace(/\D/g, "");
}
function onTelefonoInput(event: Event) {
  const target = event.target as HTMLInputElement;
  telefono.value = target.value.replace(/\D/g, "");
}

// Validaciones
function validateStep1() {
  let valid = true;

  errors.nombre = nombre.value ? "" : "El nombre es obligatorio";
  if (!nombre.value) valid = false;

  errors.email = email.value ? "" : "El correo es obligatorio";
  if (!email.value) valid = false;

  if (!fechaNacimiento.value) {
    errors.fechaNacimiento = "La fecha de nacimiento es obligatoria";
    valid = false;
  } else {
    const fecha = new Date(fechaNacimiento.value);
    const hoy = new Date();
    const diff = hoy.getFullYear() - fecha.getFullYear();
    if (
      diff < 15 ||
      (diff === 15 &&
        hoy < new Date(fecha.setFullYear(fecha.getFullYear() + 15)))
    ) {
      errors.fechaNacimiento = "Debes tener al menos 15 años";
      valid = false;
    } else {
      errors.fechaNacimiento = "";
    }
  }

  errors.genero = genero.value ? "" : "Selecciona un género";
  if (!genero.value) valid = false;

  return valid;
}

function validateStep2() {
  let valid = true;

  errors.calle = calle.value ? "" : "La calle es obligatoria";
  if (calle.value && calle.value.length > 50) {
    errors.calle = "Máx. 50 caracteres";
    valid = false;
  }

  errors.numero = numero.value ? "" : "El número es obligatorio";
  if (numero.value && numero.value.length > 50) {
    errors.numero = "Máx. 50 caracteres";
    valid = false;
  }

  errors.lugar = lugar.value ? "" : "La colonia es obligatoria";
  if (lugar.value && lugar.value.length > 50) {
    errors.lugar = "Máx. 50 caracteres";
    valid = false;
  }
  if (!lugar.value) {
    errors.lugar = "La colonia es obligatoria";
    valid = false; // <--- esto asegura que no avanza
  } else if (lugar.value.length > 50) {
    errors.lugar = "Máx. 50 caracteres";
    valid = false;
  } else {
    errors.lugar = "";
  }

  errors.municipio = municipio.value ? "" : "El municipio es obligatorio";
  if (municipio.value && municipio.value.length > 30) {
    errors.municipio = "Máx. 30 caracteres";
    valid = false;
  }

  const cpRegex = /^[0-9]{5}$/;
  if (!codigoPostal.value) {
    errors.codigoPostal = "El código postal es obligatorio";
    valid = false;
  } else if (!cpRegex.test(codigoPostal.value)) {
    errors.codigoPostal = "Sólo 5 números";
    valid = false;
  } else {
    errors.codigoPostal = "";
  }

  errors.estado = estado.value ? "" : "El estado es obligatorio";
  if (estado.value && estado.value.length > 20) {
    errors.estado = "Máx. 20 caracteres";
    valid = false;
  }

  return valid;
}

async function validateStep3() {
  let valid = true;

  const phoneRegex = /^[0-9]{10}$/;
  if (!telefono.value) {
    errors.telefono = "El teléfono es obligatorio";
    valid = false;
  } else if (!phoneRegex.test(telefono.value)) {
    errors.telefono = "Debes ingresar 10 números";
    valid = false;
  } else {
    // Verificar si el número ya existe
    const existente = await findUserByPhone(telefono.value);
    if (existente) {
      errors.telefono = "⚠️ Ese número ya está registrado";
      valid = false;
    } else {
      errors.telefono = "";
    }
  }

  if (!password.value) {
    errors.password = "La contraseña es obligatoria";
    valid = false;
  } else if (errorLongitudPassword(password.value)) {
    errors.password = errorLongitudPassword(password.value)!;
    valid = false;
  } else {
    errors.password = "";
  }

  return valid;
}

// Navegación
async function nextStep() {
  let valid = false;
  if (step.value === 1) valid = validateStep1();
  if (step.value === 2) valid = validateStep2();
  if (step.value === 3) valid = await validateStep3(); // <-- async

  if (!valid) return; // no avanza si hay error
  step.value = Math.min(step.value + 1, 4);
}
function onFechaNacimientoInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.value; // Formato: "YYYY-MM-DD"

  if (value.length > 10) {
    target.value = value.slice(0, 10); // máximo 10 caracteres (YYYY-MM-DD)
  }

  // También puedes asegurarte que el año tenga máximo 4 dígitos
  const partes = value.split("-");
  if (partes[0] && partes[0].length > 4) {
    partes[0] = partes[0].slice(0, 4);
    target.value = partes.join("-");
  }

  fechaNacimiento.value = target.value;
}

function prevStep() {
  step.value = Math.max(step.value - 1, 1);
}

// Enter / botón principal: avanza o registra según el paso
async function onSubmit() {
  if (step.value < 4) await nextStep();
  else await handleRegister();
}

// Foto
function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      fotoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // guardar también en tu ref principal
    foto.value = file;
  }
}

// Registro
async function handleRegister() {
  if (!aceptaTerminos.value) {
    termsError.value = "Debes aceptar los términos y privacidad";
    return;
  }
  termsError.value = "";

  const existente = await findUserByPhone(telefono.value);
  if (existente) {
    alert("⚠️ Ese número ya está registrado en otra cuenta.");
    return;
  }

  const id = Date.now().toString();
  let fotoURL = "";
  if (foto.value) {
    fotoURL = await uploadUserImage(foto.value, id); // sube y obtiene URL
  }
  const encrypted = await hashPassword(password.value);
  const nuevoUsuario: Usuario = {
    id,
    nombre: nombre.value,
    email: email.value,
    celular: telefono.value,
    calleNumero: calle.value + " #" + numero.value,
    lugar: lugar.value,
    municipio: municipio.value,
    codigoPostal: codigoPostal.value,
    estado: estado.value,
    fechaNacimiento: fechaNacimiento.value,
    genero: genero.value,
    pass: encrypted,
    tipo: "client",
    token: "",
    aceptoTerminos: true,
  };

  await saveUser(nuevoUsuario);
  router.replace("/login"); //login usuario normal
}
</script>

<style scoped>
.register-container {
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
.register-header {
  width: 100%;
  padding: 3.5rem 1rem 2rem;
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
  width: 56px;
  height: 56px;
  margin: 0 auto 0.7rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-emblem svg {
  width: 30px;
  height: 30px;
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
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
}
.step-indicator {
  margin: 0.3rem 0 0;
  font-size: 0.9rem;
  opacity: 0.9;
}
.progress-bar {
  height: 6px;
  max-width: 320px;
  margin: 1rem auto 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}
.progress {
  height: 100%;
  background: var(--surface);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Tarjeta */
.register-card {
  width: 90%;
  max-width: 460px;
  margin-top: -1.5rem;
  background: var(--surface);
  padding: 2rem 1.5rem;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(1, 31, 65, 0.12);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--brand-navy-text);
  margin: 0 0 1.2rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid #e8f0fa;
}

/* Campos */
.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.1rem;
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
  font-family: inherit;
  box-sizing: border-box;
  background: var(--surface);
  color: var(--text);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  border-color: var(--color-bg-blue-ligth);
  box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.15);
}
.input-error {
  border-color: #d9534f !important;
}
.error-text {
  color: #d9534f;
  font-size: 0.82rem;
  margin-top: 5px;
}

/* Inputs con icono */
.input-with-icon,
.password-input {
  position: relative;
  display: flex;
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
  z-index: 2;
}
.with-icon {
  padding-left: 42px;
}

/* Domicilio */
.address-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  column-gap: 12px;
}
.address-grid .form-group {
  min-width: 0;
}
.col-large {
  grid-column: span 8;
}
.col-small {
  grid-column: span 4;
}
.col-full {
  grid-column: span 12;
}

/* Género */
.gender-options {
  display: flex;
  gap: 10px;
}
.gender-option {
  flex: 1;
  cursor: pointer;
  border-radius: 12px;
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 2px solid var(--border);
  font-family: inherit;
  filter: grayscale(1);
  transition: all 0.2s;
}
.gender-option:hover {
  border-color: var(--color-bg-blue-ligth);
}
.gender-option.selected {
  filter: none;
  border-color: var(--color-bg-blue-ligth);
  background: #eaf2fc;
}
.gender-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.gender-label {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text);
}

/* Teléfono */
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
.password-field {
  flex: 1;
  padding-left: 42px;
  padding-right: 46px;
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

/* Avatar */
.avatar-group {
  align-items: center;
  text-align: center;
}
.hidden-input {
  display: none;
}
.avatar-upload {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid #eaf2fc;
  box-shadow: 0 4px 12px rgba(1, 31, 65, 0.15);
  background: var(--surface-2);
  transition: transform 0.2s;
}
.avatar-upload:hover {
  transform: scale(1.04);
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(1, 31, 65, 0.35);
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 1.6rem;
}
.avatar-upload:hover .avatar-overlay {
  opacity: 1;
}
.avatar-hint {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Términos */
.terms-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-size: 0.9rem;
  font-weight: 500 !important;
  cursor: pointer;
  margin-bottom: 0 !important;
}
.terms-label input[type="checkbox"] {
  accent-color: var(--color-bg-blue-ligth);
  width: 18px;
  height: 18px;
  margin-top: 1px;
  flex-shrink: 0;
  cursor: pointer;
}
.terms-label.terms-error {
  border-color: #d9534f;
}
.terms-label a {
  color: var(--brand-blue-text);
  font-weight: 600;
  text-decoration: underline;
}

/* Botones */
.button-row {
  display: flex;
  gap: 10px;
  margin-top: 0.5rem;
}
.button-row button {
  flex: 1;
}
.btn-primary,
.btn-outline {
  padding: 13px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
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
.btn-outline {
  border: 2px solid var(--color-bg-blue-ligth);
  background: var(--surface);
  color: var(--brand-blue-text);
}
.btn-outline:hover {
  background: var(--color-bg-blue-ligth);
  color: #fff;
}

.switch-link {
  margin: 1.2rem 0 0;
  text-align: center;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.switch-link a {
  color: var(--brand-blue-text);
  font-weight: 600;
  text-decoration: none;
}
.switch-link a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 480px) {
  .register-header {
    padding: 3.25rem 1rem 1.75rem;
    border-radius: 0 0 28px 28px;
  }
  .register-card {
    width: calc(100% - 1.5rem);
    padding: 1.5rem 1rem;
    margin-top: -1.25rem;
  }
  .col-large {
    grid-column: span 7;
  }
  .col-small {
    grid-column: span 5;
  }
}
@media (min-width: 900px) {
  .register-container {
    padding: 2rem 1rem;
  }
  .register-header {
    max-width: 520px;
    border-radius: 24px 24px 0 0;
    padding-top: 2.5rem;
  }
  .register-card {
    max-width: 520px;
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
