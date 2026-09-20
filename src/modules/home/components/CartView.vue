<template>
  <div class="cart-container">
    <!-- Header -->
    <div class="cart-header">
      <PageHeader title="Mi Carrito" fallback="/" />
    </div>

    <!-- Lista de productos scrollable -->
    <div class="cart-items">
      <div
        v-if="acomodandoCarrito"
        style="text-align: center; color: var(--text-muted); margin-top: 2rem"
      >
        Cargando tu carrito…
      </div>
      <div
        v-else-if="carritoItems.length === 0"
        style="text-align: center; color: var(--text-muted); margin-top: 2rem"
      >
        Aún no has agregado productos al carrito
      </div>
      <!-- Un bloque por tienda: así el cliente sabe qué le compra a quién -->
      <div v-else class="grupos">
      <section
        v-for="grupo in gruposPorTienda"
        :key="grupo.tiendaId"
        class="grupo-tienda"
        :class="{ cerrada: grupo.cerrada }"
      >
        <header class="grupo-header">
          <button
            class="grupo-tienda-nombre"
            type="button"
            :disabled="!grupo.tiendaId"
            :title="grupo.tiendaId ? 'Ver tienda' : ''"
            @click="verTienda(grupo.tiendaId)"
          >
            🏪 {{ grupo.nombre }}
          </button>
          <span class="grupo-resumen">
            {{ grupo.cantidad }} {{ grupo.cantidad === 1 ? "artículo" : "artículos" }} · ${{ grupo.subtotal.toFixed(2) }}
          </span>
          <span v-if="grupo.cerrada" class="grupo-estado cerrada">🕒 {{ grupo.aviso }}</span>
          <span v-else-if="grupo.abierta" class="grupo-estado abierta">Abierta</span>
        </header>

        <div
          v-for="item in grupo.items"
          :key="item.id_articulo + '-' + (item.sku || '')"
          class="cart-item"
          :class="{ 'tienda-cerrada': grupo.cerrada }"
        >
          <img
            loading="lazy"
            :src="imagenUrl(item.url) || defaultImg"
            @error="onImgError"
            :alt="item.nombre"
            @click="verDetalle(item)"
          />
          <div class="info">
            <p class="nombre">{{ item.nombre }}</p>

            <p class="precio">${{ item.precio.toFixed(2) }}</p>
            <p class="detalle">{{ item.detalle }}</p>
            <p v-if="item.porPedido" class="bajo-pedido">🛠️ Bajo pedido</p>
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
      </section>
      </div>
    </div>

    <!-- Footer fijo con totales y checkout -->
    <div class="cart-summary">
      <p v-if="itemsCerrados.length" class="nota-cerradas">
        {{ itemsCerrados.length === 1 ? "1 artículo es" : itemsCerrados.length + " artículos son" }}
        de tiendas cerradas: se quedan en tu carrito y podrás comprarlos en su horario.
      </p>
      <div class="line">
        <span>Subtotal</span>
        <span>${{ subtotal.toFixed(2) }}</span>
      </div>

      <div class="line">
        <span>Envio</span>
        <span class="gratis">{{
          shippingFee > 0 ? "$" + shippingFee.toFixed(2) : "GRATIS"
        }}</span>
      </div>

      <div class="divider"></div>

      <div class="line total">
        <span>Total</span>
        <span>${{ (subtotal + shippingFee).toFixed(2) }}</span>
      </div>
      <button
        class="checkout-btn"
        :disabled="itemsDisponibles.length === 0"
        @click="ContinuarCompra"
      >
        {{
          itemsDisponibles.length === 0 && carritoItems.length > 0
            ? "Tiendas cerradas"
            : itemsCerrados.length
              ? `Comprar ${itemsDisponibles.length} disponible${itemsDisponibles.length === 1 ? "" : "s"}`
              : "Continuar Compra"
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted } from "vue";
import { useHorarioTiendas } from "@/composables/useHorarioTienda";
import { useEstadoTiendas } from "@/composables/useMembresia";
import { db } from "@/db";
import { liveQuery, type Subscription } from "dexie";
import { sincronizando } from "@/db/sync";
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from "@/constants/firebase_util";
import defaultImg from "@/assets/icons/default_articulo.png";
import { FontAwesomeIcon } from "@/plugins/fontawesome";
import PageHeader from "@/components/PageHeader.vue";
import { sessionUser, sessionUsuarioValidation } from "@/utils/sessionUser";
import { idCarritoActual } from "@/db/carritoInvitado";
import { watch } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const carritoItems = reactive<any[]>([]);

const verDetalle = (producto: any) => {
  router.push(`/producto/${producto.id_articulo}`);
};

/**
 * La lista sigue a la tabla en vivo (Dexie liveQuery), no un vistazo suelto.
 *
 * Al iniciar sesión, el dueño del carrito cambia al instante pero la adopción de
 * lo del invitado tarda (va y viene a Firebase). Con una lectura única la
 * pantalla se quedaba vacía hasta salir y volver a entrar; suscrita, se llena
 * sola en cuanto la adopción escribe.
 */
let subCarrito: Subscription | null = null;

function suscribirCarrito(idDueno: string) {
  subCarrito?.unsubscribe();
  subCarrito = liveQuery(() =>
    db.Carrito.where("id_usuario").equals(idDueno).toArray(),
  ).subscribe({
    next: (items) => carritoItems.splice(0, carritoItems.length, ...items),
    error: (e) => console.error("CartView liveQuery:", e),
  });
}

// Sin sesión se muestra el carrito del invitado: se llena antes de entrar
watch(() => idCarritoActual(), suscribirCarrito, { immediate: true });
onUnmounted(() => subCarrito?.unsubscribe());

/** Mientras se acomoda el carrito del recién llegado no se anuncia que está vacío */
const acomodandoCarrito = computed(
  () => sincronizando.value && carritoItems.length === 0,
);

const aumentarCantidad = async (item: any) => {
  const dbItem = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([item.id_articulo, idCarritoActual()])
    .first();

  if (dbItem) {
    await db.Carrito.update(dbItem.id!, { cantidad: dbItem.cantidad + 1 });
    item.cantidad += 1;
  }
};

const disminuirCantidad = async (item: any) => {
  const dbItem = await db.Carrito.where("[id_articulo+id_usuario]")
    .equals([item.id_articulo, idCarritoActual()])
    .first();

  if (!dbItem) return;

  if (dbItem.cantidad > 1) {
    await db.Carrito.update(dbItem.id!, { cantidad: dbItem.cantidad - 1 });
    item.cantidad -= 1;
  } else {
    await db.Carrito.delete(dbItem.id!);
    const index = carritoItems.findIndex((i) => i.id === item.id);
    if (index !== -1) carritoItems.splice(index, 1);
  }
};

/* ---------- Horario de las tiendas ----------
 * Los artículos de una tienda cerrada se quedan en el carrito pero no se compran:
 * no cuentan para el total y no viajan al checkout. El reloj avanza cada minuto
 * para que la tienda "abra" sola mientras la pantalla está visible. */
const { estaCerrada, estaAbierta, aperturaDe } = useHorarioTiendas();
const ahora = ref(new Date());
let reloj: ReturnType<typeof setInterval> | undefined;
onMounted(() => { reloj = setInterval(() => (ahora.value = new Date()), 60_000); });
onUnmounted(() => clearInterval(reloj));

const tiendaCerrada = (item: any) => estaCerrada(item.id_tienda, ahora.value);
const avisoCerrada = (item: any) => {
  const abre = aperturaDe(item.id_tienda, ahora.value);
  return abre ? `Tienda cerrada · ${abre}` : "Tienda cerrada";
};

const itemsDisponibles = computed(() => carritoItems.filter((i) => !tiendaCerrada(i)));
const itemsCerrados = computed(() => carritoItems.filter((i) => tiendaCerrada(i)));

/* ---------- Agrupación por tienda ----------
 * El nombre guardado en el artículo del carrito (nombre_tienda) es una copia de cuando se
 * agregó; si la tienda cambió de nombre se muestra el actual, que llega en vivo desde `tiendas`. */
const { nombreDe } = useEstadoTiendas();

interface GrupoTienda {
  tiendaId: string;
  nombre: string;
  items: any[];
  cantidad: number;
  subtotal: number;
  abierta: boolean | undefined;
  cerrada: boolean;
  aviso: string;
}

/** Artículos agrupados por tienda, en el orden en que aparecen en el carrito */
const gruposPorTienda = computed<GrupoTienda[]>(() => {
  const grupos = new Map<string, GrupoTienda>();
  for (const item of carritoItems) {
    const id = String(item.id_tienda || "");
    if (!grupos.has(id)) {
      grupos.set(id, {
        tiendaId: id,
        nombre: nombreDe(id) || item.nombre_tienda || (id ? "Tienda" : "Sin tienda"),
        items: [],
        cantidad: 0,
        subtotal: 0,
        abierta: estaAbierta(id, ahora.value),
        cerrada: estaCerrada(id, ahora.value),
        aviso: avisoCerrada(item),
      });
    }
    const g = grupos.get(id)!;
    g.items.push(item);
    g.cantidad += item.cantidad;
    g.subtotal += item.precio * item.cantidad;
  }
  return [...grupos.values()];
});

const verTienda = (tiendaId: string) => {
  if (tiendaId) router.push(`/store/profile/${tiendaId}`);
};

const subtotal = computed(() =>
  itemsDisponibles.value.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
);
const shippingFee = computed(() => (subtotal.value < 200 ? 15.0 : 0.0));

const totalArticulos = computed(() =>
  itemsDisponibles.value.reduce((sum, item) => sum + item.cantidad, 0),
);
const ContinuarCompra = () => {
  // Un pedido pertenece a un cliente: aquí sí hace falta entrar. Al hacerlo, el
  // carrito del invitado se adopta solo y estos mismos artículos siguen ahí.
  if (!sessionUsuarioValidation()) {
    router.push({ path: "/login", query: { redirect: "/cart" } });
    return;
  }
  router.push({
    path: "/checkout",
    state: {
      subtotal: subtotal.value,
      envio: shippingFee.value,
      total: subtotal.value + shippingFee.value,
      totalArticulos: totalArticulos.value,
      // history.pushState no puede clonar un Proxy reactivo (DataCloneError) y
      // Vue Router recurre a una recarga completa: pasamos una copia plana.
      // Solo viajan los artículos de tiendas abiertas.
      carritoItems: JSON.parse(JSON.stringify(itemsDisponibles.value)),
    },
  });
};

/** Si la imagen no carga, se muestra la imagen por defecto */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
}
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
  background: var(--surface-2);
}

.cart-header {
  padding: 0 1rem;
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

/* Bloque por tienda */
.grupos {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.grupo-tienda {
  background: var(--surface-2);
  border-radius: 28px;
  padding: 6px 4px 8px;
}
.grupo-tienda.cerrada {
  background: #fff7ed;
}
.grupo-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 6px 14px 4px;
}
.grupo-tienda-nombre {
  border: 0;
  background: none;
  padding: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.grupo-tienda-nombre:disabled {
  cursor: default;
}
.grupo-resumen {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.grupo-estado {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.grupo-estado.abierta {
  background: #e8f5e9;
  color: #2e7d32;
}
.grupo-estado.cerrada {
  background: #fdecea;
  color: #b45309;
}
.bajo-pedido {
  margin: 2px 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #3730a3;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 8px;
  background: var(--surface);
  padding: 0.8rem;
  border-radius: 25px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  overflow: hidden; /* evita que algo se salga */
  flex-wrap: nowrap;
}

.cart-item img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 20px;
  flex-shrink: 0; /* no se encoge la imagen */
}

.info {
  flex: 1 1 auto; /* puede crecer y encogerse */
  min-width: 0; /* necesario para que el texto se recorte */
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nombre {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap; /* evita salto de línea */
  overflow: hidden; /* recorta exceso de texto */
  text-overflow: ellipsis; /* agrega "..." si se corta */
}
.detalle {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.precio {
  color: var(--brand-blue-text);
  font-weight: bold;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contador-carrito {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto; /* ocupar solo lo necesario */
  min-width: 90px; /* ancho mínimo del contador */
  max-width: 120px; /* ancho máximo para mantener proporción */
  height: 40px;
  border-radius: 25px;
  flex-shrink: 0; /* evita que se reduzca demasiado */
  background: var(--surface-2);
  padding: 0 4px;
  box-sizing: border-box;
}

.btn-carrito {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  flex-shrink: 0; /* evita que los botones se encojan */
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
  color: var(--text);
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.cart-summary {
  background: var(--surface);
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
.cart-item.tienda-cerrada img,
.cart-item.tienda-cerrada .nombre,
.cart-item.tienda-cerrada .precio {
  opacity: 0.55;
}

.aviso-cerrada {
  margin: 4px 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #b45309;
}

.nota-cerradas {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 0.8rem;
  line-height: 1.35;
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
  background: var(--surface);
  color: var(--text);
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
.gratis {
  color: #27ae60; /* verde opcional para resaltar "Gratis" */
  font-weight: normal;
}

/* ===== Responsive ===== */
.cart-header,
.cart-items,
.cart-summary {
  width: 100%;
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
}
@media (min-width: 768px) {
  .cart-container {
    padding: 0 1rem;
  }
  .cart-summary {
    border-radius: 30px 30px 0 0;
  }
  .cart-item img {
    width: 96px;
    height: 96px;
  }
  .nombre,
  .precio {
    font-size: 15px;
  }
}
@media (max-width: 480px) {
  .cart-item {
    margin: 0;
    gap: 0.6rem;
    padding: 0.6rem;
  }
  .cart-item img {
    width: 64px;
    height: 64px;
  }
  .contador-carrito {
    min-width: 84px;
  }
}
</style>
