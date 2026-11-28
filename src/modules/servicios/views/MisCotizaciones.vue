<template>
  <div class="pantalla">
    <PageHeader title="Mis cotizaciones" fallback="/perfil" />

    <main v-if="!cliente" class="contenido" data-testid="pide-sesion">
      <p class="vacio">Inicia sesión para ver tus cotizaciones.</p>
      <button type="button" class="btn pri" @click="router.push({ path: '/login', query: { redirect: '/mis-cotizaciones' } })">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <p v-if="cargando" class="vacio">Cargando…</p>
      <p v-else-if="!cotizaciones.length" class="vacio" data-testid="sin-cotizaciones">
        Aún no has pedido cotizaciones. Entra al perfil de un profesional, abre uno de sus servicios y toca «Cotizar».
      </p>

      <ul v-else class="lista">
        <li v-for="c in cotizaciones" :key="c.id" class="cot" :data-cotizacion="c.id">
          <header class="cot-cab">
            <div class="cot-titulo">
              <strong>{{ c.servicioNombre }}</strong>
              <small>{{ c.tiendaNombre || 'Tienda' }} · {{ fechaHoraCorta(c.creadaEn) }}</small>
            </div>
            <InsigniaEstado :tono="TONO_COTIZACION[efectivo(c)]" :texto="ETIQUETA_COTIZACION[efectivo(c)]" />
          </header>

          <p class="descripcion">{{ c.descripcion }}</p>

          <div v-if="c.respuesta" class="respuesta" data-testid="respuesta">
            <strong>{{ dinero(c.respuesta.precio) }}</strong>
            <span v-if="c.respuesta.descripcion">{{ c.respuesta.descripcion }}</span>
            <span v-if="c.respuesta.condiciones" class="cond">Condiciones: {{ c.respuesta.condiciones }}</span>
            <small>{{ efectivo(c) === 'vencida' ? 'Venció el' : 'Válida hasta' }} {{ fechaCorta(c.respuesta.venceEl) }}</small>
          </div>

          <p v-if="efectivo(c) === 'pendiente' || efectivo(c) === 'en_revision'" class="espera">La tienda está revisando tu solicitud. Te responderá con un precio.</p>
          <p v-else-if="efectivo(c) === 'aceptada'" class="espera">Aceptaste esta cotización. La tienda se pondrá en contacto contigo.</p>
          <p v-else-if="efectivo(c) === 'vencida'" class="espera">Esta cotización venció. Puedes pedir otra desde el servicio.</p>

          <div class="acciones">
            <template v-if="efectivo(c) === 'cotizada'">
              <button type="button" class="btn pri" data-accion="aceptar" @click="aceptar(c)">Aceptar</button>
              <button type="button" class="btn peligro" data-accion="rechazar" @click="rechazar(c)">Rechazar</button>
            </template>
            <button type="button" class="btn" @click="router.push(`/servicio/${c.tiendaId}/${c.servicioId}`)">Ver servicio</button>
            <a v-if="enlaceWa(c)" :href="enlaceWa(c)" target="_blank" rel="noopener" class="btn wa" data-testid="whatsapp">WhatsApp</a>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { sessionUser } from '@/utils/sessionUser';
import InsigniaEstado from '../components/InsigniaEstado.vue';
import { ahoraEnZona } from '../disponibilidad';
import { ETIQUETA_COTIZACION, TONO_COTIZACION, estadoEfectivoCotizacion } from '../estados';
import { ErrorServicio, mensajeError } from '../catalogo';
import { aceptarCotizacion, enlaceWhatsappCotizacion, rechazarComoCliente, useCotizacionesCliente } from '../cotizaciones';
import { dinero, fechaCorta, fechaHoraCorta } from '../formato';
import { clienteActual } from '../sesion';
import type { Cotizacion } from '../tipos';

const router = useRouter();
const cliente = computed(() => (sessionUser.value, clienteActual()));
const { cotizaciones, cargando, recargar } = useCotizacionesCliente(() => cliente.value?.id);

const efectivo = (c: Cotizacion) => estadoEfectivoCotizacion(c, ahoraEnZona().fecha);
const enlaceWa = (c: Cotizacion) => (['cotizada', 'aceptada'].includes(efectivo(c)) ? enlaceWhatsappCotizacion(c.tiendaTelefono, c, 'cliente') : '');

async function seguro(accion: () => Promise<void>) {
  try {
    await accion();
  } catch (e: any) {
    await Swal.fire({ icon: 'warning', title: 'No se pudo actualizar', text: mensajeError(e) });
  } finally {
    await recargar();
  }
}

async function aceptar(c: Cotizacion) {
  const r = await Swal.fire({
    icon: 'question',
    title: '¿Aceptar esta cotización?',
    html: `Aceptas el precio de <b>${dinero(c.respuesta?.precio ?? 0)}</b> de ${c.tiendaNombre || 'la tienda'}. Ella se pondrá en contacto contigo para coordinar. No se cobra nada desde Crustore.`,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Volver',
    confirmButtonColor: 'var(--color-bg-blue-ligth)',
  });
  if (r.isConfirmed) await seguro(() => aceptarCotizacion(c.tiendaId, c.id));
}

async function rechazar(c: Cotizacion) {
  const r = await Swal.fire({ icon: 'warning', title: '¿Rechazar esta cotización?', text: 'La tienda verá que no la aceptaste.', showCancelButton: true, confirmButtonText: 'Rechazar', cancelButtonText: 'Volver', confirmButtonColor: '#d9534f' });
  if (r.isConfirmed) await seguro(() => rechazarComoCliente(c.tiendaId, c.id));
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); }
.vacio { color: var(--text-muted); line-height: 1.5; margin: 14px 0; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cot { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.cot-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.cot-titulo { display: flex; flex-direction: column; gap: 2px; }
.cot-titulo small { color: var(--text-muted); }
.descripcion { margin: 0; line-height: 1.5; white-space: pre-line; }
.respuesta { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; background: var(--brand-blue-soft); color: var(--text); font-size: 0.9rem; }
.respuesta strong { color: var(--brand-blue-text); font-size: 1.2rem; }
.respuesta .cond, .respuesta small { color: var(--text-muted); }
.espera { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
.btn.wa { border-color: transparent; background: var(--ok-fondo); color: var(--ok-texto); }
</style>
