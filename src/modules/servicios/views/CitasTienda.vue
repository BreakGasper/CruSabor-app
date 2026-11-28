<template>
  <div class="pantalla">
    <PageHeader title="Citas" :fallback="`/store/profile/${tiendaId}`" />

    <main v-if="!esDueno" class="contenido" data-testid="no-es-dueno">
      <p class="vacio">Inicia sesión como esta tienda para ver sus citas.</p>
      <button type="button" class="btn pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <!-- Calendario de próximas citas -->
      <CalendarioMes :mes="mes" :seleccionada="dia" :marcadas="diasConCitas" @cambiar-mes="mes = $event" @seleccionar="elegirDia" />

      <nav class="filtros" aria-label="Filtrar citas">
        <button v-for="f in filtros" :key="f.id" type="button" class="filtro" :class="{ on: filtro === f.id }" :data-filtro="f.id" @click="filtro = f.id">
          {{ f.texto }}<span class="cuenta">{{ f.cuenta }}</span>
        </button>
      </nav>

      <p v-if="cargando" class="vacio">Cargando…</p>
      <p v-else-if="!visibles.length" class="vacio" data-testid="sin-citas">{{ vacioTexto }}</p>

      <ul v-else class="lista">
        <li v-for="c in visibles" :key="c.id" class="cita" :data-cita="c.id">
          <header class="cita-cab">
            <div class="cita-titulo">
              <strong>{{ c.servicioNombre }}</strong>
              <small>{{ c.clienteNombre || 'Cliente' }}<template v-if="c.profesionalNombre"> · con {{ c.profesionalNombre }}</template></small>
            </div>
            <InsigniaEstado :tono="TONO_CITA[c.estado]" :texto="ETIQUETA_CITA[c.estado]" />
          </header>
          <p class="cuando">📅 {{ fechaDia(c.fecha) }} · {{ c.inicio }}–{{ c.fin }}</p>
          <ul class="datos">
            <li v-if="c.clienteTelefono">📞 {{ c.clienteTelefono }}</li>
            <li v-if="c.adomicilio">🏠 A domicilio: {{ c.direccion }}</li>
            <li v-if="c.comentarios">💬 {{ c.comentarios }}</li>
          </ul>
          <div class="acciones">
            <button v-for="a in accionesDe(c)" :key="a.id" type="button" class="btn" :class="a.clase" :data-accion="a.id" @click="a.hacer(c)">{{ a.texto }}</button>
            <a v-if="enlaceWa(c)" :href="enlaceWa(c)" target="_blank" rel="noopener" class="btn wa" data-testid="whatsapp">WhatsApp</a>
          </div>
        </li>
      </ul>
    </main>

    <ReprogramarCitaModal :visible="!!reprogramando" :cita="reprogramando" @close="reprogramando = null" @saved="reprogramando = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import CalendarioMes from '../components/CalendarioMes.vue';
import InsigniaEstado from '../components/InsigniaEstado.vue';
import ReprogramarCitaModal from '../components/ReprogramarCitaModal.vue';
import { ahoraEnZona } from '../disponibilidad';
import { ETIQUETA_CITA, TONO_CITA, accionesDeCita, citaOcupaHorario } from '../estados';
import { esDuenoDeTienda } from '../sesion';
import { ErrorServicio, mensajeError } from '../catalogo';
import { cambiarEstadoCita, citaYaEmpezo, citasPorConfirmar, citasProximas, enlaceWhatsappCita, useCitasTienda } from '../agenda';
import { fechaDia } from '../formato';
import type { Cita, EstadoCita } from '../tipos';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const { citas, cargando } = useCitasTienda(() => (esDueno.value ? tiendaId.value : undefined));

const mes = ref(ahoraEnZona().fecha.slice(0, 7));
const dia = ref('');
type FiltroId = 'confirmar' | 'proximas' | 'dia' | 'historial';
const filtro = ref<FiltroId>('proximas');
const reprogramando = ref<Cita | null>(null);

const activas = computed(() => citas.value.filter((c) => citaOcupaHorario(c.estado) && c.estado !== 'completada'));
const diasConCitas = computed(() => new Set(activas.value.map((c) => c.fecha)));
const delDia = computed(() => citas.value.filter((c) => c.fecha === dia.value));
const proximas = computed(() => citasProximas(citas.value, ahoraEnZona(), 60));
const porConfirmar = computed(() => citas.value.filter((c) => c.estado === 'pendiente'));
const historial = computed(() => [...citas.value].filter((c) => !citasProximas([c], ahoraEnZona(), 3650).length).reverse());

const filtros = computed(() => [
  { id: 'confirmar' as FiltroId, texto: 'Por confirmar', cuenta: citasPorConfirmar(citas.value) },
  { id: 'proximas' as FiltroId, texto: 'Próximas', cuenta: proximas.value.length },
  ...(dia.value ? [{ id: 'dia' as FiltroId, texto: fechaDia(dia.value), cuenta: delDia.value.length }] : []),
  { id: 'historial' as FiltroId, texto: 'Historial', cuenta: historial.value.length },
]);
const visibles = computed(() => ({ confirmar: porConfirmar.value, proximas: proximas.value, dia: delDia.value, historial: historial.value })[filtro.value]);
const vacioTexto = computed(() => ({ confirmar: 'No tienes citas por confirmar.', proximas: 'No hay citas próximas.', dia: 'Ese día no tienes citas.', historial: 'Todavía no hay historial.' })[filtro.value]);

function elegirDia(f: string) {
  dia.value = f;
  filtro.value = 'dia';
}

const enlaceWa = (c: Cita) => enlaceWhatsappCita(c.clienteTelefono, c, 'tienda');

async function seguro(accion: () => Promise<void>) {
  try {
    await accion();
  } catch (e: any) {
    await Swal.fire({ icon: 'warning', title: 'No se pudo actualizar', text: mensajeError(e) });
  }
}

async function cancelarORechazar(c: Cita, estado: EstadoCita) {
  const rechazar = estado === 'rechazada';
  const r = await Swal.fire({
    icon: 'warning',
    title: rechazar ? '¿Rechazar esta cita?' : '¿Cancelar esta cita?',
    input: 'text',
    inputPlaceholder: 'Motivo (opcional)',
    showCancelButton: true,
    confirmButtonText: rechazar ? 'Rechazar' : 'Cancelar cita',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#d9534f',
  });
  if (r.isConfirmed) await seguro(() => cambiarEstadoCita(c.tiendaId, c.id, estado, 'tienda', String(r.value ?? '').trim() || undefined));
}

/** Botones que corresponden al estado de cada cita (solo los cambios permitidos), más reprogramar */
function accionesDe(c: Cita) {
  const textos: Partial<Record<EstadoCita, string>> = { confirmada: 'Confirmar', rechazada: 'Rechazar', cancelada: 'Cancelar', completada: 'Marcar completada' };
  const clase = (e: EstadoCita) => (e === 'confirmada' || e === 'completada' ? 'pri' : e === 'rechazada' || e === 'cancelada' ? 'peligro' : '');
  const lista = accionesDeCita(c.estado, 'tienda')
    .filter((e) => e !== 'completada' || citaYaEmpezo(c))
    .map((e) => ({
      id: e as string,
      texto: textos[e] ?? e,
      clase: clase(e),
      hacer: (x: Cita) => (e === 'rechazada' || e === 'cancelada' ? void cancelarORechazar(x, e) : void seguro(() => cambiarEstadoCita(x.tiendaId, x.id, e, 'tienda'))),
    }));
  if (c.estado === 'pendiente' || c.estado === 'confirmada') lista.push({ id: 'reprogramar', texto: 'Reprogramar', clase: '', hacer: (x: Cita) => void (reprogramando.value = x) });
  return lista;
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 14px; }
.vacio { color: var(--text-muted); line-height: 1.5; margin: 6px 0; }
.filtros { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.filtros::-webkit-scrollbar { display: none; }
.filtro { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1.5px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; text-transform: capitalize; }
.filtro.on { border-color: var(--brand-blue-text); background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.cuenta { padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--text); font-size: 0.75rem; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cita { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
.cita-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.cita-titulo { display: flex; flex-direction: column; gap: 2px; }
.cita-titulo small { color: var(--text-muted); }
.cuando { margin: 0; font-weight: 700; text-transform: capitalize; }
.datos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--text-muted); font-size: 0.85rem; }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
.btn.wa { border-color: transparent; background: var(--ok-fondo); color: var(--ok-texto); }
</style>
