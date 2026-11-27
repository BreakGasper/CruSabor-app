<template>
  <section class="aviso" role="note" :aria-label="titulo">
    <header class="aviso-cabeza">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="aviso-escudo">
        <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M8.5 12.2l2.4 2.4 4.6-4.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <strong>{{ titulo }}</strong>
    </header>
    <ul class="aviso-lista">
      <li v-for="a in avisos" :key="a.id" :data-testid="`aviso-${a.id}`">
        <strong>{{ a.titulo }}.</strong> {{ a.texto }}
      </li>
    </ul>
    <p v-if="conEnlaces" class="aviso-enlaces">
      <a :href="URL_TERMINOS" target="_blank" rel="noopener">Términos y condiciones</a> ·
      <a :href="URL_PRIVACIDAD" target="_blank" rel="noopener">Aviso de privacidad</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import { URL_PRIVACIDAD, URL_TERMINOS, type Aviso } from '@/legal/avisos';

withDefaults(defineProps<{ avisos: Aviso[]; titulo?: string; conEnlaces?: boolean }>(), {
  titulo: 'Tu protección al comprar',
  conEnlaces: true,
});
</script>

<style scoped>
.aviso {
  margin: 14px 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-bg-blue-ligth);
  background: var(--brand-blue-soft);
  color: var(--text);
  font-size: 0.86rem;
  line-height: 1.45;
  text-align: left;
}
.aviso-cabeza { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: var(--brand-blue-text); }
.aviso-escudo { width: 20px; height: 20px; flex: none; }
.aviso-lista { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.aviso-lista strong { color: var(--text); }
.aviso-enlaces { margin: 8px 0 0; font-size: 0.8rem; color: var(--text-muted); }
.aviso-enlaces a { color: var(--brand-blue-text); font-weight: 600; }
</style>
