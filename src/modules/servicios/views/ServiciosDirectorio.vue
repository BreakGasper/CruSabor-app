<template>
  <div class="pantalla">
    <PageHeader title="Servicios" fallback="/" />

    <main class="contenido">
      <SelectorModo modo="servicios" />

      <div class="buscador">
        <input v-model="texto" type="search" placeholder="Busca barbería, uñas, fotografía…" aria-label="Buscar servicios" data-testid="buscar" />
      </div>

      <nav v-if="categorias.length" class="chips" aria-label="Categorías">
        <button type="button" class="chip" :class="{ on: !categoria }" data-testid="cat-todas" @click="categoria = ''">Todas</button>
        <button v-for="c in categorias" :key="c.id" type="button" class="chip" :class="{ on: categoria === c.id }" :data-cat="c.id" @click="categoria = c.id">
          {{ c.icono }} {{ c.nombre }} <span class="n">{{ c.total }}</span>
        </button>
      </nav>

      <div class="fila-filtros">
        <div class="pestanas" role="tablist">
          <button type="button" role="tab" class="pestana" :class="{ on: vista === 'profesionales' }" :aria-selected="vista === 'profesionales'" data-testid="vista-profesionales" @click="vista = 'profesionales'">Profesionales</button>
          <button type="button" role="tab" class="pestana" :class="{ on: vista === 'servicios' }" :aria-selected="vista === 'servicios'" data-testid="vista-servicios" @click="vista = 'servicios'">Servicios</button>
        </div>
        <select v-model="modalidad" aria-label="Dónde" data-testid="modalidad">
          <option value="todas">Dónde sea</option>
          <option value="local">En establecimiento</option>
          <option value="domicilio">A domicilio</option>
        </select>
      </div>

      <p v-if="cargando" class="vacio">Cargando…</p>

      <template v-else-if="vista === 'profesionales'">
        <p class="contador">{{ profesionales.length }} {{ profesionales.length === 1 ? 'profesional' : 'profesionales' }}</p>
        <p v-if="!profesionales.length" class="vacio" data-testid="sin-resultados">No encontramos profesionales con ese criterio.</p>
        <ul v-else class="rejilla">
          <li v-for="t in profesionales" :key="t.tiendaId">
            <button type="button" class="tarjeta profesional" :data-tienda="t.tiendaId" @click="router.push(`/store/profile/${t.tiendaId}`)">
              <span class="portada" :style="t.bannerUrl ? { backgroundImage: `url(${t.bannerUrl})` } : undefined" />
              <img :src="t.logoUrl || placeholderLogo" alt="" class="logo" @error="onImgError" />
              <span class="datos">
                <strong>{{ t.nombreTienda }}</strong>
                <span class="cat">{{ nombreCategoriaServicio(t.categoriaServicio) }}</span>
                <span class="meta">{{ etiquetaModalidad(modalidadDe(t)) }}<template v-if="t.municipio"> · {{ t.municipio }}</template></span>
                <span v-if="t.especialidades?.length" class="esp">{{ t.especialidades.slice(0, 3).join(' · ') }}</span>
                <span class="precio">
                  <template v-if="precioDesde(porTienda[t.tiendaId!]) !== null">Desde {{ dinero(precioDesde(porTienda[t.tiendaId!])!) }}</template>
                  <template v-else>Cotiza tu servicio</template>
                  · {{ (porTienda[t.tiendaId!] ?? []).length }} servicio(s)
                </span>
              </span>
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="contador">{{ servicios.length }} {{ servicios.length === 1 ? 'servicio' : 'servicios' }}</p>
        <p v-if="!servicios.length" class="vacio" data-testid="sin-resultados">No encontramos servicios con ese criterio.</p>
        <ul v-else class="rejilla">
          <li v-for="r in servicios" :key="r.servicio.id">
            <button type="button" class="tarjeta servicio" :data-servicio="r.servicio.id" @click="router.push(`/servicio/${r.servicio.tiendaId}/${r.servicio.id}`)">
              <span class="foto"><img v-if="r.servicio.fotos[0]" :src="r.servicio.fotos[0]" :alt="r.servicio.nombre" loading="lazy" /><span v-else aria-hidden="true">✨</span></span>
              <span class="datos">
                <strong>{{ r.servicio.nombre }}</strong>
                <span class="meta">{{ r.tienda.nombreTienda }}</span>
                <span class="precio">{{ etiquetaPrecio(r.servicio) }}<template v-if="r.servicio.duracionMin"> · {{ etiquetaDuracion(r.servicio.duracionMin) }}</template></span>
              </span>
            </button>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import SelectorModo from '../components/SelectorModo.vue';
import { useTiendas } from '@/composables/useTiendas';
import { etiquetaDuracion, etiquetaModalidad, etiquetaPrecio, leerTodosLosServicios } from '../catalogo';
import { categoriasConProfesionales, filtrarProfesionales, filtrarServicios, precioDesde, serviciosPorTienda, tiendasDeServicios, type FiltroModalidad } from '../descubrir';
import { modalidadDe } from '../negocio';
import { nombreCategoriaServicio, type Servicio } from '../tipos';
import { dinero } from '../formato';

/** Directorio «Encontrar servicios»: profesionales y servicios, con búsqueda, categoría y modalidad */
const router = useRouter();
const { tiendas, cargarTiendas, loading } = useTiendas();
const todos = ref<Servicio[]>([]);
const cargandoServicios = ref(true);
const cargando = computed(() => loading.value || cargandoServicios.value);

const texto = ref('');
const categoria = ref('');
const modalidad = ref<FiltroModalidad>('todas');
const vista = ref<'profesionales' | 'servicios'>('profesionales');

onMounted(async () => {
  cargarTiendas();
  try {
    todos.value = await leerTodosLosServicios();
  } finally {
    cargandoServicios.value = false;
  }
});

const visibles = computed(() => tiendasDeServicios(tiendas.value));
const porTienda = computed(() => serviciosPorTienda(todos.value));
const categorias = computed(() => categoriasConProfesionales(visibles.value));
const filtros = computed(() => ({ texto: texto.value, categoria: categoria.value, modalidad: modalidad.value }));
const profesionales = computed(() => filtrarProfesionales(visibles.value, porTienda.value, filtros.value));
const servicios = computed(() => filtrarServicios(visibles.value, porTienda.value, filtros.value));

const onImgError = (e: Event) => ((e.target as HTMLImageElement).src = placeholderLogo);
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 900px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 12px; }
.buscador input { width: 100%; box-sizing: border-box; padding: 11px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: inherit; font-size: 16px; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip { flex: none; padding: 7px 12px; border: 1.5px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.chip.on { border-color: var(--brand-blue-text); background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.n { margin-left: 4px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--text); font-size: 0.75rem; }
.fila-filtros { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.pestanas { display: inline-flex; padding: 4px; border-radius: 12px; background: var(--surface-2); }
.pestana { padding: 7px 14px; border: 0; border-radius: 9px; background: transparent; color: var(--text-muted); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
.pestana.on { background: var(--surface); color: var(--text); }
select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-size: 16px; }
.contador { margin: 0; color: var(--text-muted); font-size: 0.85rem; }
.vacio { margin: 8px 0; color: var(--text-muted); }
.rejilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 640px) { .rejilla { grid-template-columns: repeat(2, 1fr); } }
.tarjeta { position: relative; width: 100%; display: flex; flex-direction: column; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; overflow: hidden; }
.portada { display: block; height: 92px; background: var(--surface-2) center / cover no-repeat; }
.logo { position: absolute; left: 14px; top: 58px; width: 64px; height: 64px; border-radius: 50%; object-fit: cover; background: var(--surface); border: 3px solid var(--surface); }
.profesional .datos { padding: 40px 14px 14px; }
.datos { display: flex; flex-direction: column; gap: 2px; }
.datos strong { font-size: 1rem; }
.cat { color: var(--brand-blue-text); font-weight: 700; font-size: 0.85rem; }
.meta, .esp { color: var(--text-muted); font-size: 0.8rem; }
.precio { margin-top: 4px; font-weight: 700; font-size: 0.85rem; }
.servicio { flex-direction: row; align-items: center; }
.servicio .foto { flex: none; width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); font-size: 1.8rem; }
.servicio .foto img { width: 100%; height: 100%; object-fit: cover; }
.servicio .datos { padding: 10px 12px; }
</style>
