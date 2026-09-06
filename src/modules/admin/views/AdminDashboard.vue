<template>
  <div class="admin-container">
    <AdminTopbar titulo="Tablero" />

    <main class="admin-main">
      <h1 class="page-title">Tablero</h1>
      <p class="page-hint">Resumen de las tiendas registradas y su situación. Toca una tarjeta para ver la lista.</p>

      <!-- Contadores -->
      <section class="stats">
        <router-link
          v-for="s in resumen"
          :key="s.clave"
          :to="{ path: '/admin/tiendas', query: { filtro: s.clave } }"
          class="stat"
          :class="'stat-' + s.clave"
        >
          <span class="stat-num">{{ loading ? '…' : s.total }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </router-link>
      </section>

      <!-- Pendientes de atención -->
      <section v-if="!loading && (pendientes.length || porVencer.length)" class="atencion">
        <article v-if="pendientes.length" class="card">
          <h3>Esperan aprobación</h3>
          <ul class="mini-lista">
            <li v-for="t in pendientes.slice(0, 5)" :key="t.tiendaId">
              <router-link :to="`/admin/tiendas/${t.tiendaId}`">{{ t.nombreTienda }}</router-link>
              <span class="mini-meta">{{ t.municipio || t.categoria }}</span>
            </li>
          </ul>
          <router-link v-if="pendientes.length > 5" class="ver-mas" to="/admin/tiendas?filtro=pendiente">
            Ver las {{ pendientes.length }} pendientes
          </router-link>
        </article>
        <article v-if="porVencer.length" class="card">
          <h3>Vencen en 7 días o menos</h3>
          <ul class="mini-lista">
            <li v-for="t in porVencer.slice(0, 5)" :key="t.tiendaId">
              <router-link :to="`/admin/tiendas/${t.tiendaId}`">{{ t.nombreTienda }}</router-link>
              <span class="mini-meta">{{ t.membresia?.vigenteHasta }}</span>
            </li>
          </ul>
          <router-link v-if="porVencer.length > 5" class="ver-mas" to="/admin/tiendas?filtro=por-vencer">
            Ver las {{ porVencer.length }} por vencer
          </router-link>
        </article>
      </section>

      <!-- Avisos de pago de las tiendas ("Ya pagué") -->
      <section v-if="solicitudes.length" class="card solicitudes">
        <div class="revision-head">
          <h3>Pagos por confirmar</h3>
          <span class="revision-fecha">{{ solicitudes.length }} aviso{{ solicitudes.length === 1 ? '' : 's' }}</span>
        </div>
        <p class="revision-vacia">
          Revisa en tu cuenta de Mercado Pago que el cobro exista y registra el pago; la tienda se activa al instante.
        </p>
        <ul class="solicitud-lista">
          <li v-for="s in solicitudes" :key="s.id" class="solicitud" :data-solicitud="s.id">
            <div class="solicitud-info">
              <router-link :to="`/admin/tiendas/${s.tiendaId}`" class="solicitud-nombre">{{ s.nombreTienda || s.tiendaId }}</router-link>
              <span class="solicitud-meta">
                Plan {{ PLAN_LABEL[s.plan] || s.plan }} · {{ fechaCorta(s.fecha) }}<span v-if="s.referencia"> · Ref. {{ s.referencia }}</span>
              </span>
            </div>
            <div class="solicitud-acciones">
              <button type="button" class="btn-mini btn-mini-ok" @click="registrarDesdeSolicitud(s)">Registrar pago</button>
              <button type="button" class="btn-mini" @click="descartarSolicitud(s)">Descartar</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Última revisión automática de membresías -->
      <section class="card revision" :class="{ 'sin-revision': !revision }">
        <div class="revision-head">
          <h3>Revisión automática de membresías</h3>
          <span v-if="revision" class="revision-fecha">{{ fechaCorta(revision.fecha) }}</span>
        </div>
        <p v-if="!revision" class="revision-vacia">
          Aún no ha corrido. Se ejecuta todos los días a las 06:00 (hora de Ciudad de México) una vez desplegada la función
          <code>revisarMembresias</code>.
        </p>
        <ul v-else class="revision-datos">
          <li><strong>{{ revision.revisadas }}</strong> tiendas con vigencia revisadas</li>
          <li><strong>{{ revision.bloqueadas }}</strong> bloqueadas por vencimiento</li>
          <li><strong>{{ revision.recordatorios }}</strong> recordatorios enviados</li>
          <li>
            <strong>{{ revision.correosEnviados }}</strong> correos enviados<span v-if="revision.correosFallidos"
              >, <strong class="rojo">{{ revision.correosFallidos }}</strong> fallidos</span
            >
          </li>
          <li v-if="revision.simulacion" class="rojo">Última corrida fue una simulación</li>
        </ul>
      </section>

      <!-- Accesos -->
      <section class="modules">
        <router-link to="/admin/tiendas" class="module">
          <h3>Tiendas</h3>
          <p>Aprobar, bloquear y registrar pagos de membresía.</p>
        </router-link>
        <router-link to="/admin/configuracion" class="module">
          <h3>Configuración</h3>
          <p>Precios de membresía, días de gracia, registro de tiendas y mantenimiento.</p>
          <span v-if="configuracion.mantenimiento.activo" class="soon alerta">Mantenimiento activo</span>
        </router-link>
        <router-link to="/admin/categorias" class="module">
          <h3>Categorías</h3>
          <p>Catálogo de categorías de tiendas y productos.</p>
        </router-link>
      </section>
    </main>

    <PagoMembresiaModal
      :visible="pagoVisible"
      :tienda="tiendaPago"
      :plan-inicial="solicitudActiva?.plan"
      :referencia-inicial="solicitudActiva?.referencia"
      metodo-inicial="Transferencia"
      @close="pagoVisible = false"
      @saved="onPagoGuardado"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import PagoMembresiaModal from '../components/PagoMembresiaModal.vue';
import { PLAN_LABEL, type PagoRegistrado } from '@/composables/useAdminTiendas';
import { useSolicitudesPago, atenderSolicitud, type SolicitudPago } from '@/composables/useSolicitudesPago';
import type { Tienda } from '@/composables/useTiendas';
import { useTiendas } from '@/composables/useTiendas';
import { estadoEfectivo, diasParaVencer, ESTADO_LABEL, type EstadoEfectivo } from '@/composables/useMembresia';
import { useConfiguracion } from '@/composables/useConfiguracion';

const { configuracion } = useConfiguracion();
const { tiendas, loading, cargarTiendas } = useTiendas();
onMounted(() => cargarTiendas());

const ORDEN: EstadoEfectivo[] = ['pendiente', 'activa', 'vencida', 'bloqueada'];
const resumen = computed(() =>
  ORDEN.map((clave) => ({
    clave,
    label: ESTADO_LABEL[clave],
    total: tiendas.value.filter((t) => estadoEfectivo(t) === clave).length,
  })),
);

const pendientes = computed(() => tiendas.value.filter((t) => estadoEfectivo(t) === 'pendiente'));
const porVencer = computed(() =>
  tiendas.value
    .filter((t) => {
      const d = diasParaVencer(t);
      return estadoEfectivo(t) === 'activa' && d !== null && d <= 7;
    })
    .sort((a, b) => (a.membresia?.vigenteHasta || '').localeCompare(b.membresia?.vigenteHasta || '')),
);

const revision = computed(() => configuracion.value.ultimaRevisionMembresias);

/* Avisos "Ya pagué" de las tiendas */
const { solicitudes } = useSolicitudesPago({ soloPendientes: true });
const pagoVisible = ref(false);
const tiendaPago = ref<Tienda | null>(null);
const solicitudActiva = ref<SolicitudPago | null>(null);
const toast = (title: string, icon: 'success' | 'error' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2400, showConfirmButton: false, icon, title });

function registrarDesdeSolicitud(s: SolicitudPago) {
  const t = tiendas.value.find((x) => x.tiendaId === s.tiendaId);
  if (!t) {
    toast('La tienda ya no existe', 'error');
    return;
  }
  solicitudActiva.value = s;
  tiendaPago.value = t;
  pagoVisible.value = true;
}
async function onPagoGuardado(p: PagoRegistrado) {
  pagoVisible.value = false;
  if (solicitudActiva.value?.id) await atenderSolicitud(solicitudActiva.value.id, 'atendido', `Pago registrado · vigente hasta ${p.vigenteHasta}`);
  solicitudActiva.value = null;
  toast(`Pago registrado · vigente hasta ${p.vigenteHasta}`);
}
async function descartarSolicitud(s: SolicitudPago) {
  const r = await Swal.fire({
    icon: 'question',
    title: `¿Descartar el aviso de "${s.nombreTienda}"?`,
    text: 'Úsalo si no encuentras el cobro en Mercado Pago. La tienda podrá avisar de nuevo.',
    input: 'text',
    inputPlaceholder: 'Motivo (opcional)',
    showCancelButton: true,
    confirmButtonText: 'Descartar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed || !s.id) return;
  await atenderSolicitud(s.id, 'descartado', r.value);
  toast('Aviso descartado');
}
function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #f3f4f6;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: #111827;
}
.admin-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}
.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}
.page-hint {
  margin: 0.25rem 0 1.25rem;
  color: #5b6472;
  font-size: 0.9rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 1.25rem;
}
.stat {
  background: #fff;
  border-radius: 16px;
  padding: 1rem 1.1rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
  border-left: 5px solid #9ca3af;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s, box-shadow 0.15s;
}
.stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.1);
}
.stat-num {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
}
.stat-label {
  font-size: 0.85rem;
  color: #5b6472;
  font-weight: 500;
}
.stat-pendiente {
  border-color: #0165d8;
}
.stat-activa {
  border-color: #10b981;
}
.stat-vencida {
  border-color: #f59e0b;
}
.stat-bloqueada {
  border-color: #d9534f;
}

.atencion {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 1.25rem;
}
.card {
  background: #fff;
  border-radius: 16px;
  padding: 1rem 1.2rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}
.card h3 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}
.mini-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mini-lista li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.9rem;
}
.mini-lista a {
  color: #111827;
  font-weight: 600;
  text-decoration: none;
}
.mini-lista a:hover {
  text-decoration: underline;
}
.mini-meta {
  color: #5b6472;
  font-size: 0.82rem;
}
.ver-mas {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #047857;
}

.revision {
  margin-bottom: 1.25rem;
  border-left: 5px solid #10b981;
}
.solicitudes {
  margin-bottom: 1.25rem;
  border-left: 5px solid #f59e0b;
}
.solicitud-lista {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.solicitud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fffbeb;
}
.solicitud-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.solicitud-nombre {
  font-weight: 700;
  color: #111827;
  text-decoration: none;
}
.solicitud-meta {
  font-size: 0.8rem;
  color: #5b6472;
}
.solicitud-acciones {
  display: flex;
  gap: 6px;
}
.btn-mini {
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-mini-ok {
  background: #059669;
  border-color: #059669;
  color: #fff;
}
.revision.sin-revision {
  border-left-color: #9ca3af;
}
.revision-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.revision-head h3 {
  margin: 0;
}
.revision-fecha {
  font-size: 0.82rem;
  color: #5b6472;
}
.revision-vacia {
  margin: 0.4rem 0 0;
  font-size: 0.88rem;
  color: #5b6472;
}
.revision-vacia code {
  font-size: 0.82rem;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 6px;
}
.revision-datos {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 0.9rem;
  color: #374151;
}
.rojo {
  color: #b91c1c;
}

.modules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.module {
  background: #fff;
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-decoration: none;
  color: inherit;
  border: 2px solid transparent;
}
.module:not(.disabled):hover {
  border-color: #10b981;
}
.module.disabled {
  opacity: 0.8;
}
.module h3 {
  margin: 0;
  font-size: 1.05rem;
}
.module p {
  margin: 0;
  font-size: 0.88rem;
  color: #5b6472;
  flex: 1;
}
.soon.alerta {
  background: #fdecea;
  color: #8a1f1b;
  border-color: #fca5a5;
}
.soon {
  align-self: flex-start;
  margin-top: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
</style>
