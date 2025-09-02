<template>
  <div class="favoritos-container">
    <!-- Header con flecha y título -->
    <div class="header">
      <ArrowBack @click="$router.back()" />
      <h2 class="carousel-title">Mis Favoritos</h2>
    </div>

    <div class="grid">
      <div
        class="carousel-item"
        v-for="prod in favoritos"
        :key="prod.articuloId"
      >
        <div class="img-container" @click="verDetalle(prod)">
          <img :src="FIREBASE_STORAGE_BASE_URL + prod.url" :alt="prod.nombre" />
          <span class="btn-quitar" @click.stop="quitarFavorito(prod)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              width="16"
              height="16"
            >
              <path
                d="M3 6h18v2H3V6zm2 3h14l-1.5 12.5a1 1 0 01-1 .5H7.5a1 1 0 01-1-.5L5 9zm5 2v8h2v-8H10zm4 0v8h2v-8h-2z"
              />
            </svg>
          </span>
        </div>

        <p class="nombre">{{ prod.nombre }}</p>
        <p class="subtitulo descripcion">{{ prod.descripcion }}</p>
        <div class="precio-agregar">
          <span class="precio">${{ prod.precio.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { db } from "@/db";
import type { Producto } from "@/types/Producto";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import ArrowBack from "@/components/ArrowBack.vue";

const favoritos = ref<Producto[]>([]);

const cargarFavoritos = async () => {
  const items = await db.Favoritos.toArray();
  favoritos.value = items.map((f) => ({
    articuloId: f.articuloId,
    nombre: f.nombre,
    url: f.url || "",
    precio: f.precio || 0,
    descripcion: f.descripcion || "",
  }));
};

const verDetalle = (producto: Producto) => {
  console.log("Ver detalle:", producto.nombre);
};

const quitarFavorito = async (producto: Producto) => {
  await db.Favoritos.where("articuloId").equals(producto.articuloId).delete();
  cargarFavoritos();
};

onMounted(() => cargarFavoritos());
</script>

<style scoped>
.favoritos-container {
  padding: 1rem;
}

/* Header alineado con flecha y título */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  position: relative;
}

.arrow-back {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: black;
  color: white;
  border: none;
  border-radius: 12px; /* esquinas redondeadas (no círculo perfecto) */
  width: 40px; /* ancho fijo */
  height: 40px; /* alto fijo */
  font-size: 20px; /* tamaño de la flecha */
  line-height: 1; /* sin espacio vertical extra */
  cursor: pointer;
  z-index: 5;
  padding: 0;
}

.carousel-title {
  font-size: 1.5rem;
  text-align: center;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.carousel-item {
  background: white;
  border-radius: 8px;
  padding: 0.3rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.img-container {
  position: relative;
  aspect-ratio: 1/1;
}

.img-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.btn-quitar {
  position: absolute;
  top: 6px;
  right: 6px;
  background: red;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center; /* centrado total */
  cursor: pointer;
}

.nombre {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.3rem 0 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.descripcion {
  font-size: 0.75rem;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.3rem;
}

.precio {
  font-size: 0.8rem;
  color: #e74c3c;
  font-weight: bold;
}
</style>
