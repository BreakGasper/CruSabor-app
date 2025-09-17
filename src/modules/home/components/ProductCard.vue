<template>
  <div class="card" @click="irADetalle">
    <div class="img-container">
      <img
        loading="lazy"
        :src="FIREBASE_STORAGE_BASE_URL + producto.url"
        :alt="producto.nombre"
      />
      <span
        class="heart-icon"
        :class="{ active: favorito }"
        @click.stop="toggleFavorito"
      >
        ❤
      </span>
    </div>
    <div class="info">
      <h3>{{ producto.nombre }}</h3>
      <p class="subcategoria">{{ producto.subcategoria || "General" }}</p>
      <p class="precio">${{ producto.precio }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { useRouter } from "vue-router";

const router = useRouter();
const props = defineProps<{
  producto: any;
}>();

const favorito = ref(false);

function irADetalle() {
  router.push(`/producto/${props.producto.articuloId}`);
}

function toggleFavorito() {
  favorito.value = !favorito.value;
}
</script>

<style scoped>
.card {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: white;
  cursor: pointer;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.img-container {
  position: relative;
}
.card img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
}

/* ❤️ Corazón */
.heart-icon {
  position: absolute;
  top: 8px;
  right: 8px;
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

.info {
  padding: 0.75rem;
  text-align: center;
}
.info h3 {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.2rem;
  color: #333;
}
.subcategoria {
  font-size: 0.85rem;
  color: #777;
  margin-bottom: 0.5rem;
}
.precio {
  color: #e74c3c;
  font-weight: bold;
  font-size: 0.95rem;
}

/* Responsive */
@media (max-width: 480px) {
  .card {
    max-width: 100%;
    width: 100%;
    margin: 0 auto;
  }

  .card img {
    height: 120px;
  }

  .info {
    padding: 0.5rem;
  }

  .info h3 {
    font-size: 0.95rem;
  }

  .subcategoria {
    font-size: 0.8rem;
  }

  .precio {
    font-size: 0.9rem;
  }
}
</style>
