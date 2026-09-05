<template>
  <div class="pedido-detalle-container">
    <!-- Header -->
    <PageHeader title="Detalle del Pedido" fallback="/pedidos" />

    <div v-if="pedido" class="pedido-detalle-content">
      <!-- Datos del pedido -->
      <div class="pedido-info-card">
        <div class="info-left">
          <p style="font-size: 12px; margin-left: 5px">
            <strong>ID:</strong> {{ pedido.id_pedido }}
          </p>
          <p class="fecha">📅 {{ formatDate(pedido.fecha_hora) }}</p>
          <p>
            <span :class="['badge', getEstatusClass(pedido.estatus)]">
              {{ ESTATUS_LABEL[pedido.estatus] || pedido.estatus }}
            </span>
          </p>
          <p class="metodo-pago">
            <img
              loading="lazy"
              v-if="pedido.metodo_pago === 'Efectivo'"
              src="@/assets/icons/money.png"
              alt="Efectivo"
              class="metodo-icon"
            />
            <img
              loading="lazy"
              v-else-if="pedido.metodo_pago === 'Tarjeta'"
              src="@/assets/icons/trasfer.png"
              alt="Tarjeta"
              class="metodo-icon"
            />
            {{ pedido.metodo_pago }}
          </p>
        </div>
        <div class="info-right">
          <p class="total-label">TOTAL</p>
          <p class="total-amount">${{ pedido.total_compra }}</p>
        </div>
      </div>

      <!-- Seguimiento -->
      <div class="seguimiento-card">
        <h3>Seguimiento</h3>

        <div v-if="pedido.estatus !== 'Cancelado'" class="steps">
          <div
            v-for="(paso, i) in PASOS"
            :key="paso"
            class="step"
            :class="{ done: i <= pasoActual, current: i === pasoActual }"
          >
            <span class="step-dot">{{ i < pasoActual ? '✓' : i + 1 }}</span>
            <span class="step-label">{{ ESTATUS_LABEL[paso] }}</span>
          </div>
        </div>
        <p v-else class="cancelado-msg">
          ✖ Pedido cancelado
          <span v-if="pedido.canceladoPor">
            por {{ pedido.canceladoPor === 'cliente' ? 'ti' : 'la tienda' }}
          </span>
          <span v-if="pedido.motivoCancelacion">· {{ pedido.motivoCancelacion }}</span>
        </p>

        <!-- Estatus por tienda cuando hay varias -->
        <ul v-if="tiendas.length > 1" class="por-tienda">
          <li v-for="t in tiendas" :key="t">
            <span>{{ nombreTienda(t) }}</span>
            <span :class="['badge', getEstatusClass(estatusDeTienda(pedido, t))]">
              {{ ESTATUS_LABEL[estatusDeTienda(pedido, t)] }}
            </span>
          </li>
        </ul>

        <!-- Historial -->
        <details v-if="pedido.historial?.length" class="historial">
          <summary>Ver historial ({{ pedido.historial.length }})</summary>
          <ul>
            <li v-for="(h, i) in [...pedido.historial].reverse()" :key="i">
              <strong>{{ ESTATUS_LABEL[h.estatus] }}</strong>
              <span class="hist-meta">
                {{ h.por === 'cliente' ? 'Tú' : h.por === 'tienda' ? 'Tienda' : 'Sistema' }}
                · {{ formatFechaISO(h.fecha) }}
              </span>
              <em v-if="h.nota">{{ h.nota }}</em>
            </li>
          </ul>
        </details>

        <button
          v-if="puedeCancelar"
          class="btn-cancelar"
          :disabled="cancelando"
          @click="cancelar"
        >
          {{ cancelando ? 'Cancelando...' : 'Cancelar pedido' }}
        </button>
        <p v-else-if="pedido.estatus === 'Enviado'" class="hint">
          Tu pedido ya va en camino. Para cancelarlo contacta a la tienda.
        </p>
      </div>

      <!-- Domicilio -->
      <div class="domicilio-card">
        <h3>Domicilio</h3>
        <p>{{ pedido.domicilio.calleNumero }}</p>
        <p>{{ pedido.domicilio.codigoPostal }}, {{ pedido.domicilio.lugar }}</p>
        <p>{{ pedido.domicilio.municipio }}, {{ pedido.domicilio.estado }}</p>
      </div>

      <!-- Items -->
      <div class="pedido-items">
        <h3>Artículos</h3>
        <div
          v-for="item in pedido.items"
          :key="item.id_articulo"
          class="pedido-item-card"
        >
          <img
            loading="lazy"
            :src="FIREBASE_STORAGE_BASE_URL + item.url_image || defaultImage"
            class="producto-img"
          />
          <div>
            <p class="nombre">{{ item.nombreProducto }}</p>
            <p class="cantidad">Cantidad: {{ item.cantidad }}</p>
            <p class="precio">Precio: ${{ item.precio }}</p>
          </div>
        </div>
      </div>
    </div>

    <p v-else>Cargando pedido...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import Swal from "sweetalert2";
import {
  getPedidoById,
  cancelarPedidoCliente,
  tiendasDelPedido,
  estatusDeTienda,
  puedeTransicionar,
  ESTATUS_LABEL,
  type EstatusPedido,
} from "@/composables/usePedidos";
import type { Pedido } from "@/composables/usePedidos";
import { useTiendas } from "@/composables/useTiendas";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import PageHeader from "@/components/PageHeader.vue";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import moneyIcon from "@/assets/icons/money.png";
import cardIcon from "@/assets/icons/trasfer.png";

const route = useRoute();
const pedido = ref<Pedido | null>(null);
const defaultImage = userDefaultImage;

const PASOS: EstatusPedido[] = ["Preparacion", "Enviado", "Entregado"];
const pasoActual = computed(() =>
  pedido.value ? Math.max(0, PASOS.indexOf(pedido.value.estatus)) : 0
);

const tiendas = computed(() => (pedido.value ? tiendasDelPedido(pedido.value) : []));
const nombresTienda = ref<Record<string, string>>({});
const { obtenerTienda } = useTiendas();
const nombreTienda = (id: string) => nombresTienda.value[id] || "Tienda";

const puedeCancelar = computed(() => {
  const p = pedido.value;
  if (!p) return false;
  return (
    puedeTransicionar(p.estatus, "Cancelado", "cliente") &&
    tiendas.value.every((t) => puedeTransicionar(estatusDeTienda(p, t), "Cancelado", "cliente"))
  );
});

const cancelando = ref(false);
async function cancelar() {
  if (!pedido.value) return;
  const { isConfirmed, value } = await Swal.fire({
    title: "¿Cancelar tu pedido?",
    text: "Los artículos volverán a estar disponibles en la tienda.",
    input: "text",
    inputPlaceholder: "Motivo (opcional)",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, cancelar",
    cancelButtonText: "Volver",
    confirmButtonColor: "#e74c3c",
  });
  if (!isConfirmed) return;
  cancelando.value = true;
  try {
    pedido.value = await cancelarPedidoCliente(pedido.value, value || undefined);
    Swal.fire({ icon: "success", title: "Pedido cancelado", timer: 1800, showConfirmButton: false });
  } catch (e: any) {
    Swal.fire({ icon: "error", title: "No se pudo cancelar", text: e?.message || String(e) });
  } finally {
    cancelando.value = false;
  }
}

function formatFechaISO(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

onMounted(async () => {
  const idPedido = route.params.id as string;
  pedido.value = await getPedidoById(idPedido);
  for (const t of tiendas.value) {
    obtenerTienda(t).then((tienda) => {
      if (tienda) nombresTienda.value[t] = tienda.nombreTienda;
    });
  }
});

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const parts = dateStr.split(",");
  return parts[0].trim();
}

function getEstatusClass(estatus: string) {
  switch (estatus.toLowerCase()) {
    case "preparacion":
      return "estatus-preparacion";
    case "enviado":
      return "estatus-enviado";
    case "entregado":
      return "estatus-entregado";
    case "cancelado":
      return "estatus-cancelado";
    default:
      return "";
  }
}
</script>

<style scoped>
.pedido-detalle-container {
  width: 95%;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.header-bar {
  display: flex;
  align-items: center;
  background: var(--color-bg-blue-dark);
  color: white;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  margin-bottom: 1.2rem;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.back-button {
  width: 28px;
  height: 28px;
  cursor: pointer;
  margin-right: 0.5rem;
}

.pedido-info-card {
  display: flex;
  justify-content: space-between; /* mantiene el total a la derecha */
  align-items: center; /* centra verticalmente todo el contenido */
  background: #ffffff;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.info-left {
  display: flex;
  flex-direction: column;
  justify-content: center; /* centra verticalmente las líneas */
  gap: 0.3rem;
}

.info-left p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: #333;
  display: flex; /* para que iconos y texto estén alineados */
  align-items: center; /* centra verticalmente icono y texto */
  gap: 0.4rem;
}

.info-right {
  text-align: center;
  background: #f0f4ff;
  padding: 0.7rem 1.2rem;
  border-radius: 10px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center; /* <-- centra verticalmente */
  align-items: center;
}

.fecha {
  font-size: 0.8rem;
  color: #777;
}

.metodo-pago {
  display: flex;
  align-items: center;
  gap: 0.4rem; /* separación entre icono y texto */
  margin: 0.25rem 0;
}

.metodo-icon {
  width: 20px;
  height: 20px;
}

.total-label {
  font-size: 0.85rem;
  font-weight: bold;
  color: #555;
  text-align: center;
  margin-bottom: 0.2rem;
}

.total-amount {
  font-size: 1.3rem;
  font-weight: bold;
  color: #1a73e8;
}

/* Estilos de estatus */
.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: capitalize;
}

.estatus-preparacion {
  background: #e3f2fd;
  color: #1976d2;
}

.estatus-enviado {
  background: #fff4e5;
  color: #b9770e;
}

.estatus-entregado {
  background: #e8f5e9;
  color: #2e7d32;
}

.estatus-cancelado {
  background: #ffebee;
  color: #c62828;
}

/* Seguimiento */
.seguimiento-card {
  background: #fff;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}
.seguimiento-card h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--color-bg-blue-dark);
}
.steps {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  margin: 0.5rem 0 1rem;
}
.steps::before {
  content: "";
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: #e3e8ef;
  z-index: 0;
}
.step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  text-align: center;
}
.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #cfd6df;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}
.step.done .step-dot {
  background: var(--color-bg-blue-ligth);
  border-color: var(--color-bg-blue-ligth);
  color: #fff;
}
.step.current .step-dot {
  box-shadow: 0 0 0 4px rgba(1, 101, 216, 0.18);
}
.step-label {
  font-size: 0.75rem;
  color: #666;
}
.step.done .step-label {
  color: #222;
  font-weight: 600;
}
.cancelado-msg {
  color: #c62828;
  font-weight: 600;
  margin: 0.25rem 0 0.75rem;
}
.por-tienda {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}
.por-tienda li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f7f9fc;
  padding: 6px 10px;
  border-radius: 8px;
}
.historial {
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.historial summary {
  cursor: pointer;
  color: var(--color-bg-blue-ligth);
  font-weight: 600;
}
.historial ul {
  list-style: none;
  padding: 0.5rem 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.historial li {
  display: flex;
  flex-direction: column;
  padding-left: 10px;
  border-left: 2px solid #e3e8ef;
}
.hist-meta {
  color: #888;
  font-size: 0.78rem;
}
.historial em {
  color: #555;
}
.btn-cancelar {
  width: 100%;
  padding: 0.7rem;
  border: 2px solid #e74c3c;
  border-radius: 10px;
  background: #fff;
  color: #e74c3c;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancelar:hover:not(:disabled) {
  background: #e74c3c;
  color: #fff;
}
.btn-cancelar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: #777;
}

.domicilio-card {
  background: #f7f9fc;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.domicilio-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--color-bg-blue-dark);
}

.pedido-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pedido-item-card {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.pedido-item-card:hover {
  transform: translateY(-3px);
}

.producto-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 8px;
}

.nombre {
  font-weight: bold;
  margin: 0;
}
.cantidad,
.precio {
  margin: 0;
  font-size: 0.85rem;
  color: #555;
}
</style>
