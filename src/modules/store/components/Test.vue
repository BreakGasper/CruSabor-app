<template>
  <div class="auto-categorizar-container">
    <h2>Asignar Categorías Automáticamente</h2>
    <button
      @click="asignarCategorias"
      :disabled="procesando || loadingCategorias"
    >
      {{
        procesando
          ? "Procesando..."
          : loadingCategorias
          ? "Cargando Categorías..."
          : "Asignar Categorías"
      }}
    </button>
    <p v-if="mensaje">{{ mensaje }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { db } from "@/firebase";
import { ref as dbRef, update } from "firebase/database";
import { useArticulos } from "@/composables/useArticulos";
import type { CategoriaData } from "@/composables/useCategorias";
import { obtenerCategorias } from "@/composables/useCategorias";

const { articulos } = useArticulos();
const procesando = ref(false);
const mensaje = ref("");
const categorias = ref<CategoriaData[]>([]);
const loadingCategorias = ref(true);

const asignarCategorias = async () => {
  if (articulos.value.length === 0) {
    mensaje.value = "No hay artículos para procesar.";
    return;
  }
  if (categorias.value.length === 0) {
    mensaje.value = "No hay categorías cargadas todavía.";
    return;
  }

  procesando.value = true;
  mensaje.value = "";

  // Copia de artículos para iterar
  const todosArticulos = [...articulos.value];

  // Iteramos de 10 en 10
  while (todosArticulos.length > 0) {
    const bloque = todosArticulos.splice(0, 10);

    for (const art of bloque) {
      // Elegimos una categoría al azar
      const cat: CategoriaData =
        categorias.value[Math.floor(Math.random() * categorias.value.length)];

      // Referencia Firebase
      const artRef = dbRef(db, `articulos/${art.articuloId}`);

      try {
        await update(artRef, {
          categoriaId: cat.id,
          categoriaNombre: cat.nombre,
          categoria: cat.nombre,
        });

        // Actualizamos localmente en useArticulos
        const idx = articulos.value.findIndex(
          (a) => a.articuloId === art.articuloId
        );
        if (idx !== -1) {
          articulos.value[idx] = {
            ...articulos.value[idx],
            categoriaId: cat.id,
            subcategoria: cat.nombre,
            categoria: cat.nombre,
          };
        }
      } catch (error) {
        console.error(`Error actualizando artículo ${art.articuloId}:`, error);
      }
    }
  }

  mensaje.value = `✅ Se actualizaron ${articulos.value.length} artículos al azar.`;
  procesando.value = false;
};
// Cargar categorías al montar
onMounted(async () => {
  categorias.value = await obtenerCategorias();
  loadingCategorias.value = false;
});
</script>

<style scoped>
.auto-categorizar-container {
  padding: 1rem;
  max-width: 400px;
  margin: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

button {
  padding: 0.6rem 1rem;
  border: none;
  background-color: #4caf50;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
}

p {
  margin-top: 1rem;
  font-weight: 600;
}
</style>
