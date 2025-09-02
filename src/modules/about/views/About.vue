<template>
  <div class="articulos-container">
    <h2>Lista de artículos</h2>
    <div v-if="loading" class="loading">Cargando artículos...</div>
    <ul v-else class="lista-articulos">
      <li
        v-for="articulo in articulos"
        :key="articulo.articuloId"
        class="articulo-card"
      >
        <img
          class="articulo-imagen"
          :src="articulo.imagen || articulo.url_image || ''"
          :alt="articulo.nombre || 'Imagen artículo'"
          loading="lazy"
        />
        <div class="articulo-info">
          <strong class="articulo-nombre">{{ articulo.nombre }}</strong>
          <span class="articulo-precio">{{ articulo.precio }} MXN</span>
          <p class="articulo-descripcion">{{ articulo.descripcion || "" }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useArticulos } from "@/composables/useArticulos";

const { articulos, loading } = useArticulos();
</script>

<style scoped>
.articulos-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.loading {
  text-align: center;
  font-size: 1.2rem;
  color: #666;
}

.lista-articulos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.articulo-card {
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;
}

.articulo-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgb(0 0 0 / 0.15);
}

.articulo-imagen {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-bottom: 1px solid #eee;
}

.articulo-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-grow: 1;
}

.articulo-nombre {
  font-size: 1.25rem;
  color: #333;
}

.articulo-precio {
  font-weight: 600;
  color: #27ae60;
  font-size: 1.1rem;
}

.articulo-descripcion {
  color: #666;
  font-size: 0.9rem;
  margin-top: auto;
}
</style>
