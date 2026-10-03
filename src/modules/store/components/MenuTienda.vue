<template>
  <!--
    Menú del perfil de tienda: panel que se desliza desde la izquierda, con fondo
    oscurecido. Renglones de ícono + texto por secciones y scroll propio, para que
    quepa todo en cualquier pantalla. La dueña o dueño ve además "Mis tiendas":
    cambiar entre las tiendas de su celular y agregar otra (cuentaTienda.ts).
  -->
  <Teleport to="body">
    <Transition name="menu-tienda">
      <div v-if="abierto" class="mt-overlay" @click.self="$emit('cerrar')" @keydown.escape="$emit('cerrar')">
        <aside class="mt-panel" role="dialog" aria-modal="true" aria-label="Menú de la tienda">
          <header class="mt-head">
            <img v-if="logoUrl" :src="logoUrl" alt="" class="mt-logo" />
            <span v-else class="mt-logo vacio" aria-hidden="true">{{ inicial(nombreTienda) }}</span>
            <div class="mt-head-texto">
              <strong>{{ nombreTienda || 'Tienda' }}</strong>
              <small>{{ esDueno ? 'Tu tienda' : 'Menú' }}</small>
            </div>
            <button type="button" class="mt-cerrar" aria-label="Cerrar menú" @click="$emit('cerrar')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <nav class="mt-cuerpo">
            <!-- Dueña o dueño -->
            <template v-if="esDueno">
              <p class="mt-seccion">Mi tienda</p>
              <button v-for="o in opcionesDueno" :key="o.accion" type="button" class="mt-opcion" @click="$emit('accion', o.accion)">
                <span class="mt-icono" aria-hidden="true">{{ o.icono }}</span>
                <span>{{ o.texto }}</span>
              </button>

              <p class="mt-seccion">Mis tiendas</p>
              <button
                v-for="t in cuenta"
                :key="t.id"
                type="button"
                class="mt-opcion mt-tienda"
                :class="{ actual: t.id === actualId }"
                :disabled="t.id === actualId || cambiando !== null"
                :data-testid="`cambiar-${t.id}`"
                @click="cambiar(t.id)"
              >
                <img v-if="t.logoUrl" :src="t.logoUrl" alt="" class="mt-mini-logo" />
                <span v-else class="mt-mini-logo vacio" aria-hidden="true">{{ inicial(t.nombreTienda) }}</span>
                <span class="mt-nombre">{{ t.nombreTienda }}</span>
                <span v-if="t.id === actualId" class="mt-badge">Abierta</span>
                <span v-else-if="cambiando === t.id" class="mt-badge">Abriendo…</span>
                <span v-else class="mt-flecha" aria-hidden="true">›</span>
              </button>
              <p v-if="error" class="mt-error" role="alert">{{ error }}</p>
              <button
                v-if="cuenta.length < MAX_TIENDAS_POR_TELEFONO"
                type="button"
                class="mt-agregar"
                data-testid="agregar-tienda"
                @click="agregarTienda"
              >
                <span aria-hidden="true">＋</span>
                Agregar otra tienda
                <small>{{ cuenta.length }} de {{ MAX_TIENDAS_POR_TELEFONO }}</small>
              </button>
              <p v-else class="mt-nota">Ya tienes el máximo de {{ MAX_TIENDAS_POR_TELEFONO }} tiendas con tu número.</p>
            </template>

            <!-- Visitante -->
            <template v-else>
              <button type="button" class="mt-opcion" @click="$emit('accion', 'productos')">
                <span class="mt-icono" aria-hidden="true">📋</span><span>Productos</span>
              </button>
              <button type="button" class="mt-opcion" @click="$emit('accion', 'carrito')">
                <span class="mt-icono" aria-hidden="true">🛒</span><span>Mi carrito</span>
                <span v-if="totalEnCarrito > 0" class="mt-contador">{{ totalEnCarrito }}</span>
              </button>
              <p class="mt-seccion">Contacto</p>
              <button type="button" class="mt-opcion" @click="$emit('accion', 'mapa')">
                <span class="mt-icono" aria-hidden="true">📍</span><span>Cómo llegar</span>
              </button>
              <button type="button" class="mt-opcion" @click="$emit('accion', 'llamar')">
                <span class="mt-icono" aria-hidden="true">📞</span><span>Llamar</span>
              </button>
            </template>
          </nav>

          <footer v-if="esDueno" class="mt-pie">
            <button type="button" class="mt-opcion mt-salir" @click="$emit('accion', 'cerrar-sesion')">
              <span class="mt-icono" aria-hidden="true">🚪</span><span>Cerrar sesión</span>
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { cambiarTiendaActiva, MAX_TIENDAS_POR_TELEFONO, type TiendaEnCuenta } from '@/composables/cuentaTienda';

export type AccionMenuTienda =
  | 'editar'
  | 'pedidos'
  | 'agregar-articulo'
  | 'promociones'
  | 'productos'
  | 'carrito'
  | 'mapa'
  | 'llamar'
  | 'cerrar-sesion';

const props = defineProps<{
  abierto: boolean;
  esDueno: boolean;
  nombreTienda?: string;
  logoUrl?: string;
  promocionesHabilitadas?: boolean;
  totalEnCarrito?: number;
  /** Tiendas del mismo celular (sesión) */
  cuenta?: TiendaEnCuenta[];
  actualId?: string;
}>();
const emit = defineEmits<{ cerrar: []; accion: [accion: AccionMenuTienda]; cambiada: [id: string] }>();

const router = useRouter();
const cuenta = computed(() => props.cuenta ?? []);
const totalEnCarrito = computed(() => props.totalEnCarrito ?? 0);

const opcionesDueno = computed(() => {
  const lista: Array<{ accion: AccionMenuTienda; icono: string; texto: string }> = [
    { accion: 'editar', icono: '✏️', texto: 'Editar mi tienda' },
    { accion: 'pedidos', icono: '🚚', texto: 'Pedidos' },
    { accion: 'agregar-articulo', icono: '➕', texto: 'Agregar artículo' },
    { accion: 'productos', icono: '📋', texto: 'Mis productos' },
  ];
  if (props.promocionesHabilitadas) lista.splice(3, 0, { accion: 'promociones', icono: '🏷️', texto: 'Crear promoción' });
  return lista;
});

const inicial = (n?: string) => (n || '?').trim().charAt(0).toUpperCase();

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

function agregarTienda() {
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
}
.mt-panel {
  width: min(320px, 86vw);
  height: 100%;
  background: var(--surface);
  color: var(--text);
  display: flex;
  flex-direction: column;
  box-shadow: 8px 0 30px rgba(0, 0, 0, 0.25);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}
.mt-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-blue-dark);
  color: #fff;
}
.mt-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  background: #fff;
  flex-shrink: 0;
}
.mt-head-texto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.mt-head-texto strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mt-head-texto small {
  opacity: 0.75;
  font-size: 0.75rem;
}
.mt-cerrar {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  width: 34px;
  height: 34px;
  padding: 0; /* sin esto hereda el padding global de button y la X queda chueca */
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.mt-cerrar svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  fill: none;
}
.mt-cuerpo {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 12px;
}
.mt-seccion {
  margin: 14px 8px 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.mt-opcion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.mt-opcion:hover:not(:disabled) {
  background: var(--surface-2);
}
.mt-icono {
  width: 28px;
  text-align: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.mt-contador {
  margin-left: auto;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-bg-blue-ligth);
  color: var(--on-primary);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
}
.mt-tienda.actual {
  background: var(--brand-blue-soft);
  cursor: default;
}
.mt-mini-logo {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  object-fit: cover;
  flex-shrink: 0;
}
.vacio {
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
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--brand-blue-text);
}
.mt-flecha {
  color: var(--text-muted);
  font-size: 1.2rem;
}
.mt-agregar {
  margin: 6px 0 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 2px dashed var(--brand-blue-text);
  background: transparent;
  color: var(--brand-blue-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.mt-agregar small {
  margin-left: auto;
  font-weight: 500;
  opacity: 0.8;
}
.mt-nota {
  margin: 6px 8px 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.mt-error {
  margin: 6px 8px 0;
  font-size: 0.82rem;
  color: #b91c1c;
}
.mt-pie {
  border-top: 1px solid var(--border);
  padding: 8px 10px;
}
.mt-salir {
  color: #b91c1c;
}

/* Entrada: el fondo aparece y el panel se desliza desde la izquierda */
.menu-tienda-enter-active,
.menu-tienda-leave-active {
  transition: opacity 0.2s ease;
}
.menu-tienda-enter-active .mt-panel,
.menu-tienda-leave-active .mt-panel {
  transition: transform 0.25s ease;
}
.menu-tienda-enter-from,
.menu-tienda-leave-to {
  opacity: 0;
}
.menu-tienda-enter-from .mt-panel,
.menu-tienda-leave-to .mt-panel {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .menu-tienda-enter-active,
  .menu-tienda-leave-active,
  .menu-tienda-enter-active .mt-panel,
  .menu-tienda-leave-active .mt-panel {
    transition: none;
  }
}
</style>
