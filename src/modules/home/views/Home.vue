<template>
  <!-- Botón scroll to top -->
  <button v-if="showScrollTop" class="scroll-top-btn" @click="scrollToTop">
    ↑
  </button>

  <div class="home">
    <!-- 🔝 Barra superior fija: menú · buscador · carrito · perfil (no se pierde al hacer scroll) -->
    <div class="top-bar-top">
      <button class="menu-button" aria-label="Menú" @click="menuAbierto = !menuAbierto">
        <template v-if="!menuAbierto"> ☰ </template>
        <template v-else>
          <X class="close-icon" />
        </template>
      </button>

      <div class="search-wrapper">
        <input
          id="buscar-productos"
          v-model="busqueda"
          type="search"
          class="search-input"
          placeholder="Buscar productos..."
          aria-label="Buscar productos"
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

      <CartButton class="btn-icon cart bg-bnt-cart" />

      <button class="user-button" aria-label="Mi perfil" @click="validarLoginSession">
        <img
          loading="lazy"
          src="@/assets/images/user.png"
          alt="Usuario"
          class="user-icon"
        />
      </button>
    </div>

    <!-- Menú lateral -->
    <div class="sidebar" :class="{ open: menuAbierto }">
      <div class="sidebar-header">
        <h1 class="logo-text">Cru - <span>Shop</span></h1>
      </div>

      <ul class="sidebar-menu">
        <li>
          <a href="#" @click.prevent="irAlInicio">
            <Home class="icon" />
            Home
          </a>
        </li>
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
          <a
            href="#"
            @click.prevent="
              sessionUsuarioValidation()
                ? $router.push('/favoritos')
                : $router.push('/login')
            "
          >
            <Heart class="icon" />
            Favoritos
          </a>
        </li>
        <li>
          <a @click.prevent="$router.push('/categoria')" href="#">
            <Grid class="icon" />
            Categorias
          </a>
        </li>
        <li>
          <a @click.prevent="$router.push('/tiendas')" href="#">
            <Store class="icon" />
            Tiendas
          </a>
        </li>
      </ul>

      <ul class="sidebar-footer">
        <li v-if="sessionUsuarioValidation()">
          <a href="#" @click="validarLoginSession">
            <Settings class="icon" />
            Mi Perfil
          </a>
        </li>

        <li>
          <div v-if="sessionUsuarioValidation()">
            <a href="#" @click="cerrarSesionLogin()">
              <LogOut class="icon" />
              Cerrar sesión
            </a>
          </div>
          <div v-else>
            <a href="#" @click.prevent="$router.push('/login')">
              <User class="icon" />
              Ingresar
            </a>
          </div>
        </li>
      </ul>
    </div>

    <!-- Overlay -->
    <div class="overlay" v-if="menuAbierto" @click="menuAbierto = false"></div>

    <!-- Categorías: icono + nombre en scroll horizontal -->
    <CategoriasScroll />

    <!-- Banners promocionales (los administra el admin), arriba de "Explorar" -->
    <BannersCarousel class="carrusel-div" />

    <!-- Carrusel de productos destacados (Explorar) -->
    <HorizontalCarousel
      :productos="productosParaCarrusel"
      class="carrusel-div"
    />

    <!-- Tiendas: banner, nombre, favorito y calificación -->
    <TiendasDestacadas />

    <!-- Lista de todos los productos -->
    <section class="destacados">
      <h2 class="title">Productos</h2>
      <div class="grid">
        <ProductCard
          v-for="p in categoriasFiltradas"
          :key="p.articuloId"
          :producto="p"
          @verDetalle="verDetalle"
        />
      </div>
    </section>

    <!-- Detalle de producto -->
    <ProductDetail
      v-if="productoSeleccionado"
      :producto="productoSeleccionado"
      @agregarCarrito="agregarAlCarrito"
    />
  </div>

  <ConfirmModal
    :visible="showConfirmLogout"
    mensaje="¿Estás seguro de cerrar tu sesión?"
    @confirm="confirmLogout"
    @cancel="cancelLogout"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import HorizontalCarousel from "../components/HorizontalCarousel.vue";
import BannersCarousel from "../components/BannersCarousel.vue";
import CategoriasScroll from "../components/CategoriasScroll.vue";
import TiendasDestacadas from "../components/TiendasDestacadas.vue";
import ProductCard from "../components/ProductCard.vue";
import ProductDetail from "../components/ProductDetail.vue";

import { useArticulos, fechaArticulo } from "@/composables/useArticulos";
import {
  cerrarSesion,
  cargarSesion,
  isLoggedIn,
  sessionUser,
  sessionUsuarioValidation,
} from "@/utils/sessionUser";

const { articulos } = useArticulos();
const productoSeleccionado = ref<any | null>(null);
const busqueda = ref("");
const router = useRouter();
const menuAbierto = ref(false);
const showScrollTop = ref(false);
const showConfirmLogout = ref(false);
// Importar iconos Lucide
import {
  Grid,
  Home,
  Search,
  User,
  Star,
  Heart,
  LogOut,
  Settings,
  Sparkles,
  X,
  ShoppingCart,
  LogIn,
  Store,
} from "lucide-vue-next";
import { faShoppingCart } from "@fortawesome/free-solid-svg-icons";
import ConfirmModal from "@/components/ConfirmModal.vue";
import CartButton from "@/components/CartButton.vue";

function verDetalle(produc: any) {
  productoSeleccionado.value = produc;
}
function CerrarSessionHome() {
  // abrir modal en vez de cerrar directamente
  showConfirmLogout.value = true;
}
function confirmLogout() {
  cerrarSesion();
  router.push("/");
  showConfirmLogout.value = false;
}

function cancelLogout() {
  showConfirmLogout.value = false;
}
function agregarAlCarrito(produc: any) {
  productoSeleccionado.value = null;
}

// Carrusel "Explorar": los 10 más recientes
const productosParaCarrusel = computed(() =>
  [...categoriasFiltradas.value]
    .sort((a, b) => fechaArticulo(b) - fechaArticulo(a))
    .slice(0, 10)
    .map((a) => ({
    ...a, // incluye todos los articulos de firebase
    url: a.url || "", // <- Aquí asignamos la propiedad url
  }))
);

function validarLoginSession() {
  if (isLoggedIn()) {
    router.push("/perfil");
    console.log("Usuario activo:", sessionUser.value?.nombre);
  } else {
    router.push("/login");
    console.log("No hay sesión");
  }
}
// Filtra los productos por nombre según lo escrito

const categoriasFiltradas = computed(() => {
  if (!busqueda.value) return articulos.value; // Si está vacío, devuelve todos
  return articulos.value.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.value.toLowerCase())
  );
});

function cerrarSesionLogin() {
  CerrarSessionHome();
  menuAbierto.value = false;
}
/**
 * "Home" del menú: cierra el menú y sube al principio.
 *
 * No navega a ningún lado porque el menú solo existe en esta pantalla: quien lo
 * abre ya está en el inicio. Si no se cerrara, se tocaría la opción y la página
 * subiría detrás del menú abierto, que se siente como que no pasó nada.
 */
function irAlInicio() {
  menuAbierto.value = false;
  scrollToTop();
}

function handleScroll() {
  // La barra superior siempre queda visible; solo se controla el botón de subir
  showScrollTop.value = window.scrollY > 200;
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth", // scroll suave
  });
}

function handleBack() {
  // Si está en checkout y presiona atrás

  // 👇 Evitar volver atrás y mandar al perfil
  router.replace("/");
}
onMounted(() => {
  cargarSesion(); // carga sesión desde localStorage

  /*  if (!sessionUser.value) {
    // Si no hay sesión, redirige al login
    router.push("/login");
  }*/
});
onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});

onMounted(() => {
  window.addEventListener("popstate", handleBack);
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handleBack);
});
</script>

<style scoped>
.home {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding: 1rem;
  padding-top: 84px; /* deja espacio a la barra superior fija */
  margin: 0 auto;
}
.title {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: left;
  margin-bottom: 1rem;
}

/* 🔝 Barra superior fija: menú · buscador · carrito · perfil */
.top-bar-top {
  position: fixed; /* se queda fija al hacer scroll */
  top: 10px; /* margen superior */
  left: 50%; /* centrada horizontalmente */
  transform: translateX(-50%);
  width: calc(100% - 1.5rem); /* ancho responsivo */
  max-width: 1200px;
  z-index: 100; /* encima de todo */
  background-color: var(--surface);
  padding: 0.45rem 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 16px; /* esquinas redondeadas */
  box-shadow: 0 4px 12px var(--color-shadow);
}
.menu-button {
  flex: 0 0 auto;
  background: transparent;
  color: var(--text);
  border: 0;
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
  color: var(--text);
}

.user-button {
  flex: 0 0 auto;
  background: var(--color-bg-blue-dark);
  width: 40px;
  height: 40px;
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

/* Teléfono: dos tarjetas por renglón, como en las tiendas en línea. Se probó
   con una fila por producto y la foto quedaba demasiado chica para antojar. */
@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
    padding: 0.75rem 0;
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
  color: var(--text); /* sigue el tema: oscuro en claro, claro en oscuro */
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
  color: var(--text); /* mismo color que el texto del enlace */
  transition: color 0.3s;
}

.sidebar ul li a:hover svg,
.sidebar ul li a.active svg {
  color: #fff; /* icono blanco al hover/selección */
}
/* Separador gris entre Account y Settings */
.sidebar-footer li:first-child {
  border-top: 1px solid var(--border); /* línea gris */
  padding-top: 0.5rem; /* espacio arriba de la línea */
  margin-top: 0.5rem; /* espacio entre Account y la línea */
}

.logo-text {
  font-size: 1.3rem;
  font-weight: bold;
  color: var(--text);
}

.logo-text span {
  color: var(--text-muted);
  font-weight: normal;
}

/* Drawer lateral compacto */
.sidebar {
  /* Fondo propio del menú: blanco hueso en claro, superficie del tema en oscuro.
     Estaba fijo en #f5f1eb y el texto en var(--text): en modo oscuro quedaban
     letras casi blancas sobre un fondo casi blanco, o sea invisibles. */
  --sidebar-bg: #f5f1eb;
  position: fixed;
  top: 20%; /* centrado verticalmente */
  left: -220px; /* fuera de pantalla inicialmente */
  width: 220px; /* ancho del drawer */
  height: 60%; /* altura compacta */
  background: var(--sidebar-bg);
  color: var(--text);
  z-index: 20;
  padding: 2rem 1.5rem;
  box-shadow: 4px 0 12px var(--color-shadow);
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

@media (prefers-color-scheme: dark) {
  .sidebar {
    --sidebar-bg: var(--surface);
    border: 1px solid var(--border);
    border-left: 0; /* el drawer sale del borde izquierdo de la pantalla */
  }
  /* Sobre fondo oscuro, el azul marino de marca casi no se distingue */
  .sidebar ul li a:hover,
  .sidebar ul li a.active {
    background-color: var(--color-bg-blue-ligth);
  }
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
  min-width: 0;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.8rem 0.6rem 2.4rem; /* espacio extra para icono */
  border: none;
  border-radius: 12px;
  background: var(--surface-2); /* gris claro */
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
  color: var(--text-muted);
  pointer-events: none;
  transition: color 0.3s ease;
}
.bg-bnt-cart {
  background-color: transparent;
  flex: 0 0 auto;
}
.scroll-top-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 36px; /* ancho fijo */
  height: 36px; /* igual al ancho para círculo */
  background: var(--surface);
  color: var(--brand-navy-text); /* flecha azul */
  border: 2px solid var(--color-bg-blue-dark);
  border-radius: 50%; /* círculo perfecto */
  display: flex;
  justify-content: center;
  align-items: center; /* centra la flecha perfectamente */
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  font-size: 16px; /* tamaño de la flecha */
  z-index: 50;
  transition: transform 0.2s ease, opacity 0.3s ease;
}

.scroll-top-btn:hover {
  transform: scale(1.1);
}

/* ===== Responsive: contenido centrado en pantallas grandes ===== */
.home > .top-bar,
.home > .carrusel-div,
.home > .destacados {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}
.home > .top-bar {
  padding-left: 0;
  padding-right: 0;
}
@media (max-width: 480px) {
  .home {
    padding: 0.75rem;
    padding-top: 100px;
  }
  .search-input {
    font-size: 16px; /* evita zoom automático en iOS */
  }
}
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.5rem;
  }
}
</style>
