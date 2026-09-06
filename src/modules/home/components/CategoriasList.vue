<template>
  <div class="categorias-container">
    <!-- Header -->
    <PageHeader title="Categorías" fallback="/" />

    <!-- Buscador -->
    <div class="search-wrapper">
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
      <input
        id="buscar-categoria"
        v-model="busqueda"
        type="search"
        class="search-input"
        placeholder="Buscar categoría..."
        aria-label="Buscar categoría"
      />
      <button v-if="busqueda" class="clear-btn" @click="busqueda = ''">✕</button>
    </div>

    <!-- Orden -->
    <div class="toolbar">
      <span class="counter">
        {{ categoriasFiltradas.length }}
        {{ categoriasFiltradas.length === 1 ? 'categoría' : 'categorías' }}
      </span>
      <label class="solo-con">
        <input v-model="soloConProductos" type="checkbox" />
        Solo con productos
      </label>
    </div>

    <!-- Estados -->
    <p v-if="cargando" class="empty">Cargando categorías...</p>
    <p v-else-if="categoriasFiltradas.length === 0" class="empty">
      No hay categorías que coincidan con "{{ busqueda }}".
    </p>

    <!-- Grid -->
    <div v-else class="grid">
      <div
        v-for="cat in categoriasFiltradas"
        :key="cat.id"
        class="categoria-item"
        :class="{ vacia: conteo[cat.id] === 0 }"
        @click="verCategoria(cat)"
      >
        <div class="img-container">
          <img
            loading="lazy"
            :src="cat.icono || defaultIcon"
            :alt="cat.nombre"
            @error="onImgError"
          />
        </div>
        <p class="nombre" :title="cat.nombre">{{ cat.nombre }}</p>
        <span class="badge">
          {{ conteo[cat.id] || 0 }}
          {{ (conteo[cat.id] || 0) === 1 ? 'producto' : 'productos' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import { obtenerCategorias } from "@/composables/useCategorias";
import { useArticulos } from "@/composables/useArticulos";
import defaultIcon from "@/assets/icons/default_articulo.png";

interface Categoria {
  id: string;
  nombre: string;
  icono?: string;
}

const router = useRouter();
const categorias = ref<Categoria[]>([]);
const cargando = ref(true);
const busqueda = ref("");
const soloConProductos = ref(false);

const { articulos } = useArticulos();

const normalizar = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

onMounted(async () => {
  categorias.value = await obtenerCategorias();
  cargando.value = false;
});

// Conteo de productos por categoría
// Conteo por categoriaId (ver scripts/migrar-categoriaId.mjs para los artículos antiguos)
const conteo = computed<Record<string, number>>(() => {
  const acc: Record<string, number> = {};
  for (const a of articulos.value) {
    if (a.categoriaId) acc[a.categoriaId] = (acc[a.categoriaId] || 0) + 1;
  }
  return acc;
});

const categoriasFiltradas = computed(() => {
  const q = normalizar(busqueda.value.trim());
  return categorias.value
    .filter((c) => !q || normalizar(c.nombre).includes(q))
    .filter((c) => !soloConProductos.value || (conteo.value[c.id] || 0) > 0)
    .sort((a, b) => {
      // Con productos primero, luego alfabético
      const da = (conteo.value[a.id] || 0) > 0 ? 0 : 1;
      const db = (conteo.value[b.id] || 0) > 0 ? 0 : 1;
      return da - db || a.nombre.localeCompare(b.nombre);
    });
});

const verCategoria = (cat: Categoria) => {
  router.push({
    name: "categoriaArticulos",
    params: { id: cat.id, categoriaNombre: cat.nombre },
  });
};

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultIcon;
}
</script>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}
.categorias-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.75rem 1rem 2rem;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 1rem;
  min-height: 44px;
}
.back-btn {
  position: absolute;
  left: 0;
  width: 40px;
}
.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

/* Buscador */
.search-wrapper {
  position: relative;
  margin-bottom: 0.75rem;
}
.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 2.8rem;
  border: none;
  border-radius: 12px;
  background: #f1f3f6;
  font-size: 16px;
  outline: none;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;
}
.search-input:focus {
  box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.2);
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
}
.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #dfe3e8;
  color: #444;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: #666;
}
.counter {
  font-weight: 600;
}
.solo-con {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.solo-con input {
  accent-color: var(--color-bg-blue-dark);
  width: 16px;
  height: 16px;
}
.empty {
  text-align: center;
  color: #777;
  padding: 2rem 0;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.9rem;
}

/* Card */
.categoria-item {
  background: #fff;
  border-radius: 16px;
  padding: 1rem 0.75rem 0.9rem;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  min-height: 190px;
}
.categoria-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
}
.categoria-item.vacia {
  opacity: 0.75;
}

.img-container {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef4fb, #dfe9f7);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.img-container img {
  width: 60%;
  height: 60%;
  object-fit: contain;
}

.nombre {
  width: 100%;
  margin: 0;
  font-weight: 600;
  font-size: 0.92rem;
  color: #222;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.badge {
  margin-top: auto;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: #e8f1fc;
  color: var(--color-bg-blue-ligth);
}
.categoria-item.vacia .badge {
  background: #ececec;
  color: #5f6368;
}

/* Responsive */
@media (min-width: 768px) {
  .grid {
    gap: 1.1rem;
  }
  .categoria-item {
    min-height: 210px;
  }
  .img-container {
    width: 96px;
    height: 96px;
  }
}
@media (max-width: 480px) {
  .categorias-container {
    padding: 0.5rem 0.75rem 2rem;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }
  .categoria-item {
    min-height: 170px;
    padding: 0.85rem 0.6rem 0.8rem;
  }
  .img-container {
    width: 70px;
    height: 70px;
  }
  .toolbar {
    flex-wrap: wrap;
  }
}
</style>
