<template>
  <button v-if="visible" type="button" class="volver-admin" @click="volver">🛡️ Volver a Admin</button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sessionAdmin } from '@/utils/sessionAdmin';
import { volverAAdmin } from '@/composables/cambioPerfil';
import { RUTA_ADMIN_HOME } from '@/modules/admin/adminRoutes';

const route = useRoute();
const router = useRouter();
const visible = computed(() => !!sessionAdmin.value && !route.path.startsWith('/admin'));

function volver() {
  volverAAdmin();
  router.push(RUTA_ADMIN_HOME);
}
</script>

<style scoped>
.volver-admin {
  position: fixed;
  left: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 900; /* debajo de las cabeceras fijas (1000) y de los diálogos */
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid #10b981;
  background: #111827;
  color: #fff;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}
</style>
