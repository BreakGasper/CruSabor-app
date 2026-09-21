<template>
  <section v-if="tarjetas.length" class="destacados-promos">
    <div class="encabezado">
      <h2 class="titulo">Destacados</h2>
      <span class="cuenta">{{ tarjetas.length }} {{ tarjetas.length === 1 ? 'promoción' : 'promociones' }}</span>
    </div>

    <!-- Dos filas que se recorren de lado, como las tiendas de arriba -->
    <div class="pista">
      <article
        v-for="t in tarjetas"
        :key="t.promo.id"
        class="promo-card"
        @click="verPromocion(t.promo.id)"
      >
        <div class="banner">
          <img loading="lazy" :src="t.banner" :alt="t.promo.titulo" @error="onImgError" />
          <span v-if="t.descuento > 0" class="descuento">-{{ t.descuento }}%</span>
        </div>

        <div class="datos">
          <h3 class="nombre" :title="t.promo.titulo">{{ t.promo.titulo }}</h3>

          <StarRating size="sm" :promedio="t.resumen.promedio" :total="t.resumen.total" />

          <div class="precios">
            <span class="precio">${{ t.promo.precioPromo.toFixed(2) }}</span>
            <span v-if="t.promo.precioOriginal > t.promo.precioPromo" class="antes">
              ${{ t.promo.precioOriginal.toFixed(2) }}
            </span>
          </div>

          <p class="publicada">{{ fechaPublicacion(t.promo.creadaEn) }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * "Destacados" de la portada: las promociones vigentes de las tiendas.
 *
 * Va entre las tiendas y la lista de productos, en dos filas que se recorren de
 * lado. Cada tarjeta lleva el banner arriba y, abajo, el título, las estrellas
 * del artículo, el precio de promoción y cuándo se publicó.
 *
 * Orden: **las más recientes primero** y, entre las publicadas el mismo día, las
 * mejor calificadas. Así una promo nueva se ve aunque todavía no tenga votos, y
 * entre las del día manda la calificación.
 *
 * Solo salen las vigentes (ni pausadas ni caducadas) cuyo artículo siga
 * publicado: `useArticulos` ya deja fuera los dados de baja y las tiendas que no
 * pueden vender, así que una tienda bloqueada desaparece de aquí sola.
 *
 * Al tocar una tarjeta se abre `/promocion/:id`, no el artículo: ahí manda el
 * banner de la promoción y el artículo va debajo, como lo que se vende.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import StarRating from '@/components/StarRating.vue';
import { useArticulos } from '@/composables/useArticulos';
import { useCalificaciones } from '@/composables/useCalificaciones';
import { useConfiguracion } from '@/composables/useConfiguracion';
import { usePromociones, descuentoPorcentaje, fechaPublicacion } from '@/composables/usePromociones';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultArticulo from '@/assets/icons/default_articulo.png';

/** Cuántas caben antes de que recorrer la pista se vuelva cansado */
const MAXIMO = 12;

const router = useRouter();
const { articulos } = useArticulos();
const { vigentes } = usePromociones();
const { resumenDe } = useCalificaciones('articulos');
const { promocionesHabilitadas } = useConfiguracion();

/** Un mismo día: para ordenar por calificación solo dentro del día */
const diaDe = (iso: string) => new Date(iso).toDateString();

const tarjetas = computed(() => {
  if (!promocionesHabilitadas.value) return [];
  return vigentes.value
    .map((promo) => {
      const articulo = articulos.value.find((a) => a.articuloId === promo.articuloId);
      if (!articulo) return null; // artículo de baja o tienda que no puede vender
      const crudo = promo.bannerUrl || articulo.url || '';
      return {
        promo,
        articulo,
        banner: crudo.startsWith('http') ? crudo : FIREBASE_STORAGE_BASE_URL + imagenUrl(crudo),
        descuento: descuentoPorcentaje(promo),
        resumen: resumenDe(promo.articuloId),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => {
      const fa = new Date(a.promo.creadaEn).getTime();
      const fb = new Date(b.promo.creadaEn).getTime();
      if (diaDe(a.promo.creadaEn) !== diaDe(b.promo.creadaEn)) return fb - fa;
      return b.resumen.promedio - a.resumen.promedio || b.resumen.total - a.resumen.total || fb - fa;
    })
    .slice(0, MAXIMO);
});

/** La tarjeta abre el detalle de la PROMOCIÓN: es lo que el cliente eligió.
    El artículo completo queda a un toque, desde esa pantalla. */
function verPromocion(promoId: string) {
  router.push(`/promocion/${promoId}`);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultArticulo;
}
</script>

<style scoped>
.destacados-promos {
  padding: 0.5rem 0 0.25rem;
}
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.titulo {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
  color: var(--text);
}
.cuenta {
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* Dos filas, se recorre de lado. Cada tarjeta ocupa la mitad del alto. */
.pista {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, 1fr);
  grid-auto-columns: 268px;
  gap: 0.75rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  padding-bottom: 0.5rem;
  scrollbar-width: thin;
}
.pista::-webkit-scrollbar {
  height: 6px;
}
.pista::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 999px;
}

.promo-card {
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.promo-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.promo-card:active {
  transform: scale(0.995);
}

/* El hueco sigue al banner: proporción de banner (16:9) en vez de un alto fijo,
   así crece con el ancho de la tarjeta. La imagen entra completa (`contain`), que
   es lo que la tienda subió: recortarla cortaría el texto de la promoción. */
.banner {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  flex-shrink: 0;
}
.banner img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.descuento {
  position: absolute;
  top: 6px;
  left: 6px;
  background: #c0392b;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
}

.datos {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.65rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.nombre {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.precios {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-top: auto;
}
/* Lo que se paga, en verde; el precio de antes, tachado y en rojo */
.precio {
  font-size: 1rem;
  font-weight: 800;
  color: #2e7d4f;
}
.antes {
  font-size: 0.78rem;
  color: #c0392b;
  text-decoration: line-through;
}
.publicada {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

@media (max-width: 480px) {
  .pista {
    /* En teléfono se ve una tarjeta completa y se asoma la siguiente, que es lo
       que invita a recorrer la pista de lado */
    grid-auto-columns: 224px;
  }
  .titulo {
    font-size: 1.3rem;
  }
}
</style>
