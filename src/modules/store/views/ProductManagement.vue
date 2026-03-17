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
const tiendaId = String(route.params.id);
const tiendaNombre = tienda.nombre;
</script>
