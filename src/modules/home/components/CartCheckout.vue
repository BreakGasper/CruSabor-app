<template>
  <div class="checkout-container">
    <div class="checkout-header">
      <TopBarFija titulo="Confirmar pedido" @back="FlechaBack()" />
      <h1 class="title">Confirmar Pedido</h1>
      <p class="subtitle">Paso {{ paso }} / 3</p>
    </div>

    <div class="checkout-card">
      <!-- Paso 1: Domicilio -->
      <div v-if="paso === 1">
        <h2 class="card-title">Domicilio de entrega</h2>

        <!-- Nueva dirección (alta) -->
        <div v-if="mostrarNuevaDireccion" class="nueva-direccion">
          <p class="subtitulo">Registrar nueva dirección</p>
          <DireccionForm
            :guardando="guardandoDireccion"
            @save="guardarNuevaDireccion"
            @cancel="mostrarNuevaDireccion = false"
          />
        </div>

        <!-- Sin direcciones registradas -->
        <div v-else-if="direcciones.length === 0" class="sin-direcciones">
          <p>Aún no tienes un domicilio registrado.</p>
          <button class="modern-button full-width" @click="mostrarNuevaDireccion = true">
            Registrar domicilio
          </button>
        </div>

        <!-- Dirección seleccionada -->
        <div v-else class="domicilio-card">
          <p class="domicilio-title">
            <strong>Enviar al domicilio</strong>
            <span class="gratis">{{ envio > 0 ? envioFormateado : "GRATIS" }}</span>
          </p>
          <p class="domicilio-alias">
            {{ direccionSeleccionada?.principal ? '🏠' : '📍' }} {{ direccionSeleccionada?.alias }}
          </p>
          <p class="domicilio-info">{{ direccionTexto(direccionSeleccionada) }}</p>
          <hr class="divider" />
          <p class="change-link" @click="mostrarSelector = !mostrarSelector">
            {{ mostrarSelector ? "Ocultar direcciones" : "Enviar a otro domicilio" }}
          </p>

          <!-- Selector de direcciones guardadas -->
          <div v-if="mostrarSelector" class="selector-direcciones">
            <label
              v-for="d in direcciones"
              :key="d.id"
              class="dir-opcion"
              :class="{ activa: d.id === direccionSeleccionada?.id }"
            >
              <input type="radio" name="direccion" :value="d.id" v-model="direccionSelId" />
              <span class="dir-body">
                <span class="dir-alias">
                  {{ d.alias }}
                  <span v-if="d.principal" class="tag">Del registro</span>
                  <span v-else-if="d.predeterminada" class="tag">Predeterminada</span>
                </span>
                <span class="dir-texto">{{ direccionTexto(d) }}</span>
              </span>
            </label>
            <button v-if="puedeAgregar" class="btn-nueva" @click="mostrarNuevaDireccion = true">
              ＋ Registrar nueva dirección
            </button>
            <p v-else class="limite">
              Tienes el máximo de {{ MAX_DIRECCIONES }} ubicaciones. Elimina una desde tu perfil
              para registrar otra.
            </p>
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
          v-if="!mostrarNuevaDireccion"
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
import { ref, computed, watch, onMounted, reactive } from "vue";
import { sessionUser } from "@/utils/sessionUser";
import { useRouter } from "vue-router";
import TopBarFija from "@/components/TopBarFija.vue";
import { useCarrito } from "@/db/composables/useCarrito";
import { guardarPedidos, MENSAJE_LIMITE_CANCELACION } from "@/composables/usePedidos";
import { tiendasCerradas } from "@/composables/useHorarioTienda";
import DireccionForm from "@/components/DireccionForm.vue";
import {
  useDirecciones,
  direccionTexto,
  direccionCompleta,
  MAX_DIRECCIONES,
  type DireccionInput,
} from "@/composables/useDirecciones";
import Swal from "sweetalert2";

const { obtenerCarritoByUser, quitarArticulosDelCarrito } = useCarrito();
const router = useRouter();
const paso = ref(1);
const metodoPago = ref("");
const mpago = ref(false);
const subtotal = ref(0);
const envio = ref(0);
const total = ref(0);
const totalArticulos = ref(0);
const carrito = reactive<any[]>([]);

/* ---------- Libreta de direcciones ---------- */
const { direcciones, predeterminada, puedeAgregar, agregar: agregarDireccion } = useDirecciones();
const direccionSelId = ref("");
const mostrarSelector = ref(false);
const mostrarNuevaDireccion = ref(false);
const guardandoDireccion = ref(false);

// Al cargar, queda seleccionada la predeterminada (o la principal del registro)
watch(
  predeterminada,
  (p) => {
    if (!direccionSelId.value && p) direccionSelId.value = p.id;
  },
  { immediate: true },
);

const direccionSeleccionada = computed(
  () =>
    direcciones.value.find((d) => d.id === direccionSelId.value) ??
    predeterminada.value ??
    null,
);

/** Forma que espera guardarPedidos */
const domicilioForm = computed(() => {
  const d = direccionSeleccionada.value;
  return {
    calle: d?.calle || "",
    numero: d?.numero || "",
    colonia: d?.colonia || "",
    municipio: d?.municipio || "",
    estado: d?.estado || "",
    cp: d?.cp || "",
  };
});

/** Guarda la nueva dirección en la libreta (no toca la del registro) y la deja seleccionada */
async function guardarNuevaDireccion(input: DireccionInput) {
  guardandoDireccion.value = true;
  try {
    const id = await agregarDireccion(input);
    direccionSelId.value = id;
    mostrarNuevaDireccion.value = false;
    mostrarSelector.value = false;
  } catch (e: any) {
    Swal.fire({ icon: "error", title: "No se pudo guardar la dirección", text: e?.message || String(e) });
  } finally {
    guardandoDireccion.value = false;
  }
}
const envioFormateado = computed(() => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(envio.value);
});
const direccionFinal = computed(
  () => direccionTexto(direccionSeleccionada.value) || "Sin domicilio",
);

const siguientePaso = async () => {
  if (paso.value === 1 && !direccionCompleta(domicilioForm.value)) {
    Swal.fire({
      icon: "warning",
      title: "Falta el domicilio",
      text: "Selecciona o registra una dirección de entrega completa.",
      confirmButtonColor: "#0165d8",
    });
    return;
  }

  if (paso.value === 2 && !metodoPago.value) {
    mpago.value = true; // o un mensaje más elegante con un toast
    return; // evita pasar al siguiente paso
  }

  if (paso.value === 3) {
    console.log("Pedido confirmado:", {
      domicilio: direccionFinal.value,
      metodoPago: metodoPago.value,
    });

    try {
      await guardarPedidos(carrito, metodoPago.value, domicilioForm.value);
    } catch (e: any) {
      if (e?.name === "TiendaCerradaError") {
        // Una tienda cerró mientras se confirmaba: sus artículos se quedan en el carrito
        // y el resto del pedido se puede confirmar de nuevo.
        const cerradas = new Set((e.tiendas || []).map((t: any) => String(t.id)));
        const restantes = carrito.filter((i) => !cerradas.has(String(i.id_tienda || i.proveedor)));
        carrito.splice(0, carrito.length, ...restantes);
        recalcularTotales();
        await Swal.fire({
          title: "Tienda cerrada",
          text: restantes.length
            ? `${e.message} Puedes confirmar el resto del pedido.`
            : e.message,
          icon: "info",
          confirmButtonColor: "#0165d8",
        });
        if (!restantes.length) router.replace("/cart");
        return;
      }
      // Stock insuficiente u otro error: el carrito se conserva para que el usuario ajuste
      Swal.fire({
        title:
          e?.name === "StockInsuficienteError"
            ? "Sin stock suficiente"
            : e?.name === "TiendaNoDisponibleError"
              ? "Tienda no disponible"
              : e?.name === "ArticuloNoDisponibleError"
                ? "Venta pausada"
                : "No se pudo confirmar",
        text: e?.message || String(e),
        icon: "error",
        confirmButtonColor: "#0165d8",
      });
      return;
    }
    // Solo salen del carrito los artículos que sí se compraron; los de tiendas cerradas siguen ahí
    await quitarArticulosDelCarrito(carrito.map((i) => i.id_articulo));

    //router.push("/pedido-confirmado");

    Swal.fire({
      title: "¡Gracias por tu compra! 🎉",
      // La ventana para cancelar es corta: se avisa aquí, recién hecho el pedido,
      // que es cuando todavía se está a tiempo de usarla.
      html: `Podrás ver tu pedido en tu perfil.<br><br><strong>⏱ ${MENSAJE_LIMITE_CANCELACION}</strong>`,
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

const recalcularTotales = () => {
  subtotal.value = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  totalArticulos.value = carrito.reduce((sum, i) => sum + i.cantidad, 0);
  envio.value = subtotal.value < 200 ? 15 : 0;
  total.value = subtotal.value + envio.value;
};

/** Carga directa (sin pasar por el carrito): solo artículos de tiendas abiertas ahora */
const cargarCarrito = async () => {
  if (!sessionUser.value?.id) return;

  const items = await obtenerCarritoByUser();
  const cerradas = new Set((await tiendasCerradas(items.map((i) => i.id_tienda || ""))).map((t) => t.id));
  carrito.splice(0, carrito.length, ...items.filter((i) => !cerradas.has(String(i.id_tienda))));
  recalcularTotales();
};

const FlechaBack = () => {
  if (mostrarNuevaDireccion.value) {
    mostrarNuevaDireccion.value = false;
  } else if (paso.value > 1) {
    anteriorPaso();
  } else {
    router.back();
  }
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
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  background: var(--surface-2);
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
  background: var(--surface-2);
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
  background: var(--surface);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
  background: var(--surface-2);
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
  color: var(--text);
}

/* Selector de direcciones */
.subtitulo {
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.75rem;
}
.sin-direcciones {
  text-align: center;
  color: var(--text-muted);
}
.domicilio-alias {
  margin: 0.25rem 0 0.1rem;
  font-weight: 700;
  color: var(--text);
}
.selector-direcciones {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dir-opcion {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0.6rem 0.7rem;
  border: 1px solid #dfe5ee;
  border-radius: 10px;
  background: var(--surface-2);
  cursor: pointer;
  text-align: left;
}
.dir-opcion.activa {
  border-color: var(--color-bg-blue-ligth);
  background: #eef5ff;
}
.dir-opcion input {
  margin-top: 4px;
  accent-color: var(--color-bg-blue-dark);
}
.dir-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dir-alias {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text);
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.tag {
  font-size: 0.66rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: #e3e8ef;
  color: var(--text-muted);
}
.dir-texto {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.3;
}
.btn-nueva {
  height: 40px;
  border: 2px dashed var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--brand-navy-text);
  font-weight: 700;
  cursor: pointer;
}
.btn-nueva:hover {
  background: #eef5ff;
}
.limite {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff4e5;
  color: #8a5a00;
  font-size: 0.85rem;
  text-align: center;
}
.nueva-direccion {
  text-align: left;
}

.domicilio-card {
  background: var(--surface);
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
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  text-align: left;
}

.divider {
  border: none;
  border-top: 1px solid var(--border);
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
  border-top: 1px solid var(--border);
  padding-top: 6px;
  margin-top: 8px;
}

.resumen-articulos {
  max-height: 200px; /* limita la altura si hay muchos productos */
  overflow-y: auto; /* scroll si excede el espacio */
  margin: 1rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
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

/* ===== Responsive ===== */
.checkout-card {
  box-sizing: border-box;
}
@media (min-width: 768px) {
  .checkout-card {
    max-width: 560px;
    padding: 2.5rem;
  }
  .resumen-pedido {
    max-width: none;
  }
}
@media (max-width: 480px) {
  .checkout-container {
    padding-bottom: 2rem;
  }
  .checkout-card {
    width: 100%;
    max-width: none;
    margin: 0 0.75rem;
    padding: 1.5rem 1rem;
    border-radius: 16px;
  }
  .checkout-header {
    padding: 1.5rem 1rem;
    border-radius: 0 0 28px 28px;
    margin-bottom: 1.25rem;
  }
  .form-input {
    font-size: 16px;
  }
  .payment-options {
    gap: 1rem;
  }
}
</style>
