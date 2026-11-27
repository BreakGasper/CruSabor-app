<template>
  <div id="app-layout">
    <MantenimientoAviso
      v-if="mantenimientoActivo"
      :mensaje="configuracion.mantenimiento.mensaje"
      :contacto="contactoSoporte"
    />
    <!-- Deslizar hacia abajo (en cualquier pantalla del móvil) recarga la página, como un F5 -->
    <PullToRefresh v-else :refrescando="refrescando" @refresh="refrescarVista">
      <router-view />
    </PullToRefresh>
  </div>

  <!-- Temática de temporada (Admin › Apariencia) -->
  <TematicaDecoracion v-if="tematicaVisible" :piezas="tematicaVisible.piezas" />

  <VolverAdmin />

  <!-- Versión nueva publicada y hay un formulario a medias: se avisa en vez de recargar sola -->
  <AvisoActualizacion v-if="hayVersionNueva" @actualizar="actualizarAhora" @cerrar="hayVersionNueva = false" />

  <Toast position="bottom-center" />

  <!-- Logo animado si algo que pidió el usuario tarda (services/carga.ts) -->
  <CargandoCrustore />
</template>
<script setup lang="ts">
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import PullToRefresh from "@/components/PullToRefresh.vue";
import AvisoActualizacion from "@/components/AvisoActualizacion.vue";
import { recargarConLoNuevo, vigilarVersion } from "@/utils/actualizacion";
import { cargarSesion } from "@/utils/sessionUser";
import { iniciarSincronizacion } from "@/db/sync";
import { useConfiguracion, enMantenimientoPara } from "@/composables/useConfiguracion";
import MantenimientoAviso from "@/components/MantenimientoAviso.vue";
import CargandoCrustore from "@/components/CargandoCrustore.vue";
import VolverAdmin from "@/components/VolverAdmin.vue";
import { aplicarPaleta } from "@/composables/usePaleta";
import { tematicaEnCurso, pantallaDeRuta, cargarIconosDe, hoyISO } from "@/composables/useTematicas";
import TematicaDecoracion from "@/components/TematicaDecoracion.vue";
cargarSesion();
// Carrito, favoritos y tiendas favoritas se respaldan en Firebase por usuario
iniciarSincronizacion();
// Configuración del sistema (membresías, mantenimiento, registro) en vivo
const { configuracion, cargada, contactoSoporte } = useConfiguracion();
const route = useRoute();

// Temática en curso (activa y dentro de sus fechas); se ve solo en las pantallas que eligió el admin
const tematica = computed(() => (cargada.value ? tematicaEnCurso(configuracion.value.apariencia.tematicas, hoyISO()) : null));
const tematicaVisible = computed(() => {
  const t = tematica.value?.[1];
  const pantalla = pantallaDeRuta(route.path);
  return t && pantalla && t.pantallas.includes(pantalla) ? t : null;
});
// Los iconos subidos desde el admin se descargan solo cuando la temática en curso los usa
watch(
  () => tematica.value?.[1].piezas,
  (piezas) => {
    if (piezas) cargarIconosDe(piezas);
  },
  { immediate: true },
);

// Paleta de colores elegida por el admin (o la de la temática en curso, si trae una).
// Hasta que llega de Firebase se queda la que index.html puso desde localStorage.
watch(
  () => {
    if (!cargada.value) return null;
    const a = configuracion.value.apariencia;
    return { id: tematica.value?.[1].paleta || a.paleta, personalizadas: a.personalizadas };
  },
  (p) => {
    if (p) aplicarPaleta(p.id, p.personalizadas);
  },
  { immediate: true, deep: true },
);
const mantenimientoActivo = computed(() => enMantenimientoPara(configuracion.value, route.path));

/* Pull to refresh: es un F5 de verdad (recarga la página). La sesión y el carrito están guardados en el
 * navegador, así que no se pierden. Las pantallas con un formulario a medias se marcan con
 * `data-sin-recarga` y el gesto no empieza en ellas. */
const refrescando = ref(false);
function refrescarVista() {
  if (refrescando.value) return;
  refrescando.value = true; // el indicador gira mientras el navegador recarga
  // Primero se vuelve a pedir el HTML sin usar la copia guardada (en la app instalada del iPhone, la recarga
  // sola se quedaba con la versión vieja) y luego se recarga: así trae lo último publicado.
  void recargarConLoNuevo();
}

/* Versión nueva publicada: se detecta al abrir, al volver a la app y al reconectarse (/version.json) */
const hayVersionNueva = ref(false);
function actualizarAhora() {
  refrescando.value = true;
  void recargarConLoNuevo();
}
let dejarDeVigilar: (() => void) | null = null;
onMounted(() => {
  dejarDeVigilar = vigilarVersion({ alHaberNueva: () => (hayVersionNueva.value = true) });
});
onBeforeUnmount(() => dejarDeVigilar?.());
const toast = useToast();
</script>

<style>

html, body {
  height: 100%;
  margin: 0;
}

#app-layout {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
/* Estilos globales de toast */
/* Quita la línea blanca y centra el contenido */
.p-toast-success {
  background-color: #4caf50 !important; /* verde */
  color: white !important;
  border: none !important; /* quita cualquier borde predeterminado */
  border-radius: 12px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  display: flex !important; /* para centrar contenido */
  align-items: center !important; /* centra verticalmente */
  justify-content: center !important; /* centra horizontalmente */
  padding: 1rem 1.5rem !important; /* ajusta espacio interno */
  font-size: 1rem !important;
  line-height: 1.3 !important;
}

/* Quitar cualquier borde interno del ícono de éxito */
.p-toast-icon {
  margin-right: 0.5rem !important; /* o 0 si quieres que quede pegado al texto */
}
</style>
