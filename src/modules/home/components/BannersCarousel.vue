<template>
  <!-- No ocupa espacio si no hay banners activos -->
  <section v-if="banners.length" class="banners" aria-label="Promociones">
    <div ref="scroll" class="banners-scroll" @scroll="onScroll">
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

    <div v-if="banners.length > 1" class="dots">
      <button
        v-for="(b, i) in banners"
        :key="b.id"
        type="button"
        class="dot"
        :class="{ on: i === activo }"
        :aria-label="`Ir al banner ${i + 1}`"
        @click="irA(i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useBannersActivos, type Banner } from '@/composables/useBanners';

const router = useRouter();
const { banners } = useBannersActivos();

const scroll = ref<HTMLDivElement | null>(null);
const activo = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function abrir(b: Banner) {
  if (!b.enlace) return;
  if (/^https?:\/\//i.test(b.enlace)) window.open(b.enlace, '_blank', 'noopener');
  else router.push(b.enlace);
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
  if (banners.value.length < 2) return;
  irA((activo.value + 1) % banners.value.length);
}

function iniciarAuto() {
  detenerAuto();
  if (banners.value.length > 1) timer = setInterval(avanzar, 5000);
}
function detenerAuto() {
  if (timer) clearInterval(timer);
  timer = null;
}

// Reinicia el auto-avance cuando cambia la cantidad de banners
watch(() => banners.value.length, iniciarAuto);
onMounted(iniciarAuto);
onUnmounted(detenerAuto);
</script>

<style scoped>
.banners {
  margin: 0.5rem 0 0.25rem;
}
.banners-scroll {
  display: flex;
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
}
</style>
