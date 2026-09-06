<template>
  <div id="app-layout">
    <MantenimientoAviso
      v-if="mantenimientoActivo"
      :mensaje="configuracion.mantenimiento.mensaje"
      :contacto="contactoSoporte"
    />
    <router-view v-else />
  </div>

  <Toast position="bottom-center" />
</template>
<script setup lang="ts">
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { cargarSesion } from "@/utils/sessionUser";
import { iniciarSincronizacion } from "@/db/sync";
import { useConfiguracion, enMantenimientoPara } from "@/composables/useConfiguracion";
import MantenimientoAviso from "@/components/MantenimientoAviso.vue";
cargarSesion();
// Carrito, favoritos y tiendas favoritas se respaldan en Firebase por usuario
iniciarSincronizacion();
// Configuración del sistema (membresías, mantenimiento, registro) en vivo
const { configuracion, contactoSoporte } = useConfiguracion();
const route = useRoute();
const mantenimientoActivo = computed(() => enMantenimientoPara(configuracion.value, route.path));
const toast = useToast();
</script>

<style>

html, body {
  height: 100%;
  margin: 0;
}

#app-layout {
  min-height: 100vh;
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
