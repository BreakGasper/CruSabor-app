<template>
  <div class="pedidos-container">
    <!-- HEADER GLOBAL -->
    <PageHeader title="Pedidos" :fallback="`/store/profile/${idTienda}`" sticky>
      <button
        class="icon-btn icon-circle"
        :class="{ 'has-filters': filtrosActivos > 0 }"
        @click="showFiltros = !showFiltros"
        :title="filtrosActivos ? `Filtros (${filtrosActivos} activos)` : 'Filtros'"
      >
        <img loading="lazy" src="@/assets/icons/filter.png" alt="Filtro" class="filter-icon" />
        <span v-if="filtrosActivos" class="filter-badge">{{ filtrosActivos }}</span>
      </button>
    </PageHeader>

    <!-- PESTAÑAS: por entregar / entregados / cancelados -->
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="tab"
        :class="{ active: tabActiva === tab.id }"
        @click="tabActiva = tab.id"
      >
        <span>{{ tab.label }}</span>
        <span class="tab-count">{{ conteos[tab.id] }}</span>
      </button>
    </div>

    <!-- FILTROS -->
    <transition name="fade">
      <div v-show="showFiltros" class="filtros">
        <input
          type="search"
          v-model="search"
          placeholder="Cliente, artículo o # de pedido..."
          class="filtro-input filtro-buscar"
          aria-label="Buscar por cliente, artículo o número de pedido"
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

    <!-- CONTADOR -->
    <div class="counter">
      {{ pedidosFiltrados.length }} {{ pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos' }}
    </div>

    <!-- EMPTY STATE -->
    <div v-if="pedidosFiltrados.length === 0" class="empty">
      {{ mensajeVacio }}
    </div>

    <!-- CARDS -->
    <div
      v-for="pedido in pedidosFiltrados"
      :key="pedido.id_pedido"
      class="pedido-card"
      :class="{ urgente: esUrgente(pedido) }"
    >
      <!-- HEADER -->
      <div class="card-header" @click="toggleExpanded(pedido.id_pedido!)">
        <div class="left">
          <div class="row">
            <strong style="font-size: 10px">#{{ pedido.id_pedido }}</strong>
            <span class="hora">{{ pedido.fecha_hora }}</span>
          </div>

          <div
            class="cliente"
            style="font-size: 14px"
            @click.stop="openClienteDialog(pedido)"
          >
            {{ pedido.usuario?.nombre || 'Sin nombre' }}
          </div>
        </div>

        <div class="right">
          <span :class="['status', pedido.estatusTienda.toLowerCase()]">
            {{ pedido.estatusLabel }}
          </span>

          <span v-if="avisoAtencion(pedido)" class="aviso-atencion">⏳ {{ avisoAtencion(pedido) }}</span>
          <span v-if="conBajoPedido(pedido)" class="bajo-pedido">🛠️ Incluye artículos bajo pedido</span>

          <div class="total">${{ pedido.totalTienda }}</div>

          <div class="items-count">🛒 {{ pedido.itemsFiltrados.length }}</div>
        </div>
      </div>

      <!-- MOTIVO DE CANCELACIÓN (visible sin expandir) -->
      <p v-if="motivoCancelado(pedido)" class="motivo-cancelacion">
        ✖ {{ motivoCancelado(pedido) }}
      </p>

      <!-- BODY -->
      <transition name="fade">
        <div v-if="expandedPedidos.has(pedido.id_pedido!)" class="card-body">
          <!-- CLIENTE INFO -->
          <div class="extra" style="font-size: 12px">
            <p><strong>📱</strong> {{ pedido.usuario?.celular || '-' }}</p>
            <p>
              <strong>📍</strong>
              {{ pedido.usuario?.calleNumero || pedido.domicilio.calleNumero }},
              {{ pedido.usuario?.municipio || pedido.domicilio.municipio }}
            </p>
          </div>

          <!-- HISTORIAL -->
          <div v-if="pedido.historial?.length" class="timeline">
            <div
              v-for="(h, i) in pedido.historial"
              :key="i"
              class="timeline-item"
              :class="h.estatus.toLowerCase()"
            >
              <span class="dot"></span>
              <div class="timeline-text">
                <strong>{{ etiqueta(h.estatus) }}</strong>
                <span class="quien">
                  · {{ ACTOR_LABEL[h.por] || 'Sistema' }}
                </span>
                <span class="cuando">{{ formatFecha(h.fecha) }}</span>
                <p v-if="h.nota" class="nota">{{ h.nota }}</p>
              </div>
            </div>
          </div>

          <!-- ITEMS -->
          <div
            v-for="(item, index) in pedido.itemsFiltrados"
            :key="item.id_articulo + '-' + index"
            class="item"
          >
            <img
              :src="imagenUrl(item.url_image) || defaultImg"
              @error="onImgError"
              class="img"
            />

            <div class="item-inline" style="font-size: small">
              <strong class="nombre">
                {{ item.nombreProducto }}
                <span v-if="item.porPedido" class="tag-bajo-pedido">bajo pedido</span>
              </strong>

              <span class="detalle">
                {{ item.cantidad }} pz × ${{ item.precio }} =
                <strong style="color: darkgreen"
                  >${{ item.cantidad * item.precio }}</strong
                >
              </span>
            </div>
          </div>
        </div>
      </transition>

      <!-- FOOTER -->
      <div class="card-footer" style="font-size: small">
        <button @click="toggleExpanded(pedido.id_pedido!)">
          {{ expandedPedidos.has(pedido.id_pedido!) ? 'Ver menos' : 'Ver más' }}
        </button>

        <div class="acciones-estatus">
          <template v-if="pedido.estatusTienda === 'Preparacion'">
            <button class="danger" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Cancelado')">
              Cancelar
            </button>
            <button class="atender" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Atendiendo')">
              👨‍🍳 Atender
            </button>
            <button class="primary" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Enviado')">
              🚚 Marcar enviado
            </button>
          </template>
          <template v-else-if="pedido.estatusTienda === 'Atendiendo'">
            <button class="danger" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Cancelado')">
              Cancelar
            </button>
            <button class="primary" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Enviado')">
              🚚 Marcar enviado
            </button>
          </template>
          <template v-else-if="pedido.estatusTienda === 'Enviado'">
            <button class="danger" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Cancelado')">
              Cancelar
            </button>
            <button class="success" :disabled="procesando === pedido.id_pedido" @click.stop="cambiarEstatus(pedido, 'Entregado')">
              ✅ Marcar entregado
            </button>
          </template>
          <span v-else class="final-label">
            {{ pedido.estatusTienda === 'Entregado' ? '✅ Entregado' : '✖ Cancelado' }}
          </span>
        </div>
      </div>
    </div>

    <!-- DIALOG CLIENTE -->
    <transition name="fade">
      <div
        v-if="clienteDialog"
        class="dialog-overlay"
        @click="closeClienteDialog"
      >
        <div class="dialog-card" @click.stop>
          <div class="dialog-header">
            <h3>Información del Cliente</h3>

            <button class="close-btn" @click="closeClienteDialog">✕</button>
          </div>

          <div class="dialog-content">
            <div class="cliente-avatar">
              {{
                clienteSeleccionado?.usuario?.nombre?.charAt(0).toUpperCase()
              }}
            </div>

            <h2>
              {{ clienteSeleccionado?.usuario?.nombre }}
            </h2>

            <div class="cliente-info">
              <div class="info-row">
                <span>📱 Teléfono</span>
                <strong>
                  {{ clienteSeleccionado?.usuario?.celular || '-' }}
                </strong>
              </div>

              <div class="info-row">
                <span>📍 Dirección</span>

                <strong>
                  {{
                    clienteSeleccionado?.usuario?.calleNumero ||
                    clienteSeleccionado?.domicilio?.calleNumero
                  }}
                </strong>
              </div>

              <div class="info-row">
                <span>🏙 Municipio</span>

                <strong>
                  {{
                    clienteSeleccionado?.usuario?.municipio ||
                    clienteSeleccionado?.domicilio?.municipio
                  }}
                </strong>
              </div>

              <div class="info-row">
                <span>🌎 Estado</span>

                <strong>
                  {{
                    clienteSeleccionado?.usuario?.estado ||
                    clienteSeleccionado?.domicilio?.estado
                  }}
                </strong>
              </div>

              <div class="info-row">
                <span>📮 C.P.</span>

                <strong>
                  {{
                    clienteSeleccionado?.usuario?.codigoPostal ||
                    clienteSeleccionado?.domicilio?.codigoPostal
                  }}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PageHeader from '@/components/PageHeader.vue';
import Swal from 'sweetalert2';
import {
  suscribirPedidosProveedor,
  actualizarEstatusTienda,
  estatusDeTienda,
  fechaPedido,
  tiempoRestanteAtencion,
  formatoTiempoRestante,
  MINUTOS_LIMITE_ATENCION,
  motivoCancelacion,
  textoCancelacion,
  tieneArticulosPorPedido,
  ESTATUS_LABEL,
  ESTATUS_LABEL_TIENDA,
  ACTOR_LABEL,
  type Pedido,
  type EstatusPedido,
} from '@/composables/usePedidos';
import { fetchUsuarioById, type Usuario } from '@/composables/useAuth';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultImg from '@/assets/icons/default_articulo.png';

const pedidos = ref<Pedido[]>([]);


const usuariosPorId = ref<Record<string, Usuario | null>>({});

/* ---------- Pestañas y filtros (mismo esquema que "Mis Pedidos" del cliente) ---------- */
type TabId = 'pendientes' | 'entregados' | 'cancelados';
const TABS: { id: TabId; label: string; estatus: EstatusPedido[] }[] = [
  { id: 'pendientes', label: 'Por entregar', estatus: ['Preparacion', 'Atendiendo', 'Enviado'] },
  { id: 'entregados', label: 'Entregados', estatus: ['Entregado'] },
  { id: 'cancelados', label: 'Cancelados', estatus: ['Cancelado'] },
];
const tabActiva = ref<TabId>('pendientes');

const search = ref('');
const fechaDesde = ref('');
const fechaHasta = ref('');
const filtroPago = ref('');
type Orden = 'recientes' | 'antiguos' | 'mayor' | 'menor';
const orden = ref<Orden>('recientes');
const showFiltros = ref(false);

const filtrosActivos = computed(
  () =>
    [search.value, fechaDesde.value, fechaHasta.value, filtroPago.value].filter(Boolean).length +
    (orden.value !== 'recientes' ? 1 : 0),
);

function limpiarFiltros() {
  search.value = '';
  fechaDesde.value = '';
  fechaHasta.value = '';
  filtroPago.value = '';
  orden.value = 'recientes';
}

const inicioDia = (yyyyMmDd: string) => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
const finDia = (yyyyMmDd: string) => inicioDia(yyyyMmDd) + 24 * 60 * 60 * 1000 - 1;

const props = defineProps<{ id_tienda: string }>();
const idTienda = props.id_tienda;

const expandedPedidos = ref<Set<string>>(new Set());
const clienteDialog = ref(false);
const clienteSeleccionado = ref<any>(null);

function openClienteDialog(pedido: any) {
  clienteSeleccionado.value = pedido;
  clienteDialog.value = true;
}

function closeClienteDialog() {
  clienteDialog.value = false;
}
function toggleExpanded(id: string) {
  expandedPedidos.value.has(id)
    ? expandedPedidos.value.delete(id)
    : expandedPedidos.value.add(id);

  expandedPedidos.value = new Set(expandedPedidos.value);
}

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Pendiente de preparar desde hace más de 30 min */
function esUrgente(pedido: any) {
  if (pedido.estatusTienda !== 'Preparacion') return false;
  const minutos = (Date.now() - fechaPedido(pedido)) / 60000;
  return minutos > 30;
}

/* Reloj que avanza cada minuto para el aviso de cancelación automática */
const ahora = ref(new Date());
let reloj: ReturnType<typeof setInterval> | undefined;
onMounted(() => { reloj = setInterval(() => (ahora.value = new Date()), 60_000); });
onUnmounted(() => clearInterval(reloj));

/** "Se cancela en 1 h 20 min si no lo atiendes" mientras la tienda no marque enviado */
function avisoAtencion(pedido: any): string | null {
  const ms = tiempoRestanteAtencion(pedido, idTienda, ahora.value);
  if (ms === null) return null;
  return ms <= 0
    ? 'Se cancelará automáticamente por falta de atención'
    : `Se cancela en ${formatoTiempoRestante(ms)} si no lo atiendes (límite ${MINUTOS_LIMITE_ATENCION} min)`;
}

/** Motivo visible de la cancelación de MI parte del pedido (propia, del cliente o automática) */
const motivoCancelado = (pedido: any) => textoCancelacion(motivoCancelacion(pedido, idTienda), 'tienda');

/** ¿Incluye artículos que elaboro bajo pedido? */
const conBajoPedido = (pedido: any) => tieneArticulosPorPedido(pedido, idTienda);

const etiqueta = (e: EstatusPedido) => ESTATUS_LABEL[e] || e;

function formatFecha(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function cargarUsuarios(lista: Pedido[]) {
  const ids = [...new Set(lista.map((p) => p.id_usuario).filter(Boolean))];

  await Promise.all(
    ids.map(async (id) => {
      if (!usuariosPorId.value[id]) {
        usuariosPorId.value[id] = await fetchUsuarioById(id);
      }
    }),
  );
}

let detener: (() => void) | null = null;
const procesando = ref<string | null>(null);

function suscribir() {
  detener?.();
  detener = suscribirPedidosProveedor(idTienda, async (lista) => {
    pedidos.value = lista;
    await cargarUsuarios(lista);
  });
}

async function cambiarEstatus(pedido: Pedido, nuevo: EstatusPedido) {
  const esCancel = nuevo === 'Cancelado';
  const { isConfirmed, value } = await Swal.fire({
    title: esCancel
      ? '¿Cancelar este pedido?'
      : nuevo === 'Atendiendo'
        ? '¿Atender este pedido?'
        : `¿Marcar como "${ESTATUS_LABEL_TIENDA[nuevo]}"?`,
    text: esCancel
      ? 'Escribe el motivo: el cliente lo verá en su pedido. Se devolverá el stock de tus artículos.'
      : nuevo === 'Atendiendo'
        ? 'El cliente verá "Atendiendo tu pedido" y ya no se cancelará automáticamente por falta de atención.'
        : 'El cliente verá el cambio en su seguimiento.',
    input: esCancel ? 'text' : undefined,
    inputPlaceholder: 'Motivo de la cancelación',
    inputValidator: esCancel ? (v: string) => (v && v.trim() ? null : 'Indica el motivo para que el cliente lo conozca') : undefined,
    icon: esCancel ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: esCancel ? 'Sí, cancelar' : 'Confirmar',
    cancelButtonText: 'Volver',
    confirmButtonColor: esCancel ? '#e74c3c' : '#0165d8',
  });
  if (!isConfirmed) return;

  procesando.value = pedido.id_pedido!;
  try {
    await actualizarEstatusTienda(pedido, idTienda, nuevo, value || undefined);
    // la suscripción refresca la lista; feedback rápido:
    Swal.fire({ toast: true, position: 'bottom', timer: 1800, showConfirmButton: false, icon: 'success', title: ESTATUS_LABEL_TIENDA[nuevo] });
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: e?.message || String(e) });
  } finally {
    procesando.value = null;
  }
}

/** Pedidos que incluyen artículos de esta tienda, con sus datos derivados */
const pedidosTienda = computed(() =>
  pedidos.value
    .map((pedido) => {
      const itemsFiltrados = pedido.items.filter(
        (i: any) => String(i.proveedor) === String(idTienda),
      );

      const totalTienda = itemsFiltrados.reduce(
        (sum: number, i: any) => sum + i.precio * i.cantidad,
        0,
      );

      const estatusTienda = estatusDeTienda(pedido, idTienda);
      return {
        ...pedido,
        itemsFiltrados,
        totalTienda,
        estatusTienda,
        estatusLabel: ESTATUS_LABEL_TIENDA[estatusTienda] || estatusTienda,
        usuario: usuariosPorId.value[pedido.id_usuario] ?? null,
      };
    })
    .filter((p) => p.itemsFiltrados.length > 0),
);

const conteos = computed<Record<TabId, number>>(() => {
  const c: Record<TabId, number> = { pendientes: 0, entregados: 0, cancelados: 0 };
  for (const p of pedidosTienda.value) {
    const tab = TABS.find((t) => t.estatus.includes(p.estatusTienda))?.id ?? 'pendientes';
    c[tab]++;
  }
  return c;
});

const metodosPago = computed(() =>
  [...new Set(pedidosTienda.value.map((p) => p.metodo_pago).filter(Boolean))].sort(),
);

const pedidosFiltrados = computed(() => {
  const estatusTab = TABS.find((t) => t.id === tabActiva.value)!.estatus;
  const q = search.value.trim().toLowerCase();
  const desde = fechaDesde.value ? inicioDia(fechaDesde.value) : -Infinity;
  const hasta = fechaHasta.value ? finDia(fechaHasta.value) : Infinity;

  const comparar: Record<Orden, (a: any, b: any) => number> = {
    recientes: (a, b) => fechaPedido(b) - fechaPedido(a),
    antiguos: (a, b) => fechaPedido(a) - fechaPedido(b),
    mayor: (a, b) => b.totalTienda - a.totalTienda,
    menor: (a, b) => a.totalTienda - b.totalTienda,
  };

  return pedidosTienda.value
    .filter((p) => estatusTab.includes(p.estatusTienda))
    .filter((p) => {
      const t = fechaPedido(p);
      return t >= desde && t <= hasta;
    })
    .filter((p) => !filtroPago.value || p.metodo_pago === filtroPago.value)
    .filter(
      (p) =>
        !q ||
        (p.id_pedido || '').toLowerCase().includes(q.replace(/^#/, '')) ||
        (p.usuario?.nombre || '').toLowerCase().includes(q) ||
        p.itemsFiltrados.some((i: any) => (i.nombreProducto || '').toLowerCase().includes(q)),
    )
    .sort(comparar[orden.value]);
});

const mensajeVacio = computed(() => {
  if (filtrosActivos.value) return 'Ningún pedido coincide con los filtros.';
  return {
    pendientes: '📦 No tienes pedidos por entregar.',
    entregados: 'Aún no has entregado pedidos.',
    cancelados: 'No hay pedidos cancelados.',
  }[tabActiva.value];
});

onMounted(suscribir);
onUnmounted(() => detener?.());

/** Si la imagen no carga, se muestra la imagen por defecto */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
}
</script>

<style scoped>
.pedidos-container {
  padding: 1rem;
  max-width: 900px;
}

/* Botón de filtros en la cabecera */
.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
}
.icon-circle {
  position: relative;
  width: 36px;
  height: 36px;
  background: var(--surface);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  padding: 6px;
}
.icon-circle img {
  width: 22px;
  height: 22px;
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
  background: var(--surface-2);
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
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.tab.active {
  background: var(--surface);
  color: var(--brand-navy-text);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.tab-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #dfe5ee;
  color: var(--text);
  font-size: 0.72rem;
  line-height: 20px;
}
.tab.active .tab-count {
  background: var(--color-bg-blue-dark);
  color: #fff;
}

/* Panel de filtros */
.filtros {
  display: flex;
  gap: 8px;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  padding: 8px;
  background: var(--surface-2);
  border-radius: 10px;
}
.filtro-input {
  flex: 1;
  min-width: 140px;
  padding: 8px 10px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
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
  color: var(--text-muted);
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
  color: var(--text);
  background: #e6e9ef;
}
.icon-btn.limpiar img {
  width: 16px;
  height: 16px;
}

.counter {
  margin-bottom: 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.pedido-card {
  background: var(--surface);
  border-radius: 14px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07);
  transition: 0.2s;
}

.pedido-card:hover {
  transform: scale(1.01);
}

.urgente {
  border-left: 5px solid red;
}

.card-header {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
}

.row {
  display: flex;
  gap: 10px;
}

.hora {
  color: var(--text-muted);
  font-size: 12px;
}

.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
}

.aviso-atencion {
  display: block;
  max-width: 150px;
  margin-top: 4px;
  font-size: 10px;
  line-height: 1.3;
  color: #b45309;
  text-align: right;
}

.status.preparacion {
  background: #fff3cd;
}

.status.atendiendo {
  background: #e0e7ff;
  color: #3730a3;
}

.status.enviado {
  background: #d4edda;
}

.bajo-pedido {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #3730a3;
  text-align: right;
}

.tag-bajo-pedido {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 10px;
  font-weight: 600;
}

.motivo-cancelacion {
  margin: 6px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: #fdecea;
  color: #9b1c1c;
  font-size: 12px;
  line-height: 1.35;
}

.acciones-estatus button.atender {
  background: #4f46e5;
  color: #fff;
}

.status.cancelado {
  background: #f8d7da;
}

.status.entregado {
  background: #cfe8ff;
  color: var(--brand-blue-text);
}

/* Acciones por estatus */
/* Botones de acción del mismo tamaño (alto y ancho) */
.acciones-estatus {
  display: flex;
  gap: 8px;
  align-items: center;
}
.acciones-estatus button,
.card-footer > button {
  min-width: 150px;
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  box-sizing: border-box;
}
.card-footer > button {
  min-width: 110px;
  background: var(--surface-2);
  color: var(--text);
}
.danger {
  background: #fdecea;
  color: #c0392b;
}
.success {
  background: #27ae60;
  color: #fff;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.final-label {
  font-weight: 600;
  color: var(--text-muted);
}

/* Historial */
.timeline {
  border-left: 2px solid var(--border);
  margin: 0.25rem 0 1rem 6px;
  padding-left: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.timeline-item {
  position: relative;
  font-size: 12px;
}
.timeline-item .dot {
  position: absolute;
  left: -20px;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffc107;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #e3e8ef;
}
.timeline-item.enviado .dot {
  background: #0165d8;
}
.timeline-item.entregado .dot {
  background: #27ae60;
}
.timeline-item.cancelado .dot {
  background: #e74c3c;
}
.timeline-text .quien {
  color: var(--text-muted);
}
.timeline-text .cuando {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
}
.timeline-text .nota {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-style: italic;
}

.card-body {
  margin-top: 1rem;
}

.item {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.img {
  width: 50px;
  height: 50px;
  border-radius: 8px;
}

.info {
  display: flex;
  flex-direction: column;
}
.item-inline {
  display: flex;
  flex-direction: row !important;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
}
.item-inline .nombre {
  flex: 1;
}

.item-inline .detalle {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.nombre {
  flex: 1;
}

.detalle {
  white-space: nowrap;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}

button {
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.primary {
  background: #0165d8;
  color: white;
}

.fade-enter-active,
.fade-leave-active {
  transition: 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.clickable {
  cursor: pointer;
  transition: 0.2s;
}

.clickable:hover {
  color: var(--brand-blue-text);
}

/* OVERLAY */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 999;
  padding: 1rem;
}

/* CARD */
.dialog-card {
  width: 100%;
  max-width: 420px;

  background: var(--surface);
  border-radius: 20px;

  overflow: hidden;

  animation: dialogIn 0.25s ease;
}

/* HEADER */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 1rem 1.2rem;

  border-bottom: 1px solid var(--border);
}

.dialog-header h3 {
  margin: 0;
}

/* CLOSE */
.close-btn {
  border: none;
  background: #f3f3f3;

  width: 35px;
  height: 35px;

  border-radius: 50%;
  cursor: pointer;
}

/* CONTENT */
.dialog-content {
  padding: 1.5rem;
}

.cliente-avatar {
  width: 70px;
  height: 70px;

  border-radius: 50%;

  background: #0165d8;
  color: white;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 28px;
  font-weight: bold;

  margin: 0 auto 1rem;
}

.dialog-content h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}

.cliente-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-row {
  display: flex;
  flex-direction: column;

  padding: 0.8rem;
  border-radius: 12px;

  background: var(--surface-2);
}

.info-row span {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ===== Responsive ===== */
.pedidos-container {
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
.top-bar h2 {
  margin: 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.75rem;
}
.title-row .back-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  color: var(--text);
  flex-shrink: 0;
}
@media (min-width: 768px) {
  .title-row {
    margin-bottom: 0;
  }
}
.controls input {
  flex: 1;
  min-width: 0;
}
.card-header .left {
  text-align: left;
  min-width: 0;
  flex: 1;
}
.card-header .row {
  flex-wrap: wrap;
  align-items: baseline;
}
.card-header .row strong {
  word-break: break-all;
}
.card-header .right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.card-footer {
  gap: 10px;
  flex-wrap: wrap;
}
@media (min-width: 768px) {
  .top-bar {
    display: flex;
    align-items: center;
  }
  .top-bar h2 {
    margin: 0;
  }
  .controls input {
    min-width: 260px;
  }
}
@media (max-width: 480px) {
  .pedidos-container {
    padding: 0.75rem;
  }
  .controls {
    flex-wrap: wrap;
  }
  .controls input,
  .controls select {
    flex: 1 1 100%;
    font-size: 16px;
  }
  .card-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  .card-header .right {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 10px;
  }
  .tab {
    font-size: 0.78rem;
    padding: 8px 4px;
    white-space: nowrap;
  }
  .tab-count {
    min-width: 18px;
    padding: 0 5px;
    font-size: 0.68rem;
  }
  .card-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .card-footer > button {
    width: 100%;
  }
  .acciones-estatus {
    width: 100%;
  }
  .acciones-estatus button {
    flex: 1 1 0;
    min-width: 0;
  }
  .img {
    width: 44px;
    height: 44px;
  }
}
</style>
