<template>
  <!-- No ocupa espacio si no hay banners activos ni sorteos -->
  <section v-if="total" class="banners" aria-label="Promociones">
    <div ref="scroll" class="banners-scroll" @scroll="onScroll">
      <!-- Sorteos: el banner del sorteo, con los logos de las tiendas participantes abajo -->
      <div
        v-for="(s, i) in sorteos"
        :key="'sorteo-' + s.id"
        class="banner sorteo clickeable"
        role="button"
        tabindex="0"
        :data-sorteo="s.id"
        :aria-label="`Sorteo: ${s.titulo}`"
        @click="abrirSorteo(s)"
        @keydown.enter="abrirSorteo(s)"
      >
        <!-- La imagen va completa, sin texto encima (el banner suele traer su propio texto): el nombre, el premio y
             los logos van en un panel aparte debajo, siempre legible -->
        <div class="sorteo-media">
          <img v-if="s.imagenUrl" :src="s.imagenUrl" :alt="s.titulo" class="banner-img sorteo-img" loading="lazy" />
          <div v-else class="banner-img sorteo-fondo" aria-hidden="true"><span>🎁</span></div>
        </div>

        <div class="sorteo-panel">
          <span class="etiqueta">🎁 Sorteo</span>
          <strong class="sorteo-titulo">{{ s.titulo }}</strong>
          <span v-if="s.premio" class="premio">🏆 {{ s.premio }}</span>
          <span v-if="s.ganadores.length" class="ganador" data-testid="ganador-carrusel">
            🎉 Ganador:
            <b><TextoDescifrado :texto="s.ganadores.map((g) => nombrePublico(g.nombre)).join(', ')" :activo="activo === i" /></b>
          </span>
          <span v-else-if="estadoSorteo(s) === 'abierto'" class="cta">Toca para participar con tu código ›</span>
          <span v-else-if="estadoSorteo(s) === 'proximo'" class="cta">Empieza el {{ s.fechaInicio }}</span>

          <div v-if="logosDe(s).length" class="sorteo-logos" data-testid="logos-sorteo">
            <img
              v-for="t in logosDe(s).slice(0, MAX_LOGOS)"
              :key="t.tiendaId"
              :src="t.logoUrl || placeholderLogo"
              :alt="t.nombreTienda"
              :title="t.nombreTienda"
              class="mini-logo"
              :data-testid="'mini-logo-' + t.tiendaId"
              loading="lazy"
              @error="onImgError"
            />
            <span v-if="logosDe(s).length > MAX_LOGOS" class="mas">+{{ logosDe(s).length - MAX_LOGOS }}</span>
          </div>
        </div>
      </div>

      <!-- Banners normales del administrador -->
      <button
        v-for="b in banners"
        :key="b.id"
        type="button"
        class="banner"
        :class="{ clickeable: !!b.enlace }"
        @click="abrir(b)"
      >
        <img :src="b.imagenUrl" :alt="b.titulo || 'Promoción'" class="banner-img" loading="lazy" />
        <div v-if="b.titulo || b.subtitulo" class="banner-texto">
          <strong v-if="b.titulo">{{ b.titulo }}</strong>
          <span v-if="b.subtitulo">{{ b.subtitulo }}</span>
        </div>
      </button>
    </div>

    <div v-if="total > 1" class="dots">
      <button
        v-for="n in total"
        :key="n"
        type="button"
        class="dot"
        :class="{ on: n - 1 === activo }"
        :aria-label="`Ir a la promoción ${n}`"
        @click="irA(n - 1)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import TextoDescifrado from '@/components/TextoDescifrado.vue';
import { abrirDialogoSorteo } from '@/composables/dialogoSorteo';
import { useBannersActivos, type Banner } from '@/composables/useBanners';
import { useSorteos, sorteosVisibles, estadoSorteo, patrocinadores, nombrePublico, type Sorteo } from '@/composables/useSorteos';

const MAX_LOGOS = 8;

const router = useRouter();
const { banners } = useBannersActivos();
const { sorteos: todosLosSorteos } = useSorteos();
/** Los sorteos van primero en el carrusel */
const sorteos = computed(() => sorteosVisibles(todosLosSorteos.value));
const logosDe = (s: Sorteo) => patrocinadores(s);
const total = computed(() => sorteos.value.length + banners.value.length);

const scroll = ref<HTMLDivElement | null>(null);
const activo = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function abrir(b: Banner) {
  if (!b.enlace) return;
  if (/^https?:\/\//i.test(b.enlace)) window.open(b.enlace, '_blank', 'noopener');
  else router.push(b.enlace);
}

/** Al tocar el sorteo se abre el diálogo para escribir el código */
function abrirSorteo(s: Sorteo) {
  void abrirDialogoSorteo(s, { irALogin: () => router.push({ path: '/login', query: { redirect: '/' } }) });
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}

function irA(i: number) {
  const cont = scroll.value;
  if (!cont) return;
  const slide = cont.children[i] as HTMLElement | undefined;
  if (slide) cont.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
}

function onScroll() {
  const cont = scroll.value;
  if (!cont) return;
  activo.value = Math.round(cont.scrollLeft / cont.clientWidth);
}

function avanzar() {
  if (total.value < 2) return;
  irA((activo.value + 1) % total.value);
}

function iniciarAuto() {
  detenerAuto();
  if (total.value > 1) timer = setInterval(avanzar, 5000);
}
function detenerAuto() {
  if (timer) clearInterval(timer);
  timer = null;
}

// Reinicia el auto-avance cuando cambia la cantidad de diapositivas
watch(total, iniciarAuto);
onMounted(iniciarAuto);
onUnmounted(detenerAuto);
</script>

<style scoped>
.banners {
  margin: 0.5rem 0 0.25rem;
}
.banners-scroll {
  display: flex;
  align-items: flex-start;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 0;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.banners-scroll::-webkit-scrollbar {
  display: none;
}
.banner {
  position: relative;
  flex: 0 0 100%;
  scroll-snap-align: start;
  border: none;
  padding: 0;
  background: transparent;
  cursor: default;
  display: block;
}
.banner.clickeable {
  cursor: pointer;
}
.banner-img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
  border-radius: 14px;
}
.banner-texto {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 16px;
  text-align: left;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
  border-radius: 0 0 14px 14px;
}
.banner-texto strong {
  display: block;
  font-size: 1.05rem;
  line-height: 1.2;
}
.banner-texto span {
  font-size: 0.85rem;
  opacity: 0.95;
}

/* ---- Diapositiva del sorteo: imagen completa arriba, panel con el texto abajo ---- */
.banner.sorteo {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
}
.banner.sorteo .banner-img {
  height: 170px;
  border-radius: 0;
}
.sorteo-fondo {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f59e0b 100%);
}
.sorteo-fondo span {
  font-size: 4.2rem;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}
.sorteo-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 14px 12px;
}
.sorteo-panel .etiqueta {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand-blue-soft);
  color: var(--brand-blue-text);
}
.sorteo-titulo {
  font-size: 1.05rem;
  line-height: 1.2;
  color: var(--text);
}
.sorteo-panel .premio {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
}
.sorteo-panel .cta {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--brand-blue-text);
}
.sorteo-panel .ganador {
  font-size: 0.88rem;
  color: var(--text);
}
.sorteo-panel .ganador b {
  color: var(--brand-blue-text);
}
.sorteo-logos {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  max-width: 100%;
  overflow: hidden;
}
.mini-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  border: 1.5px solid var(--border);
  flex: none;
}
.sorteo-logos .mas {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
}

.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--border);
  cursor: pointer;
}
.dot.on {
  background: var(--color-bg-blue-dark, #0165d8);
  width: 20px;
  border-radius: 4px;
}
@media (min-width: 900px) {
  .banner-img {
    height: 240px;
  }
  .banner.sorteo .banner-img {
    height: 230px;
  }
}
</style>
