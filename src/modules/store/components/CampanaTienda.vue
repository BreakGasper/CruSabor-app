<template>
  <div class="campana-wrap">
    <button
      type="button"
      class="campana"
      :class="{ 'con-avisos': total > 0 }"
      :title="total ? `${total} ${total === 1 ? 'aviso' : 'avisos'}` : 'Sin avisos'"
      aria-label="Notificaciones"
      @click.stop="abierta = true"
    >
      🔔
      <span v-if="total > 0" class="badge">{{ total > 99 ? '99+' : total }}</span>
    </button>

    <!-- El panel se monta en <body> para que ningún contenedor con overflow lo recorte -->
    <Teleport to="body">
      <transition name="ptr-panel">
        <div v-if="abierta" class="panel-fondo" @click.self="abierta = false">
          <section class="panel" role="dialog" aria-modal="true" aria-label="Avisos de la tienda">
            <header class="panel-head">
              <div>
                <h2 class="panel-titulo">🔔 Avisos</h2>
                <p class="panel-sub">
                  {{ total === 0 ? 'Todo en orden' : `${total} ${total === 1 ? 'pendiente' : 'pendientes'}` }}
                </p>
              </div>
              <button type="button" class="cerrar" aria-label="Cerrar" @click="abierta = false">✕</button>
            </header>

            <div class="panel-cuerpo">
              <p v-if="total === 0" class="vacio">
                No tienes pedidos sin atender ni artículos con poco stock. 🎉
              </p>

              <!-- Pedidos por atender -->
              <section v-if="pedidosSinAtender.length" class="bloque">
                <div class="bloque-head">
                  <h3>🚚 Pedidos por atender <span class="conteo">{{ pedidosSinAtender.length }}</span></h3>
                  <button type="button" class="link" @click="irAPedidos">Ver todos ›</button>
                </div>
                <p class="bloque-ayuda">Atiéndelos antes de que se cancelen solos por falta de atención.</p>
                <ul>
                  <li v-for="p in pedidosSinAtender.slice(0, 5)" :key="p.id_pedido" class="tarjeta pedido" @click="irAPedidos">
                    <div class="tarjeta-texto">
                      <span class="tarjeta-titulo">Pedido #{{ p.id_pedido?.slice(-6) }}</span>
                      <span class="tarjeta-detalle">{{ itemsDe(p) }} {{ itemsDe(p) === 1 ? 'artículo' : 'artículos' }} · {{ hace(p) }}</span>
                    </div>
                    <span v-if="restante(p)" class="restante" :class="{ urgente: esUrgente(p) }">{{ restante(p) }}</span>
                  </li>
                </ul>
              </section>

              <!-- Stock -->
              <section v-if="alertasStock.length" class="bloque">
                <div class="bloque-head">
                  <h3>
                    📦 Stock
                    <span v-if="agotados.length" class="conteo rojo">{{ agotados.length }} sin stock</span>
                    <span v-if="porAgotarse.length" class="conteo ambar">{{ porAgotarse.length }} por agotarse</span>
                  </h3>
                </div>
                <p class="bloque-ayuda">Pausa la venta mientras resurtes o da de baja lo que ya no venderás.</p>
                <ul>
                  <li v-for="a in alertasStock" :key="a.articulo.articuloId" class="tarjeta stock">
                    <img class="miniatura" :src="imagenUrl(a.articulo.url) || defaultImg" :alt="a.articulo.nombre" @error="onImgError" />
                    <div class="tarjeta-texto">
                      <span class="tarjeta-titulo">{{ a.articulo.nombre }}</span>
                      <span class="tarjeta-detalle" :class="a.stock.estado">
                        {{ a.stock.estado === 'agotado' ? '🔴 Sin stock' : `🟡 Quedan ${a.stock.minimo}` }}
                        <em v-if="a.articulo.ventaPausada"> · venta pausada</em>
                      </span>
                    </div>
                    <div class="acciones">
                      <button type="button" class="accion" title="Editar stock" @click="editar(a.articulo)">✏️ Editar</button>
                      <button
                        type="button"
                        class="accion"
                        :class="{ activo: a.articulo.ventaPausada }"
                        :disabled="ocupado === a.articulo.articuloId"
                        @click="pausar(a.articulo)"
                      >
                        {{ a.articulo.ventaPausada ? '▶ Reanudar' : '⏸ Pausar' }}
                      </button>
                      <button type="button" class="accion baja" :disabled="ocupado === a.articulo.articuloId" @click="baja(a.articulo)">
                        ⬇ Dar de baja
                      </button>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Campana de avisos de la tienda: pedidos por atender y artículos agotados o por agotarse,
 * con acciones rápidas para pausar la venta o dar de baja mientras resurte.
 * El panel se teleporta a <body>: en móvil es una hoja inferior, en escritorio un diálogo.
 */
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import { useAlertasTienda } from '@/composables/useAlertasTienda';
import { pausarVentaArticulo, darDeBajaArticulo } from '@/composables/useArticulos';
import { fechaPedido, tiempoRestanteAtencion, formatoTiempoRestante, type Pedido } from '@/composables/usePedidos';
import { imagenUrl } from '@/constants/firebase_util';
import defaultImg from '@/assets/icons/default_articulo.png';
import type { Producto } from '@/types/Producto';

const props = defineProps<{ tiendaId: string }>();
const router = useRouter();
const abierta = ref(false);
const ocupado = ref<string | null>(null);

const { pedidosSinAtender, alertasStock, agotados, porAgotarse, total } = useAlertasTienda(props.tiendaId);

const itemsDe = (p: Pedido) => p.items.filter((i) => String(i.proveedor) === String(props.tiendaId)).reduce((s, i) => s + i.cantidad, 0);

function hace(p: Pedido): string {
  const min = Math.max(0, Math.round((Date.now() - fechaPedido(p)) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}
function restante(p: Pedido): string | null {
  const ms = tiempoRestanteAtencion(p, props.tiendaId);
  if (ms === null) return null;
  return ms <= 0 ? 'Por cancelarse' : `⏳ ${formatoTiempoRestante(ms)}`;
}
function esUrgente(p: Pedido): boolean {
  const ms = tiempoRestanteAtencion(p, props.tiendaId);
  return ms !== null && ms < 30 * 60_000;
}

function irAPedidos() {
  abierta.value = false;
  router.push(`/store/pedidos/${props.tiendaId}`);
}
function editar(a: Producto) {
  abierta.value = false;
  router.push(`/store/product/edit/${a.articuloId}`);
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImg;
}

async function pausar(a: Producto) {
  ocupado.value = a.articuloId;
  try {
    const pausar = !a.ventaPausada;
    await pausarVentaArticulo(a.articuloId, pausar);
    Swal.fire({ toast: true, position: 'bottom', timer: 1600, showConfirmButton: false, icon: 'success', title: pausar ? 'Venta pausada' : 'Venta reanudada' });
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: e?.message || String(e) });
  } finally {
    ocupado.value = null;
  }
}

async function baja(a: Producto) {
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Dar de baja "${a.nombre}"?`,
    text: 'Dejará de aparecer en el catálogo. Podrás reactivarlo desde tu lista de productos.',
    showCancelButton: true,
    confirmButtonText: 'Sí, dar de baja',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#e74c3c',
  });
  if (!r.isConfirmed) return;
  ocupado.value = a.articuloId;
  try {
    await darDeBajaArticulo(a.articuloId, true);
    Swal.fire({ toast: true, position: 'bottom', timer: 1600, showConfirmButton: false, icon: 'success', title: 'Artículo dado de baja' });
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo dar de baja', text: e?.message || String(e) });
  } finally {
    ocupado.value = null;
  }
}
</script>

<style scoped>
.campana-wrap {
  position: relative;
  display: inline-block;
}
.campana {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 6px 18px var(--color-shadow);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.campana.con-avisos {
  animation: campana-latido 2.4s ease-in-out infinite;
}
@keyframes campana-latido {
  0%, 85%, 100% { transform: rotate(0); }
  88% { transform: rotate(-12deg); }
  91% { transform: rotate(10deg); }
  94% { transform: rotate(-6deg); }
  97% { transform: rotate(4deg); }
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #e74c3c;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--surface);
}
</style>

<!-- Estilos del panel sin scoped: vive en <body> por el Teleport -->
<style>
.panel-fondo {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.panel-fondo .panel {
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  color: var(--text);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  text-align: left;
  font-size: 0.95rem;
}
@media (min-width: 640px) {
  .panel-fondo {
    align-items: center;
    padding: 16px;
  }
  .panel-fondo .panel {
    border-radius: 20px;
    max-height: 80vh;
  }
}
.panel-fondo .panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border);
}
.panel-fondo .panel-titulo {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}
.panel-fondo .panel-sub {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.panel-fondo .cerrar {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
}
.panel-fondo .panel-cuerpo {
  overflow-y: auto;
  padding: 6px 18px 20px;
}
.panel-fondo .vacio {
  margin: 0;
  padding: 28px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 1rem;
}
.panel-fondo .bloque {
  padding: 14px 0 6px;
}
.panel-fondo .bloque + .bloque {
  border-top: 1px solid var(--border);
}
.panel-fondo .bloque-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.panel-fondo .bloque-head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.panel-fondo .conteo {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 700;
}
.panel-fondo .conteo.rojo {
  background: #fdecea;
  color: #c0392b;
}
.panel-fondo .conteo.ambar {
  background: #fff4e5;
  color: #b45309;
}
.panel-fondo .link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--brand-blue-text);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.panel-fondo .bloque-ayuda {
  margin: 4px 0 10px;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.panel-fondo ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-fondo .tarjeta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.panel-fondo .tarjeta.pedido {
  cursor: pointer;
}
.panel-fondo .tarjeta.pedido:hover {
  border-color: var(--color-bg-blue-ligth);
}
.panel-fondo .tarjeta.stock {
  flex-wrap: wrap;
}
.panel-fondo .miniatura {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  object-fit: cover;
  flex: 0 0 auto;
  background: var(--surface);
}
.panel-fondo .tarjeta-texto {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 140px;
}
.panel-fondo .tarjeta-titulo {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-fondo .tarjeta-detalle {
  font-size: 0.82rem;
  color: var(--text-muted);
}
.panel-fondo .tarjeta-detalle.agotado {
  color: #c0392b;
  font-weight: 600;
}
.panel-fondo .tarjeta-detalle.bajo {
  color: #b45309;
  font-weight: 600;
}
.panel-fondo .restante {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff4e5;
  color: #b45309;
  font-size: 0.78rem;
  font-weight: 700;
}
.panel-fondo .restante.urgente {
  background: #fdecea;
  color: #c0392b;
}
.panel-fondo .acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 100%;
}
.panel-fondo .accion {
  flex: 1 1 auto;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.panel-fondo .accion.activo {
  background: #e0e7ff;
  color: #3730a3;
  border-color: #c7d2fe;
}
.panel-fondo .accion.baja {
  color: #c0392b;
}
.panel-fondo .accion:disabled {
  opacity: 0.5;
  cursor: wait;
}
.ptr-panel-enter-active,
.ptr-panel-leave-active {
  transition: opacity 0.18s ease;
}
.ptr-panel-enter-active .panel,
.ptr-panel-leave-active .panel {
  transition: transform 0.22s ease;
}
.ptr-panel-enter-from,
.ptr-panel-leave-to {
  opacity: 0;
}
.ptr-panel-enter-from .panel,
.ptr-panel-leave-to .panel {
  transform: translateY(24px);
}
</style>
