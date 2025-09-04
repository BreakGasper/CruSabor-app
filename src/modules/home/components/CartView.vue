<template>
  <div class="cart-container">
    <!-- Header -->
    <div class="cart-header">
      <!-- Botón volver con SVG -->
      <ArrowBack @click="$router.back()" />

      <h2 class="cart-title">Mi Carrito</h2>
    </div>

    <!-- Lista de productos scrollable -->
    <div class="cart-items">
      <div
        v-if="carritoItems.length === 0"
        style="text-align: center; color: grey; margin-top: 2rem"
      >
        Aún no has agregado productos al carrito
      </div>
      <div v-else>
        <div
          v-for="item in carritoItems"
          :key="item.id_articulo"
          class="cart-item"
        >
          <img :src="FIREBASE_STORAGE_BASE_URL + item.url" :alt="item.nombre" />
          <div class="info">
            <p class="nombre">{{ item.nombre }}</p>
            <p class="precio">${{ item.precio.toFixed(2) }}</p>
          </div>

          <!-- Botones de cantidad estilo detalle -->
          <div class="contador-carrito">
            <button class="btn-carrito btn-mas" @click="aumentarCantidad(item)">
              <FontAwesomeIcon :icon="['fas', 'plus']" />
            </button>

            <span class="cantidad">{{ item.cantidad }}</span>

            <button
              :class="{
                'btn-carrito': true,
                'btn-basura': item.cantidad === 1,
                'btn-menos': item.cantidad > 1,
              }"
              @click="disminuirCantidad(item)"
            >
              <FontAwesomeIcon
                :icon="
                  item.cantidad === 1 ? ['fas', 'trash-can'] : ['fas', 'minus']
                "
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer fijo con totales y checkout -->
    <div class="cart-summary">
      <div class="line">
        <span>Subtotal</span>
        <span>${{ subtotal.toFixed(2) }}</span>
      </div>

      <div class="line">
        <span>Envio</span>
        <span>${{ shippingFee.toFixed(2) }}</span>
      </div>

      <div class="divider"></div>

      <div class="line total">
        <span>Total</span>
        <span>${{ (subtotal + shippingFee).toFixed(2) }}</span>
      </div>
      <button
        class="checkout-btn"
        :disabled="carritoItems.length === 0"
        @click="console.log('Checkout')"
      >
        Continuar Compra
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { db } from "@/db";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { FontAwesomeIcon } from "@/plugins/fontawesome";
import ArrowBack from "@/components/ArrowBack.vue";

const carritoItems = reactive<any[]>([]);
const shippingFee = computed(() => (carritoItems.length > 0 ? 30.0 : 0.0));

const sincronizarCarrito = async () => {
  const items = await db.Carrito.toArray();
  carritoItems.splice(0, carritoItems.length, ...items);
};

onMounted(() => sincronizarCarrito());

const aumentarCantidad = async (item: any) => {
  await db.Carrito.update(item.id!, { cantidad: item.cantidad + 1 });
  item.cantidad += 1;
};

const disminuirCantidad = async (item: any) => {
  if (item.cantidad > 1) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad - 1 });
    item.cantidad -= 1;
  } else {
    await db.Carrito.delete(item.id!);
    const index = carritoItems.findIndex((i) => i.id === item.id);
    if (index !== -1) carritoItems.splice(index, 1);
  }
};

const subtotal = computed(() =>
  carritoItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
);
</script>

<style scoped>
.divider {
  height: 1px;
  background-color: gainsboro; /* gris claro */
  margin: 0.5rem 0;
}

.cart-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fb;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: center; /* centra el título */
  padding: 1rem;
  position: relative;
}

.cart-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
}

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  padding-top: 0rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  padding: 0.8rem;
  border-radius: 25px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.cart-item img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 20px;
}

.info {
  flex: 1;
}

.nombre {
  font-weight: 600;
  font-size: 16px;
}

.precio {
  color: #e74c3c;
  font-weight: bold;
}

.contador-carrito {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 120px;
  height: 40px;
  border-radius: 25px;
}

.btn-carrito {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}

.btn-carrito.btn-mas {
  background-color: green;
  color: white;
}

.btn-carrito.btn-menos {
  background-color: #3498db;
  color: white;
}

.btn-carrito.btn-basura {
  background-color: red;
  color: white;
}

.cantidad {
  font-weight: bold;
  color: black;
  width: 24px;
  text-align: center;
}

.cart-summary {
  background: white;
  padding: 1rem;
  border-radius: 30px 30px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.line {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
}

.total {
  font-weight: bold;
  font-size: 1.2rem;
}

.checkout-btn {
  margin-top: 0.5rem;
  background: var(--color-bg-blue-dark);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 25px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
}
.checkout-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.arrow-back {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  color: black;
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
</style>
