<template>
  <div>
    <div>
      <ProductForm :tienda-id="tiendaId" :tienda-nombre="tiendaNombre" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ProductForm from "../components/ProductForm.vue";
import { useRoute } from "vue-router";

const route = useRoute();
const tienda = JSON.parse(localStorage.getItem("tiendas") || "{}");
// En /store/products/:id viene en la ruta; en /store/product/edit/:articuloId se toma de la sesión de tienda
const tiendaId = String(route.params.id || tienda.id || "");
const tiendaNombre = tienda.nombreTienda || tienda.nombre || "";
</script>
