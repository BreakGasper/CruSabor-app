<template>
  <div class="admin-container">
    <AdminTopbar :titulo="tienda?.nombreTienda || 'Tienda'" volver="/admin/tiendas" />

    <main class="admin-main">
      <p v-if="cargando" class="empty">Cargando tienda...</p>
      <p v-else-if="!tienda" class="empty">No encontramos esa tienda.</p>

      <template v-else>
        <!-- Encabezado de la tienda -->
        <section class="card cabecera">
          <img :src="tienda.logoUrl || placeholderLogo" alt="" class="logo" @error="onImgError" />
          <div class="cab-info">
            <div class="nombre-row">
              <h1 class="nombre">{{ tienda.nombreTienda }}</h1>
              <span class="estatus" :class="'estatus-' + estado">{{ ESTADO_LABEL[estado] }}</span>
            </div>
            <p class="meta">{{ tienda.categoria || 'Sin categoría' }}</p>
            <p class="meta">
              {{ [tienda.calle, tienda.numero].filter(Boolean).join(' #') }}<span v-if="tienda.colonia">, {{ tienda.colonia }}</span>
              <span v-if="tienda.municipio">, {{ tienda.municipio }}</span><span v-if="tienda.estado">, {{ tienda.estado }}</span>
            </p>
            <p class="meta">
              {{ formatTelefono(tienda.telefono) }}<span v-if="tienda.email"> · {{ tienda.email }}</span>
            </p>
            <p v-if="tienda.creadaEn" class="meta">Registrada el {{ fechaCorta(tienda.creadaEn) }}</p>
            <router-link :to="`/store/profile/${tienda.tiendaId}`" class="link">Ver perfil público</router-link>
          </div>
        </section>

        <div class="grid">
          <!-- Control -->
          <section class="card">
            <h2>Autorización y membresía</h2>
            <dl class="datos">
              <dt>Situación</dt>
              <dd><span class="estatus" :class="'estatus-' + estado">{{ ESTADO_LABEL[estado] }}</span></dd>
              <template v-if="estado === 'bloqueada' && tienda.motivoBloqueo">
                <dt>Motivo</dt>
                <dd class="motivo">{{ tienda.motivoBloqueo }}</dd>
              </template>
              <dt>Plan</dt>
              <dd>{{ tienda.membresia?.plan ? PLAN_LABEL[tienda.membresia.plan as PlanMembresia] || tienda.membresia.plan : 'Sin plan' }}</dd>
              <dt>Vigencia</dt>
              <dd>{{ textoVigencia }}</dd>
              <dt>Último pago</dt>
              <dd v-if="tienda.membresia?.ultimoPago">
                ${{ formatoMonto(tienda.membresia.ultimoPago.monto) }} · {{ tienda.membresia.ultimoPago.metodo }} ·
                {{ fechaCorta(tienda.membresia.ultimoPago.fecha) }}
              </dd>
              <dd v-else>Ninguno</dd>
              <template v-if="tienda.aprobadaEn">
                <dt>Aprobada</dt>
                <dd>{{ fechaCorta(tienda.aprobadaEn) }} por {{ tienda.aprobadaPor || 'admin' }}</dd>
              </template>
            </dl>

            <div class="acciones">
              <button v-if="estado === 'pendiente'" type="button" class="btn btn-aprobar" @click="aprobar">Aprobar tienda</button>
              <button v-if="estado === 'bloqueada'" type="button" class="btn btn-aprobar" @click="desbloquear">Desbloquear</button>
              <button
                v-if="estado === 'activa' || estado === 'vencida'"
                type="button"
                class="btn btn-bloquear"
                @click="bloquear"
              >
                Bloquear tienda
              </button>
              <button type="button" class="btn btn-pago" @click="pagoVisible = true">Registrar pago</button>
            </div>
          </section>

          <!-- Avisos "Ya pagué" de esta tienda -->
          <section class="card" :class="{ 'card-alerta': avisosPendientes.length }">
            <h2>Avisos de pago</h2>
            <p v-if="!avisosPendientes.length && !avisosAtendidos.length" class="vacio">La tienda no ha avisado pagos.</p>

            <ul v-if="avisosPendientes.length" class="timeline">
              <li v-for="s in avisosPendientes" :key="s.id" class="evento evento-pendiente" :data-aviso="s.id">
                <div class="evento-head">
                  <strong>Por confirmar · {{ PLAN_LABEL[s.plan] || s.plan }}</strong>
                  <span class="fecha">{{ fechaCorta(s.fecha) }}</span>
                </div>
                <p class="evento-det referencia">
                  Referencia: <strong v-if="s.referencia">{{ s.referencia }}</strong><span v-else class="rojo">la tienda no indicó referencia</span>
                </p>
                <p class="evento-det">Busca este cobro en la Actividad de tu cuenta de Mercado Pago antes de registrarlo.</p>
                <div class="aviso-acciones">
                  <button type="button" class="btn btn-aprobar" @click="registrarDesdeAviso(s)">Registrar este pago</button>
                  <button type="button" class="btn btn-secundario" @click="descartarAviso(s)">Descartar</button>
                </div>
              </li>
            </ul>

            <details v-if="avisosAtendidos.length" class="historial-avisos">
              <summary>Avisos anteriores ({{ avisosAtendidos.length }})</summary>
              <ul class="timeline">
                <li v-for="s in avisosAtendidos" :key="s.id" class="evento">
                  <div class="evento-head">
                    <strong>{{ s.estado === 'atendido' ? 'Registrado' : 'Descartado' }} · {{ PLAN_LABEL[s.plan] || s.plan }}</strong>
                    <span class="fecha">{{ fechaCorta(s.fecha) }}</span>
                  </div>
                  <p class="evento-det">Referencia: {{ s.referencia || 'sin referencia' }} · atendió {{ s.atendidoPor || 'admin' }}<span v-if="s.nota"> · {{ s.nota }}</span></p>
                </li>
              </ul>
            </details>
          </section>

          <!-- Pagos -->
          <section class="card">
            <h2>Pagos de membresía</h2>
            <p v-if="!pagos.length" class="vacio">Aún no hay pagos registrados.</p>
            <ul v-else class="timeline">
              <li v-for="p in pagos" :key="p.id" class="evento">
                <div class="evento-head">
                  <strong>${{ formatoMonto(p.monto) }}</strong>
                  <span class="fecha">{{ fechaCorta(p.fecha) }}</span>
                </div>
                <p class="evento-det">
                  {{ PLAN_LABEL[p.plan] || p.plan }} · {{ p.metodo }}<span v-if="p.referencia"> · Ref. {{ p.referencia }}</span>
                </p>
                <p class="evento-det">Vigencia {{ p.vigenteDesde }} → {{ p.vigenteHasta }} · registró {{ p.registradoPor }}</p>
              </li>
            </ul>
          </section>

          <!-- Historial de estatus -->
          <section class="card">
            <h2>Historial de cambios</h2>
            <p v-if="!historial.length" class="vacio">Sin cambios registrados.</p>
            <ul v-else class="timeline">
              <li v-for="h in historial" :key="h.id" class="evento">
                <div class="evento-head">
                  <strong>
                    <span class="estatus mini" :class="'estatus-' + h.a">{{ ESTADO_LABEL[h.a] }}</span>
                  </strong>
                  <span class="fecha">{{ fechaCorta(h.fecha) }}</span>
                </div>
                <p class="evento-det">
                  Antes: {{ h.de === 'sin-estatus' ? 'sin estatus' : ESTADO_LABEL[h.de] }} · por {{ h.por }}
                </p>
                <p v-if="h.motivo" class="evento-det">{{ h.motivo }}</p>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </main>

    <PagoMembresiaModal
      :visible="pagoVisible"
      :tienda="tienda"
      :plan-inicial="avisoActivo?.plan"
      :referencia-inicial="avisoActivo?.referencia"
      :metodo-inicial="avisoActivo ? 'Transferencia' : undefined"
      @close="pagoVisible = false"
      @saved="onPagoGuardado"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import Swal from 'sweetalert2';
import { db } from '@/firebase';
import { ref as dbRef, onValue } from 'firebase/database';
import AdminTopbar from '../components/AdminTopbar.vue';
import PagoMembresiaModal from '../components/PagoMembresiaModal.vue';
import type { Tienda } from '@/composables/useTiendas';
import { estadoEfectivo, diasParaVencer, ESTADO_LABEL } from '@/composables/useMembresia';
import {
  aprobarTienda,
  bloquearTienda,
  desbloquearTienda,
  useHistorialTienda,
  PLAN_LABEL,
  type PlanMembresia,
  type PagoRegistrado,
} from '@/composables/useAdminTiendas';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { useSolicitudesPago, atenderSolicitud, type SolicitudPago } from '@/composables/useSolicitudesPago';

const route = useRoute();
const tiendaId = computed(() => String(route.params.id || ''));

const tienda = ref<Tienda | null>(null);
const cargando = ref(true);
let off: (() => void) | null = null;

function suscribir() {
  off?.();
  cargando.value = true;
  if (!tiendaId.value) {
    tienda.value = null;
    cargando.value = false;
    return;
  }
  off = onValue(dbRef(db, `tiendas/${tiendaId.value}`), (snap) => {
    const data = snap.val();
    tienda.value = data ? { ...data, tiendaId: tiendaId.value } : null;
    cargando.value = false;
  });
}

const { pagos, historial, cargar: cargarHistorial } = useHistorialTienda(() => tiendaId.value);

onMounted(() => {
  suscribir();
  cargarHistorial();
});
watch(tiendaId, () => {
  suscribir();
  cargarHistorial();
});
onUnmounted(() => off?.());

const estado = computed(() => estadoEfectivo(tienda.value));

const textoVigencia = computed(() => {
  const hasta = tienda.value?.membresia?.vigenteHasta;
  if (!hasta) return 'Sin membresía registrada';
  const d = diasParaVencer(tienda.value) ?? 0;
  if (d < 0) return `Venció el ${hasta} (hace ${-d} día${d === -1 ? '' : 's'})`;
  if (d === 0) return `Vence hoy (${hasta})`;
  return `Hasta ${hasta} · faltan ${d} día${d === 1 ? '' : 's'}`;
});

function formatTelefono(tel?: string) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : tel || '';
}
function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const formatoMonto = (n: number) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}

const toast = (title: string, icon: 'success' | 'error' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2200, showConfirmButton: false, icon, title });

async function aprobar() {
  if (!tienda.value) return;
  const r = await Swal.fire({
    icon: 'question',
    title: `¿Aprobar "${tienda.value.nombreTienda}"?`,
    text: 'La tienda quedará visible para los clientes y podrá recibir pedidos.',
    showCancelButton: true,
    confirmButtonText: 'Aprobar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
  });
  if (!r.isConfirmed) return;
  try {
    await aprobarTienda(tienda.value);
    toast('Tienda aprobada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo aprobar', 'error');
  }
}

async function bloquear() {
  if (!tienda.value) return;
  const r = await Swal.fire({
    icon: 'warning',
    title: `Bloquear "${tienda.value.nombreTienda}"`,
    text: 'La tienda dejará de vender de inmediato. Escribe el motivo; la dueña o dueño lo verá en su perfil.',
    input: 'text',
    inputPlaceholder: 'Ej. Membresía no pagada',
    inputValidator: (v: string) => (!v?.trim() ? 'El motivo es obligatorio' : undefined),
    showCancelButton: true,
    confirmButtonText: 'Bloquear',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed || !r.value?.trim()) return;
  try {
    await bloquearTienda(tienda.value, r.value);
    toast('Tienda bloqueada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo bloquear', 'error');
  }
}

async function desbloquear() {
  if (!tienda.value) return;
  const r = await Swal.fire({
    icon: 'question',
    title: `¿Desbloquear "${tienda.value.nombreTienda}"?`,
    text: 'Volverá a estar activa. Si su membresía está vencida seguirá sin vender hasta registrar el pago.',
    showCancelButton: true,
    confirmButtonText: 'Desbloquear',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
  });
  if (!r.isConfirmed) return;
  try {
    await desbloquearTienda(tienda.value);
    toast('Tienda desbloqueada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo desbloquear', 'error');
  }
}

const pagoVisible = ref(false);

/* Avisos "Ya pagué" de esta tienda (en vivo) */
const { solicitudes: todasSolicitudes } = useSolicitudesPago();
const avisosTienda = computed(() => todasSolicitudes.value.filter((s) => s.tiendaId === tiendaId.value));
const avisosPendientes = computed(() => avisosTienda.value.filter((s) => s.estado === 'reportado'));
const avisosAtendidos = computed(() => avisosTienda.value.filter((s) => s.estado !== 'reportado'));
const avisoActivo = ref<SolicitudPago | null>(null);

function registrarDesdeAviso(s: SolicitudPago) {
  avisoActivo.value = s;
  pagoVisible.value = true;
}
async function descartarAviso(s: SolicitudPago) {
  const r = await Swal.fire({
    icon: 'question',
    title: '¿Descartar este aviso de pago?',
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

async function onPagoGuardado(p: PagoRegistrado) {
  pagoVisible.value = false;
  if (avisoActivo.value?.id) await atenderSolicitud(avisoActivo.value.id, 'atendido', `Pago registrado · vigente hasta ${p.vigenteHasta}`);
  avisoActivo.value = null;
  toast(`Pago registrado · vigente hasta ${p.vigenteHasta}`);
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: var(--surface-2);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: var(--text);
}
.admin-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty,
.vacio {
  text-align: center;
  color: var(--text-muted);
  padding: 1rem 0;
  margin: 0;
}
.card {
  background: var(--surface);
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}
.card h2 {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ecfdf5;
}
.cabecera {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.logo {
  width: 84px;
  height: 84px;
  border-radius: 18px;
  object-fit: cover;
  background: var(--surface-2);
  flex-shrink: 0;
}
.cab-info {
  min-width: 0;
}
.nombre-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.nombre {
  margin: 0;
  font-size: 1.35rem;
}
.meta {
  margin: 3px 0 0;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.link {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #047857;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}
.datos {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  margin: 0 0 1rem;
  font-size: 0.9rem;
}
.datos dt {
  color: var(--text-muted);
  font-weight: 500;
}
.datos dd {
  margin: 0;
}
.motivo {
  color: #8a1f1b;
}

.estatus {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
}
.estatus.mini {
  font-size: 0.68rem;
}
.estatus-pendiente {
  background: #eaf2fc;
  color: var(--brand-blue-text);
}
.estatus-activa {
  background: #ecfdf5;
  color: #047857;
}
.estatus-vencida {
  background: #fff4e5;
  color: #7a4a00;
}
.estatus-bloqueada {
  background: #fdecea;
  color: #8a1f1b;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn {
  flex: 1 1 140px;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
}
.btn-aprobar {
  background: #059669;
  color: #fff;
}
.btn-bloquear {
  background: var(--surface);
  color: #b91c1c;
  border-color: #fca5a5;
}
.btn-pago {
  background: #111827;
  color: #fff;
}
.btn:hover {
  filter: brightness(1.05);
}

.card-alerta {
  border-left: 5px solid #f59e0b;
}
.evento-pendiente {
  border-left-color: #f59e0b;
  background: #fffbeb;
  border-radius: 0 10px 10px 0;
  padding-right: 10px;
}
.referencia strong {
  font-size: 1rem;
  color: var(--text);
  letter-spacing: 0.3px;
}
.rojo {
  color: #b91c1c;
}
.aviso-acciones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.aviso-acciones .btn {
  flex: 0 1 auto;
  padding: 8px 14px;
  font-size: 0.85rem;
}
.btn-secundario {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}
.historial-avisos {
  margin-top: 10px;
}
.historial-avisos summary {
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.evento {
  padding: 8px 0 8px 14px;
  border-left: 3px solid #d1fae5;
}
.evento-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.fecha {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
}
.evento-det {
  margin: 3px 0 0;
  font-size: 0.83rem;
  color: var(--text);
}
@media (max-width: 480px) {
  .cabecera {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .nombre-row {
    justify-content: center;
  }
}
</style>
