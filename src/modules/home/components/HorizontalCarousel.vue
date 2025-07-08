<template>
  <div class="carousel-container">
    <h2 class="carousel-title">Explorar</h2>

    <div class="carousel-wrapper">
      <button class="arrow left" @click="scrollLeft">&#10094;</button>

      <div class="carousel-scroll" ref="scrollArea">
        <div
          class="carousel-item"
          v-for="p in productos.slice(0, 10)"
          :key="p.articuloId"
        >
          <div class="img-container" @click="verDetalle(p)">
            <img :src="FIREBASE_STORAGE_BASE_URL + p.url" :alt="p.nombre" />
            <span
              class="heart-icon"
              :class="{ active: favoritos.includes(p.articuloId) }"
              @click.stop="toggleFavorito(p.articuloId)"
            >
              ❤
            </span>
          </div>
          <p class="nombre">{{ p.nombre }}</p>

          <!-- Subtítulo opcional -->
          <p class="subtitulo">
            Subcategoría: {{ p.subcategoria || "General" }}
          </p>

          <div class="precio-agregar">
            <span class="precio">${{ p.precio }}</span>

            <button class="btn-agregar" @click.stop="agregarAlCarrito(p)">
              <FontAwesomeIcon :icon="faPlus" />
            </button>
          </div>
        </div>

        <div class="carousel-item ver-mas" @click="verMas">
          <span>Ver más…</span>
        </div>
      </div>

      <button class="arrow right" @click="scrollRight">&#10095;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

const props = defineProps<{ productos: any[] }>();
const scrollArea = ref<HTMLElement | null>(null);
const router = useRouter();
const favoritos = ref<number[]>([]);

function scrollLeft() {
  scrollArea.value?.scrollBy({ left: -200, behavior: "smooth" });
}

function scrollRight() {
  scrollArea.value?.scrollBy({ left: 200, behavior: "smooth" });
}

function verDetalle(producto: any) {
  router.push(`/producto/${producto.articuloId}`);
}

function verMas() {
  router.push("/productos");
}

function toggleFavorito(id: number) {
  const index = favoritos.value.indexOf(id);
  if (index >= 0) {
    favoritos.value.splice(index, 1);
  } else {
    favoritos.value.push(id);
  }
}

function agregarAlCarrito(producto: any) {
  console.log("Agregar al carrito:", producto);
  // Aquí puedes emitir un evento o integrar con tu lógica real
}
</script>

<style scoped>
.carousel-container {
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  padding: 1rem 0;
}

.carousel-title {
  font-size: 1.2rem;
  font-weight: bold;
  text-align: left;
  margin-bottom: 1rem;
}

.carousel-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.carousel-scroll {
  display: flex;
  overflow-x: auto;
  gap: 1rem;
  padding: 0 2.5rem;
  scroll-behavior: smooth;
  box-sizing: border-box;
  width: 100%;
}

.carousel-scroll::-webkit-scrollbar {
  display: none;
}

.carousel-item {
  flex: 0 0 auto;
  width: clamp(120px, 35vw, 170px);
  background: white;
  border-radius: 0.8rem;
  padding: 0.5rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.carousel-item:hover {
  transform: translateY(-6px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
}

.img-container {
  position: relative;
}

.carousel-item img {
  width: 100%;
  aspect-ratio: 1/1;
  object-fit: cover;
  border-radius: 0.5rem;
}

.nombre {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.subtitulo {
  font-size: 0.8rem;
  color: #888;
  margin: 0.2rem 0 0.5rem;
}

.precio-agregar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.2rem;
}

.precio {
  color: #777;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-agregar {
  background: black; /* fondo negro */
  border: none;
  border-radius: 50%; /* círculo */
  width: 28px;
  height: 28px;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.btn-agregar:hover {
  background: #222; /* fondo un poco más oscuro al hover */
  transform: scale(1.1);
}

.btn-agregar svg {
  color: white;
  width: 16px;
  height: 16px;
}
/* ❤️ Favorito */
.heart-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 1.1rem;
  color: #bbb;
  background: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: color 0.2s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.heart-icon.active {
  color: red;
}

.heart-icon:hover {
  color: #e63946;
}

.ver-mas {
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 36px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 2;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow:hover {
  transform: translateY(-50%) scale(1.1);
}

.arrow.left {
  left: 8px;
}

.arrow.right {
  right: 8px;
}

@media (max-width: 480px) {
  .arrow {
    display: none;
  }
}
</style>
