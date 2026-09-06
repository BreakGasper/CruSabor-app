<template>
  <div
    class="star-rating"
    :class="{ editable, chica: size === 'sm' }"
    :title="titulo"
    role="img"
    :aria-label="titulo"
  >
    <span class="estrellas" @mouseleave="hover = 0">
      <button
        v-for="n in ESTRELLAS_MAX"
        :key="n"
        type="button"
        class="estrella"
        :class="{ llena: relleno(n) >= 1, media: relleno(n) > 0 && relleno(n) < 1, mia: editable && miVoto >= n && !hover }"
        :style="{ '--relleno': relleno(n) }"
        :disabled="!editable"
        :aria-label="editable ? `Calificar con ${n} ${n === 1 ? 'estrella' : 'estrellas'}` : undefined"
        @mouseenter="editable && (hover = n)"
        @click.stop="editable && $emit('rate', n)"
      >
        <span class="fondo">★</span>
        <span class="frente">★</span>
      </button>
    </span>
    <span v-if="mostrarNumero" class="valor">{{ promedio > 0 ? promedio.toFixed(1) : '—' }}</span>
    <span v-if="mostrarTotal" class="total">({{ total }})</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Estrellas de calificación. Muestra el promedio con medias estrellas y, si es
 * `editable`, deja al cliente votar (emite `rate` con 1..5). El voto propio se
 * resalta con un borde.
 */
import { ref, computed } from 'vue';
import { ESTRELLAS_MAX } from '@/composables/useCalificaciones';

const props = withDefaults(
  defineProps<{
    promedio: number;
    total?: number;
    miVoto?: number;
    editable?: boolean;
    mostrarNumero?: boolean;
    mostrarTotal?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { total: 0, miVoto: 0, editable: false, mostrarNumero: true, mostrarTotal: true, size: 'md' },
);
defineEmits<{ (e: 'rate', estrellas: number): void }>();

const hover = ref(0);

/** Cuánto se llena la estrella n: 1 llena, 0.5 media, 0 vacía (o la previsualización al pasar el mouse) */
function relleno(n: number): number {
  if (hover.value) return n <= hover.value ? 1 : 0;
  const v = props.promedio;
  if (v >= n) return 1;
  if (v >= n - 0.75) return 0.5;
  return 0;
}

const titulo = computed(() => {
  if (!props.total) return props.editable ? 'Sé el primero en calificar' : 'Sin calificaciones';
  const base = `${props.promedio.toFixed(1)} de ${ESTRELLAS_MAX} · ${props.total} ${props.total === 1 ? 'calificación' : 'calificaciones'}`;
  return props.miVoto ? `${base} · tu voto: ${props.miVoto}` : base;
});
</script>

<style scoped>
.star-rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1;
}
.estrellas {
  display: inline-flex;
  gap: 1px;
}
.estrella {
  position: relative;
  padding: 0;
  margin: 0;
  border: 0;
  background: none;
  width: 1.15em;
  height: 1.15em;
  font-size: 1.15rem;
  line-height: 1;
  cursor: default;
  color: var(--border);
  border-radius: 4px;
}
.chica .estrella {
  font-size: 0.95rem;
  width: 1em;
  height: 1em;
}
.estrella .fondo,
.estrella .frente {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.estrella .frente {
  color: #f5b301;
  clip-path: inset(0 calc((1 - var(--relleno, 0)) * 100%) 0 0);
}
.estrella.mia {
  outline: 1px solid #f5b301;
}
.editable .estrella {
  cursor: pointer;
  transition: transform 0.1s;
}
.editable .estrella:hover {
  transform: scale(1.15);
}
.valor {
  font-weight: 600;
  color: var(--text);
}
.total {
  font-size: 0.75rem;
}
</style>
