<template>
  <ProductDetail
    v-if="producto"
    :producto="producto"
    @agregarCarrito="agregarAlCarrito"
  />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useArticulos } from "@/composables/useArticulos";
import ProductDetail from "../components/ProductDetail.vue"; // ✅ ruta corregida

const route = useRoute();
const producto = ref<any | null>(null);

const { articulos } = useArticulos();

watch(
  () => articulos.value,
  (nuevaLista) => {
    if (nuevaLista.length > 0) {
      const id = route.params.id;
      producto.value = nuevaLista.find((item) => item.articuloId === id);
    }
  },
  { immediate: true }
);

function agregarAlCarrito(item: any) {
  console.log("Producto agregado al carrito:", item);
  // Aquí conectas con Dexie / Pinia / Vuex
}
</script>
