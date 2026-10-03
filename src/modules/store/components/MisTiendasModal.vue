<template>
  <Teleport to="body">
    <div v-if="visible" class="mt-overlay" @click.self="$emit('cerrar')" @keydown.escape="$emit('cerrar')">
      <div class="mt-panel" role="dialog" aria-modal="true" aria-labelledby="mt-titulo">
        <header class="mt-head">
          <h2 id="mt-titulo">Mis tiendas</h2>
          <button type="button" class="mt-cerrar" aria-label="Cerrar" @click="$emit('cerrar')">✕</button>
        </header>
        <p class="mt-hint">
          Con tu celular puedes administrar hasta {{ MAX_TIENDAS_POR_TELEFONO }} tiendas, con la misma contraseña.
        </p>

        <ul class="mt-lista">
          <li v-for="t in cuenta" :key="t.id">
            <button
              type="button"
              class="mt-tienda"
              :class="{ actual: t.id === actualId }"
              :disabled="t.id === actualId || cambiando !== null"
              :data-testid="`cambiar-${t.id}`"
              @click="cambiar(t.id)"
            >
              <img v-if="t.logoUrl" :src="t.logoUrl" alt="" class="mt-logo" />
              <span v-else class="mt-logo vacio" aria-hidden="true">{{ t.nombreTienda.charAt(0) }}</span>
              <span class="mt-nombre">{{ t.nombreTienda }}</span>
              <span v-if="t.id === actualId" class="mt-badge">Abierta</span>
              <span v-else-if="cambiando === t.id" class="mt-badge">Abriendo…</span>
              <span v-else aria-hidden="true">›</span>
            </button>
          </li>
        </ul>

        <p v-if="error" class="mt-error" role="alert">{{ error }}</p>

        <button
          v-if="cuenta.length < MAX_TIENDAS_POR_TELEFONO"
          type="button"
          class="mt-agregar"
          data-testid="agregar-tienda"
          @click="agregar"
        >
          + Agregar otra tienda
          <small>({{ cuenta.length }} de {{ MAX_TIENDAS_POR_TELEFONO }})</small>
        </button>
        <p v-else class="mt-hint">Ya tienes el máximo de {{ MAX_TIENDAS_POR_TELEFONO }} tiendas con este número.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { cambiarTiendaActiva, MAX_TIENDAS_POR_TELEFONO, type TiendaEnCuenta } from '@/composables/cuentaTienda';

defineProps<{ visible: boolean; cuenta: TiendaEnCuenta[]; actualId: string }>();
const emit = defineEmits<{ cerrar: []; cambiada: [id: string] }>();

const router = useRouter();
const cambiando = ref<string | null>(null);
const error = ref('');

async function cambiar(id: string) {
  error.value = '';
  cambiando.value = id;
  try {
    await cambiarTiendaActiva(id);
    emit('cambiada', id);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo abrir esa tienda.';
  } finally {
    cambiando.value = null;
  }
}

function agregar() {
  emit('cerrar');
  router.push('/store/register');
}
</script>

<style scoped>
.mt-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.mt-panel {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  color: var(--text);
  border-radius: 18px 18px 0 0;
  padding: 16px 16px calc(18px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  font-family: inherit;
}
@media (min-width: 600px) {
  .mt-overlay {
    align-items: center;
  }
  .mt-panel {
    border-radius: 18px;
  }
}
.mt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mt-head h2 {
  margin: 0;
  font-size: 1.1rem;
}
.mt-cerrar {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
}
.mt-hint {
  margin: 4px 0 12px;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.mt-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mt-tienda {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.mt-tienda:hover:not(:disabled) {
  border-color: var(--brand-blue-text);
  background: var(--brand-blue-soft);
}
.mt-tienda.actual {
  border: 2px solid var(--brand-blue-text);
  background: var(--brand-blue-soft);
  cursor: default;
}
.mt-tienda:disabled:not(.actual) {
  opacity: 0.6;
}
.mt-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}
.mt-logo.vacio {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-blue-ligth);
  color: var(--on-primary);
  font-weight: 700;
}
.mt-nombre {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mt-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand-blue-soft);
  color: var(--brand-blue-text);
}
.mt-error {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: #b91c1c;
}
.mt-agregar {
  margin-top: 12px;
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: 2px dashed var(--brand-blue-text);
  background: transparent;
  color: var(--brand-blue-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.mt-agregar small {
  font-weight: 500;
  opacity: 0.8;
}
</style>
