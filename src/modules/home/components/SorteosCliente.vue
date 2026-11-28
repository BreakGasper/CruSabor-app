<template>
  <!-- No ocupa espacio si no hay ningún sorteo que mostrar -->
  <section v-if="visibles.length" class="sorteos" data-testid="sorteos-cliente">
    <h3 class="sorteos-titulo">🎁 Sorteos</h3>

    <article v-for="s in visibles" :key="s.id" class="sorteo" :data-sorteo="s.id">
      <header class="sorteo-cab">
        <strong class="sorteo-nombre">{{ s.titulo }}</strong>
        <span class="chip" :class="'chip-' + estadoDe(s)">{{ ESTADO_SORTEO_LABEL[estadoDe(s)] }}</span>
      </header>
      <p v-if="s.premio" class="premio">🏆 {{ s.premio }}</p>
      <p v-if="s.descripcion" class="descripcion">{{ s.descripcion }}</p>
      <p v-if="s.fechaInicio || s.fechaFin" class="fechas">
        <template v-if="s.fechaInicio">Desde el {{ s.fechaInicio }}</template>
        <template v-if="s.fechaFin"> · Participa hasta el {{ s.fechaFin }}</template>
      </p>

      <!-- Carrusel de las tiendas que patrocinan el sorteo -->
      <div v-if="patrocinadoresDe(s).length" class="patrocina" data-testid="carrusel-patrocinadores">
        <p class="patrocina-titulo">Patrocinan este sorteo</p>
        <div class="logos" @touchstart.passive="pausar(s.id)" @mouseenter="pausar(s.id)" @mouseleave="reanudar(s.id)" @touchend.passive="reanudar(s.id)">
          <button
            v-for="t in patrocinadoresDe(s)"
            :key="t.tiendaId"
            type="button"
            class="logo-item"
            :data-testid="'logo-' + t.tiendaId"
            :title="t.nombreTienda"
            @click="irATienda(t.tiendaId)"
          >
            <img :src="t.logoUrl || placeholderLogo" :alt="t.nombreTienda" class="logo-img" loading="lazy" @error="onImgError" />
            <span class="logo-nombre">{{ t.nombreTienda }}</span>
          </button>
        </div>
      </div>

      <!-- Ganador -->
      <div v-if="s.ganadores.length" class="ganador" data-testid="ganador">
        🎉 {{ s.ganadores.length > 1 ? 'Ganadores' : 'Ganador' }}:
        <strong>{{ s.ganadores.map((g) => nombrePublico(g.nombre)).join(', ') }}</strong>
        <p v-if="yoGane(s)" class="soy-ganador">¡Eres tú! 🥳 La tienda o la plataforma se pondrá en contacto contigo.</p>
      </div>

      <!-- Participar -->
      <template v-if="estadoDe(s) === 'abierto'">
        <p v-if="participa[s.id]" class="participas" data-testid="ya-participas">✅ Ya estás participando. ¡Mucha suerte!</p>
        <template v-else-if="!usuario?.id">
          <button type="button" class="btn" data-testid="entrar-para-participar" @click="router.push({ path: '/login', query: { redirect: '/perfil' } })">
            Inicia sesión para participar
          </button>
        </template>
        <form v-else class="participar" @submit.prevent="participar(s)">
          <label :for="'codigo-' + s.id">Escribe el código que te dio la tienda</label>
          <div class="fila">
            <input
              :id="'codigo-' + s.id"
              v-model="codigos[s.id]"
              class="input-codigo"
              data-testid="codigo-sorteo"
              type="text"
              inputmode="text"
              autocapitalize="characters"
              autocomplete="off"
              maxlength="24"
              placeholder="Ej. LOLA-7K3Q"
              :disabled="enviando[s.id]"
            />
            <button type="submit" class="btn" data-testid="participar" :disabled="enviando[s.id] || !(codigos[s.id] || '').trim()">
              {{ enviando[s.id] ? 'Enviando…' : 'Participar' }}
            </button>
          </div>
          <p class="nota">Todos participan en el mismo sorteo; el código solo nos dice qué tienda te lo dio. Una participación por persona.</p>
        </form>
      </template>
      <p v-else-if="estadoDe(s) === 'proximo'" class="nota">Podrás participar a partir del {{ s.fechaInicio }}.</p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { sessionUser } from '@/utils/sessionUser';
import {
  useSorteos,
  estadoSorteo,
  patrocinadores,
  participarEnSorteo,
  yaParticipa,
  nombrePublico,
  ESTADO_SORTEO_LABEL,
  ErrorSorteo,
  type Sorteo,
} from '@/composables/useSorteos';

const router = useRouter();
const { sorteos } = useSorteos();
const usuario = computed(() => sessionUser.value);

const DIAS_VISIBLE_SORTEADO = 30;
const estadoDe = (s: Sorteo) => estadoSorteo(s);

/** Sorteos que se muestran: todos menos los pausados; los ya sorteados solo un mes */
const visibles = computed(() =>
  sorteos.value.filter((s) => {
    const e = estadoDe(s);
    if (e === 'pausado') return false;
    if (e === 'sorteado') return !!s.cerradoEn && Date.now() - new Date(s.cerradoEn).getTime() < DIAS_VISIBLE_SORTEADO * 86_400_000;
    return true;
  }),
);

const patrocinadoresDe = (s: Sorteo) => patrocinadores(s);
const codigos = reactive<Record<string, string>>({});
const enviando = reactive<Record<string, boolean>>({});
const participa = reactive<Record<string, boolean>>({});

// Cuando hay sesión y sorteos, se revisa en cuáles ya participa
watch(
  [visibles, () => usuario.value?.id],
  async ([lista, id]) => {
    if (!id) return;
    for (const s of lista) {
      if (participa[s.id] === undefined) participa[s.id] = await yaParticipa(s.id, id).catch(() => false);
    }
  },
  { immediate: true },
);

const yoGane = (s: Sorteo) => !!usuario.value?.id && s.ganadores.some((g) => g.clienteId === usuario.value!.id);

async function participar(s: Sorteo) {
  const u = usuario.value;
  if (!u?.id || enviando[s.id]) return;
  enviando[s.id] = true;
  try {
    const r = await participarEnSorteo(s.id, { id: u.id, nombre: u.nombre, telefono: u.telefono }, codigos[s.id] || '');
    participa[s.id] = true;
    codigos[s.id] = '';
    await Swal.fire({
      icon: 'success',
      title: '¡Ya estás participando!',
      text: `Tu código de ${r.nombreTienda} quedó registrado. Mucha suerte.`,
      confirmButtonColor: 'var(--color-bg-blue-ligth)',
    });
  } catch (e: any) {
    await Swal.fire({
      icon: e instanceof ErrorSorteo ? 'warning' : 'error',
      title: e instanceof ErrorSorteo ? 'No se pudo participar' : 'Algo salió mal',
      text: e instanceof ErrorSorteo ? e.message : 'Intenta de nuevo en unos minutos.',
      confirmButtonColor: 'var(--color-bg-blue-ligth)',
    });
  } finally {
    enviando[s.id] = false;
  }
}

function irATienda(id: string) {
  router.push(`/store/profile/${id}`);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}

/* Los logos avanzan solos suavemente; se detienen mientras la persona los toca */
const pausados = new Set<string>();
const pausar = (id: string) => pausados.add(id);
const reanudar = (id: string) => pausados.delete(id);
const timer = setInterval(() => {
  document.querySelectorAll<HTMLElement>('[data-testid="carrusel-patrocinadores"] .logos').forEach((cont) => {
    const id = (cont.closest('[data-sorteo]') as HTMLElement | null)?.dataset.sorteo || '';
    if (pausados.has(id) || cont.scrollWidth <= cont.clientWidth + 4) return;
    const fin = cont.scrollLeft + cont.clientWidth >= cont.scrollWidth - 4;
    cont.scrollTo({ left: fin ? 0 : cont.scrollLeft + 110, behavior: 'smooth' });
  });
}, 2800);
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.sorteos {
  background: var(--surface);
  border-radius: 20px;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08);
  padding: 1.1rem 1rem;
  margin-bottom: 1rem;
  text-align: left;
}
.sorteos-titulo { margin: 0 0 0.6rem; font-size: 1.05rem; color: var(--text); text-align: center; }
.sorteo { padding: 0.9rem 0; border-top: 1px solid var(--border); }
.sorteo:first-of-type { border-top: 0; padding-top: 0.2rem; }
.sorteo-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.sorteo-nombre { font-size: 1rem; color: var(--text); }
.chip { font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--surface-2); color: var(--text-muted); }
.chip-abierto { background: #d1fae5; color: #065f46; }
.chip-proximo { background: #dbeafe; color: #1e40af; }
.chip-sorteado { background: #fef3c7; color: #92400e; }
.premio { margin: 6px 0 0; font-weight: 700; color: var(--text); font-size: 0.95rem; }
.descripcion, .fechas, .nota { margin: 4px 0 0; font-size: 0.84rem; line-height: 1.4; color: var(--text-muted); }
.patrocina { margin-top: 10px; }
.patrocina-titulo { margin: 0 0 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.logos { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 2px 8px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.logos::-webkit-scrollbar { display: none; }
.logo-item { flex: none; width: 78px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; scroll-snap-align: start; font-family: inherit; }
.logo-img { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; background: var(--surface-2); border: 2px solid var(--border); }
.logo-nombre { width: 100%; font-size: 0.72rem; color: var(--text); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ganador { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #fef3c7; color: #78350f; font-size: 0.9rem; }
.soy-ganador { margin: 6px 0 0; font-weight: 700; }
.participas { margin: 10px 0 0; font-weight: 700; color: #047857; font-size: 0.92rem; }
.participar { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.participar label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.fila { display: flex; gap: 8px; }
.input-codigo { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; }
.btn { padding: 10px 16px; border-radius: 10px; border: 0; background: var(--color-bg-blue-ligth); color: var(--on-primary, #fff); font-weight: 700; font-family: inherit; cursor: pointer; margin-top: 10px; }
.fila .btn { margin-top: 0; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
