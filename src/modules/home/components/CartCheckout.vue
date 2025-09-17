<template>
  <div class="checkout-container">
    <div class="checkout-header">
      <ArrowBack class="btn-icon back" @click="FlechaBack()" />
      <h1 class="title">Confirmar Pedido</h1>
      <p class="subtitle">Paso {{ paso }} / 3</p>
    </div>

    <div class="checkout-card">
      <!-- Paso 1: Domicilio -->
      <div v-if="paso === 1">
        <h2 class="card-title">Domicilio de entrega</h2>

        <div v-if="sessionUser.value && !usarOtroDomicilio">
          <p><strong>Domicilio registrado:</strong></p>
          <p>{{ sessionUser.value.domicilio }}</p>
          <p>
            {{ sessionUser.value.municipio }}, {{ sessionUser.value.estado }}
          </p>
          <button
            class="modern-button secondary"
            @click="usarOtroDomicilio = true"
          >
            Usar otro domicilio
          </button>
        </div>

        <div v-else>
          <div v-if="editable">
            <div class="form-group row-calle-numero">
              <label style="position: absolute; top: 0px; left: 20"
                >Calle</label
              >
              <input
                v-model="domicilioForm.calle"
                placeholder="Calle"
                class="form-input input-calle"
                :disabled="!editable"
              />
              <label style="position: absolute; top: 0px; right: 0px"
                >Número</label
              >
              <input
                v-model="domicilioForm.numero"
                placeholder="#"
                class="form-input input-numero"
                :disabled="!editable"
              />
            </div>

            <div class="form-group row-colonia-cp">
              <label style="position: absolute; top: 0; left: 0">Colonia</label>
              <input
                v-model="domicilioForm.colonia"
                placeholder="Colonia"
                class="form-input input-colonia"
                :disabled="!editable"
              />
              <label style="position: absolute; top: 0; right: 0px"
                >C.Postal.</label
              >
              <input
                v-model="domicilioForm.cp"
                placeholder="C.P."
                class="form-input input-cp"
                :disabled="!editable"
              />
            </div>

            <div class="form-group">
              <label for="municipio">Municipio</label>
              <input
                v-model="domicilioForm.municipio"
                placeholder="Municipio"
                class="form-input"
                :disabled="!editable"
              />
            </div>

            <div class="form-group">
              <label for="estado">Estado</label>
              <input
                v-model="domicilioForm.estado"
                placeholder="Estado"
                class="form-input"
                :disabled="!editable"
              />
            </div>

            <button
              class="modern-button full-width"
              style="margin-top: 20px"
              @click="GuardarDomicilioNuevo()"
            >
              Guardar
            </button>
          </div>
          <div v-else>
            <div class="domicilio-card">
              <p class="domicilio-title">
                <strong>Enviar al domicilio</strong>
                <span class="gratis">
                  {{ envio > 0 ? envioFormateado : "GRATIS" }}</span
                >
              </p>
              <p class="domicilio-info">
                {{ domicilioForm.calle }} #{{ domicilioForm.numero }} -
                {{ domicilioForm.colonia }}, {{ domicilioForm.municipio }} - CP
                {{ domicilioForm.cp }}
              </p>
              <p class="domicilio-type">Residencial</p>
              <hr class="divider" />
              <p
                class="change-link"
                @click="
                  usarOtroDomicilio = true;
                  editable = true;
                "
              >
                Enviar a otro domicilio
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Paso 2: Método de pago -->
      <div v-if="paso === 2">
        <h2 class="card-title">Método de pago</h2>

        <span class="error-msg" v-if="mpago">
          Selecciona un metodo de pago, ¡porfavor!
        </span>
        <div class="payment-options">
          <!-- Opción Efectivo -->
          <div
            class="payment-option"
            :class="{ active: metodoPago === 'Efectivo' }"
            @click="
              metodoPago = 'Efectivo';
              mpago = false;
            "
          >
            <img
              loading="lazy"
              src="@/assets/icons/money.png"
              alt="Efectivo"
              class="payment-icon"
            />
            <span>Efectivo</span>
          </div>

          <!-- Opción Transferencia -->
          <div
            class="payment-option"
            :class="{ active: metodoPago === 'Transferencia' }"
            @click="
              metodoPago = 'Transferencia';
              mpago = false;
            "
          >
            <img
              loading="lazy"
              src="@/assets/icons/trasfer.png"
              alt="Transferencia"
              class="payment-icon"
            />
            <span>Transferencia</span>
          </div>
        </div>
      </div>

      <!-- Paso 3: Resumen -->
      <div v-if="paso === 3" class="resumen-pedido">
        <h2 class="card-title">Resumen del pedido</h2>

        <!-- Domicilio -->
        <p><strong>Domicilio:</strong> {{ direccionFinal }}</p>

        <!-- Método de pago -->
        <p><strong>Método de pago:</strong> {{ metodoPago }}</p>

        <!-- Total de artículos -->
        <div class="resumen-row">
          <span><strong>Total de artículos:</strong></span>
          <span>{{ totalArticulos }}</span>
        </div>

        <!-- Lista de artículos -->
        <div class="resumen-articulos" v-if="carrito.length">
          <h3>Artículos:</h3>
          <ul>
            <li v-for="item in carrito" :key="item.id" class="resumen-item">
              <span>{{ item.cantidad }} x {{ item.nombre }}</span>
              <span>${{ (item.cantidad * item.precio).toFixed(2) }}</span>
            </li>
          </ul>
        </div>

        <!-- Subtotales y envío -->
        <div class="resumen-row">
          <span><strong>Subtotal:</strong></span>
          <span>${{ subtotal.toFixed(2) }}</span>
        </div>

        <div class="resumen-row">
          <span><strong>Envío:</strong></span>
          <span class="gratis">
            {{ envio > 0 ? envioFormateado : "Gratis" }}
          </span>
        </div>

        <hr class="divider" />

        <!-- Total final -->
        <div class="resumen-row total">
          <span>Total:</span>
          <span>${{ total.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Botones de navegación -->
      <div class="button-row">
        <button
          v-if="editable === false"
          class="modern-button full-width"
          @click="siguientePaso"
        >
          {{ paso === 3 ? "Confirmar Pedido" : "Continuar" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, reactive } from "vue";
import { sessionUser } from "@/utils/sessionUser";
import { useRouter } from "vue-router";
import ArrowBack from "@/components/ArrowBack.vue";
import { useCarrito } from "@/db/composables/useCarrito";
import { guardarPedidos } from "@/composables/usePedidos"; // importa la función
import Swal from "sweetalert2";

const { obtenerCarritoByUser, vaciarCarritoPorUsuario } = useCarrito();
const router = useRouter();
const paso = ref(1);
const usarOtroDomicilio = ref(false);
const metodoPago = ref("");
const editable = ref(false);
const mpago = ref(false);
const subtotal = ref(0);
const envio = ref(0);
const total = ref(0);
const totalArticulos = ref(0);
const carrito = reactive<any[]>([]);

const domicilioForm = ref({
  calle: "",
  numero: "",
  colonia: "",
  municipio: "",
  estado: "",
  cp: "",
});
const envioFormateado = computed(() => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(envio.value);
});
const direccionFinal = computed(() => {
  if (usarOtroDomicilio.value || editable.value) {
    return `${domicilioForm.value.calle} ${domicilioForm.value.numero}, ${domicilioForm.value.colonia}, ${domicilioForm.value.municipio}, ${domicilioForm.value.estado}, CP ${domicilioForm.value.cp}`;
  } else if (sessionUser.value) {
    return `${sessionUser.value.domicilio}, ${sessionUser.value.municipio}, ${sessionUser.value.estado}`;
  } else {
    return "Cargando...";
  }
});

const siguientePaso = async () => {
  if (paso.value === 2 && !metodoPago.value) {
    mpago.value = true; // o un mensaje más elegante con un toast
    return; // evita pasar al siguiente paso
  }

  if (paso.value === 3) {
    console.log("Pedido confirmado:", {
      domicilio: direccionFinal.value,
      metodoPago: metodoPago.value,
    });

    await guardarPedidos(carrito, metodoPago.value, domicilioForm.value);
    await vaciarCarritoPorUsuario();

    //router.push("/pedido-confirmado");

    Swal.fire({
      title: "¡Gracias por tu compra! 🎉",
      text: "Podrás ver tu pedido en tu perfil.",
      icon: "success",
      confirmButtonText: "Aceptar",
      confirmButtonColor: "#0165d8",
    }).then(() => {
      router.replace("/"); // 👈 aquí lo mandas al perfil
    });
  } else {
    paso.value++;
  }
};

const anteriorPaso = () => {
  if (paso.value > 1) paso.value--;
};

watchEffect(() => {
  if (sessionUser.value && !usarOtroDomicilio.value) {
    const [calle, numero] = sessionUser.value.domicilio
      ? sessionUser.value.domicilio.split("#").map((s: string) => s.trim())
      : ["", ""];

    domicilioForm.value = {
      calle: calle || "",
      numero: numero || "",
      colonia: sessionUser.value.colonia || "",
      municipio: sessionUser.value.municipio || "",
      estado: sessionUser.value.estado || "",
      cp: sessionUser.value.codigpostal || "",
    };

    editable.value = false;
  }
});

onMounted(async () => {
  const state = window.history.state;
  if (state && state.subtotal !== undefined) {
    subtotal.value = Number(state.subtotal);
    envio.value = Number(state.envio);
    total.value = Number(state.total);
    totalArticulos.value = Number(state.totalArticulos);
    carrito.splice(0, carrito.length, ...(state.carritoItems || []));
  } else {
    await cargarCarrito();
  }
});

const cargarCarrito = async () => {
  if (!sessionUser.value?.id) return;

  const items = await obtenerCarritoByUser();
  carrito.splice(0, carrito.length, ...items);

  subtotal.value = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  totalArticulos.value = carrito.reduce((sum, i) => sum + i.cantidad, 0);
  envio.value = subtotal.value < 200 ? 15 : 0;
  total.value = subtotal.value + envio.value;
};

const FlechaBack = () => {
  if (paso.value > 1) {
    anteriorPaso();
  } else if (editable.value) {
    editable.value = false;
  } else {
    router.back();
  }
};

const GuardarDomicilioNuevo = () => {
  sessionUser.value.domicilio = `${domicilioForm.value.calle} #${domicilioForm.value.numero}`;
  sessionUser.value.colonia = domicilioForm.value.colonia;
  sessionUser.value.municipio = domicilioForm.value.municipio;
  sessionUser.value.estado = domicilioForm.value.estado;
  sessionUser.value.codigpostal = domicilioForm.value.cp;

  //Falta guardar el domicilio
  editable.value = false;
};
</script>

<style scoped>
.error-msg {
  display: block; /* ocupa toda la línea */
  color: #b71c1c; /* rojo oscuro para error */
  background-color: #ffebee; /* fondo rojo claro */
  border: 1px solid #f44336; /* borde rojo */
  padding: 8px 12px; /* espacio interno */
  border-radius: 8px; /* esquinas redondeadas */
  margin: 10px 0; /* margen vertical */
  font-size: 0.9rem; /* tamaño legible */
  font-weight: 500; /* un poco más visible */
}

.payment-options {
  display: flex;
  justify-content: center;
  gap: 1.5rem; /* espacio entre opciones */
}

.payment-option {
  display: flex;
  flex-direction: column; /* icono arriba, texto abajo */
  align-items: center;
  justify-content: center;
  width: 100px;
  padding: 1rem;
  border: 2px solid #ddd;
  border-radius: 12px;
  cursor: pointer;
  background: #f9f9f9;
  transition: all 0.2s ease-in-out;
  text-align: center;
}

.payment-option span {
  font-size: 12px; /* tamaño fijo */
  text-align: center; /* centrado */
  display: block;
  margin-top: 0.5rem;
  line-height: 1.2; /* para que no se amontone */
}

.payment-option:hover {
  background: #f0f8ff;
}

.payment-option.active {
  border-color: #3498db;
  background: #eaf6ff;
  color: #3498db;
  font-weight: bold;
}

.payment-icon {
  width: 50px;
  height: 50px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.checkout-container {
  background: #f8f9fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.checkout-header {
  width: 100%;
  text-align: center;
  padding: 2rem 1rem;
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-dark),
    var(--color-bg-blue-ligth)
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

.checkout-card {
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
  color: #3498db;
  padding-bottom: 0.5rem;
}
.card-title::after {
  content: "";
  display: block;
  width: 100%;
  height: 1px;
  background-color: #ccc;
  margin-top: 0.5rem;
  border-radius: 1px;
}

.form-group {
  margin: 7px;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
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

.form-input {
  padding: 0.8rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  font-size: 1rem;
  outline: none;
  transition: border 0.3s ease;
}

.form-input:focus {
  border-color: #3498db;
}

.payment-options button {
  margin-right: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  background: #f0f0f0;
  cursor: pointer;
}
.payment-options button.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.button-row {
  display: flex;
  flex-direction: column; /* los botones uno debajo del otro */
  align-items: center; /* centramos horizontalmente */
  gap: 0.5rem; /* espacio entre botones */
  width: 100%; /* ocupa todo el ancho de la tarjeta */
  margin-top: 1rem;
}

.full-width {
  width: 100%; /* el botón ocupa todo el ancho del contenedor */
}

.modern-button {
  background-color: var(--color-bg-blue-dark);
  color: white;
  font-weight: bold;
  font-size: 1rem;
  padding: 0.8rem 2rem;
  border-radius: 16px;
  width: 48%;
}
.modern-button.secondary {
  background: #ddd;
  color: #333;
}

.domicilio-card {
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.domicilio-title {
  font-weight: bold;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
.domicilio-title {
  display: flex;
  justify-content: space-between; /* separa los elementos a extremos */
  font-weight: bold;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.domicilio-title span {
  /* opcional, para alinear texto verticalmente si quieres */
  display: inline-block;
}

.gratis {
  color: #27ae60; /* verde opcional para resaltar "Gratis" */
  font-weight: normal;
}

.domicilio-info {
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}

.domicilio-type {
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 0.5rem;
  text-align: left;
}

.divider {
  border: none;
  border-top: 1px solid #ccc;
  margin: 0.5rem 0;
}

.change-link {
  color: #3498db;
  font-weight: bold;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
}

.resumen-pedido {
  max-width: 400px; /* opcional, controla ancho */
  margin: 0; /* lo deja alineado a la izquierda */
}

.resumen-row {
  display: flex;
  justify-content: space-between;
  margin: 4px 0;
}

.resumen-row.total {
  font-size: 1.2rem;
  font-weight: bold;
  border-top: 1px solid #ccc;
  padding-top: 6px;
  margin-top: 8px;
}

.resumen-articulos {
  max-height: 200px; /* limita la altura si hay muchos productos */
  overflow-y: auto; /* scroll si excede el espacio */
  margin: 1rem 0;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  padding: 0.5rem 0;
}

.resumen-articulos h3 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  color: #3498db;
  text-align: center;
}

.resumen-item {
  display: flex;
  justify-content: space-between;
  margin: 4px 0;
  font-size: 0.9rem;
}
</style>
