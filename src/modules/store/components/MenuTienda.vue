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
              <section v-for="g in gruposDueno" :key="g.id" class="mt-grupo" :data-grupo="g.id">
                <p class="mt-seccion" :data-seccion="g.id">{{ g.titulo }}</p>
                <button v-for="o in g.opciones" :key="o.accion" type="button" class="mt-opcion" @click="$emit('accion', o.accion)">
                  <span class="mt-icono" aria-hidden="true">{{ o.icono }}</span>
                  <span class="mt-texto">{{ o.texto }}</span>
                  <span class="mt-flecha" aria-hidden="true">›</span>
                </button>
              </section>

              <section class="mt-grupo" data-grupo="tiendas">
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
              </section>
            </template>

            <!-- Visitante -->
            <template v-else>
              <button v-if="vendeProd" type="button" class="mt-opcion" @click="$emit('accion', 'productos')">
                <span class="mt-icono" aria-hidden="true">📋</span><span>Productos</span>
              </button>
              <button v-if="vendeProd" type="button" class="mt-opcion" @click="$emit('accion', 'carrito')">
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
            <VersionApp />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import VersionApp from '@/components/VersionApp.vue';
import { useRouter } from 'vue-router';
import { cambiarTiendaActiva, MAX_TIENDAS_POR_TELEFONO, type TiendaEnCuenta } from '@/composables/cuentaTienda';
import { vendeProductos, ofreceServicios } from '@/modules/servicios/negocio';

export type AccionMenuTienda =
  | 'editar'
  | 'pedidos'
  | 'agregar-articulo'
  | 'promociones'
  | 'crear-publicacion'
  | 'estudio'
  | 'productos'
  | 'panel'
  | 'servicios'
  | 'citas'
  | 'cotizaciones'
  | 'clientes'
  | 'horarios'
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
  /** 'productos' | 'servicios' | 'mixto' (sin valor = productos): define qué opciones se muestran */
  tipoNegocio?: string;
  totalEnCarrito?: number;
  /** Tiendas del mismo celular (sesión) */
  cuenta?: TiendaEnCuenta[];
  actualId?: string;
}>();
const emit = defineEmits<{ cerrar: []; accion: [accion: AccionMenuTienda]; cambiada: [id: string] }>();

const router = useRouter();
const cuenta = computed(() => props.cuenta ?? []);
const totalEnCarrito = computed(() => props.totalEnCarrito ?? 0);

/** Una tienda de solo servicios no tiene artículos, pedidos ni carrito */
const vendeProd = computed(() => vendeProductos({ tipoNegocio: props.tipoNegocio }));
const ofreceServ = computed(() => ofreceServicios({ tipoNegocio: props.tipoNegocio }));

type Opcion = { accion: AccionMenuTienda; icono: string; texto: string };
/** Menú de la dueña o dueño en tres paneles: su tienda, los artículos (productos) y los servicios */
const gruposDueno = computed(() => {
  const grupos: Array<{ id: string; titulo: string; opciones: Opcion[] }> = [
    {
      id: 'tienda',
      titulo: 'Mi tienda',
      opciones: [
        { accion: 'editar', icono: '✏️', texto: 'Editar mi tienda' },
        { accion: 'crear-publicacion', icono: '📣', texto: 'Crear publicación' },
        { accion: 'estudio', icono: '🎨', texto: 'Estudio de diseño' },
      ],
    },
  ];
  if (vendeProd.value) {
    const op: Opcion[] = [
      { accion: 'productos', icono: '📋', texto: 'Mis artículos' },
      { accion: 'agregar-articulo', icono: '➕', texto: 'Agregar artículo' },
      { accion: 'pedidos', icono: '🚚', texto: 'Pedidos' },
    ];
    if (props.promocionesHabilitadas) op.push({ accion: 'promociones', icono: '🏷️', texto: 'Crear promoción' });
    grupos.push({ id: 'articulos', titulo: 'Panel de artículos', opciones: op });
  }
  if (ofreceServ.value) {
    grupos.push({
      id: 'servicios',
      titulo: 'Panel de servicios',
      opciones: [
        { accion: 'panel', icono: '📊', texto: 'Resumen' },
        { accion: 'servicios', icono: '🗂️', texto: 'Mis servicios' },
        { accion: 'citas', icono: '🗓️', texto: 'Citas' },
        { accion: 'cotizaciones', icono: '💬', texto: 'Cotizaciones' },
        { accion: 'clientes', icono: '👥', texto: 'Clientes' },
        { accion: 'horarios', icono: '⏰', texto: 'Horarios y equipo' },
      ],
    });
  }
  return grupos;
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
  border-radius: 0 28px 28px 0;
  overflow: hidden;
  box-shadow: 8px 0 30px rgba(0, 0, 0, 0.25);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}
.mt-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  background: linear-gradient(135deg, var(--color-bg-blue-dark), color-mix(in srgb, var(--color-bg-blue-dark) 70%, #db2777));
  color: #fff;
}
.mt-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  border: 2px solid rgba(255, 255, 255, 0.85);
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
  border-radius: 50%;
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
  padding: 12px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* Cada panel es una tarjeta con borde y esquinas redondeadas */
.mt-grupo {
  --acento: var(--brand-blue-text);
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.mt-grupo[data-grupo='articulos'] { --acento: #d97706; }
.mt-grupo[data-grupo='servicios'] { --acento: #0891b2; }
.mt-grupo[data-grupo='tiendas'] { --acento: #db2777; }
.mt-seccion {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.mt-seccion::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--acento);
}
.mt-opcion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.mt-opcion:hover:not(:disabled) {
  background: color-mix(in srgb, var(--acento) 10%, var(--surface));
}
.mt-opcion:active:not(:disabled) {
  transform: scale(0.98);
}
/* Icono dentro de un círculo del color del panel */
.mt-icono {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--acento) 16%, var(--surface));
  font-size: 1.1rem;
  flex-shrink: 0;
}
.mt-texto {
  flex: 1;
  min-width: 0;
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
  background: color-mix(in srgb, var(--acento) 14%, var(--surface));
  cursor: default;
}
.mt-mini-logo {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
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
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--acento);
  color: #fff;
}
.mt-flecha {
  color: var(--text-muted);
  font-size: 1.3rem;
  line-height: 1;
}
.mt-agregar {
  margin: 6px 0 2px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  border: 2px dashed var(--acento);
  background: color-mix(in srgb, var(--acento) 8%, var(--surface));
  color: var(--acento);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.mt-agregar small {
  margin-left: auto;
  font-weight: 600;
  opacity: 0.85;
}
.mt-nota {
  margin: 6px 10px 4px;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.mt-error {
  margin: 6px 10px 0;
  font-size: 0.82rem;
  color: var(--peligro-texto, #b91c1c);
}
.mt-pie {
  border-top: 1px solid var(--border);
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
}
.mt-salir {
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  background: var(--peligro-fondo, #fee2e2);
  color: var(--peligro-texto, #b91c1c);
  font-weight: 700;
}
.mt-salir:hover:not(:disabled) {
  background: var(--peligro-fondo, #fee2e2);
  filter: brightness(0.97);
}
.mt-salir .mt-icono {
  width: auto;
  height: auto;
  background: transparent;
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
