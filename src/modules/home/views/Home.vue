<template>
  <div class="home">
    <!-- 🔍 Buscador y carrito -->
    <div class="top-bar">
      <input
        v-model="busqueda"
        type="text"
        class="search-input"
        placeholder="Buscar productos..."
      />
      <button class="cart-button" @click="irACarrito">🛒</button>
    </div>

    <!-- Carrusel de productos destacados -->
    <HorizontalCarousel
      :productos="categoriasFiltradas.slice(0, 10)"
      class="carrusel-div"
    />

    <!-- Lista de todos los productos -->
    <section class="destacados">
      <h2 class="title">Productos</h2>
      <div class="grid">
        <template v-for="p in categoriasFiltradas" :key="p.articuloId">
          <ProductListItem v-if="isMobile" :producto="p" />
          <ProductCard v-else :producto="p" @verDetalle="verDetalle" />
        </template>
      </div>
    </section>

    <!-- Detalle de producto -->
    <ProductDetail
      v-if="productoSeleccionado"
      :producto="productoSeleccionado"
      @agregarCarrito="agregarAlCarrito"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import HorizontalCarousel from "../components/HorizontalCarousel.vue";
import ProductCard from "../components/ProductCard.vue";
import ProductDetail from "../components/ProductDetail.vue";
import ProductListItem from "../components/ProductListItem.vue";
import { useIsMobile } from "@/composables/useIsMobile";
import { useCategorias } from "@/composables/useCategorias";

const { categorias } = useCategorias();
const productoSeleccionado = ref<any | null>(null);
const busqueda = ref("");
const router = useRouter();
const { isMobile } = useIsMobile();

function verDetalle(produc: any) {
  productoSeleccionado.value = produc;
}

function agregarAlCarrito(produc: any) {
  productoSeleccionado.value = null;
}

function irACarrito() {
  router.push("/carrito"); // aún no existe, pero se puede crear
}

// Filtra los productos por nombre según lo escrito
const categoriasFiltradas = computed(() =>
  categorias.value.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.value.toLowerCase())
  )
);
</script>

<style scoped>
.home {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding: 0;
  margin: 0 auto;
}
.title {
  font-size: 1.2rem;
  font-weight: bold;
  text-align: left;
  margin-bottom: 1rem;
}
/* 🔍 barra superior */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.search-input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 1rem;
}

.cart-button {
  background: #007bff00;
  color: white;
  font-size: 1.3rem;
  border: none;
  border-radius: 10px;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}
.cart-button:hover {
  background: #0173ecfa;
}

/* 🧩 grid de productos */
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding: 1rem 0;
}

.carrusel-div {
  margin: 1rem 0;
}

@media (max-width: 480px) {
  .grid {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
}
</style>
