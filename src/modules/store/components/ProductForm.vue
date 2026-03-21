<template>
  <div class="register-container">
    <!-- Header -->
    <div class="register-header">
      <h1 class="title">Registrar Artículo</h1>
      <p class="subtitle">Rápido y fácil ✨</p>
      <div class="step-indicator">
        <span v-for="n in 3" :key="n" :class="{ active: step >= n }">{{
          n
        }}</span>
      </div>
    </div>

    <!-- Card -->
    <div class="register-card">
      <!-- STEP 1 -->
      <div v-if="step === 1" class="step-container">
        <h2 class="card-title">
          <i class="fa-solid fa-box"></i> Datos Básicos
        </h2>

        <div class="form-group">
          <label><i class="fa-solid fa-tag"></i> Nombre Producto</label>
          <input
            v-model="form.nombre"
            type="text"
            class="form-input"
            placeholder="Nombre del artículo"
          />
        </div>

        <div class="form-group">
          <label><i class="fa-solid fa-align-left"></i> Descripción</label>
          <textarea
            v-model="form.descripcion"
            class="form-input"
            placeholder="Descripción breve"
          ></textarea>
        </div>

        <div class="form-group">
          <label><i class="fa-solid fa-image"></i> Imagen *</label>
          <div class="image-upload" @click="triggerFileInput">
            <input
              type="file"
              ref="fileInput"
              @change="onImageSelected"
              hidden
            />
            <div v-if="form.url" class="image-preview-wrapper">
              <img :src="form.url" class="image-preview" />
              <button class="remove-btn" @click.stop="form.url = ''">
                &times;
              </button>
            </div>

            <div v-else class="image-placeholder">
              <span>+</span>
            </div>
          </div>
        </div>

        <div class="button-row">
          <button class="modern-button" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- STEP 2 -->
      <div v-if="step === 2" class="step-container">
        <h2 class="card-title">
          <i class="fa-solid fa-dollar-sign"></i> Precio & Categoría
        </h2>

        <div class="form-row">
          <!-- Precio -->
          <div class="form-group flex-1">
            <label>Precio *</label>
            <input
              type="text"
              class="form-input"
              :value="precioDisplay"
              @keydown="onPrecioKeydown"
              @input="onPrecioInput"
              @focus="unformatPrecioDisplay"
              @blur="formatPrecioDisplay"
              placeholder="$0.00"
            />
          </div>

          <!-- Unidad de medida -->
          <div class="form-group flex-1">
            <label>Unidad de medida</label>
            <select v-model="form.unidadMedida" class="form-input">
              <option value="">Selecciona</option>
              <option value="pz">Pieza</option>
              <option value="paquete">Paquete</option>
              <option value="kg">Kilogramo</option>
              <option value="g">Gramo</option>
              <option value="l">Litro</option>
              <option value="ml">Mililitro</option>
              <option value="m">Metro</option>
              <option value="cm">Centímetro</option>
              <option value="unidad">Unidad</option>
            </select>
          </div>
        </div>

        <!-- Categoría -->
        <div class="form-group">
          <label>Categoría</label>
          <div class="custom-select-wrapper">
            <div class="custom-select" @click="toggleDropdown">
              {{ form.categoria || "Selecciona" }}
            </div>
            <div v-if="showDropdown" class="dropdown-list">
              <div
                v-for="cat in categorias"
                :key="cat.id"
                class="dropdown-item"
                @click="selectCategoria(cat.nombre)"
              >
                {{ cat.nombre }}
              </div>
            </div>
          </div>
        </div>

        <div class="button-row">
          <button class="modern-button secondary" @click="prevStep">
            Anterior
          </button>
          <button class="modern-button" @click="nextStep">Siguiente</button>
        </div>
      </div>

      <!-- STEP 3 -->
      <div v-if="step === 3" class="step-container">
        <h2 class="card-title">
          <i class="fa-solid fa-gear"></i> Opciones Avanzadas
        </h2>

        <!-- Variantes del producto -->
        <div class="form-group">
          <label>Caracteristica del producto</label>
          <div
            v-for="(variante, index) in form.variantes"
            :key="index"
            class="variante-card"
          >
            <button
              v-if="!variante.isDefault"
              type="button"
              class="remove-variante"
              @click="form.variantes.splice(index, 1)"
            >
              ×
            </button>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>SKU</label>
                <div style="display: flex; gap: 0.5rem; align-items: center">
                  <input
                    v-model="variante.sku"
                    type="text"
                    class="form-input"
                    :disabled="variante.isDefault"
                    placeholder="Código SKU"
                  />
                  <button
                    type="button"
                    class="circle-button"
                    @click="abrirScanner(index)"
                  >
                    📷
                  </button>
                </div>

                <!-- Contenedor para la cámara -->
                <div
                  v-if="scannerIndex === index"
                  :id="'scanner-' + index"
                  style="width: 100%; margin-top: 0.5rem"
                ></div>
              </div>
            </div>

            <!-- IMAGEN VARIANTE -->
            <div class="form-group">
              <label>Imagen de variante</label>

              <div class="image-upload" @click="triggerVariantFileInput(index)">
                <input
                  type="file"
                  :ref="(el) => (variantFileInputs[index] = el)"
                  @change="(e) => onVariantImageSelected(e, variante)"
                  hidden
                  :disabled="variante.isDefault"
                />

                <!-- Preview -->
                <div v-if="variante.url" class="image-preview-wrapper">
                  <img :src="variante.url" class="image-preview" />
                  <button
                    v-if="!variante.isDefault"
                    class="remove-btn"
                    @click.stop="variante.url = ''"
                  >
                    &times;
                  </button>
                </div>

                <!-- Placeholder -->
                <div v-else class="image-placeholder">
                  <span>+</span>
                </div>
              </div>
            </div>
            <!-- FILA 1: SKU + COLOR -->
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Marca / Modelo</label>
                <input
                  v-model="variante.marca"
                  type="text"
                  placeholder="Ej: Nike"
                  class="form-input"
                />
              </div>
              <!-- COLOR -->
              <div class="form-group flex-1">
                <label>Color</label>
                <div class="custom-select-wrapper">
                  <div
                    class="custom-select"
                    @click="toggleColorDropdown(index)"
                  >
                    <div
                      v-if="variante.color"
                      class="color-preview"
                      :style="{ backgroundColor: variante.colorCodigo }"
                    ></div>
                    <span>{{ variante.color || "Elegir Color" }}</span>
                  </div>

                  <div
                    v-if="colorDropdownIndex === index"
                    class="dropdown-list"
                  >
                    <div
                      v-for="c in colores"
                      :key="c.nombre"
                      class="dropdown-item color-item"
                      :class="{ disabled: colorYaUsado(c.nombre, index) }"
                      @click="
                        !colorYaUsado(c.nombre, index) &&
                        seleccionarColor(variante, c.nombre)
                      "
                    >
                      <span
                        class="color-circle"
                        :style="{ backgroundColor: c.codigo }"
                      ></span>
                      <span>{{ c.nombre }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FILA 2: ALMACÉN + PRECIO -->
            <div class="form-row">
              <!-- Almacén -->
              <div class="form-group flex-1">
                <label>Almacén</label>
                <input
                  v-model="variante.almacen"
                  type="text"
                  class="form-input"
                  placeholder="Ej: Bodega 1"
                />
              </div>

              <!-- Precio -->
              <div class="form-group flex-1">
                <label>Precio</label>
                <input
                  type="text"
                  class="form-input"
                  :value="variante.precio ? `$${variante.precio}` : ''"
                  @keydown="onPrecioKeydown"
                  @input="(e) => onVariantePrecioInput(e, variante)"
                  @blur="(e) => formatVariantePrecio(e, variante)"
                  placeholder="$0.00"
                  :disabled="variante.isDefault"
                />
              </div>
            </div>

            <!-- DETALLE VARIANTE -->
            <div class="form-group">
              <label>Detalle de variante</label>
              <textarea
                v-model="variante.detalle"
                class="form-input"
                placeholder="Ej: Edición especial, tela premium, etc."
                rows="2"
              ></textarea>
            </div>

            <!-- Tamaño -->
            <div class="variante-row">
              <label>Tamaño</label>
              <select v-model="variante.tamano" class="form-input small-input">
                <option value="">Selecciona</option>
                <option v-for="t in tamanios" :key="t" :value="t">
                  {{ t }}
                </option>
              </select>
            </div>

            <!-- Si selecciona "Otro", mostrar input -->
            <div class="variante-row" v-if="variante.tamano === 'Otro'">
              <label>Especificar tamaño</label>
              <input
                v-model="variante.tamanoOtro"
                type="text"
                placeholder="Escribe el tamaño"
                class="form-input small-input"
              />
            </div>

            <!-- Material y Marca -->
            <!-- Material -->
            <div class="variante-row">
              <label>Material</label>
              <select
                v-model="variante.material"
                class="form-input small-input"
              >
                <option value="">Selecciona</option>
                <option v-for="m in materiales" :key="m" :value="m">
                  {{ m }}
                </option>
              </select>
            </div>

            <!-- Si selecciona "Otro", aparece input -->
            <div class="variante-row" v-if="variante.material === 'Otro'">
              <label>Especificar material</label>
              <input
                v-model="variante.materialOtro"
                type="text"
                placeholder="Escribe el material"
                class="form-input small-input"
              />
            </div>

            <!-- Stock -->
            <div class="variante-row">
              <label>¿Tienes stock?</label>
              <input
                type="checkbox"
                v-model="variante.tieneStock"
                :disabled="variante.isDefault"
              />
            </div>

            <div class="variante-row" v-if="variante.tieneStock">
              <label>Stock disponible</label>
              <input
                type="number"
                min="1"
                v-model.number="variante.stock"
                class="form-input small-input"
                placeholder="Cantidad disponible"
                :disabled="variante.isDefault"
              />
            </div>
            <div class="variante-row" v-else>
              <label>Stock ilimitado</label>
            </div>
          </div>

          <button
            type="button"
            class="modern-button small-button"
            @click="agregarVariante"
          >
            + Agregar variante del mismo producto
          </button>
        </div>

        <div class="button-row">
          <button class="modern-button secondary" @click="prevStep">
            Anterior
          </button>
          <button class="modern-button" @click="handleSubmit">Registrar</button>
        </div>
      </div>
    </div>
    <Dialog
      v-model:visible="dialogError"
      modal
      :closable="false"
      :dismissableMask="false"
      :style="{ width: '350px' }"
    >
      <div
        style="
          background: white;
          border-radius: 16px;
          border: 1px solid black;
          padding: 20px;
        "
      >
        <h3
          style="
            font-weight: bold;
            color: #0d47a1;
            text-align: center;
            margin-bottom: 20px;
          "
        >
          {{ dialogMensaje }}
        </h3>

        <!-- 🔥 Botón centrado y estilizado -->
        <div style="display: flex; justify-content: center">
          <Button
            label="Aceptar"
            severity="primary"
            @click="dialogError = false"
            class="btn-elegante"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { db } from "@/firebase";
import { push, ref as dbRef } from "firebase/database";
import type { Producto } from "@/types/Producto";
import {
  obtenerCategorias,
  type CategoriaData,
} from "@/composables/useCategorias";
import { uploadArticuloImagen } from "@/composables/useStorage"; // ajusta ruta
import Dialog from "primevue/dialog";
import Button from "primevue/button";

import { Html5Qrcode } from "html5-qrcode";
const props = defineProps({
  tiendaId: {
    type: String,
    required: true,
  },
  tiendaNombre: {
    type: String,
    required: true,
  },
});
const dialogMensaje = ref("");
const dialogError = ref(false);

const step = ref(1);
const precioDisplay = ref(""); // lo que ve el usuario
const precioValue = ref(0); // valor numérico real
const scannerIndex = ref<number | null>(null);
const categorias = ref<CategoriaData[]>([]);
const form = ref<Omit<Producto, "articuloId">>({
  nombre: "",
  descripcion: "",
  categoria: "",
  subcategoria: "",
  url: "",
  precio: 0,
  anticipo: 0,
  descuentoCupon: 0,
  metodo_pago: "",
  unidadMedida: "",
  almacen: "",
  tiendaId: props.tiendaId,
  tiendaNombre: props.tiendaNombre,
  icono: "",
  fecha_hora: "",
  variantes: [],
});

const colores = ref([
  { nombre: "Rojo", codigo: "#FF0000" },
  { nombre: "Azul", codigo: "#0000FF" },
  { nombre: "Verde", codigo: "#428f0b" },
  { nombre: "Amarillo", codigo: "#FFFF00" },
  { nombre: "Negro", codigo: "#000000" },
  { nombre: "Blanco", codigo: "#FFFFFF" },
  { nombre: "Naranja", codigo: "#FFA500" },
  { nombre: "Morado", codigo: "#800080" },
  { nombre: "Rosa", codigo: "#FFC0CB" },
  { nombre: "Gris", codigo: "#808080" },

  // Colores adicionales
  { nombre: "Marrón", codigo: "#A52A2A" },
  { nombre: "Celeste", codigo: "#87CEEB" },
  { nombre: "Turquesa", codigo: "#40E0D0" },
  { nombre: "Vino", codigo: "#8B0000" },
  { nombre: "Mostaza", codigo: "#FFDB58" },
  { nombre: "Beige", codigo: "#F5F5DC" },
  { nombre: "Salmón", codigo: "#FA8072" },
  { nombre: "Fucsia", codigo: "#FF00FF" },
  { nombre: "Caqui", codigo: "#F0E68C" },
  { nombre: "Azul Marino", codigo: "#000080" },
  { nombre: "Verde Oliva", codigo: "#808000" },
  { nombre: "Gris Perla", codigo: "#C0C0C0" },
  { nombre: "Rosa Pastel", codigo: "#FFD1DC" },
  { nombre: "Verde Menta", codigo: "#98FF98" },
  { nombre: "Terracota", codigo: "#E2725B" },
  { nombre: "Cobre", codigo: "#B87333" },
  { nombre: "Oro", codigo: "#FFD700" },
  { nombre: "Plata", codigo: "#C0C0C0" },
]);
const imagenFile = ref<File | null>(null);

const fileInput = ref<HTMLInputElement | null>(null);
const onImageSelected = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    imagenFile.value = file; // guardar archivo real
    form.value.url = URL.createObjectURL(file); // preview
  }
};

const showDropdown = ref(false);
// Nuevo ref para controlar el checkbox
const tieneStock = ref(false);
const colorDropdownIndex = ref<number | null>(null);

const variantFileInputs = ref<any[]>([]);
const variantFiles = ref<(File | null)[]>([]);

function colorYaUsado(colorNombre: string, indexActual: number) {
  return form.value.variantes.some((v, i) => {
    return i !== indexActual && v.color === colorNombre;
  });
}

function triggerVariantFileInput(index: number) {
  variantFileInputs.value[index]?.click();
}
function onVariantImageSelected(e: Event, variante: any) {
  const file = (e.target as HTMLInputElement).files?.[0];

  if (file) {
    variante._file = file; // guardamos archivo real
    variante.url = URL.createObjectURL(file); // preview inmediato
  }
}

function abrirScanner(index: number) {
  scannerIndex.value = index;

  const scannerId = "scanner-" + index;
  const html5QrCode = new Html5Qrcode(scannerId);

  html5QrCode
    .start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250,
      },
      (decodedText) => {
        form.value.variantes[index].sku = decodedText;
        html5QrCode.stop();
        scannerIndex.value = null;
      },
      (errorMessage) => {
        // error opcional, ignorar
        console.log("No se detectó código: ", errorMessage);
      },
    )
    .catch((err) => console.error("Error al iniciar scanner: ", err));
}
function toggleColorDropdown(index: number) {
  if (colorDropdownIndex.value === index) colorDropdownIndex.value = null;
  else colorDropdownIndex.value = index;
}
function validarVariantes(): boolean {
  if (form.value.variantes.length === 0) {
    alert("Debes agregar al menos una variante antes de continuar.");
    return false;
  }

  for (const v of form.value.variantes) {
    if (!v.precio) {
      alert("Cada variante debe tener precio.");
      return false;
    }

    if (!v.color) {
      alert("Cada variante debe tener color.");
      return false;
    }

    // Validar material
    if (!v.material) {
      alert("Selecciona un material para cada variante.");
      return false;
    }

    if (v.material === "Otro" && !v.materialOtro) {
      alert("Debes especificar el material personalizado.");
      return false;
    }

    // Validar tamaño
    if (!v.tamano) {
      alert("Selecciona un tamaño para cada variante.");
      return false;
    }

    if (v.tamano === "Otro" && !v.tamanoOtro) {
      alert("Debes especificar el tamaño personalizado.");
      return false;
    }

    if (!v.detalle) {
      alert("Debes agregar un detalle para cada variante.");
      return false;
    }

    if (!v.url && !v._file) {
      alert("Cada variante debe tener una imagen.");
      return false;
    }
  }

  return true;
}

function handleSubmit() {
  if (validarVariantes()) {
    submitForm();
  }
}

function seleccionarColor(variante: any, colorNombre: string) {
  const colorObj = colores.value.find((c) => c.nombre === colorNombre);
  variante.color = colorNombre;
  variante.colorCodigo = colorObj?.codigo || "#fff";
  colorDropdownIndex.value = null;
}

function agregarVariante() {
  form.value.variantes.push({
    color: "",
    colorCodigo: "",
    tamano: "",
    tamanoOtro: "", // ➕ Nuevo campo
    material: "",
    materialOtro: "", // ➕ Nuevo campo
    marca: "",
    stock: 0,
    estatus: true,
    tieneStock: false,
    almacen: "",
    precio: precioValue.value || 0,
    sku: "",
    url: "",
    detalle: "",
  });
}

function generarSKU(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  const time = Date.now().toString().slice(-4);
  return `CRU-${random}-${time}`;
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function selectCategoria(nombre: string) {
  form.value.categoria = nombre;
  showDropdown.value = false;
}

onMounted(async () => {
  categorias.value = await obtenerCategorias();
});
// Función para forzar dos decimales en precio

// Bloquear caracteres no numéricos

function onPrecioKeydown(e: KeyboardEvent) {
  const allowedKeys = ["Backspace", "ArrowLeft", "ArrowRight", "Tab", "Delete"];
  const isNumber = /^[0-9]$/.test(e.key);
  const isDot = e.key === "." && !precioDisplay.value.includes(".");
  if (!isNumber && !isDot && !allowedKeys.includes(e.key)) e.preventDefault();
}

function onPrecioInput(e: Event) {
  let val = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, "");
  if (val.startsWith("0") && val.length > 1 && val[1] !== ".")
    val = val.replace(/^0+/, "");
  if (val.includes(".")) {
    const [entero, decimales] = val.split(".");
    val = entero + "." + decimales.slice(0, 2);
  }
  precioDisplay.value = val;
  precioValue.value = val ? parseFloat(val) : 0;
  form.value.precio = precioValue.value; // sincronizar solo aquí
}
function onVariantePrecioInput(e: Event, variante: any) {
  let val = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, "");

  if (val.startsWith("0") && val.length > 1 && val[1] !== ".")
    val = val.replace(/^0+/, "");

  if (val.includes(".")) {
    const [entero, decimales] = val.split(".");
    val = entero + "." + decimales.slice(0, 2);
  }

  variante.precio = val ? parseFloat(val) : 0;
  (e.target as HTMLInputElement).value = val; // mantener la escritura limpia
}
function formatVariantePrecio(e: Event, variante: any) {
  if (!variante.precio) return;
  (e.target as HTMLInputElement).value = `$${parseFloat(
    variante.precio,
  ).toFixed(2)}`;
}

// Watch opcional para sincronizar stock -1 si no tiene stock
watch(
  () => form.value.variantes,
  (variantes) => {
    variantes.forEach((v) => {
      if (!v.tieneStock) v.stock = -1;
      else if (v.stock < 1) v.stock = 1;
    });
  },
  { deep: true },
);

watch(precioValue, (nuevoPrecio) => {
  if (!nuevoPrecio || nuevoPrecio <= 0) return;

  // Si no existen variantes, crear una automáticamente
  if (step.value === 3 && form.value.variantes.length === 0) {
    form.value.variantes.push({
      color: "",
      colorCodigo: "",
      tamano: "",
      tamanoOtro: "",
      material: "",
      materialOtro: "",
      marca: "",
      stock: 0,
      estatus: true,
      tieneStock: false,
      almacen: "",
      precio: nuevoPrecio, // precio inicial
      sku: "",
      url: "",
      detalle: "",
    });
    return;
  }

  // ✅ VALIDACIÓN CLAVE
  if (!form.value.variantes.length) return;

  const primera = form.value.variantes[0];

  if (!primera.precio || primera.precio === 0) {
    primera.precio = nuevoPrecio;
  }
});

function formatPrecioDisplay() {
  if (precioDisplay.value)
    precioDisplay.value = `$${parseFloat(precioDisplay.value).toFixed(2)}`;
}

function unformatPrecioDisplay() {
  precioDisplay.value = precioDisplay.value.replace(/^\$/, "");
}
function triggerFileInput() {
  fileInput.value?.click();
}
function nextStep() {
  if (step.value === 1 && !validarPaso1()) return;
  if (step.value === 2 && !validarPaso2()) return;

  step.value = Math.min(step.value + 1, 3);

  // 👇 Cuando entra a paso 3, crear variante base si no existe
  if (step.value === 3 && form.value.variantes.length === 0) {
    form.value.variantes.push(crearVarianteBase());
  }
}

function crearVarianteBase() {
  return {
    color: "Gris",
    colorCodigo: "#cccccc",
    tamano: "Otro",
    tamanoOtro: "",
    material: "Otro",
    materialOtro: "",
    marca: "",
    stock: -1,
    estatus: true,
    tieneStock: false,
    almacen: form.value.almacen || "",
    precio: precioValue.value,
    sku: generarSKU(),
    url: form.value.url || "",
    detalle: "Producto Base",
    // 🔒 bandera para bloquear
    isDefault: true,
  };
}

function prevStep() {
  step.value = Math.max(step.value - 1, 1);

  // 👇 Si regresa del paso 3 al 2, borrar variantes
  if (step.value === 2) {
    form.value.variantes = [];
  }
}
async function submitForm() {
  try {
    form.value.fecha_hora = new Date().toISOString();

    let urlFinal = "";

    if (imagenFile.value) {
      urlFinal = await uploadArticuloImagen(imagenFile.value);
    }

    const variantesFinal = await Promise.all(
      form.value.variantes.map(async (v) => {
        let skuFinal = v.sku;

        // 🧠 si no hay SKU, generar uno
        if (!skuFinal || skuFinal.trim() === "") {
          skuFinal = generarSKU();
        }

        let urlFinalVariante = v.url;

        if (v._file) {
          urlFinalVariante = await uploadArticuloImagen(v._file);
        }

        return {
          ...v,
          sku: skuFinal, // ✅ aquí lo aseguras
          url: urlFinalVariante,
          _file: "",
        };
      }),
    );

    await push(dbRef(db, "articulos"), {
      ...form.value,
      url: urlFinal,
      variantes: variantesFinal,
    });

    // 🟦 Mostrar el diálogo personalizado
    dialogMensaje.value = "Artículo registrado correctamente";
    dialogError.value = true;

    // Reset
    step.value = 1;
    imagenFile.value = null;

    Object.assign(form.value, {
      nombre: "",
      descripcion: "",
      categoria: "",
      subcategoria: "",
      url: "",
      precio: 0,
      anticipo: 0,
      descuentoCupon: 0,
      metodo_pago: "",
      unidadMedida: "",
      estatus: false,
      almacen: "",
      icono: "",
      fecha_hora: "",
      variantes: [],
      tiendaId: props.tiendaId,
    });
  } catch (error) {
    console.error("Error registrando artículo:", error);

    // Diálogo de error
    dialogMensaje.value = "Error al registrar el artículo ❌";
    dialogError.value = true;
  }
}

const materiales = ref([
  "Otro",
  "Algodón",
  "Poliéster",
  "Metal",
  "Plástico",
  "Vidrio",
  "Cuero",
  "Madera",
  "Cerámica",
  "Cartón",
  "Papel",
]);

const tamanios = ref([
  "Otro",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "Chico",
  "Mediano",
  "Grande",
]);

function mostrarDialogo(mensaje: string) {
  dialogMensaje.value = mensaje;
  dialogError.value = true;
}

function validarPaso1() {
  if (!form.value.nombre.trim()) {
    mostrarDialogo("El nombre del artículo es obligatorio.");
    return false;
  }
  if (!form.value.descripcion.trim()) {
    mostrarDialogo("La descripción es obligatoria.");
    return false;
  }
  if (!form.value.url && !imagenFile.value) {
    mostrarDialogo("Debes subir una imagen antes de continuar.");
    return false;
  }
  return true;
}

function validarPaso2() {
  if (!precioValue.value || precioValue.value <= 0) {
    mostrarDialogo("El precio debe ser mayor a 0.");
    return false;
  }
  if (!form.value.unidadMedida) {
    mostrarDialogo("Debes seleccionar una unidad de medida.");
    return false;
  }
  if (!form.value.categoria) {
    mostrarDialogo("Debes seleccionar una categoría.");
    return false;
  }
  return true;
}
</script>

<style scoped>
.custom-dialog .p-dialog-content {
  background: transparent !important;
  padding: 0 !important;
}

.register-container {
  background: #f0f4f8;
  min-height: 100vh;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;
  padding: 2rem 0;
}

.register-header {
  width: 90%;
  max-width: 480px;
  text-align: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #6ab7ff, #0047ab);
  color: white;
  border-radius: 0 0 40px 40px;
  margin-bottom: 1.5rem;
}

.title {
  font-size: 1.8rem;
  font-weight: 700;
}
.subtitle {
  margin-top: 0.3rem;
  font-size: 1.05rem;
}
.step-indicator {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.step-indicator span {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
}
.step-indicator span.active {
  background: #fff;
  color: #0047ab;
}

.register-card {
  background: white;
  width: 90%;
  max-width: 480px;
  border-radius: 25px;
  padding: 2rem 1.5rem;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.card-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #0047ab;
  margin-bottom: 1rem;
  text-align: center;
}

.step-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}
.form-input {
  width: 100%;
  padding: 0.85rem;
  border-radius: 16px;
  border: 1px solid #ddd;
  outline: none;
  font-size: 1rem;
  transition: all 0.2s ease;
  max-height: 150px; /* solo efectivo en algunos navegadores */
  overflow-y: auto;
}
.form-input:focus {
  border-color: #6ab7ff;
  box-shadow: 0 0 6px rgba(106, 183, 255, 0.3);
}

.form-row {
  display: flex;
  gap: 0.8rem;
  width: 100%;
}
.flex-1 {
  flex: 1;
}

.button-row {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  width: 100%;
}
.modern-button {
  flex: 1;
  background: linear-gradient(135deg, #6ab7ff, #0047ab);
  color: white;
  font-weight: 700;
  border-radius: 20px;
  padding: 0.9rem 0;
  font-size: 1.05rem;
  transition: 0.2s;
}
.modern-button:hover {
  transform: translateY(-2px);
}
.modern-button.secondary {
  background: #f0f0f0;
  color: #333;
}

.switch-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.image-upload {
  width: 100px;
  height: 100px;
  cursor: pointer;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  border: 2px dashed #0047ab;
  border-radius: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #0047ab;
  font-size: 2rem;
  font-weight: bold;
}

.image-preview-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 16px;
  /* overflow: hidden; */
}
.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.remove-btn {
  position: absolute;
  top: -10px;
  right: -10px;

  width: 26px; /* Igual ancho */
  height: 26px; /* Igual alto -> círculo real */
  border-radius: 50%;

  background: #ff6b6b;
  color: white;
  border: none;

  display: flex;
  justify-content: center;
  align-items: center;

  font-size: 16px; /* Tamaño de la X */
  line-height: 0; /* IMPORTANTE → evita que se estire */
  padding: 0; /* Nada de padding */

  cursor: pointer;
  box-sizing: border-box; /* Evita que borde/padding lo deformen */
}

.custom-select-wrapper {
  position: relative;
  width: 100%;
  background-color: white;
}

.custom-select {
  padding: 0.85rem;
  border-radius: 16px;
  border: 1px solid #ddd;
  cursor: pointer;
}

.dropdown-list {
  position: absolute;
  width: 100%;
  max-height: 150px; /* altura máxima */
  overflow-y: auto; /* scroll */
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  z-index: 10;
}
.custom-select-wrapper .dropdown-list {
  background: white !important;
}

.dropdown-item {
  padding: 0.5rem;
  cursor: pointer;
}
.dropdown-item:hover {
  background: #f0f4f8;
}

.estatus-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.estatus-wrapper input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.disponible {
  color: green;
  font-weight: 700;
}

.no-disponible {
  color: red;
  font-weight: 700;
}

.variante-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.variante-card {
  background: #f9f9f9;
  border-radius: 16px;
  padding: 1rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border: 1px solid #ddd;
}

.remove-variante {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px; /* ancho fijo */
  height: 28px; /* altura igual al ancho */
  display: flex; /* para centrar la cruz */
  justify-content: center;
  align-items: center;
  font-size: 16px; /* tamaño de la cruz */
  line-height: 1; /* para que no se desplace verticalmente */
  cursor: pointer;
  padding: 0; /* quitar padding que deformaba */
}

.variante-field {
  display: flex;
  flex-direction: column;
}

.variante-field input {
  padding: 0.5rem;
  border-radius: 12px;
  border: 1px solid #ccc;
}

.color-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.color-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: 8px;
  transition: 0.2s;
}

.color-item:hover {
  background: #f0f4f8;
}

.color-circle {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: 0.5rem;
  border: 1px solid #ccc;
}

.color-item.selected {
  border: 2px solid #0047ab; /* borde azul para el seleccionado */
  padding: 0.25rem 0.45rem; /* ajustar padding por el borde */
  border-radius: 8px;
}

.dropdown-list {
  position: absolute;
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  z-index: 10;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
}

.color-item:hover {
  background: #f0f4f8;
}

.color-preview {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #ccc;
  display: inline-block;
  margin-right: 8px;
  vertical-align: middle;
}
.circle-button {
  width: 32px; /* más chico */
  height: 32px; /* igual que el ancho → círculo perfecto */
  border-radius: 50%;
  background: white;

  color: #0047ab;
  font-size: 1rem; /* tamaño del emoji 📷 */
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  line-height: 1; /* evita que se vea ovalado */
  padding: 0; /* quita espacio extra */
}

.circle-button:hover {
  background: #f0f4f8;
  transform: scale(1.05);
}

.btn-elegante {
  background: linear-gradient(135deg, #1565c0, #1e88e5);
  border: none !important;
  color: white !important;
  padding: 10px 24px !important;
  font-size: 16px !important;
  font-weight: bold !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  transition: all 0.25s ease !important;
}

.btn-elegante:hover {
  background: linear-gradient(135deg, #0d47a1, #1565c0);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}

.btn-elegante:active {
  transform: translateY(0px);
  box-shadow: 0 3px 7px rgba(0, 0, 0, 0.25);
}

.color-item.disabled {
  opacity: 0.4;
  pointer-events: none;
  cursor: not-allowed;
}
</style>
