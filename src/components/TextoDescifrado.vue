<template>
  <span class="descifrado" :class="{ animando }" :aria-label="texto" data-testid="texto-descifrado">
    <span aria-hidden="true">{{ visible }}</span>
  </span>
</template>

<script setup lang="ts">
// El lector de pantalla recibe el texto final (aria-label); el barajado es solo visual.
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { crearPlanScramble, fotogramaScramble, prefiereMenosMovimiento } from '@/utils/textScramble';

const props = withDefaults(defineProps<{ texto: string; activo?: boolean; duracionMs?: number }>(), { activo: true, duracionMs: 1700 });

/** Si el efecto va a correr, el primer cuadro ya sale barajado (sin un destello del texto final) */
function inicial(): string {
  if (!props.activo || !props.texto || prefiereMenosMovimiento()) return props.texto;
  return fotogramaScramble(crearPlanScramble(props.texto), 0);
}
const visible = ref(inicial());
const animando = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

function detener() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Corre el efecto de principio a fin. Se puede volver a llamar para repetirlo. */
function correr() {
  detener();
  if (!props.texto || prefiereMenosMovimiento()) {
    visible.value = props.texto;
    animando.value = false;
    return;
  }
  const PASO_MS = 33;
  const plan = crearPlanScramble(props.texto, Math.random, Math.max(8, Math.round(props.duracionMs / PASO_MS)));
  let f = 0;
  animando.value = true;
  visible.value = fotogramaScramble(plan, 0);
  timer = setInterval(() => {
    f++;
    visible.value = fotogramaScramble(plan, f);
    if (f >= plan.fotogramas) {
      detener();
      visible.value = props.texto;
      animando.value = false;
    }
  }, PASO_MS);
}

onMounted(() => {
  if (props.activo) correr();
});
// Se repite cuando cambia el texto, o cuando vuelve a quedar a la vista (p. ej. al llegar a su diapositiva)
watch(() => props.texto, () => props.activo && correr());
watch(() => props.activo, (a) => {
  if (a) correr();
});
onUnmounted(detener);
</script>

<style scoped>
.descifrado { white-space: pre-wrap; }
.descifrado.animando {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.04em;
}
</style>
