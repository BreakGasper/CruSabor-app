<template>
  <section v-if="tiendasVisibles.length" class="tiendas-destacadas">
    <div class="encabezado">
      <h2 class="titulo">Tiendas</h2>
      <button type="button" class="ver-todas" @click="router.push('/tiendas')">Ver todas ›</button>
    </div>

    <div class="pista">
      <article
        v-for="t in tiendasVisibles"
        :key="t.tiendaId"
        class="tienda-card"
        @click="verTienda(t)"
      >
        <div class="banner">
          <img loading="lazy" :src="t.bannerUrl || t.logoUrl || placeholderBanner" :alt="t.nombreTienda" @error="onImgError" />
          <img v-if="t.logoUrl" class="logo" :src="t.logoUrl" alt="" @error="onLogoError" />
        </div>

        <div class="cuerpo">
          <div class="fila-nombre">
            <h3 class="nombre" :title="t.nombreTienda">{{ t.nombreTienda }}</h3>
            <button
              type="button"
              class="corazon"
              :class="{ activo: esFavorita(t.tiendaId) }"
              :title="esFavorita(t.tiendaId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
              @click.stop="toggle(t)"
            >
              <FontAwesomeIcon :icon="esFavorita(t.tiendaId) ? ['fas', 'heart'] : ['far', 'heart']" />
            </button>
          </div>
          <p v-if="t.categoria" class="categoria">{{ t.categoria }}</p>
          <!-- Solo lectura: para calificar hay que entrar al perfil de la tienda -->
          <StarRating
            size="sm"
            :promedio="resumenDe(t.tiendaId).promedio"
            :total="resumenDe(t.tiendaId).total"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Tiendas en la portada, una tarjeta debajo de otra con el banner a todo lo ancho, el nombre
 * en negritas y el corazón de favoritos a la derecha. Solo se muestran tiendas que pueden
 * vender. Las estrellas se muestran solo de lectura; se califica desde el perfil de la tienda.
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@/plugins/fontawesome';
import StarRating from '@/components/StarRating.vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { useEstadoTiendas } from '@/composables/useMembresia';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import { useCalificaciones } from '@/composables/useCalificaciones';
import placeholderBanner from '@/assets/icons/default_articulo.png';

const props = withDefaults(defineProps<{ maximo?: number }>(), { maximo: 6 });

const router = useRouter();
const { tiendas, cargarTiendas } = useTiendas();
const { noPuedeVender } = useEstadoTiendas();
const { esFavorita, toggle } = useTiendasFavoritas();
const { resumenDe } = useCalificaciones('tiendas');

onMounted(cargarTiendas);

/** Tiendas activas; primero las mejor calificadas (sin mostrar la nota aquí), luego por nombre */
const tiendasVisibles = computed(() =>
  tiendas.value
    .filter((t) => t.tiendaId && t.nombreTienda && !noPuedeVender(t.tiendaId))
    .sort((a, b) => {
      const ra = resumenDe(a.tiendaId);
      const rb = resumenDe(b.tiendaId);
      return rb.promedio - ra.promedio || rb.total - ra.total || a.nombreTienda.localeCompare(b.nombreTienda, 'es');
    })
    .slice(0, props.maximo),
);

function verTienda(t: Tienda) {
  router.push(`/store/profile/${t.tiendaId}`);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderBanner;
}
function onLogoError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}
</script>

<style scoped>
.tiendas-destacadas {
  padding: 0.5rem 0 0.25rem;
}
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0;
}
.titulo {
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  text-align: left;
}
.ver-todas {
  border: 0;
  background: none;
  padding: 0;
  font-size: 0.85rem;
  color: var(--brand-blue-text);
  cursor: pointer;
}
/* Lista vertical: una tarjeta debajo de otra, a todo lo ancho */
.pista {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}
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
  aspect-ratio: 16 / 7; /* el banner abarca todo el ancho de la tarjeta */
  min-height: 120px;
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
.categoria {
  margin: 2px 0 6px;
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
</style>
