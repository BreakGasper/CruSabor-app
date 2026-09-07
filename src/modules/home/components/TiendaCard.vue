<template>
  <article class="tienda-card" @click="$emit('abrir', tienda)">
    <div class="banner">
      <img loading="lazy" :src="tienda.bannerUrl || tienda.logoUrl || placeholderBanner" :alt="tienda.nombreTienda" @error="onImgError" />
      <img v-if="tienda.logoUrl" class="logo" :src="tienda.logoUrl" alt="" @error="onLogoError" />
    </div>

    <div class="cuerpo">
      <div class="fila-nombre">
        <h3 class="nombre" :title="tienda.nombreTienda">{{ tienda.nombreTienda }}</h3>
        <button
          type="button"
          class="corazon"
          :class="{ activo: esFavorita(tienda.tiendaId) }"
          :title="esFavorita(tienda.tiendaId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
          @click.stop="toggle(tienda)"
        >
          <FontAwesomeIcon :icon="esFavorita(tienda.tiendaId) ? ['fas', 'heart'] : ['far', 'heart']" />
        </button>
      </div>
      <p v-if="tienda.categoria" class="categoria">{{ tienda.categoria }}</p>
      <!-- Solo lectura: se califica desde el perfil de la tienda -->
      <StarRating size="sm" :promedio="resumenDe(tienda.tiendaId).promedio" :total="resumenDe(tienda.tiendaId).total" />

      <div v-if="detalle" class="extras">
        <span class="ubicacion" :title="`${tienda.colonia}, ${tienda.municipio}`">
          📍 {{ [tienda.colonia, tienda.municipio].filter(Boolean).join(', ') || 'Sin ubicación' }}
        </span>
        <span v-if="tienda.envioDomicilio" class="tag envio">🚚 Envío a domicilio</span>
        <span v-if="tienda.incluyeWhatsapp" class="tag wa">WhatsApp</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
/**
 * Tarjeta de tienda: banner a todo lo ancho con el logo encima, nombre en negritas con el
 * corazón de favoritos a la derecha, categoría y estrellas solo de lectura. Se usa en la
 * portada (carrusel horizontal) y en la lista completa de tiendas (vertical, con `detalle`).
 */
import { FontAwesomeIcon } from '@/plugins/fontawesome';
import StarRating from '@/components/StarRating.vue';
import type { Tienda } from '@/composables/useTiendas';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import { useCalificaciones } from '@/composables/useCalificaciones';
import placeholderBanner from '@/assets/icons/default_articulo.png';

withDefaults(defineProps<{ tienda: Tienda; detalle?: boolean }>(), { detalle: false });
defineEmits<{ (e: 'abrir', tienda: Tienda): void }>();

const { esFavorita, toggle } = useTiendasFavoritas();
const { resumenDe } = useCalificaciones('tiendas');

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderBanner;
}
function onLogoError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}
</script>

<style scoped>
.tienda-card {
  width: 100%;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 3px 10px var(--color-shadow);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
}
.tienda-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--color-shadow);
}
.banner {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 7;
  min-height: 110px;
  max-height: 260px;
  background: var(--surface-2);
}
.banner > img:first-child {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.logo {
  position: absolute;
  left: 12px;
  bottom: -18px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--surface);
  background: var(--surface);
}
.cuerpo {
  padding: 22px 14px 12px;
}
.fila-nombre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nombre {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.corazon {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.corazon.activo {
  color: #e74c3c;
}
.categoria {
  margin: 2px 0 6px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.ubicacion {
  flex: 1 1 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
}
.tag.envio {
  background: #e3f2fd;
  color: #1976d2;
}
.tag.wa {
  background: #e8f5e9;
  color: #2e7d32;
}
</style>
