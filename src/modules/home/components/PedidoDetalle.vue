<template>
  <div class="pedido-detalle-container">
    <!-- Header -->
    <div class="header-bar">
      <ArrowBack class="back-button" @click="$router.back()" />
      <h2 class="header-title">Detalle del Pedido</h2>
    </div>

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
              {{ pedido.estatus }}
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
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getPedidoById } from "@/composables/usePedidos";
import type { Pedido } from "@/composables/usePedidos";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import ArrowBack from "@/components/ArrowBack.vue";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import moneyIcon from "@/assets/icons/money.png";
import cardIcon from "@/assets/icons/trasfer.png";

const route = useRoute();
const pedido = ref<Pedido | null>(null);
const defaultImage = userDefaultImage;

onMounted(async () => {
  const idPedido = route.params.id as string;
  pedido.value = await getPedidoById(idPedido);
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

.estatus-entregado {
  background: #e8f5e9;
  color: #2e7d32;
}

.estatus-cancelado {
  background: #ffebee;
  color: #c62828;
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
