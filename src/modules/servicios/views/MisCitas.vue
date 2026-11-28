<template>
  <div class="pantalla">
    <PageHeader title="Mis citas" fallback="/perfil" />

    <main v-if="!cliente" class="contenido" data-testid="pide-sesion">
      <p class="vacio">Inicia sesión para ver tus citas.</p>
      <button type="button" class="btn pri" @click="router.push({ path: '/login', query: { redirect: '/mis-citas' } })">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <p v-if="cargando" class="vacio">Cargando…</p>
      <p v-else-if="!citas.length" class="vacio" data-testid="sin-citas">Aún no tienes citas. Entra al perfil de un profesional, abre uno de sus servicios y toca «Agendar cita».</p>

      <template v-else>
        <section v-for="g in grupos" :key="g.id" v-show="g.lista.length" class="grupo" :data-grupo="g.id">
          <h2>{{ g.titulo }} ({{ g.lista.length }})</h2>
          <ul class="lista">
            <li v-for="c in g.lista" :key="c.id" class="cita" :data-cita="c.id">
              <header class="cita-cab">
                <div class="cita-titulo">
                  <strong>{{ c.servicioNombre }}</strong>
                  <small>{{ c.tiendaNombre || 'Tienda' }}<template v-if="c.profesionalNombre"> · {{ c.profesionalNombre }}</template></small>
                </div>
                <InsigniaEstado :tono="TONO_CITA[c.estado]" :texto="ETIQUETA_CITA[c.estado]" />
              </header>
              <p class="cuando">📅 {{ fechaDia(c.fecha) }} · {{ c.inicio }}–{{ c.fin }}</p>
              <p v-if="c.adomicilio" class="detalle">🏠 A domicilio: {{ c.direccion }}</p>
              <p v-if="c.comentarios" class="detalle">💬 {{ c.comentarios }}</p>
              <p v-if="c.estado === 'pendiente'" class="espera">La tienda aún debe confirmar tu cita.</p>

              <div class="acciones">
                <button v-if="puedeCancelar(c)" type="button" class="btn peligro" data-accion="cancelar" @click="cancelar(c)">Cancelar cita</button>
                <button type="button" class="btn" @click="router.push(`/servicio/${c.tiendaId}/${c.servicioId}`)">Ver servicio</button>
                <a v-if="enlaceWa(c)" :href="enlaceWa(c)" target="_blank" rel="noopener" class="btn wa" data-testid="whatsapp">WhatsApp</a>
              </div>
            </li>
          </ul>
        </section>
      </template>
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
import { ETIQUETA_CITA, TONO_CITA, puedeCambiarCita } from '../estados';
import { ErrorServicio, mensajeError } from '../catalogo';
import { cambiarEstadoCita, citaYaEmpezo, enlaceWhatsappCita, useCitasCliente } from '../agenda';
import { fechaDia } from '../formato';
import { clienteActual } from '../sesion';
import type { Cita } from '../tipos';

const router = useRouter();
const cliente = computed(() => (sessionUser.value, clienteActual()));
const { citas, cargando, recargar } = useCitasCliente(() => cliente.value?.id);

/** Próximas (las que siguen vivas y no han empezado) y anteriores (todo lo demás, lo más reciente primero) */
const grupos = computed(() => {
  const ahora = ahoraEnZona();
  const vivas = (c: Cita) => (c.estado === 'pendiente' || c.estado === 'confirmada') && !citaYaEmpezo(c, ahora);
  return [
    { id: 'proximas', titulo: 'Próximas', lista: citas.value.filter(vivas) },
    { id: 'anteriores', titulo: 'Anteriores', lista: citas.value.filter((c) => !vivas(c)).reverse() },
  ];
});

const puedeCancelar = (c: Cita) => puedeCambiarCita(c.estado, 'cancelada', 'cliente') && !citaYaEmpezo(c);
const enlaceWa = (c: Cita) => (c.estado === 'cancelada' || c.estado === 'rechazada' ? '' : enlaceWhatsappCita(c.tiendaTelefono, c, 'cliente'));

async function cancelar(c: Cita) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Cancelar esta cita?',
    text: `${c.servicioNombre} · ${fechaDia(c.fecha)} a las ${c.inicio}. El horario quedará libre para otra persona.`,
    showCancelButton: true,
    confirmButtonText: 'Cancelar cita',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  try {
    await cambiarEstadoCita(c.tiendaId, c.id, 'cancelada', 'cliente');
  } catch (e: any) {
    await Swal.fire({ icon: 'warning', title: 'No se pudo cancelar', text: mensajeError(e) });
  } finally {
    await recargar();
  }
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); }
.vacio { color: var(--text-muted); line-height: 1.5; margin: 14px 0; }
.grupo h2 { margin: 16px 0 8px; font-size: 1rem; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cita { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
.cita-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.cita-titulo { display: flex; flex-direction: column; gap: 2px; }
.cita-titulo small { color: var(--text-muted); }
.cuando { margin: 0; font-weight: 700; text-transform: capitalize; }
.detalle { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
.espera { margin: 0; color: var(--aviso-texto); background: var(--aviso-fondo); padding: 6px 10px; border-radius: 8px; font-size: 0.85rem; }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
.btn.wa { border-color: transparent; background: var(--ok-fondo); color: var(--ok-texto); }
</style>
