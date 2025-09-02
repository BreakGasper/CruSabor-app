<template>
  <button class="arrow-back" @click="$emit('click')">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>
</template>

<script setup lang="ts">
// No necesitas props por ahora; solo emite click
defineEmits(["click"]);
</script>

<style scoped>
.arrow-back {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative; /* se puede usar absolute donde lo llames */
  background: white;
  color: black;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.arrow-back svg {
  width: 60%; /* escala de la flecha dentro del botón */
  height: 60%;
  display: block;
}
</style>
