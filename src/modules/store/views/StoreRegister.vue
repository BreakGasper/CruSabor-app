<template>
  <div class="wizard-container">
    <!-- ENCABEZADO -->
    <div class="wizard-header">
      <ArrowBack class="btn-icon back" @click="$router.back()" />
      <h2 class="header-title">Registro de Tienda</h2>
      <p class="step-indicator">Paso {{ step }} de 5</p>
      <div class="progress-bar">
        <div class="progress" :style="{ width: `${(step - 1) * 25}%` }"></div>
      </div>
    </div>

    <!-- CARD -->
    <div class="wizard-card">
      <!-- PASO 1 -->
      <div v-if="step === 1" class="wizard-step">
        <h3 class="step-title">Información básica</h3>

        <div class="form-group">
          <label>Nombre de la tienda</label>
          <input v-model="form.nombreTienda" type="text" class="form-input" />
          <span v-if="errors.nombreTienda" class="error-msg">{{
            errors.nombreTienda
          }}</span>
        </div>

        <div class="form-group" style="position: relative">
          <label>Categoría</label>

          <!-- Contenedor del select + icono -->
          <div class="select-container">
            <img
              v-if="form.categoria"
              :src="categorias.find((c) => c.id === form.categoria)?.icono"
              alt="icono"
              class="icono-select"
            />
            <select
              v-model="form.categoria"
              class="form-input select-with-icon"
            >
              <option disabled value="">Selecciona...</option>
              <option
                v-for="categoria in categorias"
                :key="categoria.id"
                :value="categoria.id"
              >
                {{ categoria.nombre }}
              </option>
            </select>
          </div>

          <span v-if="errors.categoria" class="error-msg">
            {{ errors.categoria }}
          </span>
        </div>

        <div class="form-group">
          <label>Descripción breve</label>
          <textarea v-model="form.descripcion" class="form-input"></textarea>
          <span v-if="errors.descripcion" class="error-msg">{{
            errors.descripcion
          }}</span>
        </div>
        <!-- CONTRASEÑA -->
        <div class="form-group">
          <label>Contraseña</label>
          <div class="input-with-icon password-input">
            <img
              src="@/assets/icons/lock.png"
              alt="Contraseña"
              class="input-icon"
            />
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="form.password"
              placeholder="Crea tu contraseña"
              class="form-input"
              maxlength="8"
              minlength="6"
            />
            <span class="toggle-password" @click="showPassword = !showPassword">
              {{ showPassword ? "🙈" : "👁️" }}
            </span>
          </div>
          <span v-if="errors.password" class="error-msg">{{
            errors.password
          }}</span>
        </div>

        <div class="form-group">
          <label>Confirmar contraseña</label>
          <div class="input-with-icon password-input">
            <img
              src="@/assets/icons/lock.png"
              alt="Confirmar Contraseña"
              class="input-icon"
            />
            <input
              :type="showPasswordConfirm ? 'text' : 'password'"
              v-model="form.confirmPassword"
              placeholder="Confirma tu contraseña"
              class="form-input"
              maxlength="8"
              minlength="6"
            />
            <span
              class="toggle-password"
              @click="showPasswordConfirm = !showPasswordConfirm"
            >
              {{ showPasswordConfirm ? "🙈" : "👁️" }}
            </span>
          </div>
          <span v-if="errors.confirmPassword" class="error-msg">{{
            errors.confirmPassword
          }}</span>
        </div>

        <!-- BANNER -->
        <div class="form-group">
          <label>Portada | Banner</label>
          <div class="banner-upload" @click="triggerBanner">
            <template v-if="!bannerPreview">
              <span class="add-banner">+</span>
            </template>
            <img
              v-else
              :src="bannerPreview"
              alt="Banner preview"
              class="banner-preview"
            />
          </div>
          <input
            ref="bannerInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleBannerChange"
          />
          <span v-if="errors.banner" class="error-msg">{{
            errors.banner
          }}</span>
        </div>

        <!-- LOGOTIPO -->
        <div class="form-group">
          <label>Logotipo</label>
          <div class="logo-upload" @click="triggerLogo">
            <!-- Si no hay logo, mostrar + -->
            <template v-if="!logoPreview">
              <span class="add-logo">+</span>
            </template>

            <!-- Si hay logo, mostrar la preview -->
            <img
              v-else
              :src="logoPreview"
              alt="Vista previa"
              class="logo-preview"
            />
          </div>
          <input
            ref="logoInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleLogoChange"
          />
          <span v-if="errors.logo" class="error-msg">{{ errors.logo }}</span>
        </div>

        <div class="buttons">
          <button class="btn-primary" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- PASO 2: DOMICILIO CON AUTOCOMPLETADO -->
      <div v-if="step === 2" class="wizard-step">
        <h3 class="step-title">Domicilio</h3>

        <div class="form-group address-group">
          <!-- CALLE -->
          <div class="col-large">
            <label for="calle">Calle</label>
            <div class="input-with-icon">
              <img
                src="@/assets/icons/street.png"
                alt="Calle"
                class="input-icon"
              />
              <input
                id="calle"
                v-model="form.calle"
                type="text"
                placeholder="Calle"
                class="form-input"
              />
            </div>
            <span v-if="errors.calle" class="error-msg">{{
              errors.calle
            }}</span>
          </div>

          <!-- NÚMERO -->
          <div class="col-small">
            <label for="numero">Número</label>
            <div class="input-with-icon">
              <img
                src="@/assets/icons/number_house.png"
                alt="Número"
                class="input-icon"
              />
              <input
                id="numero"
                v-model="form.numero"
                type="text"
                placeholder="Número"
                class="form-input"
              />
            </div>
            <span v-if="errors.numero" class="error-msg">{{
              errors.numero
            }}</span>
          </div>
          <!-- MUNICIPIO -->
          <div class="full-width" style="position: relative">
            <label for="municipio">Municipio</label>
            <div class="input-with-icon">
              <img
                src="@/assets/icons/municipio.png"
                alt="Municipio"
                class="input-icon"
              />
              <input
                id="municipio"
                v-model="form.municipio"
                @focus="mostrarListaMunicipios = true"
                type="text"
                autocomplete="off"
                placeholder="Selecciona municipio"
                class="form-input"
              />
            </div>
            <ul
              v-if="mostrarListaMunicipios && municipiosFiltrados.length"
              class="autocomplete-list"
            >
              <li
                v-for="m in municipiosFiltrados"
                :key="m.id"
                @click="seleccionarMunicipio(m)"
              >
                {{ m.municipio }}
              </li>
            </ul>
            <span v-if="errors.municipio" class="error-msg">{{
              errors.municipio
            }}</span>
          </div>

          <!-- PUEBLO / Colonia-->
          <div class="col-large" style="position: relative">
            <label for="pueblo">Pueblo / Colonia</label>

            <div class="input-with-icon">
              <img
                src="@/assets/icons/colonia.png"
                alt="Pueblo"
                class="input-icon"
              />
              <input
                id="pueblo"
                v-model="puebloSeleccionado"
                type="text"
                placeholder="Selecciona pueblo"
                class="form-input"
                :disabled="puebloDisabled"
                @focus="mostrarListaPueblos = true"
                autocomplete="off"
                @input="
                  pueblosFiltrados = pueblos.filter((p) =>
                    p.toLowerCase().includes(puebloSeleccionado.toLowerCase())
                  )
                "
              />
            </div>
            <ul
              v-if="mostrarListaPueblos && pueblosFiltrados.length"
              class="autocomplete-list"
            >
              <li
                v-for="p in pueblosFiltrados"
                :key="p"
                @click="seleccionarPueblo(p)"
              >
                {{ p }}
              </li>
            </ul>
            <span v-if="errors.colonia" class="error-msg">{{
              errors.colonia
            }}</span>
          </div>

          <!-- CÓDIGO POSTAL -->
          <div class="col-small">
            <label for="cp">C.P.</label>
            <div class="input-with-icon">
              <img src="@/assets/icons/cp.png" alt="C.P." class="input-icon" />
              <input
                id="cp"
                v-model="form.cp"
                type="tel"
                placeholder="C.P."
                maxlength="5"
                minlength="5"
                class="form-input"
                @input="form.cp = form.cp.replace(/\D/g, '')"
              />
            </div>
            <span v-if="errors.cp" class="error-msg">{{ errors.cp }}</span>
          </div>

          <!-- ESTADO -->
          <div class="full-width">
            <label for="estado">Estado</label>
            <div class="input-with-icon">
              <img
                src="@/assets/icons/estado.png"
                alt="Estado"
                class="input-icon"
              />
              <input
                id="estado"
                v-model="form.estado"
                type="text"
                placeholder="Estado"
                class="form-input"
                readonly
              />
            </div>
            <span v-if="errors.estado" class="error-msg">{{
              errors.estado
            }}</span>
          </div>
        </div>

        <!-- BOTONES -->
        <div class="buttons">
          <button class="btn-secondary" @click="prevStep">Atrás</button>
          <button class="btn-primary" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- PASO 3 -->
      <div v-if="step === 3" class="wizard-step">
        <h3 class="step-title">Datos de contacto</h3>

        <div class="form-group">
          <label>Email</label>
          <div class="input-with-icon">
            <img
              src="@/assets/icons/email.png"
              alt="Email"
              class="input-icon"
            />
            <input v-model="form.email" type="email" class="form-input" />
          </div>
          <span v-if="errors.email" class="error-msg">{{ errors.email }}</span>
        </div>

        <div class="form-group">
          <label>Teléfono</label>
          <div class="input-with-icon">
            <img
              src="@/assets/icons/smartphone.png"
              alt="Teléfono"
              class="input-icon"
            />
            <input
              v-model="form.telefono"
              type="tel"
              class="form-input"
              maxlength="10"
              minlength="10"
              pattern="[0-9]{10}"
              required
              @input="
                form.telefono = form.telefono.replace(/\D/g, '').slice(0, 10)
              "
            />
          </div>
          <div class="checkbox-with-icon">
            <input type="checkbox" v-model="form.incluyeWhatsapp" />
            <img
              src="@/assets/icons/whatsapp.png"
              alt="WhatsApp"
              class="wa-icon"
            />
            <span>Incluye WhatsApp</span>
          </div>
          <span v-if="errors.telefono" class="error-msg">{{
            errors.telefono
          }}</span>
        </div>

        <div class="form-group">
          <label>Redes sociales</label>
          <div class="input-with-icon">
            <img
              src="@/assets/icons/facebook.png"
              alt="Facebook"
              class="input-icon"
            />
            <input
              v-model="form.facebook"
              type="text"
              placeholder="Facebook"
              class="form-input"
            />
          </div>

          <div class="input-with-icon">
            <img
              src="@/assets/icons/instagram.png"
              alt="Instagram"
              class="input-icon"
            />
            <input
              v-model="form.instagram"
              type="text"
              placeholder="Instagram"
              class="form-input"
            />
          </div>
        </div>

        <div class="buttons">
          <button class="btn-secondary" @click="prevStep">Atrás</button>
          <button class="btn-primary" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- PASO 4 -->
      <div v-if="step === 4" class="wizard-step">
        <h3 class="step-title">Información de venta</h3>

        <!-- MÉTODOS DE PAGO -->
        <div class="form-group">
          <label>Métodos de pago</label>
          <div class="payment-options">
            <label class="payment-option">
              <input
                type="checkbox"
                v-model="form.metodosPago"
                value="Efectivo"
              />
              <img
                src="@/assets/icons/money.png"
                alt="Efectivo"
                class="payment-icon"
              />
              Efectivo
            </label>
            <label class="payment-option">
              <input
                type="checkbox"
                v-model="form.metodosPago"
                value="Tarjeta"
              />
              <img
                src="@/assets/icons/card_pay.png"
                alt="Tarjeta"
                class="payment-icon"
              />
              Tarjeta
            </label>
            <label class="payment-option">
              <input
                type="checkbox"
                v-model="form.metodosPago"
                value="Transferencia"
              />
              <img
                src="@/assets/icons/trasfer.png"
                alt="Transferencia"
                class="payment-icon"
              />
              Transferencia
            </label>
          </div>
          <span v-if="errors.metodosPago" class="error-msg">{{
            errors.metodosPago
          }}</span>
        </div>

        <!-- ENVÍOS A DOMICILIO -->
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="form.envioDomicilio" />
            Ofrezco envíos a domicilio
          </label>
        </div>

        <div v-if="form.envioDomicilio" class="form-group">
          <label for="zona">Ingresar zonas de entrega</label>
          <div class="input-with-button" style="position: relative">
            <input
              id="zona"
              v-model="zonaSeleccionada"
              type="text"
              placeholder="Ej. Crucero"
              class="form-input"
              @focus="mostrarListaZonas = true"
              autocomplete="off"
              @keyup.enter="agregarZona"
            />
            <button
              type="button"
              class="btn-add"
              :disabled="!agregarZonaHabilitada"
              @click="agregarZona"
            >
              Agregar
            </button>

            <ul
              v-if="mostrarListaZonas && pueblosZonaFiltrados.length"
              class="autocomplete-list"
            >
              <li
                v-for="p in pueblosZonaFiltrados"
                :key="p"
                @click="seleccionarZona(p)"
              >
                {{ p }}
              </li>
            </ul>
          </div>

          <!-- Lista de zonas -->
          <ul class="zona-list">
            <li
              v-for="(zona, index) in form.zonasEntrega"
              :key="index"
              class="zona-item"
            >
              {{ zona }}
              <button
                type="button"
                class="remove-zona"
                @click="eliminarZona(index)"
              >
                ✕
              </button>
            </li>
          </ul>
        </div>

        <!-- HORARIO -->
        <div class="form-group">
          <label>Horario</label>
          <div v-for="dia in diasSemana" :key="dia" class="day-schedule">
            <strong>{{ dia }}:</strong>
            <input
              type="time"
              v-model="form.horario[dia].inicio"
              @change="updateMinEndTime(dia)"
            />
            <span>a</span>
            <input
              type="time"
              v-model="form.horario[dia].fin"
              :min="minEndTime[dia]"
            />
          </div>
          <span v-if="errors.horario" class="error-msg">{{
            errors.horario
          }}</span>
        </div>

        <div class="buttons">
          <button class="btn-secondary" @click="prevStep">Atrás</button>
          <button class="btn-primary" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- PASO 5 -->
      <div v-if="step === 5" class="wizard-step">
        <h3 class="step-title">Extras</h3>
        <div class="form-group">
          <label>Comparte consejos o noticias de tu tienda</label>
          <textarea v-model="form.blog" class="form-input"></textarea>
        </div>
        <div class="form-group">
          <label>Galería (máx. 3 imágenes)</label>

          <div class="gallery-upload">
            <!-- Mostrar imágenes seleccionadas -->
            <div
              v-for="(img, i) in galleryPreview"
              :key="i"
              class="gallery-item"
            >
              <img :src="img" alt="Imagen" />
            </div>

            <!-- Cuadro para añadir más imágenes, solo si hay menos de 3 -->
            <div
              v-if="galleryPreview.length < 3"
              class="gallery-item add-image"
              @click="triggerGallery"
            >
              <span>+</span>
            </div>
          </div>

          <input
            ref="galleryInput"
            type="file"
            multiple
            accept="image/*"
            class="hidden-input"
            @change="handleGallery"
          />
        </div>

        <div class="buttons">
          <button class="btn-secondary" @click="prevStep">Atrás</button>
          <button class="btn-success" @click="submitStore">Finalizar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ArrowBack from "@/components/ArrowBack.vue";
import { ref, reactive, watch, computed, onMounted } from "vue";
import { useTiendas } from "@/composables/useTiendas";
import { hashPassword } from "@/composables/usePassword";
import router from "@/router";
import {
  obtenerMunicipios,
  obtenerPueblosPorMunicipio,
  obtenerTodosPueblos,
} from "@/composables/useLugar";
import type { MunicipioData } from "@/composables/useLugar";
import {
  obtenerCategorias,
  type CategoriaData,
} from "@/composables/useCategorias";
const step = ref(1);
const showPassword = ref(false);
const showPasswordConfirm = ref(false);

const categorias = ref<CategoriaData[]>([]);
const categoriaSeleccionada = ref("");
const mostrarListaCategorias = ref(false);

const form = ref({
  nombreTienda: "",
  categoria: "",
  descripcion: "",
  email: "",
  telefono: "",
  calle: "",
  numero: "",
  colonia: "",
  cp: "",
  municipio: "",
  estado: "",
  facebook: "",
  instagram: "",
  productos: "",
  metodosPago: [] as string[],
  envioDomicilio: false,
  zonasEntrega: [] as string[],
  horario: {} as Record<string, { inicio: string; fin: string }>,
  faq: "",
  certificaciones: "",
  blog: "",
  logo: null as File | null,
  gallery: [] as File[],
  incluyeWhatsapp: false,
  password: "",
  categoriaId: "",
  banner: null as File | null,
  confirmPassword: "",
});

// ------------------- BANNER -------------------
const bannerPreview = ref<string | null>(null);
const bannerInput = ref<HTMLInputElement | null>(null);
function triggerBanner() {
  bannerInput.value?.click();
}
function handleBannerChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    form.value.banner = target.files[0];
    bannerPreview.value = URL.createObjectURL(target.files[0]);
  }
}
// ------------------- MUNICIPIOS Y PUEBLOS EN TIEMPO REAL -------------------
const municipios = ref<MunicipioData[]>([]);
const municipiosFiltrados = ref<MunicipioData[]>([]);
const pueblos = ref<string[]>([]);
const pueblosFiltrados = ref<string[]>([]);

const municipioSeleccionado = ref<MunicipioData | null>(null);
const puebloSeleccionado = ref("");
const mostrarListaMunicipios = ref(false);
const mostrarListaPueblos = ref(false);
const puebloDisabled = ref(false);

const todosPueblos = ref<string[]>([]);
const pueblosZonaFiltrados = ref<string[]>([]);
const zonaSeleccionada = ref("");
const mostrarListaZonas = ref(false);
const agregarZonaHabilitada = ref(false);

// Seleccionar municipio y escuchar pueblos en tiempo real
async function seleccionarMunicipio(m: MunicipioData) {
  municipioSeleccionado.value = m;
  form.value.municipio = m.municipio;
  form.value.estado = m.estado;
  municipiosFiltrados.value = [];
  mostrarListaMunicipios.value = false;

  // Obtener pueblos
  pueblos.value = await obtenerPueblosPorMunicipio(m.municipio);
  pueblosFiltrados.value = [...pueblos.value];
  puebloSeleccionado.value = "";
  form.value.colonia = "";

  // Municipio válido → habilitar pueblo y quitar error
  errors.value.municipio = "";
  puebloDisabled.value = false;
}

function seleccionarPueblo(pueblo: string) {
  puebloSeleccionado.value = pueblo;
  form.value.colonia = pueblo;
  pueblosFiltrados.value = [];
  mostrarListaPueblos.value = false;

  puebloDisabled.value = true;
}

// ------------------- HORARIO -------------------
const diasSemana = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const minEndTime = reactive<Record<string, string>>({});
diasSemana.forEach((dia) => (minEndTime[dia] = "00:00"));
form.value.horario = diasSemana.reduce((acc, dia) => {
  acc[dia] = { inicio: "", fin: "" };
  return acc;
}, {} as Record<string, { inicio: string; fin: string }>);

function updateMinEndTime(dia: string) {
  const inicio = form.value.horario[dia].inicio;
  if (inicio) {
    const [h, m] = inicio.split(":").map(Number);
    const date = new Date();
    date.setHours(h);
    date.setMinutes(m + 1);
    minEndTime[dia] = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  } else minEndTime[dia] = "00:00";
}

// ------------------- LOGO Y GALERÍA -------------------
const logoPreview = ref<string | null>(null);
const logoInput = ref<HTMLInputElement | null>(null);
const galleryPreview = ref<string[]>([]);
const galleryInput = ref<HTMLInputElement | null>(null);

function triggerLogo() {
  logoInput.value?.click();
}
function handleLogoChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    form.value.logo = target.files[0];
    logoPreview.value = URL.createObjectURL(target.files[0]);
  }
}
function triggerGallery() {
  galleryInput.value?.click();
}
function handleGallery(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    const newFiles = Array.from(target.files).slice(
      0,
      3 - form.value.gallery.length
    );
    form.value.gallery.push(...newFiles);
    galleryPreview.value = form.value.gallery.map((f) =>
      URL.createObjectURL(f)
    );
  }
}

// ------------------- ZONAS DE ENTREGA -------------------
const nuevaZona = ref("");
function seleccionarZona(z: string) {
  zonaSeleccionada.value = z;
  agregarZonaHabilitada.value = true;
  mostrarListaZonas.value = false;
}

function agregarZona() {
  if (agregarZonaHabilitada.value && zonaSeleccionada.value.trim() !== "") {
    form.value.zonasEntrega.push(zonaSeleccionada.value.trim());
    zonaSeleccionada.value = "";
    agregarZonaHabilitada.value = false;
  }
}

function eliminarZona(index: number) {
  form.value.zonasEntrega.splice(index, 1);
}
// ------------------- VALIDACIÓN Y PASOS -------------------
const { crearTienda, telefonoExiste } = useTiendas();
const errors = ref<any>({});

async function validateStep() {
  errors.value = {};
  if (step.value === 1) {
    if (!form.value.nombreTienda)
      errors.value.nombreTienda = "El nombre es obligatorio";

    if (!form.value.categoria)
      errors.value.categoria = "Seleccione una categoría";

    if (!form.value.descripcion)
      errors.value.descripcion = "La descripción es obligatoria";

    if (!form.value.logo) errors.value.logo = "Debe subir un logotipo";

    if (!form.value.password)
      errors.value.password = "La contraseña es obligatoria";
    else if (form.value.password.length < 6)
      errors.value.password = "La contraseña debe tener al menos 6 caracteres";

    if (!form.value.confirmPassword)
      errors.value.confirmPassword = "Confirme su contraseña";
    else if (form.value.password !== form.value.confirmPassword)
      errors.value.confirmPassword = "Las contraseñas no coinciden";
  }
  if (step.value === 2) {
    // Validaciones existentes
    if (!form.value.calle) errors.value.calle = "La calle es obligatoria";
    if (!form.value.numero) errors.value.numero = "El número es obligatorio";
    if (!form.value.colonia)
      errors.value.colonia = "El pueblo/colonia es obligatorio";
    if (!form.value.cp) errors.value.cp = "El código postal es obligatorio";
    else if (form.value.cp.replace(/\D/g, "").length !== 5)
      errors.value.cp = "El código postal debe tener 5 dígitos";
    if (!form.value.estado) errors.value.estado = "El estado es obligatorio";

    // --- VALIDACIÓN DE MUNICIPIO ---
    const municipioValido = municipios.value.some(
      (m) => m.municipio.toLowerCase() === form.value.municipio.toLowerCase()
    );
    if (!municipioValido) {
      errors.value.municipio = "Municipio no válido";
      puebloDisabled.value = true;
    }

    // --- VALIDACIÓN DE PUEBLO / COLONIA ---
    if (form.value.colonia && !pueblos.value.includes(form.value.colonia)) {
      errors.value.colonia = "Pueblo/Colonia no válido";
    }
  }

  if (step.value === 3) {
    const existTel = await telefonoExiste(form.value.telefono);
    if (existTel) errors.value.telefono = "El teléfono ya está registrado";
    else if (!form.value.email) errors.value.email = "El email es obligatorio";
    else if (!/\S+@\S+\.\S+/.test(form.value.email))
      errors.value.email = "Email inválido";
    if (!form.value.telefono)
      errors.value.telefono = "El teléfono es obligatorio";
    else if (form.value.telefono.replace(/\D/g, "").length !== 10)
      errors.value.telefono = "El teléfono debe tener 10 dígitos";
  }
  if (step.value === 4) {
    if (form.value.metodosPago.length === 0)
      errors.value.metodosPago = "Seleccione al menos un método de pago";
    const horariosCompletos = Object.values(form.value.horario).some(
      (h) => h.inicio && h.fin
    );
    if (!horariosCompletos)
      errors.value.horario = "Debe ingresar al menos un horario válido";
    const diasInvalidos: string[] = [];
    Object.entries(form.value.horario).forEach(([dia, h]) => {
      if (h.inicio && h.fin && h.fin <= h.inicio) diasInvalidos.push(dia);
    });
    if (diasInvalidos.length > 0)
      errors.value.horario = `Por favor, corrige los horarios: ${diasInvalidos.join(
        ", "
      )}.`;
  }
  return Object.keys(errors.value).length === 0;
}

async function nextStep() {
  if ((await validateStep()) && step.value < 5) step.value++;
}
function prevStep() {
  if (step.value > 1) step.value--;
}

// ------------------- ENVÍO -------------------
async function submitStore() {
  if (!(await validateStep())) return;

  try {
    const hashedPassword = await hashPassword(form.value.password);

    // Buscar el nombre de la categoría seleccionada
    const categoriaObj = categorias.value.find(
      (c) => c.id === form.value.categoria
    );

    await crearTienda({
      ...form.value,
      password: hashedPassword,
      logoFile: form.value.logo ?? undefined,
      galleryFiles: form.value.gallery,
      categoriaId: form.value.categoria, // el id
      categoria: categoriaObj?.nombre ?? "", // el nombre
      bannerFile: form.value.banner ?? undefined,
    });
    router.replace("/store/login");
  } catch (err) {
    console.error("Error registrando tienda:", err);
    alert("Ocurrió un error al registrar la tienda");
  }
}

function seleccionarCategoria(cat: CategoriaData) {
  categoriaSeleccionada.value = cat.nombre;
  mostrarListaCategorias.value = false;
  errors.value.categoria = "";
}

function validarCategoria() {
  if (
    !categorias.value.some(
      (c) =>
        c.nombre.toLowerCase() === categoriaSeleccionada.value.toLowerCase()
    )
  ) {
    errors.value.categoria = "Categoría no válida";
  } else {
    errors.value.categoria = "";
  }
}
// ------------------- ON MOUNT -------------------
onMounted(async () => {
  categorias.value = await obtenerCategorias();
  const lista = await obtenerMunicipios();
  municipios.value = lista;
  municipiosFiltrados.value = lista; // inicialmente todos
});

onMounted(async () => {
  todosPueblos.value = await obtenerTodosPueblos();
  pueblosZonaFiltrados.value = [...todosPueblos.value];
});

// Filtrar municipios mientras escribe
// ------------------- VALIDACIÓN DE MUNICIPIO -------------------

watch(zonaSeleccionada, (val) => {
  if (!val) {
    pueblosZonaFiltrados.value = [...todosPueblos.value];
    agregarZonaHabilitada.value = false;
    return;
  }

  pueblosZonaFiltrados.value = todosPueblos.value.filter((p) =>
    p.toLowerCase().includes(val.toLowerCase())
  );

  agregarZonaHabilitada.value = todosPueblos.value.some(
    (p) => p.toLowerCase() === val.toLowerCase()
  );
});
watch(
  () => form.value.municipio,
  (val) => {
    // Filtrar lista para autocomplete
    municipiosFiltrados.value = municipios.value.filter((m) =>
      m.municipio.toLowerCase().includes(val.toLowerCase())
    );

    // Validar municipio escrito
    const existe = municipios.value.some(
      (m) => m.municipio.toLowerCase() === val.toLowerCase()
    );

    if (!val || !existe) {
      errors.value.municipio = "Municipio no válido";
      puebloDisabled.value = true;
      puebloSeleccionado.value = "";
      form.value.colonia = "";
    } else {
      errors.value.municipio = "";
      puebloDisabled.value = false;
    }
  }
);

// Filtrar pueblos mientras escribe
watch(
  () => puebloSeleccionado.value,
  (val) => {
    if (!val) {
      pueblosFiltrados.value = [...pueblos.value];
      form.value.colonia = "";
      errors.value.colonia = "Pueblo/Colonia no válido";
      return;
    }
    pueblosFiltrados.value = pueblos.value.filter((p) =>
      p.toLowerCase().includes(val.toLowerCase())
    );

    // Validación de pueblo
    if (!pueblos.value.some((p) => p.toLowerCase() === val.toLowerCase())) {
      errors.value.colonia = "Pueblo/Colonia no válido";
    } else {
      errors.value.colonia = "";
    }
  }
);
</script>

<style scoped>
/* CONTENEDOR PRINCIPAL */
.wizard-container {
  background: #f7f9fc;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

/* HEADER */
.wizard-header {
  background: linear-gradient(135deg, #87cefa, #1f70b2, #00509e);
  padding: 24px 16px;
  text-align: center;
  border-radius: 0 0 60px 60px;
  color: white;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
.header-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.step-indicator {
  font-size: 0.95rem;
  opacity: 0.85;
}
.btn-icon.back {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 28px;
  color: var(--color-bg-blue-dark);
}

/* CARD */
.wizard-card {
  background: #fff;
  padding: 30px 25px;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;
}
.step-title {
  font-weight: 700;
  color: #222;
  font-size: 1.2rem;
  margin-bottom: 18px;
  border-bottom: 2px solid #eee;
  padding-bottom: 8px;
}

/* FORM GROUP */
.form-group {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
}
.form-input,
textarea,
select {
  padding: 12px 14px 12px 36px; /* espacio para icono */
  border-radius: 12px;
  border: 1px solid #ccc;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
}
textarea {
  min-height: 80px;
  resize: vertical;
}
.form-input:focus,
textarea:focus,
select:focus {
  border-color: #1f70b2;
  outline: none;
}

/* BOTONES */
.buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
}
.btn-primary,
.btn-secondary,
.btn-success {
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: 0.2s;
}
.btn-primary {
  background: #1f70b2;
  color: #fff;
}
.btn-primary:hover {
  background: #105a8b;
}
.btn-secondary {
  background: #f0f0f0;
  color: #333;
}
.btn-secondary:hover {
  background: #e0e0e0;
}
.btn-success {
  background: #28a745;
  color: #fff;
}
.btn-success:hover {
  background: #1f7a30;
}

/* MENSAJES DE ERROR */
.error-msg {
  color: #d9534f;
  font-size: 0.85rem;
  margin-top: 4px;
}

/* INPUTS CON ICONO */
.input-with-icon {
  position: relative;
  margin-top: 10px;
}
.input-icon {
  width: 24px;
  height: 24px;
}
.input-with-icon .input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  z-index: 2;
  pointer-events: none;
}
.input-with-icon input,
.input-with-icon select,
.input-with-icon textarea {
  padding-left: 44px;
}

/* GRID DOMICILIO */
.address-group {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
}
.col-large {
  grid-column: span 8;
}
.col-small {
  grid-column: span 4;
}
.full-width {
  grid-column: span 12;
}

/* LOGO */
.logo-upload {
  width: 120px;
  height: 120px;
  border: 2px dashed #1f70b2;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 auto;
  font-size: 2.5rem;
  color: #1f70b2;
}

.add-logo {
  font-weight: bold;
}
.default-logo,
.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.hidden-input {
  display: none;
}

/* CHECKBOX CON ICONO */
.checkbox-with-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.checkbox-with-icon input[type="checkbox"] {
  accent-color: #1f70b2;
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.wa-icon {
  width: 20px;
  height: 20px;
}

/* GALERÍA */
.gallery-preview {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.gallery-preview img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid #ccc;
}
.gallery-upload {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 10px;
}

.gallery-item {
  width: 120px;
  height: 120px;
  border: 2px dashed #1f70b2;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gallery-item.add-image {
  font-size: 2rem;
  color: #1f70b2;
  font-weight: bold;
  justify-content: center;
}

/* MÉTODOS DE PAGO */
.payment-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 10px;
}
.payment-option {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #ddd;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  transition: 0.2s;
  flex: 1 1 120px;
  max-width: 200px;
}
.payment-option:hover {
  border-color: #1f70b2;
  background: rgba(238, 246, 253, 0.8);
}
.payment-option input[type="checkbox"] {
  accent-color: #1f70b2;
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.payment-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
/* --- HORARIO DIARIO --- */
.day-schedule {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.day-schedule strong {
  width: 80px;
  font-weight: 600;
}
.day-schedule input[type="time"] {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #ccc;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  transition: all 0.2s;
  width: 100px;
}
.day-schedule input[type="time"]:focus {
  border-color: #1f70b2;
  outline: none;
}
.day-schedule span {
  margin: 0 4px;
  font-weight: 500;
}

/* Password toggle */
.password-input {
  position: relative;
}
.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  user-select: none;
  font-size: 1rem;
}

.input-with-button {
  display: flex;
  gap: 8px; /* espacio entre input y botón */
  align-items: center;
  position: relative; /* necesario para la lista de autocomplete */
}
.btn-add {
  flex-shrink: 0;
  background: #1f70b2;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-add:hover {
  background: #105a8b;
}

.zona-list {
  list-style: none;
  padding: 0;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.zona-item {
  background: #eef6fd;
  padding: 6px 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.remove-zona {
  background: transparent;
  border: none;
  color: #d9534f;
  cursor: pointer;
  font-size: 14px;
}

.autocomplete-list {
  position: absolute;
  top: 100%; /* justo debajo del input */
  left: 0;
  right: 0;
  max-height: 200px; /* altura máxima */
  overflow-y: auto;
  background: white;
  border: 1px solid #ccc;
  z-index: 10; /* encima de otros elementos, pero debajo del input */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
}

.autocomplete-list li:hover {
  background-color: #f0f0f0;
}

.progress-bar {
  height: 6px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
  margin: 16px 0;
}
.progress {
  height: 100%;
  background: #1f70b2;
  transition: width 0.3s ease;
}

.select-container {
  position: relative;
  display: flex;
  align-items: center;
}

.icono-select {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  position: absolute;
  left: 8px;
  z-index: 2;
  pointer-events: none; /* para que no interfiera con el select */
}

.select-with-icon {
  padding-left: 50px; /* deja espacio para el icono */
}

/**Banner */

.banner-upload {
  width: 100%;
  max-height: 200px;
  border: 2px dashed #1f70b2;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 auto;
  font-size: 2.5rem;
  color: #1f70b2;
  overflow: hidden;
}

.add-banner {
  font-weight: bold;
}

.banner-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
