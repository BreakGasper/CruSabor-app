<template>
  <div class="pedido-detalle-container">
    <!-- Cabecera centrada -->
    <div class="pedido-header">
      <p><strong>ID:</strong> {{ pedido?.id_pedido }}</p>

      <p><strong>Estatus:</strong> {{ pedido?.estatus }}</p>
      <p><strong>Total Artículos:</strong> {{ pedido?.items.length }}</p>
    </div>

    <hr />

    <!-- Lista de items -->
    <div class="pedido-items">
      <div
        v-for="item in pedido?.items"
        :key="item.id_articulo"
        class="item-card"
      >
        <img
          :src="FIREBASE_STORAGE_BASE_URL + item.url_image || defaultImage"
          alt="Producto"
        />
        <div class="item-details">
          <p class="nombre">{{ item.nombreProducto }}</p>
          <p class="cantidad">Cant: {{ item.cantidad }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import type { Pedido } from "@/composables/usePedidos";

interface Item {
  id_articulo: string;
  nombre: string;
  url_image: string;
  cantidad: number;
}

const props = defineProps<{
  pedido?: Pedido | null;
}>();
const defaultImage = userDefaultImage;

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const parts = dateStr.split(",");
  return parts[0].trim();
}
</script>

<style scoped>
.pedido-detalle-container {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Cabecera */
.pedido-header {
  text-align: center;
}

.pedido-header p {
  margin: 0.25rem 0;
  font-weight: 600;
}

/* Lista de items con scroll si es necesario */
.pedido-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

/* Ocultar scrollbar */
.pedido-items::-webkit-scrollbar {
  width: 0px;
  background: transparent;
}
.pedido-items {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Card individual de cada item */
.item-card {
  display: flex;
  gap: 1rem;
  align-items: center;
  background-color: #fff;
  padding: 0.75rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.item-card img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid #eee;
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-details .nombre {
  font-weight: bold;
  color: #222;
  font-size: 0.95rem;
  margin: 0;
}

.item-details .cantidad {
  font-size: 0.85rem;
  color: #555;
  margin: 0;
}
</style>
