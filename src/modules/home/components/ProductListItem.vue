<template>
  <div class="product-item" @click="irADetalle">
    <div class="image-content">
      <img
        loading="lazy"
        :src="FIREBASE_STORAGE_BASE_URL + producto.url"
        :alt="producto.nombre"
      />
    </div>

    <div class="text-content">
      <h3>{{ producto.nombre }}</h3>
      <p class="subcategoria">{{ producto.subcategoria || "General" }}</p>
      <span class="precio">${{ producto.precio }}</span>
    </div>

    <div class="bottom-row">
      <button class="boton-flecha" @click.stop="irADetalle">➔</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";

const router = useRouter();
const props = defineProps<{
  producto: any;
}>();

function irADetalle() {
  router.push(`/producto/${props.producto.articuloId}`);
}
</script>

<style scoped>
.product-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 0.8rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 1rem;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.product-item:hover {
  transform: translateY(-2px);
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-right: 0.75rem;
}

.text-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: #333;
}

.subcategoria {
  font-size: 0.85rem;
  color: #777;
  margin-bottom: 0.4rem;
}

.bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.precio {
  font-weight: bold;
  color: #333;
  font-size: 0.9rem;
}

.boton-flecha {
  background: #000;
  color: white;
  border: none;
  border-radius: 0; /* Cambio aquí para que sea cuadrado */
  width: 24px;
  height: 24px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
}

.boton-flecha:hover {
  background: #111;
}

.image-content img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 0.75rem;
  margin-right: 0.75rem;
}
</style>
>
