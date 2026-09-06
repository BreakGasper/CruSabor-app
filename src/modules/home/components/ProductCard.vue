<template>
  <div class="card" @click="irADetalle">
    <div class="img-container">
      <img
        loading="lazy"
        :src="FIREBASE_STORAGE_BASE_URL+imagenUrl(producto.url) || defaultImg"
        :alt="producto.nombre"
        @error="onImgError"
      />
      <!-- ❤️ Favorito real (solo con sesión) -->
      <button
        v-if="sessionUsuarioValidation()"
        class="heart-icon"
        :class="{ active: estaFavorito(producto.articuloId) }"
        :title="estaFavorito(producto.articuloId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
        @click.stop="toggleFavoritoLocal(producto, sessionUser.id)"
      >
        <FontAwesomeIcon :icon="estaFavorito(producto.articuloId) ? ['fas', 'heart'] : ['far', 'heart']" />
      </button>
    </div>

    <div class="info">
      <h3 :title="producto.nombre">{{ producto.nombre }}</h3>
      <p class="subcategoria">{{ producto.subcategoria || producto.categoria || "General" }}</p>
      <div class="fila-precio">
        <span class="precio">${{ Number(producto.precio).toFixed(2) }}</span>
        <span v-if="esPorPedido(producto)" class="tag por-pedido" title="La tienda lo elabora cuando lo pides">Bajo pedido</span>
        <span v-else-if="sinStock(producto)" class="tag agotado">Agotado</span>
        <span v-else-if="sinEnvioTienda(producto)" class="tag sin-envio">Sin envío</span>
      </div>

      <!-- 🛒 Carrito: mismo control que la lista de productos -->
      <div class="acciones" @click.stop>
        <button
          v-if="!(cantidadEnCarrito[producto.articuloId] > 0)"
          class="btn-agregar"
          :disabled="sinStock(producto) || sinEnvioTienda(producto)"
          @click.stop="aumentar(producto)"
        >
          <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
          {{ sinEnvioTienda(producto) ? "Sin envío" : sinStock(producto) ? "Sin stock" : "Agregar" }}
        </button>
        <div v-else class="contador">
          <button
            class="btn-c menos"
            :class="{ basura: cantidadEnCarrito[producto.articuloId] === 1 }"
            :title="cantidadEnCarrito[producto.articuloId] > 1 ? 'Quitar uno' : 'Quitar del carrito'"
            @click.stop="disminuir(producto)"
          >
            <FontAwesomeIcon :icon="cantidadEnCarrito[producto.articuloId] > 1 ? ['fas', 'minus'] : ['fas', 'trash-can']" />
          </button>
          <span class="cantidad">{{ cantidadEnCarrito[producto.articuloId] }}</span>
          <button
            class="btn-c mas"
            :disabled="stockDe(producto) !== Infinity && cantidadEnCarrito[producto.articuloId] >= stockDe(producto)"
            title="Agregar uno"
            @click.stop="aumentar(producto)"
          >
            <FontAwesomeIcon :icon="['fas', 'plus']" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from "@/constants/firebase_util";
import defaultImg from "@/assets/icons/default_articulo.png";
import { useCarritoRapido } from "@/db/composables/useCarritoRapido";
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import { sessionUser, sessionUsuarioValidation } from "@/utils/sessionUser";
import type { Producto } from "@/types/Producto";

const router = useRouter();
const props = defineProps<{ producto: Producto }>();

const { cantidadEnCarrito, aumentar, disminuir, stockDe, sinStock, sinEnvioTienda, esPorPedido } = useCarritoRapido();
const { toggleFavoritoLocal, estaFavorito } = useHorizontalCarousel();

function irADetalle() {
  router.push(`/producto/${props.producto.articuloId}`);
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
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
  background: var(--surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.img-container {
  position: relative;
  background: var(--surface-2);
}
.card img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}

/* ❤️ Corazón */
.heart-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: color 0.2s ease;
}
.heart-icon :deep(svg) {
  width: 0.95em;
  height: 0.95em;
}
.heart-icon.active,
.heart-icon:hover {
  color: #e74c3c;
}

.info {
  padding: 0.75rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.info h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.subcategoria {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fila-precio {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
}
.precio {
  color: #e74c3c;
  font-weight: 800;
  font-size: 1rem;
}
.tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.tag.agotado {
  background: #fdecea;
  color: #c0392b;
}
.tag.por-pedido {
  background: #eef2ff;
  color: #3730a3;
}
.tag.sin-envio {
  background: #fff4e5;
  color: #8a5a00;
}

/* 🛒 Carrito */
.acciones {
  margin-top: 0.45rem;
}
.btn-agregar {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0.5rem;
  border: none;
  border-radius: 10px;
  background: var(--color-bg-blue-dark);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-agregar :deep(svg) {
  width: 0.95em;
  height: 0.95em;
}
.btn-agregar:hover {
  background: var(--color-bg-blue-ligth);
}
.btn-agregar:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.contador {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 3px;
}
.btn-c {
  width: 32px;
  height: 32px;
  padding: 0; /* el button global trae padding y aplasta el icono */
  border-radius: 50%;
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.btn-c :deep(svg) {
  width: 0.9rem;
  height: 0.9rem;
}
.btn-c:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-c.mas {
  background: #27ae60;
}
.btn-c.menos {
  background: var(--color-bg-blue-ligth);
}
.btn-c.menos.basura {
  background: #e74c3c;
}
.cantidad {
  font-weight: 700;
  color: var(--text);
  min-width: 24px;
  text-align: center;
}

/* Responsive */
@media (max-width: 480px) {
  .card {
    max-width: 100%;
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
  .btn-agregar {
    font-size: 0.78rem;
    padding: 0.45rem 0.4rem;
  }
}
</style>
