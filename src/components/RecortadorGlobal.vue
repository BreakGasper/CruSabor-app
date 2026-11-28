<template>
  <RecortadorImagen
    :archivo="peticionRecorte?.archivo ?? null"
    :aspecto-inicial="peticionRecorte?.aspecto"
    @listo="resolverRecorte($event)"
    @sin-cambios="resolverRecorte(peticionRecorte?.archivo ?? null)"
    @cancelar="resolverRecorte(null)"
  />
</template>

<script setup lang="ts">
import RecortadorImagen from '@/components/RecortadorImagen.vue';
import { peticionRecorte, resolverRecorte } from '@/utils/recortarFoto';
</script>
