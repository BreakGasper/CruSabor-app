<template>
  <div v-if="sorteo" class="sd-overlay" @click.self="$emit('close')" @keydown.escape="$emit('close')">
    <div class="sd-modal" role="dialog" aria-modal="true" aria-labelledby="sd-titulo" data-testid="detalle-sorteo">
      <header class="sd-cab">
        <div class="sd-cab-texto">
          <h3 id="sd-titulo">{{ sorteo.titulo }}</h3>
          <p class="sd-sub">
            <span :class="'est est-' + estadoSorteo(sorteo)">{{ ESTADO_SORTEO_LABEL[estadoSorteo(sorteo)] }}</span>
            <span v-if="sorteo.premio"> · 🏆 {{ sorteo.premio }}</span>
            <span v-if="sorteo.fechaInicio || sorteo.fechaFin"> · {{ sorteo.fechaInicio || '…' }} → {{ sorteo.fechaFin || '…' }}</span>
          </p>
        </div>
        <button type="button" class="sd-cerrar" aria-label="Cerrar" data-testid="cerrar-detalle" @click="$emit('close')">✕</button>
      </header>

      <div class="sd-cuerpo">
        <!-- Cifras -->
        <ul class="sd-cifras" aria-label="Resumen">
          <li><strong data-testid="n-participantes">{{ participantes.length }}</strong><span>Participantes</span></li>
          <li><strong data-testid="n-tiendas">{{ tiendasConCodigo }}</strong><span>Tiendas</span></li>
          <li><strong>{{ sorteo.codigos.length }}</strong><span>Códigos</span></li>
          <li><strong>{{ usosTotales }}</strong><span>Usos</span></li>
        </ul>

        <!-- Tiendas participantes y sus códigos -->
        <section class="sd-seccion">
          <h4>Tiendas participantes</h4>
          <div class="form-codigo">
            <select v-model="nuevo.tiendaId" class="sd-input" data-testid="tienda-codigo">
              <option value="">Elige una tienda…</option>
              <option v-for="t in tiendas" :key="t.tiendaId" :value="t.tiendaId">{{ t.nombreTienda }}</option>
            </select>
            <input v-model="nuevo.codigo" class="sd-input" maxlength="24" placeholder="Código (vacío = se genera uno)" data-testid="codigo-propio" />
            <input v-model.number="nuevo.limite" type="number" min="0" class="sd-input corto" placeholder="Límite" title="Veces que se puede usar (0 = sin límite)" />
            <button type="button" class="sd-btn pri" :disabled="agregando" data-testid="agregar-codigo" @click="agregar">Agregar</button>
          </div>
          <p class="sd-pista">Límite de usos: cuántas personas pueden entrar con ese código (0 = sin límite).</p>

          <p v-if="!resumen.length" class="sd-vacio">Aún no hay tiendas. Crea un código por cada tienda patrocinadora.</p>
          <ul v-else class="tiendas" data-testid="resumen-tiendas">
            <li v-for="r in resumen" :key="r.tiendaId" class="tienda" :data-tienda="r.tiendaId">
              <div class="tienda-cab">
                <img :src="logoDe(r.tiendaId)" alt="" class="logo" @error="onImgError" />
                <span class="tienda-nombre">{{ r.nombreTienda }}</span>
                <strong class="tienda-cuenta" :title="`${r.participantes} participante(s)`">{{ r.participantes }}</strong>
              </div>
              <div class="barra" aria-hidden="true"><span :style="{ width: porcentaje(r.participantes) + '%' }" /></div>
              <div v-for="c in codigosDe(r.tiendaId)" :key="c.codigo" class="codigo" :class="{ inactivo: !c.activo }">
                <strong class="cod" :data-codigo="c.codigo">{{ c.codigo }}</strong>
                <span class="sd-pista">{{ c.usos }}{{ c.limite ? ` / ${c.limite}` : '' }} uso(s){{ c.activo ? '' : ' · desactivado' }}</span>
                <span class="acciones-codigo">
                  <button type="button" class="sd-btn mini" @click="copiar(c.codigo)">Copiar</button>
                  <button type="button" class="sd-btn mini" @click="alternarCodigo(sorteo.id, c.codigo, !c.activo)">{{ c.activo ? 'Desactivar' : 'Activar' }}</button>
                  <button type="button" class="sd-btn mini peligro" @click="quitarCodigo(c.codigo)">Quitar</button>
                </span>
              </div>
            </li>
          </ul>
        </section>

        <!-- Clientes registrados en el sorteo -->
        <section class="sd-seccion">
          <h4>Clientes registrados ({{ participantes.length }})</h4>
          <div v-if="participantes.length" class="filtros">
            <input v-model="busqueda" type="search" class="sd-input" placeholder="Buscar por nombre, teléfono o código" data-testid="buscar-participante" />
            <select v-model="filtroTienda" class="sd-input" data-testid="filtro-tienda">
              <option value="">Todas las tiendas</option>
              <option v-for="r in resumen" :key="r.tiendaId" :value="r.tiendaId">{{ r.nombreTienda }} ({{ r.participantes }})</option>
            </select>
          </div>

          <p v-if="cargandoParticipantes" class="sd-vacio">Cargando…</p>
          <p v-else-if="!participantes.length" class="sd-vacio">Todavía no participa nadie.</p>
          <p v-else-if="!filtrados.length" class="sd-vacio">Nadie coincide con esa búsqueda.</p>
          <template v-else>
            <ul class="participantes" data-testid="lista-participantes">
              <li v-for="p in visibles" :key="p.clienteId" class="participante" :data-cliente="p.clienteId">
                <div class="p-datos">
                  <strong>{{ p.nombre || 'Sin nombre' }}</strong>
                  <a v-if="p.telefono" :href="`tel:${p.telefono}`" class="p-tel">📞 {{ p.telefono }}</a>
                </div>
                <div class="p-meta">
                  <span>🏪 {{ p.nombreTienda || p.tiendaId }}</span>
                  <span class="p-codigo">{{ p.codigo }}</span>
                  <span>{{ fechaHoraCorta(p.fecha) }}</span>
                </div>
              </li>
            </ul>
            <button v-if="filtrados.length > limite" type="button" class="sd-btn" data-testid="mostrar-mas" @click="limite += PAGINA">
              Mostrar más ({{ filtrados.length - limite }} restantes)
            </button>
          </template>
        </section>

        <!-- Ganador -->
        <section class="sd-seccion">
          <h4>Ganador</h4>
          <ul v-if="sorteo.ganadores.length" class="ganadores" data-testid="ganadores">
            <li v-for="g in sorteo.ganadores" :key="g.id">
              🎉 <strong>{{ g.nombre }}</strong>
              <span v-if="g.telefono"> · 📞 {{ g.telefono }}</span>
              <span v-if="g.nombreTienda"> · vino por {{ g.nombreTienda }} ({{ g.codigo }})</span>
            </li>
          </ul>
          <button type="button" class="sd-btn pri" :disabled="sorteando || !participantes.length" data-testid="sortear" @click="sortear">
            {{ sorteando ? 'Sorteando…' : sorteo.ganadores.length ? 'Sortear otro ganador' : '🎲 Sortear ganador' }}
          </button>
          <p class="sd-pista">Al sortear se cierra la participación. El ganador se elige al azar entre todos los participantes que no hayan ganado ya.</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Swal from 'sweetalert2';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { sessionAdmin } from '@/utils/sessionAdmin';
import type { Tienda } from '@/composables/useTiendas';
import { fechaHoraCorta } from '@/modules/servicios/formato';
import {
  useParticipantes,
  agregarCodigo,
  alternarCodigo,
  eliminarCodigo,
  sortearGanador,
  estadoSorteo,
  participantesPorTienda,
  ESTADO_SORTEO_LABEL,
  ErrorSorteo,
  type Sorteo,
} from '@/composables/useSorteos';

/**
 * Detalle de un sorteo para el administrador: cifras, tiendas participantes con sus códigos,
 * clientes registrados (con búsqueda y filtro por tienda) y el sorteo del ganador.
 */
const props = defineProps<{ sorteo: Sorteo | null; tiendas: Tienda[] }>();
defineEmits<{ close: [] }>();

const { participantes, cargando: cargandoParticipantes, observar } = useParticipantes(() => props.sorteo?.id ?? null);
const resumen = computed(() => participantesPorTienda(participantes.value, props.sorteo?.codigos ?? []));
const tiendasConCodigo = computed(() => new Set((props.sorteo?.codigos ?? []).map((c) => c.tiendaId)).size);
const usosTotales = computed(() => (props.sorteo?.codigos ?? []).reduce((n, c) => n + c.usos, 0));
const maximo = computed(() => Math.max(1, ...resumen.value.map((r) => r.participantes)));
const porcentaje = (n: number) => Math.round((n / maximo.value) * 100);
const codigosDe = (tiendaId: string) => (props.sorteo?.codigos ?? []).filter((c) => c.tiendaId === tiendaId);
const logoDe = (tiendaId: string) => (props.sorteo?.codigos ?? []).find((c) => c.tiendaId === tiendaId)?.logoUrl || placeholderLogo;

/* Clientes: búsqueda, filtro por tienda y paginación (50 en 50) */
const PAGINA = 50;
const busqueda = ref('');
const filtroTienda = ref('');
const limite = ref(PAGINA);
const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const filtrados = computed(() => {
  const q = sinAcentos(busqueda.value.trim());
  return [...participantes.value]
    .filter((p) => !filtroTienda.value || p.tiendaId === filtroTienda.value)
    .filter((p) => !q || sinAcentos(`${p.nombre} ${p.telefono ?? ''} ${p.codigo} ${p.nombreTienda ?? ''}`).includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
});
const visibles = computed(() => filtrados.value.slice(0, limite.value));
watch([busqueda, filtroTienda], () => (limite.value = PAGINA));

// Al abrir otro sorteo se empieza limpio y se leen sus participantes
watch(() => props.sorteo?.id, () => {
  busqueda.value = '';
  filtroTienda.value = '';
  limite.value = PAGINA;
  observar();
}, { immediate: true });

/* Códigos */
const nuevo = reactive({ tiendaId: '', codigo: '', limite: 0 });
const agregando = ref(false);
const textoError = (e: any) => (e instanceof ErrorSorteo ? e.message : e?.message || 'Intenta de nuevo.');
const aviso = (icon: 'success' | 'warning', title: string, text = '') => Swal.fire({ icon, title, text, confirmButtonColor: 'var(--color-bg-blue-ligth)' });

async function agregar() {
  const s = props.sorteo;
  const t = props.tiendas.find((x) => x.tiendaId === nuevo.tiendaId);
  if (!s) return;
  if (!t) {
    await aviso('warning', 'Elige una tienda');
    return;
  }
  agregando.value = true;
  try {
    const codigo = await agregarCodigo(s.id, { tiendaId: t.tiendaId!, nombreTienda: t.nombreTienda, logoUrl: t.logoUrl }, { codigo: nuevo.codigo, limite: nuevo.limite });
    Object.assign(nuevo, { tiendaId: '', codigo: '', limite: 0 });
    await Swal.fire({ icon: 'success', title: 'Código creado', html: `Entrégaselo a <b>${t.nombreTienda.replace(/[<>&]/g, '')}</b>:<br><b style="font-size:1.4rem;letter-spacing:.08em">${codigo}</b>`, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
  } catch (e: any) {
    await aviso('warning', 'No se pudo crear el código', textoError(e));
  } finally {
    agregando.value = false;
  }
}

async function copiar(codigo: string) {
  try {
    await navigator.clipboard.writeText(codigo);
    Swal.fire({ toast: true, position: 'bottom', timer: 1200, showConfirmButton: false, icon: 'success', title: 'Código copiado' });
  } catch {
    await aviso('success', codigo, 'Copia el código manualmente.');
  }
}

async function quitarCodigo(codigo: string) {
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Quitar el código ${codigo}?`,
    text: 'Nadie más podrá entrar con él. Quienes ya participan con ese código siguen participando.',
    showCancelButton: true,
    confirmButtonText: 'Quitar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (r.isConfirmed && props.sorteo) await eliminarCodigo(props.sorteo.id, codigo);
}

/* Sorteo */
const sorteando = ref(false);
async function sortear() {
  const s = props.sorteo;
  if (!s) return;
  const r = await Swal.fire({
    icon: 'question',
    title: s.ganadores.length ? '¿Sortear otro ganador?' : '¿Sortear ahora?',
    text: `Se elegirá al azar entre ${participantes.value.length} participante(s) y se cerrará la participación.`,
    showCancelButton: true,
    confirmButtonText: 'Sortear',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--color-bg-blue-ligth)',
  });
  if (!r.isConfirmed) return;
  sorteando.value = true;
  try {
    const g = await sortearGanador(s.id, sessionAdmin.value?.nombre || 'admin');
    const esc = (t: string) => String(t).replace(/[<>&]/g, '');
    await Swal.fire({
      icon: 'success',
      title: '🎉 ¡Tenemos ganador!',
      html: `<b style="font-size:1.2rem">${esc(g.nombre)}</b>${g.telefono ? `<br>📞 ${esc(g.telefono)}` : ''}${g.nombreTienda ? `<br>Vino por <b>${esc(g.nombreTienda)}</b> (${esc(g.codigo || '')})` : ''}`,
      confirmButtonColor: 'var(--color-bg-blue-ligth)',
    });
  } catch (e: any) {
    await aviso('warning', 'No se pudo sortear', textoError(e));
  } finally {
    sorteando.value = false;
  }
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = placeholderLogo;
}
</script>

<style scoped>
.sd-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 0.75rem; background: rgba(17, 24, 39, 0.6); overscroll-behavior: contain; }
.sd-modal { width: 100%; max-width: 720px; max-height: calc(100dvh - 1.5rem); display: flex; flex-direction: column; border-radius: 18px; background: var(--surface); color: var(--text); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); overflow: hidden; text-align: left; }
.sd-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.sd-cab h3 { margin: 0; font-size: 1.1rem; }
.sd-sub { margin: 4px 0 0; color: var(--text-muted); font-size: 0.82rem; }
.sd-cerrar { flex: none; width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--text); font-size: 1rem; cursor: pointer; }
.sd-cuerpo { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 18px; }
.est { font-weight: 700; }
.est-abierto { color: var(--ok-texto); }
.est-pausado, .est-terminado { color: var(--peligro-texto); }
.est-proximo { color: var(--brand-blue-text); }
.est-sorteado { color: var(--aviso-texto); }
.sd-cifras { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.sd-cifras li { display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border-radius: 12px; background: var(--brand-blue-soft); }
.sd-cifras strong { font-size: 1.35rem; color: var(--brand-blue-text); }
.sd-cifras span { font-size: 0.72rem; color: var(--text-muted); }
.sd-seccion { display: flex; flex-direction: column; gap: 10px; }
.sd-seccion h4 { margin: 0; font-size: 0.98rem; }
.sd-pista { margin: 0; color: var(--text-muted); font-size: 0.78rem; }
.sd-vacio { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
.sd-input { padding: 9px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; font-size: 16px; min-width: 0; }
.sd-btn { padding: 9px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
.sd-btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.sd-btn.mini { padding: 5px 9px; font-size: 0.75rem; }
.sd-btn.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
.sd-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.form-codigo { display: grid; grid-template-columns: 1.4fr 1.2fr 90px auto; gap: 8px; }
.tiendas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.tienda { padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
.tienda-cab { display: flex; align-items: center; gap: 10px; }
.logo { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; background: var(--surface-2); flex: none; }
.tienda-nombre { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tienda-cuenta { padding: 2px 10px; border-radius: 999px; background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.barra { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.barra span { display: block; height: 100%; border-radius: 999px; background: var(--brand-blue-text); }
.codigo { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 6px 8px; border-radius: 9px; background: var(--surface-2); }
.codigo.inactivo { opacity: 0.6; }
.cod { letter-spacing: 0.08em; }
.acciones-codigo { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
.filtros { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; }
.participantes, .ganadores { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.participante { padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); display: flex; flex-direction: column; gap: 4px; }
.p-datos { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.p-tel { color: var(--brand-blue-text); font-size: 0.85rem; text-decoration: none; }
.p-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--text-muted); font-size: 0.78rem; }
.p-codigo { letter-spacing: 0.06em; font-weight: 700; color: var(--text); }
.ganadores li { padding: 8px 10px; border-radius: 8px; background: var(--aviso-fondo); color: var(--aviso-texto); font-size: 0.9rem; }
@media (max-width: 600px) {
  .form-codigo { grid-template-columns: 1fr 1fr; }
  .form-codigo .sd-btn { grid-column: 1 / -1; }
  .filtros { grid-template-columns: 1fr; }
  .sd-cifras { grid-template-columns: repeat(2, 1fr); }
}
</style>
