<template>
  <span class="visor">
    <!-- UN SOLO nodo raíz, y el comentario va DENTRO: con dos nodos arriba
         (aunque uno sea un comentario) Vue trata al componente como fragmento,
         no le pasa el data-v- del padre y sus reglas scoped dejan de aplicar
         sin avisar. Misma razón que en BotonCompartir.vue. -->
    <button
      type="button"
      class="visor-abrir"
      :title="ETIQUETA"
      :aria-label="ETIQUETA"
      @click.stop="abrir"
    >
      <Expand :size="16" />
      <span v-if="mostrarTexto" class="visor-abrir__texto">{{ ETIQUETA }}</span>
    </button>

    <!-- El visor se monta en <body>: el contenedor de la imagen tiene
         overflow:hidden y lo recortaría a su marco -->
    <Teleport to="body">
      <transition name="visor-fade">
        <div
          v-if="abierto"
          class="visor-fondo"
          role="dialog"
          aria-modal="true"
          :aria-label="ETIQUETA"
          @click.self="cerrar"
        >
          <button type="button" class="visor-cerrar" aria-label="Cerrar" @click="cerrar">
            <X :size="22" />
          </button>

          <img :src="src" :alt="alt" class="visor-img" @click.stop />

          <p v-if="alt" class="visor-pie">{{ alt }}</p>
        </div>
      </transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
/**
 * Ver una imagen completa, sin el recorte de su miniatura.
 *
 * En el catálogo las fotos se muestran con `object-fit: cover` para que llenen
 * su marco, y eso recorta los bordes. Este botón abre la foto entera sobre un
 * fondo oscuro (`contain`), que es como la enseñan las tiendas en línea: la
 * portada se ve pareja y quien quiera el detalle lo pide.
 *
 * Se cierra con la ✕, tocando fuera de la foto o con Escape, y mientras está
 * abierto se bloquea el desplazamiento del fondo.
 */
import { ref, onUnmounted, watch } from 'vue';
import { Expand, X } from 'lucide-vue-next';

const ETIQUETA = 'Ver imagen completa';

withDefaults(
  defineProps<{
    /** Imagen a mostrar en grande */
    src: string;
    /** Texto alternativo; también se usa como pie */
    alt?: string;
    /** Mostrar la leyenda junto al icono */
    mostrarTexto?: boolean;
  }>(),
  { alt: '', mostrarTexto: true },
);

const abierto = ref(false);

function abrir() {
  abierto.value = true;
}
function cerrar() {
  abierto.value = false;
}

function alPulsarTecla(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrar();
}

/** Mientras el visor está abierto, el fondo no se desplaza ni escucha Escape de más */
watch(abierto, (visible) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = visible ? 'hidden' : '';
  if (visible) document.addEventListener('keydown', alPulsarTecla);
  else document.removeEventListener('keydown', alPulsarTecla);
});

// Si la pantalla se desmonta con el visor abierto, el body debe quedar usable
onUnmounted(() => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', alPulsarTecla);
});
</script>

<style scoped>
/* ---------- Botón sobre la imagen ---------- */
.visor-abrir {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  border: none;
  border-radius: 999px;
  /* Píldora sobre foto: el par oscuro translúcido + texto claro se lee igual en
     tema claro y oscuro, como los badges de estado */
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: background 0.2s;
}
.visor-abrir:hover {
  background: rgba(0, 0, 0, 0.72);
}
.visor-abrir__texto {
  white-space: nowrap;
}

/* ---------- Visor ---------- */
.visor-fondo {
  position: fixed;
  inset: 0;
  z-index: 4000; /* por encima de las cabeceras fijas (1000) y del pull to refresh (3000) */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.92);
}
.visor-img {
  max-width: 100%;
  /* deja aire para la ✕ de arriba y el pie de abajo */
  max-height: calc(100vh - 8rem);
  object-fit: contain; /* aquí sí: la foto completa es el punto de la pantalla */
  border-radius: 8px;
}
.visor-pie {
  margin: 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  text-align: center;
  max-width: 40rem;
}
.visor-cerrar {
  position: absolute;
  top: max(1rem, env(safe-area-inset-top));
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.visor-cerrar:hover {
  background: rgba(255, 255, 255, 0.28);
}

.visor-fade-enter-active,
.visor-fade-leave-active {
  transition: opacity 0.2s ease;
}
.visor-fade-enter-from,
.visor-fade-leave-to {
  opacity: 0;
}
</style>
