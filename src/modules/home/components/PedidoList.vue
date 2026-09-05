<template>
  <div class="pedidos-list-container">
    <!-- Header -->
    <PageHeader v-if="props.showHeader" title="Mis Pedidos" fallback="/perfil" sticky>
        <button
          class="icon-btn icon-circle"
          :class="{ 'has-filters': filtrosActivos > 0 }"
          @click="toggleFiltros"
          :title="filtrosActivos ? `Filtros (${filtrosActivos} activos)` : 'Filtros'"
        >
          <img loading="lazy" src="@/assets/icons/filter.png" alt="Filtro" class="filter-icon" />
          <span v-if="filtrosActivos" class="filter-badge">{{ filtrosActivos }}</span>
        </button>
    </PageHeader>

    <!-- Pestañas: por entregar / entregados / cancelados -->
    <div v-if="props.showHeader" class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="tab"
        :class="{ active: tabActiva === tab.id }"
        @click="cambiarTab(tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span class="tab-count">{{ conteos[tab.id] }}</span>
      </button>
    </div>

    <!-- Filtros desplegables -->
    <transition name="slide-fade" v-if="props.showHeader">
      <div v-show="showFiltros" class="filtros">
        <input
          type="search"
          v-model="filtroArticulo"
          placeholder="Artículo o # de pedido..."
          class="filtro-input filtro-buscar"
          aria-label="Buscar por artículo o número de pedido"
        />
        <label class="filtro-campo">
          <span>Desde</span>
          <input type="date" v-model="fechaDesde" class="filtro-input" aria-label="Desde" />
        </label>
        <label class="filtro-campo">
          <span>Hasta</span>
          <input type="date" v-model="fechaHasta" class="filtro-input" aria-label="Hasta" />
        </label>
        <select v-model="filtroPago" class="filtro-input" aria-label="Método de pago">
          <option value="">Cualquier pago</option>
          <option v-for="mp in metodosPago" :key="mp" :value="mp">{{ mp }}</option>
        </select>
        <select v-model="orden" class="filtro-input" aria-label="Ordenar">
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
          <option value="mayor">Mayor total</option>
          <option value="menor">Menor total</option>
        </select>
        <button class="icon-btn limpiar" @click="limpiarFiltros" title="Limpiar filtros">
          <img loading="lazy" src="@/assets/icons/clean.png" alt="" /> Limpiar
        </button>
      </div>
    </transition>

    <!-- Estados -->
    <p v-if="cargando" class="empty">Cargando pedidos...</p>
    <p v-else-if="pedidosPaginados.length === 0" class="empty">
      {{ mensajeVacio }}
    </p>

    <!-- Lista de pedidos -->
    <div class="lista" :class="{ horizontal: props.horizontal }">
    <div
      v-for="pedido in pedidosPaginados"
      :key="pedido.id_pedido"
      class="pedido-card"
      :class="'estado-' + pedido.estatus.toLowerCase()"
      @click="abrirDetallePedido(pedido)"
    >
      <!-- Encabezado del pedido -->
      <div class="pedido-header">
        <div class="pedido-meta">
          <span class="fecha">📅 {{ formatFecha(pedido) }}</span>
          <span class="id" :title="pedido.id_pedido">#{{ pedido.id_pedido?.slice(-6) }}</span>
        </div>
        <span class="estatus" :class="'estatus-' + pedido.estatus.toLowerCase()">
          {{ ESTATUS_LABEL[pedido.estatus] || pedido.estatus }}
        </span>
      </div>

      <!-- Artículos del pedido -->
      <ul class="items">
        <li
          v-for="(item, i) in itemsVisibles(pedido)"
          :key="item.id_articulo + '-' + i"
          class="item"
        >
          <img
            loading="lazy"
            :src="imagenUrl(item.url_image) || defaultImage"
            :alt="item.nombreProducto"
            class="item-img"
            @error="onImageError($event)"
          />
          <div class="item-info">
            <p class="item-nombre">{{ item.nombreProducto }}</p>
            <p class="item-detalle">
              {{ item.cantidad }} × ${{ Number(item.precio).toFixed(2) }}
              <span v-if="item.categoria" class="item-cat">· {{ item.categoria }}</span>
            </p>
          </div>
          <span class="item-total">${{ (item.cantidad * item.precio).toFixed(2) }}</span>
        </li>
        <li v-if="pedido.items.length > MAX_ITEMS && !expandidos.has(pedido.id_pedido!)" class="item-more">
          <button class="link-btn" @click.stop="expandir(pedido.id_pedido!)">
            Ver {{ pedido.items.length - MAX_ITEMS }} artículo(s) más
          </button>
        </li>
      </ul>

      <!-- Pie del pedido -->
      <div class="pedido-footer">
        <span class="resumen">
          {{ totalUnidades(pedido) }} {{ totalUnidades(pedido) === 1 ? 'artículo' : 'artículos' }}
          · {{ pedido.metodo_pago }}
        </span>
        <span class="total">Total ${{ Number(pedido.total_compra).toFixed(2) }}</span>
      </div>
      <p v-if="pedido.estatus === 'Entregado' && pedido.fechaEntrega" class="entregado-en">
        Entregado el {{ pedido.fechaEntrega.split(',')[0] }}
      </p>
    </div>
    </div>

    <!-- Controles de paginación -->
    <div v-if="totalPaginas > 1 && props.showHeader" class="pagination">
      <button class="page-btn" :disabled="paginaActual === 1" @click="paginaActual--">
        ◀ Anterior
      </button>
      <span class="page-info">Página {{ paginaActual }} de {{ totalPaginas }}</span>
      <button class="page-btn" :disabled="paginaActual === totalPaginas" @click="paginaActual++">
        Siguiente ▶
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  suscribirPedidosUsuario,
  fechaPedido,
  ESTATUS_LABEL,
  type Pedido,
  type EstatusPedido,
} from "@/composables/usePedidos";
import { sessionUser } from "@/utils/sessionUser";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { imagenUrl } from "@/constants/firebase_util";
import PageHeader from "@/components/PageHeader.vue";

const router = useRouter();
const defaultImage = userDefaultImage;

// Props
const props = withDefaults(
  defineProps<{
    limit?: number;
    showHeader?: boolean;
    showVerTodos?: boolean;
    /** Tarjetas en fila con desplazamiento lateral (perfil) */
    horizontal?: boolean;
  }>(),
  { limit: undefined, showHeader: true, showVerTodos: false, horizontal: false }
);

/* ---------- Pestañas ---------- */
type TabId = "pendientes" | "entregados" | "cancelados";
const TABS: { id: TabId; label: string; estatus: EstatusPedido[] }[] = [
  { id: "pendientes", label: "Por entregar", estatus: ["Preparacion", "Enviado"] },
  { id: "entregados", label: "Entregados", estatus: ["Entregado"] },
  { id: "cancelados", label: "Cancelados", estatus: ["Cancelado"] },
];
const tabActiva = ref<TabId>("pendientes");

function cambiarTab(id: TabId) {
  tabActiva.value = id;
  paginaActual.value = 1;
}

/* ---------- Datos (en vivo) ---------- */
const pedidos = ref<Pedido[]>([]);
const cargando = ref(true);
let detener: (() => void) | null = null;

function suscribir() {
  detener?.();
  cargando.value = true;
  detener = suscribirPedidosUsuario((lista) => {
    pedidos.value = lista;
    cargando.value = false;
  });
}
onMounted(suscribir);
watch(() => sessionUser.value?.id, suscribir);
onUnmounted(() => detener?.());

const conteos = computed<Record<TabId, number>>(() => {
  const c: Record<TabId, number> = { pendientes: 0, entregados: 0, cancelados: 0 };
  for (const p of pedidos.value) {
    const tab = TABS.find((t) => t.estatus.includes(p.estatus))?.id ?? "pendientes";
    c[tab]++;
  }
  return c;
});

/* ---------- Filtros ---------- */
const filtroArticulo = ref("");
const fechaDesde = ref("");
const fechaHasta = ref("");
const filtroPago = ref("");
type Orden = "recientes" | "antiguos" | "mayor" | "menor";
const orden = ref<Orden>("recientes");
const showFiltros = ref(false);

const filtrosActivos = computed(
  () =>
    [filtroArticulo.value, fechaDesde.value, fechaHasta.value, filtroPago.value].filter(Boolean).length +
    (orden.value !== "recientes" ? 1 : 0)
);

const metodosPago = computed(() =>
  [...new Set(pedidos.value.map((p) => p.metodo_pago).filter(Boolean))].sort()
);
const MAX_ITEMS = 3;
const expandidos = ref<Set<string>>(new Set());

/** Límites de un día en hora local */
const inicioDia = (yyyyMmDd: string) => {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};
const finDia = (yyyyMmDd: string) => inicioDia(yyyyMmDd) + 24 * 60 * 60 * 1000 - 1;

const coincideBusqueda = (p: Pedido, q: string) =>
  p.items.some((i) => i.nombreProducto?.toLowerCase().includes(q)) ||
  (p.id_pedido || "").toLowerCase().includes(q.replace(/^#/, ""));

const pedidosFiltrados = computed(() => {
  // En el perfil (sin header) se listan todos los estatus; en la vista completa, la pestaña activa
  const estatusTab = props.showHeader
    ? TABS.find((t) => t.id === tabActiva.value)!.estatus
    : null;

  const q = filtroArticulo.value.trim().toLowerCase();

  const desde = fechaDesde.value ? inicioDia(fechaDesde.value) : -Infinity;
  const hasta = fechaHasta.value ? finDia(fechaHasta.value) : Infinity;

  const comparar: Record<Orden, (a: Pedido, b: Pedido) => number> = {
    recientes: (a, b) => fechaPedido(b) - fechaPedido(a),
    antiguos: (a, b) => fechaPedido(a) - fechaPedido(b),
    mayor: (a, b) => Number(b.total_compra) - Number(a.total_compra),
    menor: (a, b) => Number(a.total_compra) - Number(b.total_compra),
  };

  return pedidos.value
    .filter((p) => !estatusTab || estatusTab.includes(p.estatus))
    .filter((p) => {
      const t = fechaPedido(p);
      return t >= desde && t <= hasta;
    })
    .filter((p) => !filtroPago.value || p.metodo_pago === filtroPago.value)
    .filter((p) => !q || coincideBusqueda(p, q))
    .sort(comparar[props.showHeader ? orden.value : "recientes"]);
});

const mensajeVacio = computed(() => {
  if (filtrosActivos.value) return "Ningún pedido coincide con los filtros.";
  if (!props.showHeader) return "No tienes pedidos registrados.";
  return {
    pendientes: "No tienes pedidos por entregar. 🎉",
    entregados: "Aún no tienes pedidos entregados.",
    cancelados: "No tienes pedidos cancelados.",
  }[tabActiva.value];
});

/* ---------- Paginación ---------- */
const paginaActual = ref(1);
const itemsPorPagina = 5;

const totalPaginas = computed(() =>
  Math.max(1, Math.ceil(pedidosFiltrados.value.length / itemsPorPagina))
);

const pedidosPaginados = computed(() => {
  if (props.limit) return pedidosFiltrados.value.slice(0, props.limit);
  const start = (paginaActual.value - 1) * itemsPorPagina;
  return pedidosFiltrados.value.slice(start, start + itemsPorPagina);
});

watch([filtroArticulo, fechaDesde, fechaHasta, filtroPago, orden], () => (paginaActual.value = 1));

/* ---------- Helpers ---------- */
function itemsVisibles(p: Pedido) {
  return expandidos.value.has(p.id_pedido!) ? p.items : p.items.slice(0, MAX_ITEMS);
}
function expandir(id: string) {
  expandidos.value = new Set([...expandidos.value, id]);
}
const totalUnidades = (p: Pedido) => p.items.reduce((s, i) => s + (i.cantidad || 0), 0);

function formatFecha(p: Pedido) {
  const t = fechaPedido(p);
  if (!t) return p.fecha_hora?.split(",")[0] ?? "-";
  return new Date(t).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function toggleFiltros() {
  showFiltros.value = !showFiltros.value;
}
function limpiarFiltros() {
  filtroArticulo.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
  filtroPago.value = "";
  orden.value = "recientes";
}
function abrirDetallePedido(pedido: Pedido) {
  router.push({ name: "PedidoDetallePage", params: { id: pedido.id_pedido } });
}
function onImageError(event: Event) {
  (event.target as HTMLImageElement).src = defaultImage;
}
</script>

<style scoped>
.pedidos-list-container {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 0.75rem 2rem;
  box-sizing: border-box;
  font-family: "Poppins", Arial, sans-serif;
}

/* Header */
.header-bar {
  position: sticky;
  top: 0;
  width: 100%;
  background: var(--color-bg-blue-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin: 0.5rem 0 0.75rem;
  border-radius: 10px;
  box-sizing: border-box;
}
.back-button {
  width: 26px;
  height: 26px;
}
.header-title {
  color: white;
  font-weight: bold;
  font-size: 1rem;
  margin: 0;
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
.icon-circle {
  position: relative;
  width: 36px;
  height: 36px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  padding: 6px;
}
/* El PNG del filtro es blanco: lo pintamos negro sobre el círculo blanco */
.filter-icon {
  filter: brightness(0);
  opacity: 0.85;
}
.icon-circle.has-filters {
  background: var(--color-bg-blue-ligth);
}
.icon-circle.has-filters .filter-icon {
  filter: none;
  opacity: 1;
}
.filter-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #e74c3c;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

/* Pestañas */
.tabs {
  display: flex;
  gap: 6px;
  background: #eef1f5;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 0.75rem;
}
.tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 6px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #555;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.tab.active {
  background: #fff;
  color: var(--color-bg-blue-dark);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.tab-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #dfe5ee;
  color: #444;
  font-size: 0.72rem;
  line-height: 20px;
}
.tab.active .tab-count {
  background: var(--color-bg-blue-dark);
  color: #fff;
}

/* Filtros */
.filtros {
  display: flex;
  gap: 8px;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  padding: 8px;
  background: #f2f4f8;
  border-radius: 10px;
}
.filtro-input {
  flex: 1;
  min-width: 140px;
  padding: 8px 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}
.filtro-buscar {
  flex: 1 1 100%;
}
.filtro-campo {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.72rem;
  color: #666;
}
.filtro-campo .filtro-input {
  width: 100%;
}
.icon-btn.limpiar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #444;
  background: #e6e9ef;
}
.icon-btn.limpiar img {
  width: 16px;
  height: 16px;
}
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.empty {
  text-align: center;
  color: #777;
  padding: 2rem 0;
}

/* Modo horizontal (perfil): fila con scroll lateral */
.lista.horizontal {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 4px 2px 10px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.lista.horizontal .pedido-card {
  flex: 0 0 82%;
  max-width: 320px;
  margin-bottom: 0;
  scroll-snap-align: start;
}
.lista.horizontal .item-detalle .item-cat {
  display: none;
}
@media (min-width: 600px) {
  .lista.horizontal .pedido-card {
    flex-basis: 300px;
  }
}

/* Card de pedido */
.pedido-card {
  background: white;
  border-radius: 14px;
  padding: 0.85rem 0.9rem;
  margin-bottom: 0.8rem;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  border-left: 4px solid #ffc107;
}
.pedido-card.estado-enviado {
  border-left-color: var(--color-bg-blue-ligth);
}
.pedido-card.estado-entregado {
  border-left-color: #27ae60;
}
.pedido-card.estado-cancelado {
  border-left-color: #e74c3c;
  opacity: 0.85;
}
.pedido-card:hover {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.14);
  transform: translateY(-2px);
}

.pedido-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.5rem;
}
.pedido-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 0.8rem;
  color: #555;
}
.pedido-meta .id {
  font-family: monospace;
  color: #999;
}
.estatus {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #fff3cd;
  color: #6b5400;
}
.estatus-enviado {
  background: #e3f0ff;
  color: #0b4f8a;
}
.estatus-entregado {
  background: #e8f5e9;
  color: #2e7d32;
}
.estatus-cancelado {
  background: #ffebee;
  color: #c62828;
}

/* Artículos */
.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.item-img {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #eee;
  flex-shrink: 0;
  background: #f5f5f5;
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-nombre {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-detalle {
  margin: 0;
  font-size: 0.78rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-cat {
  color: #999;
}
.item-total {
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #333;
}
.item-more {
  padding-left: 54px;
}
.link-btn {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--color-bg-blue-ligth);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

/* Pie */
.pedido-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e5e8ee;
  font-size: 0.8rem;
  color: #666;
}
.pedido-footer .total {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-bg-blue-dark);
}
.entregado-en {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: #2e7d32;
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

@media (max-width: 480px) {
  .tab {
    font-size: 0.78rem;
    padding: 8px 4px;
  }
  .pedido-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}
</style>
