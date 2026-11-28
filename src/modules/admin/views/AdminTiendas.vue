<template>
  <div class="admin-container">
    <AdminTopbar titulo="Tiendas" />

    <main class="admin-main">
      <!-- Control rápido: abrir/cerrar el registro de tiendas nuevas.
           Cerrar NO afecta a los clientes ni a las tiendas existentes. -->
      <div class="registro-toggle" :class="{ cerrado: !registroTiendasAbierto }">
        <div class="registro-info">
          <strong>Registro de tiendas nuevas: {{ registroTiendasAbierto ? 'Abierto' : 'Cerrado' }}</strong>
          <span>
            {{ registroTiendasAbierto
              ? 'Cualquiera puede registrar una tienda. Ciérralo cuando necesites pausar altas nuevas.'
              : 'Nadie puede registrar tiendas nuevas. Los clientes siguen comprando y las tiendas existentes siguen operando.' }}
          </span>
        </div>
        <button
          type="button"
          class="btn"
          :class="registroTiendasAbierto ? 'btn-cerrar-registro' : 'btn-abrir-registro'"
          :disabled="guardandoRegistro"
          @click="alternarRegistro"
        >
          {{ guardandoRegistro ? 'Guardando...' : (registroTiendasAbierto ? 'Cerrar registro' : 'Abrir registro') }}
        </button>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <div class="chips">
          <button
            v-for="f in FILTROS"
            :key="f.clave"
            type="button"
            class="chip"
            :class="[{ active: filtro === f.clave }, 'chip-' + f.clave]"
            @click="filtro = f.clave"
          >
            {{ f.label }}
            <span class="chip-count">{{ conteo[f.clave] }}</span>
          </button>
        </div>
        <input
          id="buscar-tienda-admin"
          v-model="busqueda"
          type="search"
          class="search-input"
          placeholder="Buscar por nombre, celular, municipio o categoría..."
          aria-label="Buscar tienda"
        />
      </div>

      <p v-if="loading" class="empty">Cargando tiendas...</p>
      <p v-else-if="!tiendasFiltradas.length" class="empty">No hay tiendas con ese filtro.</p>

      <!-- Lista -->
      <ul v-else class="lista">
        <li v-for="t in tiendasFiltradas" :key="t.tiendaId" class="fila" :data-tienda="t.tiendaId">
          <img :src="t.logoUrl || placeholderLogo" alt="" class="logo" @error="onImgError" />

          <div class="info">
            <div class="nombre-row">
              <router-link :to="`/admin/tiendas/${t.tiendaId}`" class="nombre">{{ t.nombreTienda }}</router-link>
              <span class="estatus" :class="'estatus-' + estadoDe(t)">{{ ESTADO_LABEL[estadoDe(t)] }}</span>
              <span v-if="etiquetaPrueba(t)" class="estatus estatus-prueba">{{ etiquetaPrueba(t) }}</span>
              <span v-if="conAviso.has(t.tiendaId || '')" class="estatus estatus-aviso" title="La tienda avisó que ya pagó; confírmalo en el tablero">Pago por confirmar</span>
            </div>
            <p class="meta">
              {{ t.categoria || 'Sin categoría' }} · {{ etiquetaTipoNegocio(tipoDeTienda(t)) }} · {{ t.municipio || 'Sin municipio' }} · {{ formatTelefono(t.telefono) }}
            </p>
            <p class="meta vigencia">{{ textoVigencia(t) }}</p>
            <p v-if="estadoDe(t) === 'bloqueada' && t.motivoBloqueo" class="motivo">Motivo: {{ t.motivoBloqueo }}</p>
          </div>

          <div class="acciones">
            <button
              v-if="estadoDe(t) === 'pendiente'"
              type="button"
              class="btn btn-aprobar"
              @click="aprobar(t)"
            >
              Aprobar
            </button>
            <button
              v-if="estadoDe(t) === 'bloqueada'"
              type="button"
              class="btn btn-aprobar"
              @click="desbloquear(t)"
            >
              Desbloquear
            </button>
            <button
              v-if="estadoDe(t) === 'activa' || estadoDe(t) === 'vencida'"
              type="button"
              class="btn btn-bloquear"
              @click="bloquear(t)"
            >
              Bloquear
            </button>
            <button type="button" class="btn btn-pago" @click="abrirPago(t)">Registrar pago</button>
            <router-link :to="`/admin/tiendas/${t.tiendaId}`" class="btn btn-detalle">Detalle</router-link>
          </div>
        </li>
      </ul>

      <!-- Limpiar datos de prueba: artículos de TODAS las tiendas -->
      <section class="zona-peligro-global" data-testid="zona-global">
        <h2>Limpiar datos de prueba</h2>
        <p>Borra los artículos (con sus promociones y fotos) de <strong>todas</strong> las tiendas. Las tiendas, sus perfiles y los pedidos ya hechos no se tocan. No se puede deshacer.</p>
        <button type="button" class="btn-peligro" :disabled="vaciandoTodas" data-testid="vaciar-todas" @click="vaciarTodas">
          {{ vaciandoTodas ? 'Borrando…' : 'Vaciar artículos de todas las tiendas' }}
        </button>
      </section>
    </main>

    <PagoMembresiaModal
      :visible="pagoVisible"
      :tienda="tiendaPago"
      @close="pagoVisible = false"
      @saved="onPagoGuardado"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import PagoMembresiaModal from '../components/PagoMembresiaModal.vue';
import { leerPlanVaciado, vaciarArticulos } from '@/composables/vaciarArticulos';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { estadoEfectivo, diasParaVencer, etiquetaPrueba, ESTADO_LABEL, type EstadoEfectivo } from '@/composables/useMembresia';
import { aprobarTienda, bloquearTienda, desbloquearTienda, type PagoRegistrado } from '@/composables/useAdminTiendas';
import { etiquetaTipoNegocio, tipoDeTienda } from '@/modules/servicios/negocio';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { useSolicitudesPago } from '@/composables/useSolicitudesPago';
import { useConfiguracion } from '@/composables/useConfiguracion';

// Abrir/cerrar el registro de tiendas nuevas desde esta pantalla (mismo flag que /admin/configuracion)
const { registroTiendasAbierto, guardarConfiguracion } = useConfiguracion();
const guardandoRegistro = ref(false);
async function alternarRegistro() {
  const abrir = !registroTiendasAbierto.value;
  guardandoRegistro.value = true;
  try {
    await guardarConfiguracion({ registro: { tiendasAbierto: abrir } });
    Swal.fire({ toast: true, position: 'bottom', timer: 1800, showConfirmButton: false, icon: 'success', title: abrir ? 'Registro de tiendas abierto' : 'Registro de tiendas cerrado' });
  } catch {
    Swal.fire({ toast: true, position: 'bottom', timer: 2200, showConfirmButton: false, icon: 'error', title: 'No se pudo guardar el cambio' });
  } finally {
    guardandoRegistro.value = false;
  }
}

type Filtro = 'todas' | EstadoEfectivo | 'por-vencer';
const FILTROS: { clave: Filtro; label: string }[] = [
  { clave: 'todas', label: 'Todas' },
  { clave: 'pendiente', label: 'Pendientes' },
  { clave: 'activa', label: 'Activas' },
  { clave: 'por-vencer', label: 'Por vencer' },
  { clave: 'vencida', label: 'Vencidas' },
  { clave: 'bloqueada', label: 'Bloqueadas' },
];

const route = useRoute();
const router = useRouter();
const { tiendas, loading, cargarTiendas } = useTiendas();
onMounted(() => cargarTiendas());
const { solicitudes } = useSolicitudesPago({ soloPendientes: true });
const conAviso = computed(() => new Set(solicitudes.value.map((s) => s.tiendaId)));

const filtroInicial = FILTROS.some((f) => f.clave === route.query.filtro) ? (route.query.filtro as Filtro) : 'todas';
const filtro = ref<Filtro>(filtroInicial);
const busqueda = ref('');
watch(filtro, (f) => router.replace({ query: f === 'todas' ? {} : { filtro: f } }));

const estadoDe = (t: Tienda) => estadoEfectivo(t);
const porVencer = (t: Tienda) => {
  const d = diasParaVencer(t);
  return estadoDe(t) === 'activa' && d !== null && d <= 7;
};

const cumpleFiltro = (t: Tienda, f: Filtro) =>
  f === 'todas' ? true : f === 'por-vencer' ? porVencer(t) : estadoDe(t) === f;

const conteo = computed(() =>
  Object.fromEntries(FILTROS.map((f) => [f.clave, tiendas.value.filter((t) => cumpleFiltro(t, f.clave)).length])) as Record<Filtro, number>,
);

const normalizar = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const tiendasFiltradas = computed(() => {
  const q = normalizar(busqueda.value.trim());
  return tiendas.value
    .filter((t) => cumpleFiltro(t, filtro.value))
    .filter(
      (t) =>
        !q ||
        normalizar(t.nombreTienda).includes(q) ||
        normalizar(t.municipio).includes(q) ||
        normalizar(t.categoria).includes(q) ||
        String(t.telefono || '').includes(q.replace(/\D/g, '') || q),
    )
    .sort((a, b) => {
      // pendientes primero, luego por nombre
      const pa = estadoDe(a) === 'pendiente' ? 0 : 1;
      const pb = estadoDe(b) === 'pendiente' ? 0 : 1;
      return pa - pb || (a.nombreTienda || '').localeCompare(b.nombreTienda || '');
    });
});

function formatTelefono(tel?: string) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : tel || '';
}

function textoVigencia(t: Tienda) {
  const hasta = t.membresia?.vigenteHasta;
  if (!hasta) return 'Sin membresía registrada';
  const d = diasParaVencer(t) ?? 0;
  if (d < 0) return `Venció el ${hasta} (hace ${-d} día${d === -1 ? '' : 's'})`;
  if (d === 0) return `Vence hoy (${hasta})`;
  return `Vigente hasta ${hasta} · ${d} día${d === 1 ? '' : 's'}`;
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}

const toast = (title: string, icon: 'success' | 'error' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2200, showConfirmButton: false, icon, title });

async function aprobar(t: Tienda) {
  const r = await Swal.fire({
    icon: 'question',
    title: `¿Aprobar "${t.nombreTienda}"?`,
    text: 'La tienda quedará visible para los clientes y podrá recibir pedidos.',
    showCancelButton: true,
    confirmButtonText: 'Aprobar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
  });
  if (!r.isConfirmed) return;
  try {
    await aprobarTienda(t);
    toast('Tienda aprobada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo aprobar', 'error');
  }
}

async function bloquear(t: Tienda) {
  const r = await Swal.fire({
    icon: 'warning',
    title: `Bloquear "${t.nombreTienda}"`,
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
    await bloquearTienda(t, r.value);
    toast('Tienda bloqueada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo bloquear', 'error');
  }
}

async function desbloquear(t: Tienda) {
  const r = await Swal.fire({
    icon: 'question',
    title: `¿Desbloquear "${t.nombreTienda}"?`,
    text: 'Volverá a estar activa. Si su membresía está vencida seguirá sin vender hasta registrar el pago.',
    showCancelButton: true,
    confirmButtonText: 'Desbloquear',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#059669',
  });
  if (!r.isConfirmed) return;
  try {
    await desbloquearTienda(t);
    toast('Tienda desbloqueada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo desbloquear', 'error');
  }
}

/* ---------- Vaciar los artículos de TODAS las tiendas (datos de prueba) ---------- */
const vaciandoTodas = ref(false);
async function vaciarTodas() {
  if (vaciandoTodas.value) return;
  vaciandoTodas.value = true;
  try {
    const plan = await leerPlanVaciado(null);
    if (!plan.articulos.length) {
      await Swal.fire({ icon: 'info', title: 'No hay artículos', text: 'Ninguna tienda tiene artículos.', confirmButtonColor: 'var(--color-bg-blue-ligth)' });
      return;
    }
    const tiendas = new Set(plan.articulos.map((a) => a.tiendaId)).size;
    const r = await Swal.fire({
      icon: 'warning',
      title: '¿Vaciar los artículos de TODAS las tiendas?',
      html: `Se borrarán <b>${plan.articulos.length} artículo(s)</b> de ${tiendas} tienda(s)${plan.promociones.length ? `, ${plan.promociones.length} promoción(es)` : ''} y sus fotos.<br>No se puede deshacer.`,
      input: 'text',
      inputPlaceholder: 'Escribe VACIAR TODO para confirmar',
      showCancelButton: true,
      confirmButtonText: 'Borrar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c0392b',
      inputValidator: (v: string) => (String(v).trim().toUpperCase() === 'VACIAR TODO' ? null : 'Escribe VACIAR TODO para continuar'),
    });
    if (!r.isConfirmed || String(r.value ?? '').trim().toUpperCase() !== 'VACIAR TODO') return;
    const res = await vaciarArticulos(null, plan); // el plan que se vio y confirmó
    await Swal.fire({ icon: 'success', title: 'Artículos borrados', text: `${res.articulos} artículo(s) y ${res.promociones} promoción(es).`, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
  } catch (e: any) {
    await Swal.fire({ icon: 'error', title: 'No se pudo vaciar', text: e?.message || 'Intenta de nuevo.' });
  } finally {
    vaciandoTodas.value = false;
  }
}

const pagoVisible = ref(false);
const tiendaPago = ref<Tienda | null>(null);
function abrirPago(t: Tienda) {
  tiendaPago.value = t;
  pagoVisible.value = true;
}
function onPagoGuardado(p: PagoRegistrado) {
  pagoVisible.value = false;
  toast(`Pago registrado · vigente hasta ${p.vigenteHasta}`);
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--surface-2);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: var(--text);
}
.admin-main {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 3rem;
}

/* Filtros */
.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 1rem;
}
.registro-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.registro-toggle.cerrado {
  border-color: #e11d48;
  border-width: 1.5px;
}
.registro-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.registro-info strong {
  color: var(--text);
  font-size: 0.95rem;
}
.registro-info span {
  color: var(--text-muted);
  font-size: 0.82rem;
}
.btn-cerrar-registro {
  background: var(--surface);
  color: var(--peligro-texto);
  border-color: #fca5a5;
}
.btn-abrir-registro {
  background: #059669;
  color: #fff;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}
.chip-count {
  font-size: 0.72rem;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
}
.chip.active {
  border-color: #111827;
  background: #111827;
  color: #fff;
}
.chip.active .chip-count {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.search-input {
  width: 100%;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--surface);
}
.search-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 0;
}

/* Lista */
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fila {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
  background: var(--surface);
  border-radius: 16px;
  padding: 0.9rem 1rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}
.logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
  background: var(--surface-2);
}
.info {
  min-width: 0;
}
.nombre-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nombre {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  text-decoration: none;
}
.nombre:hover {
  text-decoration: underline;
}
.meta {
  margin: 2px 0 0;
  font-size: 0.83rem;
  color: var(--text-muted);
}
.vigencia {
  font-weight: 500;
}
.motivo {
  margin: 4px 0 0;
  font-size: 0.83rem;
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
.estatus-pendiente {
  background: var(--brand-blue-soft);
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
.estatus-prueba {
  background: #f3e8ff;
  color: #6b21a8;
}
.estatus-aviso {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.acciones {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}
.btn {
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.83rem;
  cursor: pointer;
  border: 1px solid transparent;
  text-align: center;
  text-decoration: none;
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
.btn-bloquear:hover {
  background: var(--peligro-fondo);
}
.btn-pago {
  background: #111827;
  color: #fff;
}
.btn-detalle {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}
.btn:hover {
  filter: brightness(1.05);
}

@media (max-width: 640px) {
  .fila {
    grid-template-columns: 48px 1fr;
  }
  .logo {
    width: 48px;
    height: 48px;
  }
  .acciones {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .acciones .btn {
    flex: 1 1 45%;
  }
}

.zona-peligro-global { margin: 28px 0 12px; padding: 14px; border: 1px solid #e8b4ad; border-radius: 12px; background: var(--surface); text-align: left; }
.zona-peligro-global h2 { margin: 0 0 6px; font-size: 1rem; }
.zona-peligro-global p { margin: 0 0 10px; font-size: 0.86rem; line-height: 1.4; color: var(--text-muted); }
.btn-peligro { border: 0; border-radius: 10px; padding: 10px 14px; background: #c0392b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.btn-peligro:disabled { opacity: 0.6; cursor: wait; }
</style>
