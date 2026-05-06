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

          <div class="cliente" style="font-size: 14px">
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
            v-for="item in pedido.itemsFiltrados"
            :key="item.id_articulo"
            class="item"
          >
            <img
              :src="item.url_image + FIREBASE_STORAGE_BASE_URL"
              class="img"
            />

            <div class="info">
              <strong>{{ item.nombreProducto }}</strong>
              <span>Cantidad: {{ item.cantidad }}</span>
              <span>${{ item.precio }}</span>
            </div>
          </div>
        </div>
      </transition>

      <!-- FOOTER -->
      <div class="card-footer">
        <button @click="toggleExpanded(pedido.id_pedido!)">
          {{ expandedPedidos.has(pedido.id_pedido!) ? 'Ver menos' : 'Ver más' }}
        </button>

        <button class="primary" @click.stop="markAsSent(pedido.id_pedido!)">
          Marcar enviado
        </button>
      </div>
    </div>
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
        (i: any) => i.proveedor === idTienda,
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
</style>
