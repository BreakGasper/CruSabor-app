<template>
  <div class="productos-container">
    <PageHeader title="Todos los productos" fallback="/">
      <CartButton class="header-cart" />
    </PageHeader>

    <!-- Buscador -->
    <div class="search-wrapper">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z" />
      </svg>
      <input
        id="buscar-producto"
        v-model="busqueda"
        type="search"
        class="search-input"
        placeholder="Buscar producto, categoría o tienda..."
        aria-label="Buscar producto"
      />
      <button v-if="busqueda" class="clear-btn" @click="busqueda = ''">✕</button>
    </div>

    <!-- Orden y conteo -->
    <div class="toolbar">
      <span class="counter">
        {{ productosFiltrados.length }} {{ productosFiltrados.length === 1 ? 'producto' : 'productos' }}
      </span>
      <select v-model="orden" class="orden" aria-label="Ordenar">
        <option value="recientes">Más recientes</option>
        <option value="antiguos">Más antiguos</option>
        <option value="menor">Menor precio</option>
        <option value="mayor">Mayor precio</option>
        <option value="nombre">Nombre A-Z</option>
      </select>
    </div>

    <!-- Estados -->
    <p v-if="loading" class="empty">Cargando productos...</p>
    <p v-else-if="productosFiltrados.length === 0" class="empty">
      {{ busqueda ? `Nada coincide con "${busqueda}".` : 'Aún no hay productos publicados.' }}
    </p>

    <!-- Grid -->
    <div v-else class="grid">
      <article
        v-for="p in productosFiltrados"
        :key="p.articuloId"
        class="card"
        @click="verDetalle(p)"
      >
        <div class="img-wrap">
          <img loading="lazy" :src="FIREBASE_STORAGE_BASE_URL+imagenUrl(p.url) || defaultImg" :alt="p.nombre" @error="onImgError" />
          <span v-if="esNuevo(p)" class="badge-nuevo">Nuevo</span>
          <button
            v-if="sessionUsuarioValidation()"
            class="heart"
            :class="{ active: estaFavorito(p.articuloId) }"
            :title="estaFavorito(p.articuloId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
            @click.stop="toggleFavoritoLocal(p, sessionUser.id)"
          >
            <FontAwesomeIcon :icon="estaFavorito(p.articuloId) ? ['fas', 'heart'] : ['far', 'heart']" />
          </button>
        </div>

        <div class="info">
          <h3 class="nombre" :title="p.nombre">{{ p.nombre }}</h3>
          <p class="meta">
            <span v-if="p.categoria">{{ p.categoria }}</span>
            <span v-if="p.tiendaNombre" class="tienda">· {{ p.tiendaNombre }}</span>
          </p>
          <p class="fecha">{{ fechaTexto(p) }}</p>
          <div class="fila-precio">
            <span class="precio">${{ Number(p.precio).toFixed(2) }}</span>
            <span v-if="sinStock(p)" class="tag agotado">Agotado</span>
            <span v-else-if="sinEnvioTienda(p)" class="tag sin-envio">Sin envío</span>
          </div>

          <!-- Carrito -->
          <div class="acciones" @click.stop>
            <button
              v-if="!(cantidadEnCarrito[p.articuloId] > 0)"
              class="btn-agregar"
              :disabled="sinStock(p) || sinEnvioTienda(p)"
              @click.stop="aumentar(p)"
            >
              <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
              {{ sinEnvioTienda(p) ? 'Sin envío' : sinStock(p) ? 'Sin stock' : 'Agregar' }}
            </button>
            <div v-else class="contador">
              <button class="btn-c menos" :class="{ basura: cantidadEnCarrito[p.articuloId] === 1 }" @click.stop="disminuir(p)">
                <FontAwesomeIcon :icon="cantidadEnCarrito[p.articuloId] > 1 ? ['fas', 'minus'] : ['fas', 'trash-can']" />
              </button>
              <span class="cantidad">{{ cantidadEnCarrito[p.articuloId] }}</span>
              <button
                class="btn-c mas"
                :disabled="stockDe(p) !== Infinity && cantidadEnCarrito[p.articuloId] >= stockDe(p)"
                @click.stop="aumentar(p)"
              >
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import PageHeader from '@/components/PageHeader.vue';
import CartButton from '@/components/CartButton.vue';
import { useArticulos, fechaArticulo } from '@/composables/useArticulos';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { useHorizontalCarousel } from '@/modules/home/scripts/useHorizontalCarousel';
import { sessionUser, sessionUsuarioValidation } from '@/utils/sessionUser';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultImg from '@/assets/icons/default_articulo.png';
import type { Producto } from '@/types/Producto';

const router = useRouter();
const { articulos, loading } = useArticulos();
const { cantidadEnCarrito, aumentar, disminuir, stockDe, sinStock, sinEnvioTienda } = useCarritoRapido();
const { toggleFavoritoLocal, estaFavorito } = useHorizontalCarousel();

const busqueda = ref('');
type Orden = 'recientes' | 'antiguos' | 'menor' | 'mayor' | 'nombre';
const orden = ref<Orden>('recientes');

const normalizar = (s?: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const comparar: Record<Orden, (a: Producto, b: Producto) => number> = {
  recientes: (a, b) => fechaArticulo(b) - fechaArticulo(a),
  antiguos: (a, b) => fechaArticulo(a) - fechaArticulo(b),
  menor: (a, b) => Number(a.precio) - Number(b.precio),
  mayor: (a, b) => Number(b.precio) - Number(a.precio),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre),
};

const productosFiltrados = computed(() => {
  const q = normalizar(busqueda.value);
  return articulos.value
    .filter(
      (p) =>
        !q ||
        normalizar(p.nombre).includes(q) ||
        normalizar(p.categoria).includes(q) ||
        normalizar(p.tiendaNombre).includes(q),
    )
    .sort(comparar[orden.value]);
});

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const esNuevo = (p: Producto) => {
  const t = fechaArticulo(p);
  return t > 0 && Date.now() - t < SIETE_DIAS;
};

function fechaTexto(p: Producto) {
  const t = fechaArticulo(p);
  if (!t) return '';
  return 'Publicado el ' + new Date(t).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function verDetalle(p: Producto) {
  router.push(`/producto/${p.articuloId}`);
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
}
</script>

<style scoped>
.productos-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
  box-sizing: border-box;
}
.header-cart {
  color: #fff;
  background: transparent;
  border: none;
  padding: 0; /* el button global trae padding y aplasta el icono */
  font-size: 1.1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.header-cart :deep(svg) {
  width: 1.15em;
  height: 1.15em;
}

/* Buscador */
.search-wrapper { position: relative; margin-bottom: 0.75rem; }
.search-input {
  width: 100%; padding: 0.75rem 2.5rem 0.75rem 2.8rem; border: none; border-radius: 12px;
  background: #f1f3f6; font-size: 16px; outline: none; box-sizing: border-box;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05); transition: box-shadow 0.2s;
}
.search-input:focus { box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.2); }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: #888; pointer-events: none; }
.clear-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px;
  border: none; border-radius: 50%; background: #dfe3e8; color: #444; cursor: pointer; font-size: 0.8rem; padding: 0;
}

/* Toolbar */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 0.75rem; }
.counter { font-size: 0.85rem; font-weight: 600; color: #666; }
.orden { padding: 6px 10px; border: 1px solid #d5dbe3; border-radius: 8px; background: #fff; font-size: 0.85rem; }
.empty { text-align: center; color: #777; padding: 2rem 0; }

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Card */
.card {
  background: #fff; border-radius: 16px; overflow: hidden; cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07); display: flex; flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover { transform: translateY(-3px); box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12); }
.img-wrap { position: relative; aspect-ratio: 1 / 1; background: #f5f6fa; }
.img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.badge-nuevo {
  position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: 999px;
  background: #27ae60; color: #fff; font-size: 0.7rem; font-weight: 700;
}
.heart {
  position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 50%; border: none;
  background: #fff; color: #bbb; display: flex; align-items: center; justify-content: center; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); padding: 0;
}
.heart.active { color: #e74c3c; }

.info { padding: 0.7rem 0.8rem 0.8rem; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.nombre { margin: 0; font-size: 0.95rem; font-weight: 700; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { margin: 0; font-size: 0.78rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fecha { margin: 0; font-size: 0.72rem; color: #767676; }
.fila-precio { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
.precio { font-weight: 800; color: #e74c3c; font-size: 1rem; }
.tag { font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
.tag.agotado { background: #fdecea; color: #c0392b; }
.tag.sin-envio { background: #fff4e5; color: #8a5a00; }

/* Carrito */
.acciones { margin-top: 0.4rem; }
.btn-agregar {
  width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0.5rem;
  border: none; border-radius: 10px; background: var(--color-bg-blue-dark); color: #fff; font-size: 0.85rem;
  font-weight: 600; cursor: pointer; white-space: nowrap;
}
.btn-agregar:hover { background: var(--color-bg-blue-ligth); }
.btn-agregar:disabled { background: #ccc; cursor: not-allowed; }
.contador { display: flex; align-items: center; justify-content: space-between; background: #f0f2f5; border-radius: 999px; padding: 3px; }
.btn-c { width: 32px; height: 32px; padding: 0; border-radius: 50%; border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem; flex-shrink: 0; }
.btn-c :deep(svg) { width: 0.9rem; height: 0.9rem; }
.btn-agregar :deep(svg), .heart :deep(svg) { width: 0.95em; height: 0.95em; }
.heart { padding: 0; }
.btn-c:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-c.mas { background: #27ae60; }
.btn-c.menos { background: var(--color-bg-blue-ligth); }
.btn-c.menos.basura { background: #e74c3c; }
.cantidad { font-weight: 700; color: #333; min-width: 24px; text-align: center; }

@media (max-width: 480px) {
  .productos-container { padding: 0 0.75rem 2rem; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; }
  .info { padding: 0.55rem 0.6rem 0.65rem; }
  .btn-agregar { font-size: 0.78rem; padding: 0.45rem 0.4rem; }
  .toolbar { flex-wrap: wrap; }
}
</style>
