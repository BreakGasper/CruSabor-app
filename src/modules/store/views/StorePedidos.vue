<template>
  <div class="pedidos-container">
    <!-- HEADER GLOBAL -->
    <div class="top-bar">
      <h2>Pedidos</h2>

      <div class="controls">
        <input v-model="search" placeholder="Buscar pedido o cliente..." />

        <select v-model="filtroEstado">
          <option value="">Todos</option>
          <option value="Preparacion">Preparación</option>
          <option value="Enviado">Enviado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>
    </div>

    <!-- CONTADOR -->
    <div class="counter">{{ pedidosFiltrados.length }} pedidos</div>

    <!-- EMPTY STATE -->
    <div v-if="pedidosFiltrados.length === 0" class="empty">
      📦 No hay pedidos disponibles
    </div>

    <!-- CARDS -->
    <div
      v-for="pedido in pedidosFiltrados"
      :key="pedido.id_pedido"
      class="pedido-card"
      :class="{ urgente: esUrgente(pedido.fecha_hora) }"
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
          <span :class="['status', pedido.estatus.toLowerCase()]">
            {{ pedido.estatus }}
          </span>

          <div class="total">${{ pedido.totalTienda }}</div>

          <div class="items-count">🛒 {{ pedido.itemsFiltrados.length }}</div>
        </div>
      </div>

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

          <!-- ITEMS -->
          <div
            v-for="(item, index) in pedido.itemsFiltrados"
            :key="item.id_articulo + '-' + index"
            class="item"
          >
            <img
              :src="FIREBASE_STORAGE_BASE_URL + item.url_image"
              class="img"
            />

            <div class="item-inline" style="font-size: small">
              <strong class="nombre">
                {{ item.nombreProducto }}
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

        <button class="primary" @click.stop="markAsSent(pedido.id_pedido!)">
          Marcar enviado
        </button>
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
import { ref, computed, onMounted } from 'vue';
import { getPedidosByProveedor, type Pedido } from '@/composables/usePedidos';
import { fetchUsuarioById, type Usuario } from '@/composables/useAuth';
import { FIREBASE_STORAGE_BASE_URL } from '@/constants/firebase_util';

const pedidos = ref<Pedido[]>([]);
const usuariosPorId = ref<Record<string, Usuario | null>>({});

const search = ref('');
const filtroEstado = ref('');

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

function esUrgente(fecha: string) {
  const minutos = (Date.now() - new Date(fecha).getTime()) / 60000;
  return minutos > 30;
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

const cargarPedidos = async () => {
  pedidos.value = await getPedidosByProveedor(idTienda);
  await cargarUsuarios(pedidos.value);
};

const pedidosFiltrados = computed(() => {
  return pedidos.value
    .map((pedido) => {
      const itemsFiltrados = pedido.items.filter(
        (i: any) => String(i.proveedor) === String(idTienda),
      );

      const totalTienda = itemsFiltrados.reduce(
        (sum: number, i: any) => sum + i.precio * i.cantidad,
        0,
      );

      return {
        ...pedido,
        itemsFiltrados,
        totalTienda,
        usuario: usuariosPorId.value[pedido.id_usuario] ?? null,
      };
    })
    .filter((p) => p.itemsFiltrados.length > 0)
    .filter((p) =>
      filtroEstado.value ? p.estatus === filtroEstado.value : true,
    )
    .filter((p) => {
      const txt = search.value.toLowerCase();
      return (
        p.id_pedido?.toLowerCase().includes(txt) ||
        p.usuario?.nombre?.toLowerCase().includes(txt)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime(),
    );
});

function markAsSent(id: string) {
  console.log('Enviar pedido:', id);
}

onMounted(() => {
  cargarPedidos();

  // 🔥 AUTO REFRESH
  setInterval(() => {
    cargarPedidos();
  }, 15000);
});
</script>

<style scoped>
.pedidos-container {
  padding: 1rem;
  max-width: 900px;
}

.top-bar {
  display: block;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.controls {
  display: flex;
  gap: 10px;
}

input,
select {
  padding: 6px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.counter {
  margin-bottom: 1rem;
  font-weight: bold;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #777;
}

.pedido-card {
  background: white;
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
  color: gray;
  font-size: 12px;
}

.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
}

.status.preparacion {
  background: #fff3cd;
}

.status.enviado {
  background: #d4edda;
}

.status.cancelado {
  background: #f8d7da;
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
  color: #0165d8;
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

  background: white;
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

  border-bottom: 1px solid #eee;
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

  background: #f7f7f7;
}

.info-row span {
  font-size: 12px;
  color: gray;
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
  margin: 0 0 0.75rem;
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
  .card-footer button {
    flex: 1;
  }
  .img {
    width: 44px;
    height: 44px;
  }
}
</style>
