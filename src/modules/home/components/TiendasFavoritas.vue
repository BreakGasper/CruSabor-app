<template>
  <div class="tf-container">
    <p v-if="favoritas.length === 0" class="tf-empty">
      Aún no tienes tiendas favoritas.
      <a href="#" @click.prevent="router.push('/tiendas')">Explorar tiendas</a>
    </p>

    <div v-else class="tf-list">
      <div
        v-for="t in visibles"
        :key="t.tiendaId"
        class="tf-card"
        @click="router.push(`/store/profile/${t.tiendaId}`)"
      >
        <img
          :src="t.logoUrl || placeholderLogo"
          :alt="t.nombreTienda"
          class="tf-logo"
          loading="lazy"
          @error="onImgError"
        />
        <div class="tf-info">
          <p class="tf-nombre">{{ t.nombreTienda }}</p>
          <p class="tf-detalle">
            📍 {{ [t.colonia, t.municipio].filter(Boolean).join(', ') || 'Sin ubicación' }}
          </p>
          <a
            v-if="t.telefono"
            class="tf-tel"
            :href="`tel:${t.telefono}`"
            @click.stop
          >
            📞 {{ t.telefono }}
          </a>
        </div>
        <button
          class="tf-quitar"
          title="Quitar de favoritos"
          @click.stop="quitar(t)"
        >
          <FontAwesomeIcon :icon="['fas', 'heart']" />
        </button>
      </div>
    </div>

    <button
      v-if="favoritas.length > 0"
      class="tf-ver-todas"
      @click="router.push({ path: '/tiendas', query: { favoritas: '1' } })"
    >
      ➤ Ver todas mis favoritas{{ favoritas.length > visibles.length ? ` (${favoritas.length})` : '' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import type { TiendaFavoritaItem } from '@/db';
import placeholderLogo from '@/assets/icons/user_back_profile.png';

const props = defineProps<{ limit?: number }>();
const router = useRouter();

const { favoritas, toggle } = useTiendasFavoritas();

/** Las últimas agregadas primero; recortadas al límite si se indica */
const visibles = computed(() => {
  const orden = [...favoritas.value].sort((a, b) =>
    (b.fecha_hora || '').localeCompare(a.fecha_hora || ''),
  );
  return props.limit ? orden.slice(0, props.limit) : orden;
});

function quitar(t: TiendaFavoritaItem) {
  toggle({ tiendaId: t.tiendaId, nombreTienda: t.nombreTienda } as any);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}
</script>

<style scoped>
.tf-empty {
  text-align: center;
  color: #777;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}
.tf-empty a {
  color: var(--color-bg-blue-ligth);
  font-weight: 600;
  text-decoration: none;
}
.tf-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.tf-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: #f7f9fc;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
  min-width: 0;
}
.tf-card:hover {
  background: #eef3fa;
  transform: translateY(-1px);
}
.tf-logo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #fff;
  border: 2px solid #fff;
}
.tf-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.tf-nombre {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tf-detalle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tf-tel {
  font-size: 0.8rem;
  color: var(--color-bg-blue-ligth);
  font-weight: 600;
  text-decoration: none;
}
.tf-quitar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #fff;
  color: #e74c3c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.tf-quitar:hover {
  background: #ffecec;
}
.tf-ver-todas {
  margin-top: 0.6rem;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-bg-blue-ligth);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
}
.tf-ver-todas:hover {
  text-decoration: underline;
}
</style>
