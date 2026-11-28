<template>
  <div class="pantalla">
    <PageHeader :title="servicio?.nombre || 'Servicio'" :fallback="`/store/profile/${tiendaId}`" />

    <p v-if="cargando" class="estado" data-testid="cargando">Cargando…</p>
    <p v-else-if="!visible" class="estado" data-testid="no-disponible">Este servicio ya no está disponible.</p>

    <main v-else-if="servicio" class="detalle" data-testid="detalle-servicio">
      <!-- Galería del trabajo -->
      <div class="galeria" aria-label="Fotos del servicio">
        <div ref="pista" class="pista" @scroll="alDeslizar">
          <img v-for="(f, i) in servicio.fotos" :key="f" :src="f" :alt="`${servicio.nombre} ${i + 1}`" class="foto" loading="lazy" />
          <div v-if="!servicio.fotos.length" class="foto sin-foto" aria-hidden="true">{{ icono }}</div>
        </div>
        <div v-if="servicio.fotos.length > 1" class="puntos">
          <span v-for="(f, i) in servicio.fotos" :key="f" class="punto" :class="{ on: i === actual }" />
        </div>
      </div>

      <section class="cuerpo">
        <p class="categoria">{{ icono }} {{ nombreCategoriaServicio(servicio.categoria) }}</p>
        <h1 class="nombre">{{ servicio.nombre }}</h1>
        <p class="precio" data-testid="precio-servicio">{{ etiquetaPrecio(servicio) }}</p>

        <ul class="datos">
          <li v-if="servicio.duracionMin">⏱ {{ etiquetaDuracion(servicio.duracionMin) }}</li>
          <li>📍 {{ etiquetaModalidad(servicio.modalidad) }}</li>
          <li>🧾 {{ ETIQUETA_CONTRATACION[servicio.contratacion] }}</li>
        </ul>

        <p v-if="servicio.descripcion" class="descripcion">{{ servicio.descripcion }}</p>

        <button v-if="tienda" type="button" class="tienda" data-testid="tarjeta-tienda" @click="router.push(`/store/profile/${tiendaId}`)">
          <img v-if="tienda.logoUrl" :src="tienda.logoUrl" alt="" class="tienda-logo" />
          <span v-else class="tienda-logo vacio" aria-hidden="true">{{ (tienda.nombreTienda || '?').charAt(0).toUpperCase() }}</span>
          <span class="tienda-texto">
            <strong>{{ tienda.nombreTienda }}</strong>
            <small>{{ [tienda.colonia, tienda.municipio].filter(Boolean).join(', ') }}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <!-- Acción: en un servicio NO se agrega al carrito, se cotiza (o se agenda) -->
      <footer class="acciones">
        <template v-if="esDueno">
          <p class="nota" data-testid="vista-dueno">Así lo ven tus clientes.</p>
          <button type="button" class="btn-sec" data-testid="editar" @click="router.push(`/store/servicios/${tiendaId}`)">Editar mis servicios</button>
        </template>
        <template v-else-if="!tiendaDisponible">
          <p class="nota" data-testid="tienda-no-disponible">Esta tienda no está disponible por el momento.</p>
        </template>
        <template v-else>
          <button v-if="puedeCotizar(servicio)" type="button" class="btn-pri" data-testid="cotizar" @click="cotizar">💬 Cotizar</button>
          <button v-if="sePuedeAgendar(servicio)" type="button" class="btn-sec" disabled data-testid="agendar-pronto">🗓️ Agendar cita · próximamente</button>
        </template>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { estadoEfectivo } from '@/composables/useMembresia';
import { CATEGORIAS_SERVICIO, nombreCategoriaServicio, type Servicio } from '../tipos';
import { ofreceServicios } from '../negocio';
import { esDuenoDeTienda } from '../sesion';
import { ETIQUETA_CONTRATACION, etiquetaDuracion, etiquetaModalidad, etiquetaPrecio, obtenerServicio, puedeCotizar, sePuedeAgendar } from '../catalogo';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.tiendaId ?? ''));
const servicioId = computed(() => String(route.params.servicioId ?? ''));
const { obtenerTienda } = useTiendas();

const servicio = ref<Servicio | null>(null);
const tienda = ref<Tienda | null>(null);
const cargando = ref(true);
const actual = ref(0);
const pista = ref<HTMLElement | null>(null);

const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
/** Los clientes solo ven servicios activos de una tienda que ofrece servicios; la dueña o dueño ve el suyo siempre */
const visible = computed(() => !!servicio.value && !!tienda.value && ofreceServicios(tienda.value) && (servicio.value.activo || esDueno.value));
const tiendaDisponible = computed(() => !!tienda.value && estadoEfectivo(tienda.value) === 'activa');
const icono = computed(() => CATEGORIAS_SERVICIO.find((c) => c.id === servicio.value?.categoria)?.icono ?? '✨');

onMounted(async () => {
  try {
    [servicio.value, tienda.value] = await Promise.all([obtenerServicio(tiendaId.value, servicioId.value), obtenerTienda(tiendaId.value)]);
  } finally {
    cargando.value = false;
  }
});

function alDeslizar() {
  const p = pista.value;
  if (p && p.clientWidth) actual.value = Math.round(p.scrollLeft / p.clientWidth);
}

const cotizar = () => router.push(`/cotizar/${tiendaId.value}/${servicioId.value}`);
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); padding-bottom: 96px; }
.estado { padding: 40px 16px; text-align: center; color: var(--text-muted); }
.detalle { max-width: 760px; margin: 0 auto; text-align: left; }
.galeria { position: relative; }
.pista { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.pista::-webkit-scrollbar { display: none; }
.foto { flex: 0 0 100%; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; scroll-snap-align: start; background: var(--surface-2); }
.sin-foto { display: flex; align-items: center; justify-content: center; font-size: 4rem; }
.puntos { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; justify-content: center; gap: 6px; }
.punto { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.6); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); }
.punto.on { background: #fff; width: 20px; border-radius: 4px; }
.cuerpo { padding: 16px; display: flex; flex-direction: column; gap: 8px; color: var(--text); }
.categoria { margin: 0; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; }
.nombre { margin: 0; font-size: 1.4rem; line-height: 1.2; }
.precio { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--brand-blue-text); }
.datos { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.datos li { padding: 5px 12px; border-radius: 999px; background: var(--surface-2); color: var(--text); font-size: 0.82rem; font-weight: 600; }
.descripcion { margin: 6px 0; line-height: 1.55; white-space: pre-line; }
.tienda { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.tienda-logo { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none; }
.tienda-logo.vacio { display: flex; align-items: center; justify-content: center; background: var(--surface-2); font-weight: 700; }
.tienda-texto { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.tienda-texto small { color: var(--text-muted); }
.acciones { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; flex-direction: column; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: var(--surface); border-top: 1px solid var(--border); box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.12); }
.btn-pri, .btn-sec { width: 100%; max-width: 728px; margin: 0 auto; padding: 14px 16px; border: 0; border-radius: 12px; font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
.btn-pri { background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn-sec { background: var(--surface-2); color: var(--text); }
.btn-sec:disabled { opacity: 0.65; cursor: not-allowed; }
.nota { margin: 0; text-align: center; color: var(--text-muted); font-size: 0.9rem; }
</style>
