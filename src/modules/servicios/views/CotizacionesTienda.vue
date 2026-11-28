<template>
  <div class="pantalla">
    <PageHeader title="Cotizaciones" :fallback="`/store/profile/${tiendaId}`" />

    <main v-if="!esDueno" class="contenido" data-testid="no-es-dueno">
      <p class="vacio">Inicia sesión como esta tienda para ver sus cotizaciones.</p>
      <button type="button" class="btn-pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <nav class="filtros" aria-label="Filtrar cotizaciones">
        <button v-for="f in FILTROS" :key="f.id" type="button" class="filtro" :class="{ on: filtro === f.id }" :data-filtro="f.id" @click="filtro = f.id">
          {{ f.texto }}<span class="cuenta">{{ cuentaDe(f.id) }}</span>
        </button>
      </nav>

      <p v-if="cargando" class="vacio">Cargando…</p>
      <p v-else-if="!visibles.length" class="vacio" data-testid="sin-cotizaciones">
        {{ cotizaciones.length ? 'No hay cotizaciones en este filtro.' : 'Todavía no recibes solicitudes de cotización. Aparecerán aquí cuando un cliente las pida desde tu catálogo.' }}
      </p>

      <ul v-else class="lista">
        <li v-for="c in visibles" :key="c.id" class="cot" :data-cotizacion="c.id">
          <header class="cot-cab">
            <div class="cot-titulo">
              <strong>{{ c.servicioNombre }}</strong>
              <small>{{ c.clienteNombre || 'Cliente' }} · {{ fechaHoraCorta(c.creadaEn) }}</small>
            </div>
            <InsigniaEstado :tono="TONO_COTIZACION[efectivo(c)]" :texto="ETIQUETA_COTIZACION[efectivo(c)]" />
          </header>

          <p class="descripcion">{{ c.descripcion }}</p>

          <ul v-if="c.imagenes.length" class="imagenes" aria-label="Imágenes de referencia">
            <li v-for="(im, i) in c.imagenes" :key="im">
              <a :href="im" target="_blank" rel="noopener"><img :src="im" :alt="`Referencia ${i + 1}`" loading="lazy" /></a>
            </li>
          </ul>

          <ul class="datos">
            <li v-if="c.fechaTentativa">📅 Fecha tentativa: {{ fechaCorta(c.fechaTentativa) }}</li>
            <li v-if="c.adomicilio">🏠 A domicilio: {{ c.direccion }}</li>
            <li v-if="c.clienteTelefono">📞 {{ c.clienteTelefono }}</li>
          </ul>

          <div v-if="c.respuesta" class="respuesta" data-testid="respuesta">
            <strong>{{ dinero(c.respuesta.precio) }}</strong>
            <span v-if="c.respuesta.descripcion">{{ c.respuesta.descripcion }}</span>
            <span v-if="c.respuesta.condiciones" class="cond">Condiciones: {{ c.respuesta.condiciones }}</span>
            <small>Válida hasta {{ fechaCorta(c.respuesta.venceEl) }}</small>
          </div>

          <div class="acciones">
            <button v-for="a in accionesDe(c)" :key="a.estado" type="button" class="btn" :class="a.clase" :data-accion="a.estado" @click="a.hacer(c)">{{ a.texto }}</button>
            <a v-if="enlaceWa(c)" :href="enlaceWa(c)" target="_blank" rel="noopener" class="btn wa" data-testid="whatsapp">WhatsApp</a>
          </div>
        </li>
      </ul>
    </main>

    <ResponderCotizacionModal :visible="!!respondiendo" :cotizacion="respondiendo" @close="respondiendo = null" @saved="respondiendo = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import InsigniaEstado from '../components/InsigniaEstado.vue';
import ResponderCotizacionModal from '../components/ResponderCotizacionModal.vue';
import { ahoraEnZona } from '../disponibilidad';
import { ETIQUETA_COTIZACION, TONO_COTIZACION, accionesDeCotizacion, estadoEfectivoCotizacion } from '../estados';
import { esDuenoDeTienda } from '../sesion';
import { ErrorServicio, mensajeError } from '../catalogo';
import { completarCotizacion, enlaceWhatsappCotizacion, marcarEnRevision, rechazarComoTienda, useCotizacionesTienda } from '../cotizaciones';
import { dinero, fechaCorta, fechaHoraCorta } from '../formato';
import type { Cotizacion, EstadoCotizacion } from '../tipos';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const { cotizaciones, cargando } = useCotizacionesTienda(() => (esDueno.value ? tiendaId.value : undefined));

type FiltroId = 'todas' | 'atender' | 'cotizadas' | 'aceptadas' | 'cerradas';
const FILTROS: { id: FiltroId; texto: string }[] = [
  { id: 'todas', texto: 'Todas' },
  { id: 'atender', texto: 'Por atender' },
  { id: 'cotizadas', texto: 'Cotizadas' },
  { id: 'aceptadas', texto: 'Aceptadas' },
  { id: 'cerradas', texto: 'Cerradas' },
];
const GRUPO: Record<FiltroId, EstadoCotizacion[] | null> = {
  todas: null,
  atender: ['pendiente', 'en_revision'],
  cotizadas: ['cotizada'],
  aceptadas: ['aceptada'],
  cerradas: ['rechazada', 'vencida', 'completada'],
};
const filtro = ref<FiltroId>('todas');
const respondiendo = ref<Cotizacion | null>(null);

const efectivo = (c: Cotizacion) => estadoEfectivoCotizacion(c, ahoraEnZona().fecha);
const enGrupo = (c: Cotizacion, f: FiltroId) => !GRUPO[f] || GRUPO[f]!.includes(efectivo(c));
const cuentaDe = (f: FiltroId) => cotizaciones.value.filter((c) => enGrupo(c, f)).length;
const visibles = computed(() => cotizaciones.value.filter((c) => enGrupo(c, filtro.value)));

const enlaceWa = (c: Cotizacion) => enlaceWhatsappCotizacion(c.clienteTelefono, c, 'tienda');

async function seguro(accion: () => Promise<void>) {
  try {
    await accion();
  } catch (e: any) {
    await Swal.fire({ icon: 'warning', title: 'No se pudo actualizar', text: mensajeError(e) });
  }
}

async function rechazar(c: Cotizacion) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Rechazar esta solicitud?',
    input: 'text',
    inputPlaceholder: 'Motivo (opcional, lo verá el cliente)',
    showCancelButton: true,
    confirmButtonText: 'Rechazar',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#d9534f',
  });
  if (r.isConfirmed) await seguro(() => rechazarComoTienda(c.tiendaId, c.id, String(r.value ?? '')));
}

/** Botones que corresponden al estado de cada solicitud (solo los cambios permitidos) */
function accionesDe(c: Cotizacion) {
  const clase = (e: EstadoCotizacion) => (e === 'rechazada' ? 'peligro' : e === 'cotizada' || e === 'completada' ? 'pri' : '');
  const textos: Partial<Record<EstadoCotizacion, string>> = { en_revision: 'Marcar en revisión', cotizada: 'Responder con precio', rechazada: 'Rechazar', completada: 'Marcar completada' };
  const hacer: Partial<Record<EstadoCotizacion, (c: Cotizacion) => void>> = {
    en_revision: (x) => void seguro(() => marcarEnRevision(x.tiendaId, x.id)),
    cotizada: (x) => (respondiendo.value = x),
    rechazada: (x) => void rechazar(x),
    completada: (x) => void seguro(() => completarCotizacion(x.tiendaId, x.id)),
  };
  // "Responder" solo desde pendiente / en revisión (si ya está cotizada, la tienda solo puede retirarla)
  return accionesDeCotizacion(efectivo(c), 'tienda')
    .filter((e) => !(e === 'cotizada' && efectivo(c) === 'cotizada'))
    .map((e) => ({ estado: e, texto: textos[e] ?? e, clase: clase(e), hacer: hacer[e]! }));
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); }
.vacio { color: var(--text-muted); line-height: 1.5; margin: 14px 0; }
.filtros { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: none; }
.filtros::-webkit-scrollbar { display: none; }
.filtro { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1.5px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.filtro.on { border-color: var(--brand-blue-text); background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.cuenta { padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--text); font-size: 0.75rem; }
.lista { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cot { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.cot-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.cot-titulo { display: flex; flex-direction: column; gap: 2px; }
.cot-titulo small { color: var(--text-muted); }
.descripcion { margin: 0; line-height: 1.5; white-space: pre-line; }
.imagenes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.imagenes img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; display: block; }
.datos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; color: var(--text-muted); font-size: 0.85rem; }
.respuesta { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; background: var(--brand-blue-soft); color: var(--text); font-size: 0.9rem; }
.respuesta strong { color: var(--brand-blue-text); font-size: 1.1rem; }
.respuesta .cond, .respuesta small { color: var(--text-muted); }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
.btn.wa { background: var(--ok-fondo); color: var(--ok-texto); border-color: transparent; }
.btn-pri { padding: 10px 16px; border: 0; border-radius: 10px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-weight: 700; cursor: pointer; }
</style>
