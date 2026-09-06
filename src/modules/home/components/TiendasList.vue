<template>
  <div class="tiendas-container">
    <!-- Header -->
    <PageHeader title="Tiendas" fallback="/" />

    <!-- Buscador -->
    <div class="search-wrapper">
      <svg
        class="search-icon"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"
        />
      </svg>
      <input
        id="buscar-tienda"
        aria-label="Buscar tienda"
        v-model="busqueda"
        type="search"
        class="search-input"
        placeholder="Buscar tienda, colonia o municipio..."
      />
      <button v-if="busqueda" class="clear-btn" @click="busqueda = ''">✕</button>
    </div>

    <!-- Filtro por categoría -->
    <div class="chips">
      <button
        class="chip"
        :class="{ active: categoriaSel === '' && !soloFavoritas }"
        @click="categoriaSel = ''; soloFavoritas = false"
      >
        Todas
      </button>
      <button
        class="chip chip-fav"
        :class="{ active: soloFavoritas }"
        @click="soloFavoritas = !soloFavoritas"
      >
        ❤ Favoritas<span v-if="favoritasIds.length" class="chip-count">{{ favoritasIds.length }}</span>
      </button>
      <button
        v-for="cat in categorias"
        :key="cat"
        class="chip"
        :class="{ active: categoriaSel === cat }"
        @click="categoriaSel = cat"
      >
        {{ cat }}
      </button>
    </div>

    <p class="counter">
      {{ tiendasFiltradas.length }}
      {{ tiendasFiltradas.length === 1 ? 'tienda' : 'tiendas' }}
    </p>

    <!-- Estados -->
    <p v-if="loading" class="empty">Cargando tiendas...</p>
    <p v-else-if="tiendasFiltradas.length === 0" class="empty">
      {{ soloFavoritas && !busqueda ? 'Aún no tienes tiendas favoritas.' : 'No encontramos tiendas con ese criterio.' }}
    </p>

    <!-- Lista -->
    <div v-else class="grid">
      <div
        v-for="t in tiendasFiltradas"
        :key="t.tiendaId"
        class="tienda-card"
        @click="verTienda(t)"
      >
        <img
          :src="t.logoUrl || placeholderLogo"
          :alt="t.nombreTienda"
          class="logo"
          loading="lazy"
          @error="onImgError"
        />

        <div class="info">
          <div class="nombre-row">
            <h3 class="nombre">{{ t.nombreTienda }}</h3>
            <span v-if="t.categoria" class="categoria">{{ t.categoria }}</span>
          </div>

          <div class="detalle-row">
            <span class="ubicacion" :title="`${t.colonia}, ${t.municipio}`">
              📍 {{ [t.colonia, t.municipio].filter(Boolean).join(', ') || 'Sin ubicación' }}
            </span>
            <a
              v-if="t.telefono"
              class="telefono"
              :href="`tel:${t.telefono}`"
              @click.stop
            >
              📞 {{ formatTelefono(t.telefono) }}
            </a>
          </div>

          <div class="extras">
            <span v-if="t.envioDomicilio" class="tag envio">🚚 Envío a domicilio</span>
            <span v-if="t.incluyeWhatsapp" class="tag wa">WhatsApp</span>
          </div>
        </div>

        <button
          class="fav-btn"
          :class="{ active: esFavorita(t.tiendaId) }"
          :title="esFavorita(t.tiendaId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
          @click.stop="toggle(t)"
        >
          <FontAwesomeIcon :icon="esFavorita(t.tiendaId) ? ['fas', 'heart'] : ['far', 'heart']" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import { tiendaPuedeVender } from '@/composables/useMembresia';

const router = useRouter();
const { tiendas, loading, cargarTiendas } = useTiendas();
const { esFavorita, toggle, favoritasIds } = useTiendasFavoritas();
const route = useRoute();
/** Desde el perfil se llega con /tiendas?favoritas=1 */
const soloFavoritas = ref(route.query.favoritas === '1');

const busqueda = ref('');
const categoriaSel = ref('');

onMounted(() => cargarTiendas());

const normalizar = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Al público solo se muestran tiendas aprobadas y con membresía vigente */
const tiendasVisibles = computed(() => tiendas.value.filter((t) => tiendaPuedeVender(t)));

const categorias = computed(() =>
  Array.from(new Set(tiendasVisibles.value.map((t) => t.categoria).filter(Boolean))).sort(),
);

const tiendasFiltradas = computed(() => {
  const q = normalizar(busqueda.value.trim());
  return tiendasVisibles.value
    .filter((t) => !soloFavoritas.value || esFavorita(t.tiendaId))
    .filter((t) => !categoriaSel.value || t.categoria === categoriaSel.value)
    .filter(
      (t) =>
        !q ||
        normalizar(t.nombreTienda).includes(q) ||
        normalizar(t.colonia).includes(q) ||
        normalizar(t.municipio).includes(q) ||
        normalizar(t.categoria).includes(q),
    )
    .sort((a, b) => a.nombreTienda.localeCompare(b.nombreTienda));
});

function formatTelefono(tel: string) {
  const d = String(tel).replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : tel;
}

function verTienda(t: Tienda) {
  router.push(`/store/profile/${t.tiendaId}`);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}
</script>

<style scoped>
.tiendas-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0.75rem 1rem 2rem;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 1rem;
  min-height: 44px;
}
.back-btn {
  position: absolute;
  left: 0;
  width: 40px;
}
.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

/* Buscador */
.search-wrapper {
  position: relative;
  margin-bottom: 0.75rem;
}
.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 2.8rem;
  border: none;
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;
}
.search-input:focus {
  box-shadow: 0 0 0 3px rgba(1, 101, 216, 0.2);
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  pointer-events: none;
}
.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #dfe3e8;
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

/* Chips de categoría */
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  margin-bottom: 0.5rem;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.chip.active {
  background: var(--color-bg-blue-dark);
  border-color: var(--color-bg-blue-dark);
  color: #fff;
}
.chip-fav.active {
  background: #e74c3c;
  border-color: #e74c3c;
}
.chip-count {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  font-size: 0.72rem;
}
.chip-fav.active .chip-count {
  background: rgba(255, 255, 255, 0.25);
}

.counter {
  margin: 0 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 0;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
}

/* Card */
.tienda-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1rem;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-width: 0;
}
.tienda-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
}
.logo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--surface-2);
  border: 2px solid #eef2f7;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nombre-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.nombre {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.categoria {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e8f1fc;
  color: var(--brand-blue-text);
  white-space: nowrap;
}
.detalle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.85rem;
  color: var(--text-muted);
  min-width: 0;
}
.ubicacion {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.telefono {
  flex-shrink: 0;
  color: var(--brand-blue-text);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.telefono:hover {
  text-decoration: underline;
}
.extras {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}
.tag.envio {
  background: #eef8f1;
  color: #1e8449;
}
.tag.wa {
  background: #e9f9ee;
  color: #128c7e;
}
.fav-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: #f4f6f9;
  color: #b5bcc6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  font-size: 1rem;
  transition: all 0.2s;
}
.fav-btn:hover,
.fav-btn.active {
  background: #ffecec;
  color: #e74c3c;
}

@media (max-width: 480px) {
  .tiendas-container {
    padding: 0.5rem 0.75rem 2rem;
  }
  .logo {
    width: 54px;
    height: 54px;
  }
  .detalle-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .fav-btn {
    width: 34px;
    height: 34px;
  }
  .nombre-row {
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .nombre {
    white-space: normal;
    line-height: 1.2;
  }
}
</style>
