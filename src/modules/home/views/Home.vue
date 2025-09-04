<template>
  <div class="home">
    <!-- 🔝 Barra superior: menú hamburguesa y usuario -->
    <div class="top-bar-top" :class="{ 'solo-menu': !mostrarUsuario }">
      <button class="menu-button" @click="menuAbierto = !menuAbierto">
        <template v-if="!menuAbierto"> ☰ </template>
        <template v-else>
          <X class="close-icon" />
        </template>
      </button>

      <button
        v-if="mostrarUsuario"
        class="user-button"
        @click.prevent="$router.push('/perfil')"
      >
        <img src="@/assets/images/user.png" alt="Usuario" class="user-icon" />
      </button>
    </div>

    <!-- 🔍 Barra de búsqueda y carrito -->
    <div class="top-bar">
      <div class="search-wrapper">
        <input
          v-model="busqueda"
          type="text"
          class="search-input"
          placeholder="Buscar productos..."
        />
        <svg
          class="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"
          />
        </svg>
      </div>

      <button class="btn-icon cart bg-bnt-cart" @click="$router.push('/cart')">
        <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
      </button>
    </div>

    <!-- Menú lateral -->
    <div class="sidebar" :class="{ open: menuAbierto }">
      <div class="sidebar-header">
        <h1 class="logo-text">MAVI <span>Store</span></h1>
      </div>

      <ul class="sidebar-menu">
        <li>
          <a href="#" @click.prevent="$router.push('/cart')">
            <ShoppingCart class="icon" />
            Carrito
          </a>
        </li>
        <li>
          <a href="#">
            <Star class="icon" />
            Populares
          </a>
        </li>
        <li>
          <a href="#" @click.prevent="$router.push('/favoritos')">
            <Heart class="icon" />
            Favorites
          </a>
        </li>
        <li>
          <a @click.prevent="$router.push('/categoria')" href="#">
            <Grid class="icon" />
            Categories
          </a>
        </li>
        <li>
          <a href="#" @click.prevent="$router.push('/perfil')">
            <User class="icon" />
            Account
          </a>
        </li>
      </ul>

      <ul class="sidebar-footer">
        <li>
          <a href="#">
            <Settings class="icon" />
            Settings
          </a>
        </li>
        <li>
          <a href="#">
            <LogOut class="icon" />
            Log Out
          </a>
        </li>
      </ul>
    </div>

    <!-- Overlay -->
    <div class="overlay" v-if="menuAbierto" @click="menuAbierto = false"></div>

    <!-- Carrusel de productos destacados -->
    <HorizontalCarousel
      :productos="productosParaCarrusel"
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import HorizontalCarousel from "../components/HorizontalCarousel.vue";
import ProductCard from "../components/ProductCard.vue";
import ProductDetail from "../components/ProductDetail.vue";
import ProductListItem from "../components/ProductListItem.vue";
import { useIsMobile } from "@/composables/useIsMobile";
import { useArticulos } from "@/composables/useArticulos";

const { articulos } = useArticulos();
const productoSeleccionado = ref<any | null>(null);
const busqueda = ref("");
const router = useRouter();
const { isMobile } = useIsMobile();
const menuAbierto = ref(false);

// Importar iconos Lucide
import {
  Grid,
  Search,
  User,
  Star,
  Heart,
  LogOut,
  Settings,
  Sparkles,
  X,
  ShoppingCart,
} from "lucide-vue-next";
import { faShoppingCart } from "@fortawesome/free-solid-svg-icons";

function verDetalle(produc: any) {
  productoSeleccionado.value = produc;
}

function agregarAlCarrito(produc: any) {
  productoSeleccionado.value = null;
}

function irACarrito() {
  router.push("/carrito");
}

function irPerfil() {
  console.log("Ir a perfil de usuario");
}

const productosParaCarrusel = computed(() =>
  categoriasFiltradas.value.slice(0, 10).map((a) => ({
    articuloId: a.articuloId,
    nombre: a.nombre,
    descripcion: a.descripcion,
    precio: a.precio,
    url: a.url || "", // <- Aquí asignamos la propiedad url
  }))
);

// Filtra los productos por nombre según lo escrito

const categoriasFiltradas = computed(() => {
  if (!busqueda.value) return articulos.value; // Si está vacío, devuelve todos
  return articulos.value.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.value.toLowerCase())
  );
});

const scrollY = ref(0);
const mostrarUsuario = ref(true);

function handleScroll() {
  const actualY = window.scrollY;
  if (actualY > scrollY.value) {
    // Scrolldown → ocultar usuario
    mostrarUsuario.value = false;
  } else {
    // Scrollup → mostrar usuario
    mostrarUsuario.value = true;
  }
  scrollY.value = actualY;
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style scoped>
.home {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding: 1rem;
  padding-top: 120px;
  margin: 0 auto;
}
.title {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: left;
  margin-bottom: 1rem;
}

/* 🔝 Barra superior: menú y usuario */
.top-bar-top {
  position: fixed; /* se queda fija */
  top: 10px; /* margen superior */
  left: 50%; /* centrada horizontalmente */
  transform: translateX(-50%);
  width: calc(100% - 2rem); /* ancho responsivo */
  max-width: 1200px;
  z-index: 100; /* encima de todo */
  background-color: #fff; /* fondo blanco */
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 12px; /* esquinas redondeadas */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); /* sombra sutil */
}

/* Modo solo menú: botón flotante compacto a la izquierda */
.top-bar-top.solo-menu {
  width: auto; /* solo rodea el botón */
  padding: 0.2rem; /* más pequeño */
  border-radius: 12px; /* forma rectangular pequeña */
  left: 1rem; /* esquina superior izquierda */
  top: 1rem; /* un poco de margen superior */
  transform: none; /* quitar centrado */
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); /* sombra sutil */
}
.menu-button {
  font-size: 1.4rem; /* tamaño más compacto */
  width: 36px;
  height: 36px;
  border-radius: 8px; /* pequeño borde redondeado */
  padding: 0;
}
.close-icon {
  display: block;
  margin: auto;
  width: 20px;
  height: 20px;
  color: #000;
}

.user-button {
  background: var(--color-bg-blue-dark);
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.user-icon {
  width: 20px; /* ajusta tamaño según tu icono */
  height: 20px;
}

/* 🔍 Barra de búsqueda y carrito */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fff;
  position: relative; /* ya no fixed ni sticky */
  z-index: 10;
}
.search-input {
  flex: 1;
  padding: 0.5rem 1rem 0.5rem 2rem;
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
} /* Lista de enlaces sin puntos y expandida */
.sidebar ul {
  list-style: none; /* quita los puntos */
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px; /* margen entre botones */
}

.sidebar ul li {
  width: 100%; /* cada item ocupa todo el ancho del drawer */
}

.sidebar ul li a {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #000; /* texto negro por defecto */
  font-size: 1.1rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  transition: background 0.3s, color 0.3s;
  width: 100%; /* ocupa todo el ancho */
}

/* Hover / selección: azul y texto blanco */
.sidebar ul li a:hover,
.sidebar ul li a.active {
  background-color: var(--color-bg-blue-dark);
  color: #fff;
}

/* Iconos Lucide */
.sidebar ul li a svg {
  width: 20px;
  height: 20px;
  color: #000; /* negro por defecto */
  transition: color 0.3s;
}

.sidebar ul li a:hover svg,
.sidebar ul li a.active svg {
  color: #fff; /* icono blanco al hover/selección */
}
/* Separador gris entre Account y Settings */
.sidebar-footer li:first-child {
  border-top: 1px solid #ccc; /* línea gris */
  padding-top: 0.5rem; /* espacio arriba de la línea */
  margin-top: 0.5rem; /* espacio entre Account y la línea */
}

.logo-text {
  font-size: 1.3rem;
  font-weight: bold;
  color: black;
}

.logo-text span {
  color: gray;
  font-weight: normal;
}

/* Drawer lateral compacto */
.sidebar {
  position: fixed;
  top: 20%; /* centrado verticalmente */
  left: -220px; /* fuera de pantalla inicialmente */
  width: 220px; /* ancho del drawer */
  height: 60%; /* altura compacta */
  background: #f5f1eb; /* blanco hueso */
  color: #000; /* texto negro */
  z-index: 20;
  padding: 2rem 1.5rem;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  transition: left 0.4s ease, background 0.3s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.sidebar.open {
  left: 0;
}

/* Enlaces dentro del drawer */
.sidebar ul li a {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #000; /* texto negro por defecto */
  font-size: 1.1rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  transition: background 0.3s, color 0.3s;
}

/* Hover / selección: azul y texto blanco */
.sidebar ul li a:hover,
.sidebar ul li a.active {
  background-color: var(--color-bg-blue-dark); /* azul que ya tenías */
  color: #fff;
}

/* Iconos Lucide */
.sidebar ul li a svg {
  width: 20px;
  height: 20px;
  color: #000; /* negro por defecto */
  transition: color 0.3s;
}

.sidebar ul li a:hover svg,
.sidebar ul li a.active svg {
  color: #fff; /* icono blanco al hover/selección */
}

/* Overlay */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  z-index: 15;
}

.search-wrapper {
  position: relative;
  flex: 1;
}

.search-input {
  width: 100%;
  padding: 0.7rem 1rem 0.7rem 2.8rem; /* espacio extra para icono */
  border: none;
  border-radius: 12px;
  background: #f5f5f5; /* gris claro */
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #888;
  pointer-events: none;
  transition: color 0.3s ease;
}
.bg-bnt-cart {
  background-color: transparent;
}
</style>
