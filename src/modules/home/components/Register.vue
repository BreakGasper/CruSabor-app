<template>
  <div class="register-container">
    <div class="register-header">
      <h1 class="title">Registrarme</h1>
      <p class="subtitle">Crea tu cuenta en segundos ✨</p>
      <p class="step-indicator">Paso {{ step }} / 4</p>
    </div>

    <div class="register-card">
      <!-- Botón volver  con SVG -->
      <ArrowBack class="btn-icon back" @click="$router.back()" />
      <!-- Paso 1: Datos personales -->
      <div v-if="step === 1">
        <h2 class="card-title">Datos personales</h2>

        <!-- Nombre -->
        <div class="form-group">
          <label for="nombre">Nombre completo</label>
          <input
            v-model="nombre"
            id="nombre"
            type="text"
            class="form-input"
            :class="{ 'input-error': errors.nombre }"
            maxlength="50"
            placeholder="Ej. Daniela Buenrostro"
          />
          <small v-if="errors.nombre" class="error-text">{{
            errors.nombre
          }}</small>
        </div>

        <!-- Email -->
        <div class="form-group">
          <label for="email">Correo electrónico</label>
          <input
            v-model="email"
            id="email"
            type="email"
            class="form-input"
            :class="{ 'input-error': errors.email }"
            maxlength="100"
            placeholder="ejemplo@correo.com"
          />
          <small v-if="errors.email" class="error-text">{{
            errors.email
          }}</small>
        </div>

        <!-- Fecha de nacimiento -->
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

        <!-- Género -->
        <div class="form-group">
          <label>Género</label>
          <div class="gender-options">
            <div
              v-for="option in genderOptions"
              :key="option.value"
              class="gender-option"
              :class="{
                selected: genero === option.value,
                'input-error': errors.genero,
              }"
              @click="genero = option.value"
            >
              <img :src="option.icon" :alt="option.label" class="gender-icon" />
              <div class="gender-letter">{{ option.value }}</div>
            </div>
          </div>
          <small v-if="errors.genero" class="error-text">{{
            errors.genero
          }}</small>
        </div>

        <Button
          label="Siguiente"
          class="modern-button"
          style="margin-top: 20px"
          @click="nextStep"
        />
      </div>

      <!-- Paso 2: Domicilio -->
      <div v-if="step === 2">
        <h2 class="card-title">Domicilio</h2>

        <!-- Calle y Número en la misma fila -->
        <div class="form-group row-calle-numero">
          <label style="position: absolute; top: 0px; left: 20">Calle</label>
          <input
            v-model="calle"
            id="calle"
            type="text"
            class="form-input input-calle"
            :class="{ 'input-error': errors.calle }"
            maxlength="50"
            placeholder="Calle"
          />
          <label style="position: absolute; top: 0px; right: 0px">Número</label>
          <input
            v-model="numero"
            id="numero"
            type="text"
            class="form-input input-numero"
            :class="{ 'input-error': errors.numero }"
            maxlength="50"
            placeholder="Num."
            inputmode="numeric"
            @input="onNumeroInput"
          />
        </div>
        <!-- Colonia y Código Postal en la misma fila -->
        <div class="form-group row-colonia-cp">
          <label style="position: absolute; top: 0; left: 0">Colonia</label>
          <input
            v-model="lugar"
            id="lugar"
            type="text"
            class="form-input input-colonia"
            :class="{ 'input-error': errors.lugar }"
            maxlength="50"
            placeholder="Ej. Camajapita"
          />
          <label style="position: absolute; top: 0; right: 0px">C.P.</label>
          <input
            v-model="codigoPostal"
            id="codigoPostal"
            type="text"
            class="form-input input-cp"
            :class="{ 'input-error': errors.codigoPostal }"
            maxlength="5"
            placeholder="45100"
            inputmode="numeric"
            @input="onCodigoPostalInput"
          />
        </div>
        <small v-if="errors.lugar || errors.codigoPostal" class="error-text">
          {{ errors.lugar || errors.codigoPostal }}
        </small>

        <!-- Municipio -->
        <div class="form-group">
          <label for="municipio">Municipio</label>
          <input
            v-model="municipio"
            id="municipio"
            type="text"
            class="form-input"
            :class="{ 'input-error': errors.municipio }"
            maxlength="30"
            placeholder="Ej. Zapopan"
          />
          <small v-if="errors.municipio" class="error-text">{{
            errors.municipio
          }}</small>
        </div>

        <!-- Estado -->
        <div class="form-group">
          <label for="estado">Estado</label>
          <input
            v-model="estado"
            id="estado"
            type="text"
            class="form-input"
            :class="{ 'input-error': errors.estado }"
            maxlength="20"
            placeholder="Ej. Jalisco"
          />
          <small v-if="errors.estado" class="error-text">{{
            errors.estado
          }}</small>
        </div>

        <div class="button-row">
          <Button
            label="Anterior"
            class="modern-button secondary"
            @click="prevStep"
          />
          <Button label="Siguiente" class="modern-button" @click="nextStep" />
        </div>
      </div>

      <!-- Paso 3: Contacto y contraseña -->
      <div v-if="step === 3">
        <h2 class="card-title">Contacto y contraseña</h2>

        <!-- Teléfono -->
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
              @input="onTelefonoInput"
            />
          </div>
          <small v-if="errors.telefono" class="error-text">{{
            errors.telefono
          }}</small>
        </div>

        <!-- Contraseña -->
        <div class="form-group" style="margin-top: 10px">
          <label for="password">Contraseña</label>
          <input
            v-model="password"
            id="password"
            type="password"
            class="form-input"
            :class="{ 'input-error': errors.password }"
            maxlength="10"
            placeholder="Máx. 10 caracteres"
          />
          <small v-if="errors.password" class="error-text">{{
            errors.password
          }}</small>
        </div>

        <div class="button-row">
          <Button
            label="Anterior"
            class="modern-button secondary"
            @click="prevStep"
          />
          <Button label="Siguiente" class="modern-button" @click="nextStep" />
        </div>
      </div>

      <!-- Paso 4: Foto de perfil y términos -->
      <div v-if="step === 4">
        <h2 class="card-title">Foto de perfil y términos</h2>

        <!-- Avatar circular con click para seleccionar archivo -->
        <div class="form-group" style="align-items: center">
          <label>Foto de perfil (opcional)</label>
          <div class="avatar-upload" @click="triggerFileInput">
            <img
              :src="fotoPreview || defaultAvatar"
              alt="Foto de perfil"
              class="avatar-img"
            />
            <div class="avatar-overlay">
              <span>📷</span>
            </div>
          </div>
          <input
            type="file"
            ref="fileInput"
            @change="handleFileChange"
            accept="image/*"
            style="display: none"
          />
        </div>

        <!-- Checkbox de términos -->
        <div class="form-group">
          <label class="terms-label">
            <input type="checkbox" v-model="aceptaTerminos" />
            Acepto los <a href="#" target="_blank">Términos y Privacidad</a>
          </label>
        </div>

        <!-- Botones -->
        <div class="button-row">
          <Button
            label="Anterior"
            class="modern-button secondary"
            @click="prevStep"
          />
          <Button
            label="Crear cuenta"
            class="modern-button"
            @click="handleRegister"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import Button from "primevue/button";
import { saveUser, findUserByPhone, type Usuario } from "@/composables/useAuth";
import { useRouter } from "vue-router";
import GFemale from "@/assets/icons/g-female.png";
import GMale from "@/assets/icons/g-male.png";
import GOther from "@/assets/icons/g-other.png";
import AvatarIcon from "@/assets/icons/user_back_profile.png";
import { uploadUserImage } from "@/composables/useStorage";
import ArrowBack from "@/components/ArrowBack.vue";
const router = useRouter();
const step = ref(1);

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
  } else if (password.value.length > 10) {
    errors.password = "Máx. 10 caracteres";
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
    alert("⚠️ Debes aceptar los términos y privacidad");
    return;
  }

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
    pass: password.value,
    tipo: "client",
    token: "",
    aceptoTerminos: true,
  };

  await saveUser(nuevoUsuario);
  router.replace("/login");
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

/* Estilos generales */
.register-container {
  background: #f8f9fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.register-header {
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
.step-indicator {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  color: #fff;
}

.register-card {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-title {
  text-align: center;
  margin-bottom: 1rem;
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--color-bg-blue-ligth);
  padding-bottom: 0.5rem;
}
.card-title::after {
  content: "";
  display: block;
  width: 100%; /* línea de ancho completo */
  height: 1px; /* grosor de la línea */
  background-color: #ccc; /* color gris */
  margin-top: 0.5rem; /* separación entre texto y línea */
  border-radius: 1px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.row {
  display: flex;
  gap: 0.5rem;
}
.row .col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-error {
  border-color: red !important;
}
.error-text {
  color: red;
  font-size: 0.8rem;
  margin-top: 2px;
}

.gender-options {
  display: flex;
  gap: 1rem;
  justify-content: center;
}
.gender-option {
  cursor: pointer;
  border-radius: 12px;
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: grayscale(1);
  border: 2px solid transparent;
  transition: all 0.2s;
}
.gender-option.selected {
  filter: none;
  border-color: var(--color-bg-blue-dark);
  background-color: rgba(0, 0, 0, 0.05);
}
.gender-icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
  margin-bottom: 4px;
}
.gender-letter {
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
}

.telefono-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.lada {
  background: gray;
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

.button-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 1rem;
}
.modern-button {
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  );
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
  padding: 0.8rem 2rem;
  border-radius: 16px;
  width: 100%;
  transition: all 0.3s ease;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}
.modern-button.secondary {
  background: #ddd;
  color: #333;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.modern-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}
.modern-button:active {
  transform: translateY(0);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.row-calle-numero {
  position: relative;
  height: 60px; /* Ajusta según el alto de tus inputs */
  margin-bottom: 1rem;
}

.input-calle {
  position: absolute;
  left: 0;
  width: 70%; /* Calle ocupa más espacio */
  top: 25px;
}

.input-numero {
  position: absolute;
  right: 0;
  width: 25%; /* Número ocupa menos */
  top: 25px;
}

.avatar-upload {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eee; /* fondo gris */
  transition: transform 0.2s;
}
.avatar-upload:hover {
  transform: scale(1.05);
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
  color: #555;
  background: rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 1.5rem;
  border-radius: 50%;
}
.avatar-upload:hover .avatar-overlay {
  opacity: 1;
}

.terms-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
.terms-label a {
  color: var(--color-bg-blue-dark);
  text-decoration: underline;
}

.row-colonia-cp {
  position: relative;
  height: 60px; /* Ajusta según el alto de tus inputs */
  margin-bottom: 1rem;
}

.input-colonia {
  position: absolute;
  left: 0;
  width: 70%; /* Colonia ocupa más espacio */
  top: 25px;
}

.input-cp {
  position: absolute;
  right: 0;
  width: 25%; /* Código Postal ocupa menos */
  top: 25px;
}
</style>
