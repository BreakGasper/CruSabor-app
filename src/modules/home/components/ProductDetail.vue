<template>
  <div class="detalle-container" v-if="producto">
    <!-- Imagen superior -->
    <div class="detalle-header">
      <div class="detalle-img-container">
        <img
          loading="lazy"
          :src="FIREBASE_STORAGE_BASE_URL + producto.url"
          :alt="producto.nombre"
          class="detalle-img"
        />
      </div>

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
        <!-- <p class="precio">${{ Number(producto.precio).toFixed(2) }}</p> -->
        <p class="precio">${{ Number(precioActual).toFixed(2) }}</p>
        <div class="rating">
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star">☆</span>
          <span class="rating-value">4.5</span>
        </div>
      </div>

      <div class="tienda-header">
        <h1 class="titulo_header">{{ producto.tiendaNombre }}</h1>
        <img
          v-if="tiendaUrl"
          :src="tiendaUrl"
          alt="Logo tienda"
          class="logo-tienda"
        />
      </div>

      <h1 class="titulo">{{ producto.nombre }}</h1>

      <!-- Opciones de color -->
      <div class="color-section">
        <p class="color-label">Color option</p>
        <div class="color-options">
          <span
            v-for="(variante, index) in coloresVariantes"
            :key="index"
            class="color-dot"
            :style="{
              backgroundColor: variante.colorCodigo,
              border:
                varianteSeleccionada?.sku === variante.sku
                  ? '3px solid #1f70b2'
                  : '2px solid #ddd',
            }"
            @click="seleccionarColor(variante)"
          >
          </span>
        </div>
      </div>

      <!-- Categoria -->
      <p class="descripcion-title">Categoría</p>
      <p class="descripcion">{{ producto.categoria }}</p>

      <!-- Tamaño -->
      <p class="descripcion-title">Tamaño</p>
      <p class="descripcion">
        {{
          varianteSeleccionada?.tamano === "Otro"
            ? varianteSeleccionada?.tamanoOtro || "Tamaño personalizado"
            : varianteSeleccionada?.tamano
        }}
      </p>
      <!-- Descripción -->
      <p class="descripcion-title">Descripción</p>
      <p class="descripcion">{{ producto.descripcion }}</p>
    </div>

    <!-- Footer con botón agregar -->
    <div class="detalle-footer">
      <div v-if="sessionUsuarioValidation()">
        <div
          v-if="cantidadEnCarrito[producto.articuloId] > 0"
          class="contador-carrito"
        >
          <button
            class="btn-carrito btn-mas"
            @click="aumentarCantidad(producto)"
          >
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
      <button
        v-else
        class="btn-agregar"
        @click.prevent="$router.push('/login')"
      >
        Iniciar Sesión
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, reactive, onMounted } from "vue";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import type { Producto } from "@/types/Producto";
import { db } from "@/db";
import ArrowBack from "@/components/ArrowBack.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { sessionPedidoId, generarNuevoPedidoId } from "@/utils/sessionPedido";
import { sessionUsuarioValidation, sessionUser } from "@/utils/sessionUser";
import { useRouter } from "vue-router";

import { useTiendas } from "@/composables/useTiendas";

const props = defineProps<{ producto: Producto }>();
defineEmits(["agregarCarrito"]);

const { toggleFavoritoLocal, favoritosIds } = useHorizontalCarousel();

const router = useRouter();
const tiendaUrl = ref("");

// Favorito reactivo
const esFavorito = computed(() =>
  props.producto
    ? favoritosIds.value.includes(String(props.producto.articuloId))
    : false,
);

// Función toggle favorito
const toggleFavorito = (producto: Producto) => {
  if (sessionUsuarioValidation()) {
    toggleFavoritoLocal(producto, sessionUser.value.id);
  } else {
    router.push("/login");
  }
};

// Reactivo para la cantidad en carrito
const cantidadEnCarrito = reactive<Record<string, number>>({});

// Sincronizar con Dexie
const sincronizarCarrito = async () => {
  if (!props.producto || !sessionUser.value?.id) return;
  const items = await db.Carrito.where("id_usuario")
    .equals(sessionUser.value.id)
    .toArray();

  for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  for (const item of items) cantidadEnCarrito[item.id_articulo] = item.cantidad;
};

// variante seleccionada
const varianteSeleccionada = ref(props.producto?.variantes?.[0] || null);

// precio dinámico
const precioActual = computed(() => {
  return varianteSeleccionada.value?.precio || props.producto.precio;
});

// colores desde variantes
const coloresVariantes = computed(() => {
  return props.producto?.variantes || [];
});

const { obtenerTienda } = useTiendas();
// seleccionar variante
function seleccionarColor(variante: any) {
  varianteSeleccionada.value = variante;
}

// Ejecutar sincronización al montar
if (props.producto) sincronizarCarrito();

// Función para agregar / aumentar
const aumentarCantidad = async (producto: Producto) => {
  if (!sessionPedidoId.value) {
    generarNuevoPedidoId(sessionUser.value.id);
  }

  const item = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([producto.articuloId, sessionUser.value.id])
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
      id_pedido: sessionPedidoId.value!,
      id_usuario: sessionUser.value.id,
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
  const item = await db.Carrito.where("[id_articulo+id_usuario]")
    // .equals(producto.articuloId)
    .equals([producto.articuloId, sessionUser.value.id])
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

watch(
  () => sessionUser.value?.id,
  async (newUserId) => {
    for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
    if (props.producto) await sincronizarCarrito();
  },
);
//console.log("Producto recibido en detalle:", props.producto);

onMounted(async () => {
  if (props.producto?.tiendaId) {
    const ot = await obtenerTienda(props.producto.tiendaId);
    tiendaUrl.value = ot?.logoUrl || "";
    console.log("Tienda obtenida en detalle:", tiendaUrl.value);
  }
});
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

.detalle-img-container {
  width: 100%;
  height: 50vh; /* mantiene la altura que quieres */
  overflow: hidden; /* corta solo fuera del contenedor */
  border-bottom-left-radius: 60px; /* mantiene tu esquina redondeada */
  position: relative;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.detalle-img {
  width: 100%;
  height: 100%;
  object-fit: contain; /* muestra toda la imagen completa */
  object-position: top; /* centra la parte superior */
  display: block;
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
  color: var(--color-bg-blue-ligth);
  margin: 0;
  font-family: "Poppins", sans-serif;
}
.tienda-header {
  display: flex;
  align-items: center; /* centra verticalmente nombre y logo */
  justify-content: flex-end; /* todo alineado a la derecha */
  gap: 10px; /* espacio entre nombre y logo */
}

.logo-tienda {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 50%; /* hace el logo circular */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); /* opcional: sombra */
}

.titulo_header {
  font-size: 14px;
  font-weight: 500;
  color: teal;
  text-align: right;
  color: #ff4da6;
  font-weight: bold;
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

.detalle-modal-container {
  display: flex;
  flex-direction: column;
  height: 100%; /* importante para ocupar todo el modal */
  overflow-y: auto; /* scroll interno si el contenido es grande */
}
</style>
