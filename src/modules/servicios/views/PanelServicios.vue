<template>
  <div class="pantalla">
    <PageHeader title="Panel de servicios" :fallback="`/store/profile/${tiendaId}`" />

    <main v-if="!esDueno" class="contenido" data-testid="no-es-dueno">
      <p class="vacio">Inicia sesión como esta tienda para ver su panel.</p>
      <button type="button" class="btn-pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <h2 class="saludo">{{ nombreTienda || 'Mi negocio' }}</h2>

      <!-- Indicadores -->
      <ul class="kpis" aria-label="Resumen">
        <li class="kpi" data-kpi="proximas"><strong>{{ proximas.length }}</strong><span>Próximas citas (7 días)</span></li>
        <li class="kpi" :class="{ alerta: porConfirmar > 0 }" data-kpi="por-confirmar"><strong>{{ porConfirmar }}</strong><span>Citas por confirmar</span></li>
        <li class="kpi" :class="{ alerta: cotPorAtender > 0 }" data-kpi="cotizaciones"><strong>{{ cotPorAtender }}</strong><span>Cotizaciones pendientes</span></li>
        <li class="kpi" data-kpi="nuevas"><strong>{{ nuevas }}</strong><span>Solicitudes nuevas (24 h)</span></li>
        <li class="kpi" data-kpi="servicios"><strong>{{ activos }}</strong><span>Servicios publicados<template v-if="ocultos"> ({{ ocultos }} ocultos)</template></span></li>
      </ul>

      <!-- Próximas citas -->
      <section class="bloque" data-testid="proximas-citas">
        <header class="bloque-cab"><h3>Próximas citas</h3><button type="button" class="enlace" @click="ir('citas')">Ver todas ›</button></header>
        <p v-if="!proximas.length" class="vacio">No tienes citas en los próximos 7 días.</p>
        <ul v-else class="citas">
          <li v-for="c in proximas.slice(0, 5)" :key="c.id" class="cita">
            <span class="hora">{{ fechaDia(c.fecha) }} · {{ c.inicio }}</span>
            <span class="quien">{{ c.clienteNombre || 'Cliente' }} — {{ c.servicioNombre }}</span>
            <InsigniaEstado :tono="TONO_CITA[c.estado]" :texto="ETIQUETA_CITA[c.estado]" />
          </li>
        </ul>
      </section>

      <!-- Secciones -->
      <nav class="secciones" aria-label="Secciones">
        <button v-for="s in secciones" :key="s.id" type="button" class="seccion" :data-seccion="s.id" @click="s.ir()">
          <span class="icono" aria-hidden="true">{{ s.icono }}</span>
          <span class="texto"><strong>{{ s.titulo }}</strong><small>{{ s.detalle }}</small></span>
          <span v-if="s.cuenta" class="badge">{{ s.cuenta }}</span>
        </button>
      </nav>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import InsigniaEstado from '../components/InsigniaEstado.vue';
import { useTiendas } from '@/composables/useTiendas';
import { ahoraEnZona } from '../disponibilidad';
import { ETIQUETA_CITA, TONO_CITA } from '../estados';
import { esDuenoDeTienda } from '../sesion';
import { useServiciosTienda } from '../catalogo';
import { citasPorConfirmar, citasProximas, useCitasTienda } from '../agenda';
import { cotizacionesPorAtender, useCotizacionesTienda } from '../cotizaciones';
import { useClientesServicio } from '../clientes';
import { fechaDia } from '../formato';

/** Resumen del negocio de servicios: indicadores y accesos a cada sección */
const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const id = () => (esDueno.value ? tiendaId.value : undefined);
const { citas } = useCitasTienda(id);
const { cotizaciones } = useCotizacionesTienda(id);
const { servicios } = useServiciosTienda(id);
const { clientes } = useClientesServicio(id);
const { obtenerTienda } = useTiendas();

const nombreTienda = ref('');
onMounted(async () => {
  if (esDueno.value) nombreTienda.value = (await obtenerTienda(tiendaId.value))?.nombreTienda ?? '';
});

const proximas = computed(() => citasProximas(citas.value, ahoraEnZona(), 7));
const porConfirmar = computed(() => citasPorConfirmar(citas.value));
const cotPorAtender = computed(() => cotizacionesPorAtender(cotizaciones.value));
/** Solicitudes (citas y cotizaciones) pendientes que llegaron en las últimas 24 horas */
const nuevas = computed(() => {
  const desde = Date.now() - 24 * 3600_000;
  const reciente = (x: { estado: string; creadaEn: string }) => x.estado === 'pendiente' && new Date(x.creadaEn).getTime() >= desde;
  return citas.value.filter(reciente).length + cotizaciones.value.filter(reciente).length;
});
const activos = computed(() => servicios.value.filter((s) => s.activo).length);
const ocultos = computed(() => servicios.value.length - activos.value);

const rutas: Record<string, string> = { servicios: 'servicios', citas: 'citas', cotizaciones: 'cotizaciones', clientes: 'clientes', horarios: 'horarios' };
const ir = (seccion: string) => router.push(`/store/${rutas[seccion]}/${tiendaId.value}`);

const secciones = computed(() => [
  { id: 'servicios', icono: '🗂️', titulo: 'Mis servicios', detalle: 'Catálogo de tu trabajo', cuenta: 0, ir: () => ir('servicios') },
  { id: 'citas', icono: '🗓️', titulo: 'Calendario y citas', detalle: 'Confirma, reprograma o cancela', cuenta: porConfirmar.value, ir: () => ir('citas') },
  { id: 'cotizaciones', icono: '💬', titulo: 'Cotizaciones', detalle: 'Responde solicitudes', cuenta: cotPorAtender.value, ir: () => ir('cotizaciones') },
  { id: 'clientes', icono: '👥', titulo: 'Clientes', detalle: `${clientes.value.length} registrados`, cuenta: 0, ir: () => ir('clientes') },
  { id: 'horarios', icono: '⏰', titulo: 'Horarios y equipo', detalle: 'Disponibilidad y profesionales', cuenta: 0, ir: () => ir('horarios') },
  { id: 'perfil', icono: '🖼️', titulo: 'Perfil y portafolio', detalle: 'Fotos, datos y configuración', cuenta: 0, ir: () => router.push(`/store/profile/${tiendaId.value}`) },
]);
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 16px; }
.saludo { margin: 0; font-size: 1.2rem; }
.vacio { color: var(--text-muted); margin: 6px 0; }
.kpis { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 640px) { .kpis { grid-template-columns: repeat(5, 1fr); } }
.kpi { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.kpi strong { font-size: 1.6rem; color: var(--brand-blue-text); }
.kpi span { font-size: 0.75rem; color: var(--text-muted); line-height: 1.25; }
.kpi.alerta { border-color: transparent; background: var(--aviso-fondo); }
.kpi.alerta strong { color: var(--aviso-texto); }
.bloque { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.bloque-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.bloque-cab h3 { margin: 0; font-size: 1rem; }
.enlace { border: 0; background: none; color: var(--brand-blue-text); font: inherit; font-weight: 700; cursor: pointer; }
.citas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cita { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); }
.hora { font-weight: 700; text-transform: capitalize; }
.quien { flex: 1; min-width: 140px; color: var(--text-muted); font-size: 0.88rem; }
.secciones { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 640px) { .secciones { grid-template-columns: repeat(2, 1fr); } }
.seccion { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.icono { font-size: 1.5rem; }
.texto { flex: 1; display: flex; flex-direction: column; }
.texto small { color: var(--text-muted); }
.badge { min-width: 24px; padding: 2px 8px; border-radius: 999px; background: var(--aviso-fondo); color: var(--aviso-texto); font-weight: 800; font-size: 0.8rem; text-align: center; }
.btn-pri { padding: 10px 16px; border: 0; border-radius: 10px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-weight: 700; cursor: pointer; }
</style>
