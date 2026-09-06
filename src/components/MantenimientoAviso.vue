<template>
  <div class="mant-container" role="alert">
    <div class="mant-card">
      <div class="mant-emblem" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-2.6 2.4-2.4z" />
        </svg>
      </div>
      <h1>MAVI en mantenimiento</h1>
      <p class="mensaje">{{ mensaje }}</p>
      <p v-if="contacto" class="contacto">¿Necesitas ayuda? {{ contacto }}</p>
      <button type="button" class="btn-reintentar" @click="reload">Reintentar</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ mensaje: string; contacto?: string }>();
const reload = () => window.location.reload();
</script>

<style scoped>
.mant-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: #0f1c2e;
  background-image:
    radial-gradient(circle at 15% 10%, rgba(1, 101, 216, 0.25), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(245, 158, 11, 0.18), transparent 50%);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  box-sizing: border-box;
}
.mant-card {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border-radius: 22px;
  padding: 2.25rem 1.75rem;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}
.mant-emblem {
  width: 72px;
  height: 72px;
  margin: 0 auto 1rem;
  border-radius: 20px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.mant-emblem svg {
  width: 38px;
  height: 38px;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--text);
}
.mensaje {
  margin: 0.6rem 0 0;
  color: var(--text);
  line-height: 1.45;
}
.contacto {
  margin: 0.8rem 0 0;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.btn-reintentar {
  margin-top: 1.4rem;
  padding: 12px 28px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #0165d8, #011f41);
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
}
</style>
