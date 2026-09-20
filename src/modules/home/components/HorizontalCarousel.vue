<template>
  <div class="carousel-container">
    <div class="encabezado">
      <h2 class="titulo">Explorar</h2>
      <button type="button" class="ver-todas" @click="verMas">Ver más productos ›</button>
    </div>

    <div class="carousel-wrapper">
      <button class="arrow left" @click="scrollLeft">&#10094;</button>

      <div class="carousel-scroll" ref="scrollArea">
        <div
          class="carousel-item"
          v-for="p in productos.slice(0, 10)"
          :key="p.articuloId"
        >
          <div class="img-container" @click="verDetalle(p)">
            <img
              loading="lazy"
              :src="FIREBASE_STORAGE_BASE_URL+imagenUrl(p.url) || defaultImg"
              @error="onImgError"
              :alt="p.nombre"
            />
            <div v-if="sessionUsuarioValidation()">
              <span
                class="heart-icon"
                :class="{ active: estaFavorito(p.articuloId) }"
                @click.stop="toggleFavoritoLocal(p, sessionUser.id)"
              >
                <FontAwesomeIcon
                  :icon="
                    estaFavorito(p.articuloId)
                      ? ['fas', 'heart']
                      : ['far', 'heart']
                  "
                />
              </span>
            </div>
          </div>

          <p class="nombre">{{ p.nombre }}</p>
          <p class="subtitulo">
            Categoría: {{ p.categoria || 'General' }}
          </p>

          <div class="precio-agregar">
            <span class="precio">${{ p.precio }}</span>

            <div class="acciones" v-if="sessionUsuarioValidation()">
              <div class="acciones" v-if="obtenerStock(p) !== 0">
                <!-- Si no está en el carrito, mostrar botón negro -->
                <button
                  v-if="
                    !(cantidadEnCarrito[p.articuloId] > 0) &&
                    obtenerStock(p) > 0
                  "
                  class="btn-agregar"
                  :class="{ 'sin-envio': sinEnvio(p.tiendaId) }"
                  :disabled="sinEnvio(p.tiendaId)"
                  :title="sinEnvio(p.tiendaId) ? 'Esta tienda no envía a domicilio' : 'Agregar al carrito'"
                  @click.stop="aumentarCantidad(p)"
                >
                  <FontAwesomeIcon :icon="['fas', sinEnvio(p.tiendaId) ? 'ban' : 'plus']" />
                </button>

                <!-- Si ya está en el carrito, mostrar contador con + / - -->
                <div v-else class="contador-carrito">
                  <button
                    v-if="obtenerStock(p) !== 0"
                    class="btn-carrito btn-mas"
                    :disabled="
                      obtenerStock(p) !== Infinity &&
                      cantidadEnCarrito[p.articuloId] >= obtenerStock(p)
                    "
                    @click.stop="aumentarCantidad(p)"
                  >
                    <FontAwesomeIcon
                      :icon="['fas', 'plus']"
                      fixed-width
                      size="sm"
                    />
                  </button>

                  <span class="cantidad">{{
                    cantidadEnCarrito[p.articuloId]
                  }}</span>

                  <button
                    :class="{
                      'btn-carrito': true,
                      'btn-basura': cantidadEnCarrito[p.articuloId] === 1,
                      'btn-menos': cantidadEnCarrito[p.articuloId] > 1,
                    }"
                    @click.stop="disminuirCantidad(p)"
                  >
                    <FontAwesomeIcon
                      :icon="
                        cantidadEnCarrito[p.articuloId] === 1
                          ? ['fas', 'trash-can']
                          : ['fas', 'minus']
                      "
                    />
                  </button>
                </div>
              </div>
              <div class="acciones" v-else>
                <span v-if="obtenerStock(p) === 0" class="agotado-label">
                  Agotado
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="carousel-item ver-mas" @click="verMas">
          <span>Ver más…</span>
        </div>
      </div>

      <button class="arrow right" @click="scrollRight">&#10095;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/modules/home/styles/HorizontalCarousel.css';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultImg from '@/assets/icons/default_articulo.png';
import { watch, reactive, onMounted } from 'vue';
import { useHorizontalCarousel } from '@/modules/home/scripts/useHorizontalCarousel';
import type { Producto } from '@/types/Producto';
import { db } from '@/db';
import { FontAwesomeIcon } from '@/plugins/fontawesome';
import { sessionUsuarioValidation } from '@/utils/sessionUser';
import { sessionUser } from '@/utils/sessionUser';
import { sessionPedidoId, generarNuevoPedidoId } from '@/utils/sessionPedido';
import { useEnvioTienda, MENSAJE_SIN_ENVIO } from '@/composables/useEnvioTienda';
import Swal from 'sweetalert2';

const props = defineProps<{ productos: Producto[] }>();

const {
  scrollArea,
  favoritosIds,
  scrollLeft,
  scrollRight,
  verDetalle,
  verMas,
  toggleFavoritoLocal,
  estaFavorito,
} = useHorizontalCarousel();

const cantidadEnCarrito = reactive<Record<string, number>>({});

const sincronizarCarrito = async () => {
  if (!sessionUser.value?.id) {
    for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
    return;
  }

  const items = await db.Carrito.where('id_usuario')
    .equals(sessionUser.value.id)
    .toArray();

  for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  for (const item of items) {
    cantidadEnCarrito[item.id_articulo] = item.cantidad;
  }
};

onMounted(() => sincronizarCarrito());

const obtenerStock = (producto: Producto) => {
  const variante = producto.variantes?.[0];

  if (!variante) return 0;

  if (variante.stock === -1) return Infinity; // ilimitado
  return variante.stock ?? 0;
};

const { sinEnvio } = useEnvioTienda();

const aumentarCantidad = async (producto: Producto) => {
  if (sinEnvio(producto.tiendaId)) {
    Swal.fire({ icon: 'info', title: 'Sin envío a domicilio', text: MENSAJE_SIN_ENVIO, confirmButtonColor: '#0165d8' });
    return;
  }
  if (!sessionPedidoId.value) {
    generarNuevoPedidoId(sessionUser.value.id);
  }

  const stock = obtenerStock(producto);
  const cantidadActual = cantidadEnCarrito[producto.articuloId] || 0;

  // 🚫 BLOQUEO POR STOCK
  if (stock !== Infinity && cantidadActual >= stock) {
    console.log('Stock máximo alcanzado');
    return;
  }

  const item = await db.Carrito.where('[id_articulo+id_usuario]')
    .equals([producto.articuloId, sessionUser.value?.id || ''])
    .first();

  if (item) {
    await db.Carrito.update(item.id!, { cantidad: item.cantidad + 1 });
    cantidadEnCarrito[producto.articuloId] = item.cantidad + 1;
  } else {
    const newItem = {
      almacen: producto.almacen || '',
      anticipo: producto.anticipo || 0,
      cantidad: 1,
      categoria: producto.categoria || '',
      descuentoCupon: 0,
      estatus: 'Preparacion',
      fechaEntrega: '',
      fecha_hora: new Date().toLocaleString(),
      id_articulo: producto.articuloId,
      id_pedido: sessionPedidoId.value!,
      id_usuario: sessionUser.value?.id || 'anon',
      metodo_pago: 'Efectivo',
      nombre: producto.nombre,
      precio: producto.precio,
      url: producto.url,
      sku: producto.variantes[0]?.sku || '',
      detalle: producto.variantes[0]?.detalle || '',
      id_tienda: producto.tiendaId || '',
      nombre_tienda: producto.tiendaNombre || '',
    };
    await db.Carrito.add(newItem);
    cantidadEnCarrito[producto.articuloId] = 1;
  }
};

const disminuirCantidad = async (producto: Producto) => {
  const item = await db.Carrito.where('[id_articulo+id_usuario]')
    .equals([producto.articuloId, sessionUser.value?.id || ''])
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
  () => sincronizarCarrito(),
);

/** Si la imagen no carga, se muestra la imagen por defecto */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
}
</script>

<style scoped>
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}
.encabezado .titulo {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  text-align: left;
}
.encabezado .ver-todas {
  border: 0;
  background: none;
  padding: 0;
  font-size: 0.85rem;
  color: var(--brand-blue-text);
  cursor: pointer;
  font-family: inherit;
}
</style>
