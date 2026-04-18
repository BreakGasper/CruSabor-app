<template>
  <div class="pedidos-container">
    <h2>Pedidos en preparación</h2>

    <div v-if="pedidosFiltrados.length === 0">
      No hay pedidos en preparación
    </div>

    <div
      v-for="pedido in pedidosFiltrados"
      :key="pedido.id_pedido"
      class="pedido-card"
    >
      <div class="pedido-header">
        <p><strong>Pedido:</strong> {{ pedido.id_pedido }}</p>
        <p><strong>Fecha:</strong> {{ pedido.fecha_hora }}</p>
        <p><strong>Estatus:</strong> {{ pedido.estatus }}</p>
      </div>

      <hr />

      <!-- SOLO ITEMS DE ESTA TIENDA -->
      <div
        v-for="item in pedido.itemsFiltrados"
        :key="item.id_articulo"
        class="item"
      >
        <img :src="item.url_image" class="img" />

        <div class="info">
          <p>
            <strong>{{ item.nombreProducto }}</strong>
          </p>
          <p>Cantidad: {{ item.cantidad }}</p>
          <p>Precio: ${{ item.precio }}</p>
        </div>
      </div>

      <div class="total">Total tienda: ${{ pedido.totalTienda }}</div>

      <button class="btn">Marcar como enviado</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, child } from 'firebase/database';
import { sessionUser } from '@/utils/sessionUser';
import { getPedidosByProveedor } from '@/composables/usePedidos';

const pedidos = ref<any[]>([]);

// 🔥 TU ID DE TIENDA (proveedor)
const props = defineProps<{
  id: string;
}>();

const idTienda = props.id;
// CARGAR PEDIDOS
const cargarPedidos = async () => {
  pedidos.value = await getPedidosByProveedor(idTienda);
};
// 🔥 FILTRAR SOLO PEDIDOS DE ESTA TIENDA
const pedidosFiltrados = computed(() => {
  return pedidos.value
    .filter((p) => p.estatus === 'Preparacion')
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
      };
    })
    .filter((p) => p.itemsFiltrados.length > 0);
});

onMounted(() => {
  console.log('ID de tienda:', idTienda);
  if (idTienda) {
    cargarPedidos();
  }
});
</script>
<style scoped>
.pedidos-container {
  padding: 1rem;
}

.pedido-card {
  background: white;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}

.total {
  margin-top: 10px;
  font-weight: bold;
}

.btn {
  margin-top: 10px;
  background: #0165d8;
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
}
</style>
