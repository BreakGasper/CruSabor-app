<template>
  <div class="detalle">
    <img :src="producto.imagenUrl" />
    <h2>{{ producto.nombre }}</h2>
    <p class="precio">${{ producto.precio }}</p>
    <p>{{ producto.descripcion }}</p>
    <button @click="$emit('agregarCarrito', producto)">
      Agregar al carrito
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ producto: any }>();
defineEmits(["agregarCarrito"]);
</script>

<style scoped>
.detalle {
  padding: 1.5rem;
  text-align: center;
}
img {
  width: 100%;
  max-width: 400px;
  border-radius: 20px;
}
.precio {
  color: #e74c3c;
  font-weight: bold;
  font-size: 1.4rem;
}
</style>
