<template>
  <div class="detalle-container" v-if="producto">
    <!-- Imagen superior -->
    <div class="detalle-header">
      <img
        :src="FIREBASE_STORAGE_BASE_URL + producto.url"
        :alt="producto.nombre"
        class="detalle-img"
      />

      <!-- Botón volver  con SVG -->
      <ArrowBack class="btn-icon back" @click="$router.back()" />

      <!-- Carrito -->
      <button class="btn-icon cart" @click="$router.push('/cart')">
        <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
      </button>
      <button
        class="btn-fav"
        :class="{ active: esFavorito }"
        @click="toggleFavorito(producto)"
      >
        <FontAwesomeIcon
          :icon="esFavorito ? ['fas', 'heart'] : ['far', 'heart']"
          class="icono-corazon"
        />
      </button>
    </div>

    <!-- Información del producto -->
    <div class="detalle-info">
      <div class="precio-ranking">
        <p class="precio">${{ Number(producto.precio).toFixed(2) }}</p>
        <div class="rating">
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star">☆</span>
          <span class="rating-value">4.5</span>
        </div>
      </div>

      <h1 class="titulo">{{ producto.nombre }}</h1>

      <!-- Opciones de color -->
      <div class="color-section">
        <p class="color-label">Color option</p>
        <div class="color-options">
          <span class="color-dot black"></span>
          <span class="color-dot red"></span>
          <span class="color-dot blue"></span>
        </div>
      </div>

      <!-- Descripción -->
      <p class="descripcion-title">Descripción</p>
      <p class="descripcion">{{ producto.descripcion }}</p>
    </div>

    <!-- Footer con botón agregar -->
    <div class="detalle-footer">
      <div
        v-if="cantidadEnCarrito[producto.articuloId] > 0"
        class="contador-carrito"
      >
        <button class="btn-carrito btn-mas" @click="aumentarCantidad(producto)">
          <FontAwesomeIcon :icon="['fas', 'plus']" />
        </button>

        <span class="cantidad">{{
          cantidadEnCarrito[producto.articuloId]
        }}</span>

        <button
          :class="{
            'btn-carrito': true,
            'btn-basura': cantidadEnCarrito[producto.articuloId] === 1,
            'btn-menos': cantidadEnCarrito[producto.articuloId] > 1,
          }"
          @click="disminuirCantidad(producto)"
        >
          <FontAwesomeIcon
            :icon="
              cantidadEnCarrito[producto.articuloId] === 1
                ? ['fas', 'trash-can']
                : ['fas', 'minus']
            "
          />
        </button>
      </div>

      <button v-else class="btn-agregar" @click="aumentarCantidad(producto)">
        + Agregar al carrito
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import type { Producto } from "@/types/Producto";
import { db } from "@/db";
import ArrowBack from "@/components/ArrowBack.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";

const props = defineProps<{ producto: Producto }>();
defineEmits(["agregarCarrito"]);

const { toggleFavoritoLocal, favoritosIds } = useHorizontalCarousel();

// Favorito reactivo
const esFavorito = computed(() =>
  props.producto
    ? favoritosIds.value.includes(String(props.producto.articuloId))
    : false
);

// Función toggle favorito
const toggleFavorito = (producto: Producto) => {
  toggleFavoritoLocal(producto);
};

// Reactivo para la cantidad en carrito
const cantidadEnCarrito = reactive<Record<string, number>>({});

// Sincronizar con Dexie
const sincronizarCarrito = async () => {
  if (!props.producto) return;
  const items = await db.Carrito.toArray();
  for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  for (const item of items) cantidadEnCarrito[item.id_articulo] = item.cantidad;
};

// Ejecutar sincronización al montar
if (props.producto) sincronizarCarrito();

// Función para agregar / aumentar
const aumentarCantidad = async (producto: Producto) => {
  const item = await db.Carrito.where("id_articulo")
    .equals(producto.articuloId)
    .first();
  if (item) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad + 1 });
    cantidadEnCarrito[producto.articuloId] = item.cantidad + 1;
  } else {
    const newItem = {
      almacen: producto.almacen || "",
      anticipo: producto.anticipo || 0,
      cantidad: 1,
      categoria: producto.categoria || "",
      descuentoCupon: 0,
      estatus: "Preparacion",
      fechaEntrega: "",
      fecha_hora: new Date().toLocaleString(),
      id_articulo: producto.articuloId,
      id_pedido: "0_" + Math.random().toString(36).substr(2, 9),
      id_usuario: "0-OIOifXcje3Sy0G4Ki4Ki4y",
      metodo_pago: "Efectivo",
      nombre: producto.nombre,
      precio: producto.precio,
      url: producto.url,
    };
    await db.Carrito.add(newItem);
    cantidadEnCarrito[producto.articuloId] = 1;
  }
};

// Función para disminuir / eliminar
const disminuirCantidad = async (producto: Producto) => {
  const item = await db.Carrito.where("id_articulo")
    .equals(producto.articuloId)
    .first();
  if (!item) return;

  if (item.cantidad > 1) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad - 1 });
    cantidadEnCarrito[producto.articuloId] = item.cantidad - 1;
  } else {
    await db.Carrito.delete(item.id!);
    cantidadEnCarrito[producto.articuloId] = 0;
  }
};
</script>

<style scoped>
.detalle-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fff;
}

.detalle-header {
  position: relative;
}

.detalle-img {
  width: 100%;
  height: 50vh;
  object-fit: cover;
  border-bottom-left-radius: 60px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn-icon {
  position: absolute;
  top: 1rem;
  background: white;
  border: none;
  border-radius: 50%;
  padding: 0.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
.btn-icon.back {
  border-radius: 30%;
  width: 40px;
  height: 40px;
  left: 1rem;
  top: 1rem;
  width: 40px; /* tamaño del botón */
  height: 40px;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-icon.back svg {
  width: 50%; /* escala el SVG respecto al botón */
  height: 50%;
}

.btn-icon.cart {
  right: 1rem;
}

.btn-fav {
  position: absolute;
  top: calc(50vh - 30px); /* ajusta si lo quieres más arriba/abajo */
  right: 1rem;
  width: 50px; /* tamaño fijo */
  height: 50px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.btn-fav.active {
  color: red;
}

.btn-fav:hover {
  transform: scale(1.1);
}
.icono-corazon {
  font-size: 60px;
}
.detalle-info {
  flex: 1;
  padding: 1.5rem;
}
.precio-ranking {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.precio {
  font-size: 24px;
  font-weight: bold;
  color: #e74c3c;
  margin: 0;
  font-family: "Poppins", sans-serif;
}
.titulo {
  font-size: 18px;
  font-weight: 600;
  margin: 0.2rem 0;
  text-align: left;
}

.rating {
  display: flex;
  align-items: center;
  gap: 2px;
}
.star {
  color: #ddd;
  font-size: 16px;
}
.star.filled {
  color: #f1c40f;
}
.rating-value {
  font-size: 14px;
  color: #555;
  margin-left: 4px;
}

.color-section {
  margin-top: 1rem;
}
.color-label {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 0.5rem;
  text-align: left;
}
.color-options {
  display: flex;
  gap: 10px;
}
.color-dot {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 2px solid #ddd;
  cursor: pointer;
}
.color-dot.black {
  background: #000;
}
.color-dot.red {
  background: #e74c3c;
}
.color-dot.blue {
  background: #3498db;
}

.descripcion-title {
  font-size: 14px;
  font-weight: bold;
  margin-top: 1rem;
  margin-bottom: 0.3rem;
  text-align: left;
}
.descripcion {
  margin: 0;
  color: #555;
  line-height: 1.5;
  text-align: left;
}

.detalle-footer {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 50%;
  display: flex;
  justify-content: flex-end;
  padding: 0;
  background: transparent;
  gap: 0.5rem; /* espacio entre botones si quieres */
}

/* Botón Add to Cart con esquinas específicas redondeadas */
.btn-agregar {
  width: 100%;
  height: 50px;
  background: var(--color-bg-blue-dark);
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
  padding: 1rem;
  border: none;
  cursor: pointer;
  border-top-left-radius: 60px; /* esquina sup izq */
  border-bottom-right-radius: 20px; /* esquina inf der */
  border-top-right-radius: 0;
  border-bottom-left-radius: 0;
}

.contador-carrito {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%; /* ocupar toda la mitad del footer */
  height: 50px; /* misma altura que btn-agregar */
  background: var(--color-bg-blue-dark);
  border-radius: 25px; /* redondeado similar al botón */
  padding: 0 10px;
}

.contador-carrito .btn-carrito {
  width: 40px; /* tamaño similar al botón circular */
  height: 40px;
  border-radius: 50%;
  background: white;
  color: black;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}

.contador-carrito .btn-basura {
  background: red;
  color: white;
}

.contador-carrito .cantidad {
  font-size: 18px;
  font-weight: bold;
  color: white;
  min-width: 40px;
  text-align: center;
}

.btn-carrito.btn-mas {
  background-color: green;
  color: white;
}

.btn-carrito.btn-menos {
  background-color: var(--color-bg-blue-ligth);
  color: white;
}
</style>
