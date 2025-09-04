<template>
  <div class="carousel-container">
    <h2 class="carousel-title">Explorar</h2>

    <div class="carousel-wrapper">
      <button class="arrow left" @click="scrollLeft">&#10094;</button>

      <div class="carousel-scroll" ref="scrollArea">
        <div
          class="carousel-item"
          v-for="p in productos.slice(0, 10)"
          :key="p.articuloId"
        >
          <div class="img-container" @click="verDetalle(p)">
            <img :src="FIREBASE_STORAGE_BASE_URL + p.url" :alt="p.nombre" />
            <span
              class="heart-icon"
              :class="{ active: estaFavorito(p.articuloId) }"
              @click.stop="toggleFavoritoLocal(p)"
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

          <p class="nombre">{{ p.nombre }}</p>
          <p class="subtitulo">
            Subcategoría: {{ p.subcategoria || "General" }}
          </p>

          <div class="precio-agregar">
            <span class="precio">${{ p.precio }}</span>

            <div class="acciones">
              <!-- Si no está en el carrito, mostrar botón negro -->
              <button
                v-if="!(cantidadEnCarrito[p.articuloId] > 0)"
                class="btn-agregar"
                @click.stop="aumentarCantidad(p)"
              >
                <FontAwesomeIcon :icon="['fas', 'plus']" />
              </button>

              <!-- Si ya está en el carrito, mostrar contador con + / - -->
              <div v-else class="contador-carrito">
                <button
                  class="btn-carrito btn-mas"
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
import "@/modules/home/styles/HorizontalCarousel.css";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import { ref, reactive, onMounted } from "vue";
import { useHorizontalCarousel } from "@/modules/home/scripts/useHorizontalCarousel";
import type { Producto } from "@/types/Producto";
import { db } from "@/db";
import { FontAwesomeIcon } from "@/plugins/fontawesome";

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
  const items = await db.Carrito.toArray();
  for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  for (const item of items) cantidadEnCarrito[item.id_articulo] = item.cantidad;
};

onMounted(() => sincronizarCarrito());

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
      id_usuario: "0-OIOifXcje3Sy0G4Ki4y",
      metodo_pago: "Efectivo",
      nombre: producto.nombre,
      precio: producto.precio,
      url: producto.url,
    };
    await db.Carrito.add(newItem);
    cantidadEnCarrito[producto.articuloId] = 1;
  }
};

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
