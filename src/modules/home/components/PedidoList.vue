<template>
  <div class="pedidos-list-container">
    <div class="header-bar" v-if="props.showHeader">
      <ArrowBack class="back-button" @click="$router.back()" />
      <h2 class="header-title">Mis Pedidos</h2>
    </div>

    <div
      v-for="pedido in pedidos.slice(0, props.limit || pedidos.length)"
      :key="pedido.id_pedido"
      class="pedido-card"
    >
      <!-- Solo mostrar header si showHeader es true -->
      <div class="pedido-header">
        <span class="fecha">{{ formatDate(pedido.fecha_hora) }}</span>
        <span class="id">ID: {{ pedido.id_pedido }}</span>
      </div>

      <hr />

      <!-- Items del pedido -->
      <div
        v-for="item in pedido.items.slice(0, 3)"
        :key="item.id_articulo"
        class="pedido-item"
      >
        <img
          :src="FIREBASE_STORAGE_BASE_URL + item.url_image || defaultImage"
          alt="Producto"
          class="producto-img"
          @error="onImageError($event)"
        />
        <div class="detalle-right">
          <p class="estatus">{{ pedido.estatus }}</p>
          <p class="fecha-entrega">
            Entrega: {{ formatDate(pedido.fechaEntrega || "") }}
          </p>
          <p class="cantidad">Cant: {{ item.cantidad }}</p>
        </div>
      </div>

      <p
        v-if="pedido.items.length > 3"
        class="mas-items"
        @click="abrirDialog(pedido)"
      >
        +{{ pedido.items.length - 3 }} más...
      </p>
      <p class="mas-items" @click="abrirDialog(pedido)" v-else>ver más...</p>
    </div>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :closable="true"
      :style="{ width: '100%', maxWidth: '700px', height: '90vh' }"
      class="pedido-dialog-full"
    >
      <PedidoDetalle :pedido="selectedPedido" />
    </Dialog>

    <p v-if="pedidos.length === 0">No tienes pedidos registrados.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getPedidosByUser } from "@/composables/usePedidos";
import type { Pedido } from "@/composables/usePedidos";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import ArrowBack from "@/components/ArrowBack.vue";
import PedidoDetalle from "./PedidoDetalle.vue";

const pedidos = ref<Pedido[]>([]);
const selectedPedido = ref<Pedido | null>(null);
const dialogVisible = ref(false);
const defaultImage = userDefaultImage;
const props = withDefaults(
  defineProps<{
    limit?: number;
    showHeader?: boolean;
    showVerTodos?: boolean;
    onVerTodos?: () => void; // función para el botón "Ver todos"
  }>(),
  {
    showHeader: true, // valor por defecto
    limit: undefined,
    showVerTodos: false,
    onVerTodos: undefined,
  }
);
function abrirDialog(pedido: Pedido) {
  selectedPedido.value = pedido;
  dialogVisible.value = true;
}

function cerrarDialog() {
  dialogVisible.value = false;
  selectedPedido.value = null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  // Separar fecha y hora usando la coma
  const parts = dateStr.split(",");
  return parts[0].trim(); // solo la fecha, e.g., "11/9/2025"
}
function mostrarMasItems(pedido: Pedido) {
  console.log("Items completos del pedido:", pedido.items);
}

function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = defaultImage;
}

onMounted(async () => {
  pedidos.value = await getPedidosByUser();
});
</script>

<style scoped>
/* overlay oscuro */
.pedido-dialog-full .p-dialog-mask {
  background-color: rgba(0, 0, 0, 0.6) !important;
}

/* dialogo ocupa toda la pantalla */
.pedido-dialog-full .p-dialog {
  width: 100vw !important;
  height: 100vh !important;
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent !important; /* transparente para que se vea overlay */
}

/* contenedor blanco dentro del dialogo */
.pedido-detalle-container {
  width: 100%;
  height: 100%;
  background-color: white; /* aquí pones el fondo blanco */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
}

/* Estilos para la barra superior */
.header-bar {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  background: var(--color-bg-blue-dark);
  display: flex;
  align-items: center;
  padding: 0.25rem 0.75rem; /* más delgada */
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-bottom: 30px;
}
.back-button {
  width: 30px;
  height: 30px;
}

.header-title {
  color: white;
  font-weight: bold;
  font-size: 1rem; /* más pequeña */
  margin-left: 0.75rem;
}

/* Opcional: agregar padding superior al container para que no quede debajo del header */
.pedidos-list-container {
  padding-top: 1rem;
}

.mas-items {
  font-size: 0.85rem;
  color: #555;
  text-align: end;
  cursor: pointer;
  user-select: none;
}
.mas-items:hover {
  text-decoration: underline;
}
.id {
  font-size: 12px;
  color: var(--color-bg-blue-ligth);
}
.fecha {
  font-size: 12px;
}
.pedidos-list-container {
  width: 90%;
  max-width: 700px;
  margin: 0 auto;
  padding-bottom: 3rem;
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 1rem 0;
}

.empty {
  text-align: center;
  font-size: 1rem;
  color: #555;
  margin-top: 2rem;
}

.pedido-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;

  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s ease;
}

.pedido-card:hover {
  border: 1px solid #0f1f7c46;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); /* más sombra al pasar el mouse */
}
.pedido-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
  color: #333;
}

.pedido-item {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem; /* menos espacio superior */
  align-items: flex-start; /* alineamos al top */
  border-bottom: 1px solid #eee;
  padding-bottom: 0.25rem; /* menos padding inferior */
  margin-bottom: 0.25rem; /* menos margen inferior */
}

.producto-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #eee;
}
.detalle-right {
  display: flex;
  flex-direction: column;
  gap: 2px; /* espacio mínimo entre líneas */
}
.nombre {
  font-weight: bold;
  color: #222;
  font-size: 0.95rem; /* un poquito más pequeño */
  margin: 0; /* eliminamos margen */
}

.estatus {
  font-weight: 600;
  color: #0f1f7c;
  font-size: 13px; /* tamaño mínimo fijo */
  margin: 0;
}

.fecha-entrega {
  font-size: 12px;
  color: #555;
  margin: 0;
}
.cantidad {
  font-size: 0.7rem;
  color: #555;
  margin: 0;
}
</style>
