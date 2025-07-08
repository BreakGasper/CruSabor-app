<template>
  <div class="detalle-container" v-if="producto">
    <img class="detalle-img" :src="producto.imagenUrl" :alt="producto.nombre" />
    <div class="detalle-info">
      <h1>{{ producto.nombre }}</h1>
      <p class="precio">${{ producto.precio }}</p>
      <p class="descripcion">{{ producto.descripcion }}</p>
      <button class="btn-agregar">Agregar al carrito</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useCategorias } from "@/composables/useCategorias";

const route = useRoute();
const producto = ref<any | null>(null);

const { categorias, loading } = useCategorias();

watch(
  () => categorias.value,
  (nuevaLista) => {
    if (nuevaLista.length > 0) {
      const id = route.params.id;
      producto.value = nuevaLista.find((item) => item.articuloId === id);
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.detalle-container {
  display: flex;
  flex-direction: column;
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  gap: 1rem;
}
.detalle-img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  border-radius: 20px;
}
.detalle-info {
  padding: 1rem;
}
.precio {
  color: #e74c3c;
  font-size: 1.5rem;
  font-weight: bold;
}
.descripcion {
  font-size: 1rem;
  color: #444;
}
.btn-agregar {
  background-color: #27ae60;
  color: white;
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 10px;
  margin-top: 1rem;
  cursor: pointer;
}
</style>
