<template>
  <div class="pedidos-list-container">
    <!-- Header -->
    <div class="header-bar" v-if="props.showHeader">
      <ArrowBack class="back-button" @click="$router.back()" />
      <h2 class="header-title">Mis Pedidos</h2>
      <div class="header-icons">
        <button class="icon-btn icon-circle" @click="toggleFiltros">
          <img loading="lazy" src="@/assets/icons/filter.png" alt="Filtro" />
        </button>
      </div>
    </div>

    <!-- Filtros desplegables -->
    <transition name="slide-fade" v-if="props.showHeader">
      <div v-show="showFiltros" class="filtros">
        <input type="date" v-model="filtroFecha" class="filtro-input" />

        <select v-model="filtroEstatus" class="filtro-input">
          <option value="">Todos</option>
          <option value="Preparacion">Preparación</option>
          <option value="Entregado">Entregado</option>
          <option value="Camino">Camino</option>
          <option value="Cancelado">Cancelado</option>
        </select>

        <button class="icon-btn" @click="limpiarFiltros">
          <img loading="lazy" src="@/assets/icons/clean.png" alt="Limpiar" />
        </button>

        <input
          type="text"
          v-model="filtroArticulo"
          placeholder="Buscar artículo..."
          class="filtro-input"
        />
      </div>
    </transition>

    <!-- Lista de pedidos con paginación -->
    <div
      v-for="pedido in props.showHeader
        ? pedidosPaginados
        : pedidosPaginados.slice(0, 3)"
      :key="pedido.id_pedido"
      class="pedido-card"
      @click="abrirDetallePedido(pedido)"
    >
      <div class="pedido-header">
        <span class="fecha">{{ formatDate(pedido.fecha_hora) }}</span>
        <span class="id">ID: {{ pedido.id_pedido }}</span>
      </div>

      <hr />

      <div class="pedido-item">
        <div class="mini-img-grid">
          <div
            v-for="(item, index) in pedido.items.slice(0, 4)"
            :key="item.id_articulo"
            class="mini-img-wrapper"
          >
            <img
              loading="lazy"
              :src="FIREBASE_STORAGE_BASE_URL + item.url_image || defaultImage"
              class="mini-img"
              @error="onImageError($event)"
            />
            <div
              v-if="index === 3 && pedido.items.length > 4"
              class="overlay-more"
            >
              +{{ pedido.items.length - 4 }}
            </div>
          </div>
        </div>

        <div class="detalle-right">
          <p class="estatus">{{ pedido.estatus }}</p>
          <p class="fecha-entrega">
            Entrega: {{ formatDate(pedido.fechaEntrega || "") }}
          </p>
          <p class="cantidad">Total: ${{ pedido.total_compra }}</p>
        </div>
      </div>
    </div>

    <p v-if="pedidosFiltrados.length === 0">No se encontraron pedidos.</p>

    <!-- Controles de paginación -->
    <div v-if="totalPaginas > 1 && props.showHeader" class="pagination">
      <button
        class="page-btn"
        :disabled="paginaActual === 1"
        @click="paginaActual--"
      >
        ◀ Anterior
      </button>
      <span class="page-info"
        >Página {{ paginaActual }} de {{ totalPaginas }}</span
      >
      <button
        class="page-btn"
        :disabled="paginaActual === totalPaginas"
        @click="paginaActual++"
      >
        Siguiente ▶
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getPedidosByUser } from "@/composables/usePedidos";
import type { Pedido } from "@/composables/usePedidos";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { useRouter } from "vue-router";
import ArrowBack from "@/components/ArrowBack.vue";

const router = useRouter();
const pedidos = ref<Pedido[]>([]);
const defaultImage = userDefaultImage;

// Props
const props = withDefaults(
  defineProps<{
    limit?: number;
    showHeader?: boolean;
  }>(),
  { limit: undefined, showHeader: true }
);

// Filtros
const filtroFecha = ref<string>("");
const filtroArticulo = ref<string>("");
const filtroEstatus = ref<string>("");
const showFiltros = ref(false);
// Paginación
const paginaActual = ref(1);
const itemsPorPagina = 5;

// Función para parsear fecha del formato "11/9/2025, 11:34:09 a.m."
function parseFechaHora(fechaHora?: string): Date | null {
  if (!fechaHora) return null;
  const [fechaPart, horaPart] = fechaHora.split(",").map((x) => x.trim());
  const [dia, mes, anio] = fechaPart.split("/").map(Number);

  let hours = 0,
    minutes = 0,
    seconds = 0;
  if (horaPart) {
    const match = horaPart.match(/(\d+):(\d+):(\d+)\s*(a\.m\.|p\.m\.)/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      seconds = parseInt(match[3], 10);
      const ampm = match[4].toLowerCase();
      if (ampm === "p.m." && hours < 12) hours += 12;
      if (ampm === "a.m." && hours === 12) hours = 0;
    }
  }
  return new Date(anio, mes - 1, dia, hours, minutes, seconds);
}

// Computed con filtros aplicados y ordenados de más reciente a menos reciente
const pedidosFiltrados = computed(() => {
  let filtrados = pedidos.value.filter((pedido) => {
    const fechaOk = filtroFecha.value
      ? (() => {
          const f = filtroFecha.value.split("-");
          const fDate = new Date(Number(f[0]), Number(f[1]) - 1, Number(f[2]));
          const pDate = parseFechaHora(pedido.fecha_hora);
          if (!pDate) return false;
          return (
            pDate.getFullYear() === fDate.getFullYear() &&
            pDate.getMonth() === fDate.getMonth() &&
            pDate.getDate() === fDate.getDate()
          );
        })()
      : true;

    const articuloOk = filtroArticulo.value
      ? pedido.items.some((item) =>
          item.nombreProducto
            .toLowerCase()
            .includes(filtroArticulo.value.toLowerCase())
        )
      : true;

    const estatusOk = filtroEstatus.value
      ? pedido.estatus.toLowerCase() === filtroEstatus.value.toLowerCase()
      : true;

    return fechaOk && articuloOk && estatusOk;
  });

  filtrados.sort((a, b) => {
    const ta = parseFechaHora(a.fecha_hora)?.getTime() ?? 0;
    const tb = parseFechaHora(b.fecha_hora)?.getTime() ?? 0;
    return tb - ta;
  });

  return filtrados;
});

// Paginación
const totalPaginas = computed(() =>
  Math.ceil(pedidosFiltrados.value.length / itemsPorPagina)
);

const pedidosPaginados = computed(() => {
  const start = (paginaActual.value - 1) * itemsPorPagina;
  return pedidosFiltrados.value.slice(start, start + itemsPorPagina);
});

// Funciones
function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  return dateStr.split(",")[0].trim();
}

function abrirDetallePedido(pedido: Pedido) {
  router.push({
    name: "PedidoDetallePage",
    params: { id: pedido.id_pedido },
  });
}

function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = defaultImage;
}

function toggleFiltros() {
  showFiltros.value = !showFiltros.value;
}

function limpiarFiltros() {
  filtroFecha.value = "";
  filtroArticulo.value = "";
  filtroEstatus.value = "";
  paginaActual.value = 1;
}

onMounted(async () => {
  pedidos.value = await getPedidosByUser();
});
</script>

<style scoped>
/* Contenedor principal */
.pedidos-list-container {
  width: 90%;
  max-width: 700px;
  margin: 0 auto;
  padding-bottom: 2rem;
  font-family: "Arial", sans-serif;
}
.icon-circle {
  width: 36px;
  height: 36px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  border: none;
  padding: 6px;
}
.filter-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: brightness(0);
}
/* Header */
.header-bar {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  background: var(--color-bg-blue-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.75rem;
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-bottom: 10px;
  border-radius: 10px;
}
.back-button {
  width: 26px;
  height: 26px;
}
.header-title {
  color: white;
  font-weight: bold;
  font-size: 0.95rem;
}
.header-icons {
  display: flex;
  gap: 8px;
}
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
}
.icon-btn img {
  width: 22px;
  height: 22px;
}
/* Filtros */
.filtros {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  padding: 8px;
  background: #f2f4f8;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.filtro-input {
  flex: 1;
  min-width: 120px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
/* Transición filtros */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
/* Pedido card */
.pedido-card {
  background: white;
  border-radius: 10px;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.8rem;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  font-size: 12px;
}
.pedido-card:hover {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}
/* Pedido header */
.pedido-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.8rem;
  color: #333;
}
/* Pedido items */
.pedido-item {
  display: flex;
  gap: 8px;
  margin-top: 5px;
  align-items: center;
}
/* Mini imágenes */
.mini-img-grid {
  display: grid;
  grid-template-columns: repeat(2, 45px);
  grid-template-rows: repeat(2, 45px);
  gap: 3px;
}
.mini-img-wrapper {
  position: relative;
}
.mini-img {
  width: 45px;
  height: 45px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eee;
}
.overlay-more {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.55);
  color: white;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.75rem;
}
/* Info derecha */
.detalle-right {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 90px;
}
.estatus {
  font-weight: 600;
  color: #0f1f7c;
  font-size: 12px;
  margin: 0;
}
.fecha-entrega,
.cantidad {
  font-size: 11px;
  color: #555;
  margin: 0;
}
/* Paginación */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
  gap: 12px;
}
.page-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-blue-dark);
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.page-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.page-info {
  font-size: 0.9rem;
  font-weight: 500;
}
</style>
