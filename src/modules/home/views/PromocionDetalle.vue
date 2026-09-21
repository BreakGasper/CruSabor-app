<template>
  <div class="promo-detalle">
    <PageHeader title="Promoción" fallback="/">
      <CartButton class="header-cart" />
    </PageHeader>

    <p v-if="cargando" class="estado">Cargando promoción...</p>

    <p v-else-if="!promo" class="estado">
      Esta promoción ya no está disponible.
      <button type="button" class="enlace" @click="router.push('/')">Volver al inicio</button>
    </p>

    <main v-else class="contenido">
      <!-- Banner de la promoción: caja fija, imagen completa -->
      <div class="banner">
        <img :src="bannerUrl" :alt="promo.titulo" @error="onImgError" />
        <span v-if="descuento > 0" class="descuento">-{{ descuento }}%</span>
      </div>

      <section class="cabecera">
        <h1 class="titulo">{{ promo.titulo }}</h1>

        <p v-if="promo.tiendaNombre" class="tienda">
          de
          <button type="button" class="enlace" @click="verTienda">{{ promo.tiendaNombre }}</button>
        </p>

        <div class="precios">
          <span class="precio">${{ promo.precioPromo.toFixed(2) }}</span>
          <span v-if="promo.precioOriginal > promo.precioPromo" class="antes">
            ${{ promo.precioOriginal.toFixed(2) }}
          </span>
          <span v-if="ahorro > 0" class="ahorro">Ahorras ${{ ahorro.toFixed(2) }}</span>
        </div>

        <p class="vigencia">
          Publicada el {{ fechaPublicacion(promo.creadaEn) }}
          <template v-if="vigente"> · termina el {{ fechaCorta(promo.venceEn) }}</template>
        </p>

        <p v-if="!vigente" class="aviso">
          Esta promoción ya terminó. El artículo se sigue vendiendo a su precio normal.
        </p>
      </section>

      <!-- El artículo al que se le aplicó la promoción -->
      <section class="articulo-bloque">
        <h2 class="subtitulo">Artículo en promoción</h2>

        <p v-if="!articulo" class="aviso">
          El artículo de esta promoción ya no está publicado.
        </p>

        <article v-else class="articulo" @click="verArticulo">
          <div class="foto">
            <img loading="lazy" :src="fotoArticulo" :alt="articulo.nombre" @error="onImgError" />
          </div>

          <div class="datos">
            <h3 class="nombre">{{ articulo.nombre }}</h3>
            <p class="meta">
              <span>{{ articulo.categoria || 'General' }}</span>
              <span v-if="articulo.tiendaNombre" class="de-tienda">· {{ articulo.tiendaNombre }}</span>
            </p>
            <StarRating size="sm" :promedio="resumen.promedio" :total="resumen.total" />
            <p v-if="articulo.descripcion" class="descripcion">{{ articulo.descripcion }}</p>
            <button type="button" class="enlace" @click.stop="verArticulo">Ver el artículo completo ›</button>
          </div>
        </article>
      </section>

      <!-- Se compra desde aquí, como cualquier artículo -->
      <section v-if="articulo" class="compra" @click.stop>
        <div v-if="etiquetaEstado" class="tag" :class="claseEstado">{{ etiquetaEstado }}</div>

        <button
          v-if="!(cantidadEnCarrito[articulo.articuloId] > 0)"
          class="btn-agregar"
          :disabled="noSePuedeComprar"
          @click="aumentar(articulo)"
        >
          <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
          {{ noSePuedeComprar ? 'No disponible' : 'Agregar al carrito' }}
        </button>

        <div v-else class="contador">
          <button
            class="btn-c menos"
            :class="{ basura: cantidadEnCarrito[articulo.articuloId] === 1 }"
            :title="cantidadEnCarrito[articulo.articuloId] > 1 ? 'Quitar uno' : 'Quitar del carrito'"
            @click="disminuir(articulo)"
          >
            <FontAwesomeIcon :icon="cantidadEnCarrito[articulo.articuloId] > 1 ? ['fas', 'minus'] : ['fas', 'trash-can']" />
          </button>
          <span class="cantidad">{{ cantidadEnCarrito[articulo.articuloId] }}</span>
          <button
            class="btn-c mas"
            :disabled="stockDe(articulo) !== Infinity && cantidadEnCarrito[articulo.articuloId] >= stockDe(articulo)"
            title="Agregar uno"
            @click="aumentar(articulo)"
          >
            <FontAwesomeIcon :icon="['fas', 'plus']" />
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * Detalle de una promoción (`/promocion/:id`).
 *
 * Es una pantalla aparte de la del artículo: aquí manda la promoción —su banner,
 * su título, lo que se ahorra y hasta cuándo dura— y el artículo va debajo, como
 * lo que se está vendiendo. Entrando por Destacados, lo que el cliente eligió fue
 * la promoción, no el artículo; el artículo completo queda a un toque.
 *
 * Se puede comprar desde aquí con el mismo carrito de las listas, así que el
 * precio que se guarda ya es el de la promoción (ver `useCarritoRapido`).
 */
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import PageHeader from '@/components/PageHeader.vue';
import CartButton from '@/components/CartButton.vue';
import StarRating from '@/components/StarRating.vue';
import { useArticulos } from '@/composables/useArticulos';
import { useCalificaciones } from '@/composables/useCalificaciones';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import {
  usePromociones,
  descuentoPorcentaje,
  fechaPublicacion,
  promocionVigente,
} from '@/composables/usePromociones';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultArticulo from '@/assets/icons/default_articulo.png';

const route = useRoute();
const router = useRouter();

const { articulos, loading } = useArticulos();
const { promociones } = usePromociones();
const { resumenDe } = useCalificaciones('articulos');
const { cantidadEnCarrito, aumentar, disminuir, stockDe, sinStock, sinEnvioTienda, esPorPedido, ventaPausada } =
  useCarritoRapido();

const promoId = computed(() => String(route.params.id || ''));
const promo = computed(() => promociones.value.find((p) => p.id === promoId.value) || null);
const articulo = computed(() =>
  promo.value ? articulos.value.find((a) => a.articuloId === promo.value!.articuloId) || null : null,
);

/** Mientras no haya llegado el nodo de promociones no se puede decir que no existe */
const cargando = ref(true);
watch(
  [promociones, loading],
  () => {
    if (promociones.value.length || !loading.value) cargando.value = false;
  },
  { immediate: true },
);

const vigente = computed(() => (promo.value ? promocionVigente(promo.value) : false));
const descuento = computed(() => (promo.value ? descuentoPorcentaje(promo.value) : 0));
const ahorro = computed(() =>
  promo.value ? Math.max(0, promo.value.precioOriginal - promo.value.precioPromo) : 0,
);

const conBase = (url: string) => (url.startsWith('http') ? url : FIREBASE_STORAGE_BASE_URL + imagenUrl(url));
const bannerUrl = computed(() => conBase(promo.value?.bannerUrl || articulo.value?.url || ''));
const fotoArticulo = computed(() => conBase(articulo.value?.url || ''));
const resumen = computed(() => resumenDe(promo.value?.articuloId || ''));

const noSePuedeComprar = computed(
  () =>
    !articulo.value ||
    sinStock(articulo.value) ||
    sinEnvioTienda(articulo.value) ||
    ventaPausada(articulo.value),
);

const etiquetaEstado = computed(() => {
  if (!articulo.value) return '';
  if (ventaPausada(articulo.value)) return 'Venta pausada';
  if (esPorPedido(articulo.value)) return 'Bajo pedido';
  if (sinStock(articulo.value)) return 'Agotado';
  if (sinEnvioTienda(articulo.value)) return 'Sin envío';
  return '';
});
const claseEstado = computed(() =>
  etiquetaEstado.value === 'Bajo pedido' ? 'por-pedido' : etiquetaEstado.value === 'Sin envío' ? 'sin-envio' : 'agotado',
);

const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(d)
    : '';
};

function verArticulo() {
  if (articulo.value) router.push(`/producto/${articulo.value.articuloId}`);
}
function verTienda() {
  if (promo.value?.tiendaId) router.push(`/store/profile/${promo.value.tiendaId}`);
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultArticulo;
}
</script>

<style scoped>
.promo-detalle {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 2rem;
}
.contenido {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.estado {
  max-width: 760px;
  margin: 2rem auto;
  padding: 0 1rem;
  text-align: center;
  color: var(--text-muted);
}

/* Banner: misma regla que en Destacados, caja fija y la imagen entera */
.banner {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  margin-top: 0.75rem;
}
.banner img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.descuento {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #c0392b;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 999px;
}

.cabecera {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.titulo {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.25;
}
.tienda,
.vigencia {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.precios {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 0.2rem 0;
}
/* Lo que se paga en verde, el precio de antes tachado en rojo */
.precio {
  font-size: 1.6rem;
  font-weight: 800;
  color: #2e7d4f;
}
.antes {
  font-size: 1rem;
  color: #c0392b;
  text-decoration: line-through;
}
.ahorro {
  font-size: 0.75rem;
  font-weight: 700;
  color: #2e7d4f;
  background: #e6f4ec;
  padding: 3px 10px;
  border-radius: 999px;
}
.aviso {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  background: #fff4e5;
  color: #8a5a00;
  border-radius: 10px;
  padding: 8px 10px;
}

.articulo-bloque {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.subtitulo {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}
.articulo {
  display: flex;
  gap: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.85rem;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}
.articulo:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.foto {
  flex: 0 0 110px;
  width: 110px;
  height: 110px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-2);
}
.foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.datos {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nombre {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
}
.meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.meta .de-tienda {
  opacity: 0.85;
}
.descripcion {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.enlace {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--brand-blue-text);
  cursor: pointer;
}

/* Compra */
.compra {
  position: sticky;
  bottom: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.tag {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
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
.btn-agregar {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.75rem;
  border: none;
  border-radius: 12px;
  background: var(--color-bg-blue-dark);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-agregar:hover {
  background: var(--color-bg-blue-ligth);
}
.btn-agregar:disabled {
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: not-allowed;
}
.contador {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 4px;
}
.btn-c {
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
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
  min-width: 28px;
  text-align: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--text);
}

@media (max-width: 480px) {
  .foto {
    flex-basis: 88px;
    width: 88px;
    height: 88px;
  }
  .titulo {
    font-size: 1.2rem;
  }
  .precio {
    font-size: 1.4rem;
  }
}
</style>
