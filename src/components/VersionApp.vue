<template>
  <p class="version-app" data-testid="version-app" :title="`Versión ${id}`">Versión {{ corta }}</p>
</template>

<script setup lang="ts">
/** Versión de la app que está corriendo (la del commit publicado): sirve para comprobar que el teléfono trae lo último */
import { BUILD_ID } from '@/utils/actualizacion';

const id = BUILD_ID;
const corta = id.length > 10 ? id.slice(-7) : id.slice(0, 7);
</script>

<style scoped>
.version-app { margin: 14px 0 6px; text-align: center; font-size: 0.72rem; color: var(--text-muted); opacity: 0.8; }
</style>
