<template>
  <div class="pantalla">
    <PageHeader title="Agendar cita" :fallback="`/servicio/${tiendaId}/${servicioId}`" />

    <p v-if="cargando" class="estado">Cargando…</p>
    <p v-else-if="!disponible" class="estado" data-testid="no-disponible">Este servicio no se puede agendar en este momento.</p>

    <main v-else-if="!cliente" class="contenido" data-testid="pide-sesion">
      <p class="intro">Inicia sesión para agendar tu cita: así {{ tienda!.nombreTienda }} te confirma y tú ves tu reserva en «Mis citas».</p>
      <button type="button" class="btn-pri" data-testid="iniciar-sesion" @click="irALogin">Iniciar sesión</button>
    </main>

    <main v-else class="contenido" data-sin-recarga>
      <section class="resumen" data-testid="resumen-servicio">
        <img v-if="servicio!.fotos[0]" :src="servicio!.fotos[0]" alt="" class="resumen-foto" />
        <div>
          <strong>{{ servicio!.nombre }}</strong>
          <small>{{ tienda!.nombreTienda }} · {{ etiquetaPrecio(servicio!) }} · {{ etiquetaDuracion(servicio!.duracionMin) }}</small>
        </div>
      </section>

      <!-- 1. Profesional -->
      <section v-if="candidatos.length > 1" class="bloque" data-testid="elegir-profesional">
        <h2>1. ¿Con quién?</h2>
        <div class="opciones">
          <label v-for="p in candidatos" :key="p.id" class="opcion" :class="{ on: profesionalId === p.id }">
            <input v-model="profesionalId" type="radio" name="profesional" :value="p.id" :data-testid="'prof-' + p.id" />
            <img v-if="p.fotoUrl" :src="p.fotoUrl" alt="" class="prof-foto" />
            <span><strong>{{ p.nombre }}</strong><small v-if="p.especialidad">{{ p.especialidad }}</small></span>
          </label>
        </div>
      </section>
      <p v-else-if="!candidatos.length" class="estado" data-testid="sin-profesionales">Por ahora nadie atiende este servicio.</p>

      <template v-if="profesionalId && disp">
        <!-- 2. Día y hora -->
        <section class="bloque">
          <h2>{{ candidatos.length > 1 ? '2' : '1' }}. ¿Cuándo?</h2>
          <SelectorHorario v-model:fecha="fecha" v-model:inicio="inicio" :disp="disp" :duracion-min="servicio!.duracionMin" :ocupacion="ocupacion" />
        </section>

        <!-- 3. Tus datos -->
        <form v-if="inicio" class="bloque formulario" novalidate data-testid="datos-cita" @submit.prevent="enviar">
          <h2>{{ candidatos.length > 1 ? '3' : '2' }}. Tus datos</h2>
          <p class="elegido" data-testid="cita-elegida">📅 {{ fechaDia(fecha) }} · {{ inicio }}–{{ horaFin(inicio, servicio!.duracionMin) }}</p>

          <label class="campo">
            <span>Nombre *</span>
            <input v-model="form.nombre" type="text" maxlength="80" data-testid="nombre" :class="{ err: errores.nombre }" />
            <small v-if="errores.nombre" class="error">{{ errores.nombre }}</small>
          </label>
          <label class="campo">
            <span>Celular *</span>
            <input v-model="form.telefono" type="tel" inputmode="numeric" maxlength="14" data-testid="telefono" :class="{ err: errores.telefono }" />
            <small v-if="errores.telefono" class="error">{{ errores.telefono }}</small>
          </label>
          <label class="campo">
            <span>Comentarios (opcional)</span>
            <textarea v-model="form.comentarios" rows="3" maxlength="500" placeholder="Algo que debamos saber: estilo, alergias, referencias…" data-testid="comentarios"></textarea>
          </label>

          <template v-if="atiendeADomicilio(servicio!.modalidad)">
            <label v-if="servicio!.modalidad === 'ambas'" class="check">
              <input v-model="form.adomicilio" type="checkbox" data-testid="domicilio" />
              Lo necesito a domicilio
            </label>
            <p v-else class="pista">Este servicio se da a domicilio.</p>
            <label v-if="form.adomicilio" class="campo">
              <span>Dirección del servicio *</span>
              <textarea v-model="form.direccion" rows="2" maxlength="300" data-testid="direccion" :class="{ err: errores.direccion }"></textarea>
              <small v-if="errores.direccion" class="error">{{ errores.direccion }}</small>
            </label>
          </template>

          <p v-if="errores.cliente || errores.servicio || errores.profesional" class="error">{{ errores.cliente || errores.servicio || errores.profesional }}</p>
          <button type="submit" class="btn-pri" :disabled="enviando" data-testid="enviar">{{ enviando ? 'Enviando…' : 'Solicitar cita' }}</button>
          <p class="pista centro">{{ tienda!.nombreTienda }} confirmará tu cita. No se cobra nada desde Crustore.</p>
        </form>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import SelectorHorario from '../components/SelectorHorario.vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { estadoEfectivo } from '@/composables/useMembresia';
import { sessionUser } from '@/utils/sessionUser';
import { atiendeADomicilio, ofreceServicios } from '../negocio';
import { ErrorServicio, mensajeError, etiquetaDuracion, etiquetaPrecio, obtenerServicio, sePuedeAgendar } from '../catalogo';
import { leerDisponibilidad, leerOcupacion, listarProfesionales, reservarCita, validarSolicitudCita } from '../agenda';
import { horaFin } from '../disponibilidad';
import { fechaDia } from '../formato';
import { clienteActual } from '../sesion';
import type { Disponibilidad, Profesional, Servicio } from '../tipos';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.tiendaId ?? ''));
const servicioId = computed(() => String(route.params.servicioId ?? ''));
const { obtenerTienda } = useTiendas();

const servicio = ref<Servicio | null>(null);
const tienda = ref<Tienda | null>(null);
const profesionales = ref<Profesional[]>([]);
const cargando = ref(true);
const cliente = computed(() => (sessionUser.value, clienteActual()));

const disponible = computed(
  () => !!servicio.value && !!tienda.value && servicio.value.activo && sePuedeAgendar(servicio.value) && ofreceServicios(tienda.value) && estadoEfectivo(tienda.value) === 'activa',
);
/** Profesionales activos que ofrecen este servicio (sin lista = todos) */
const candidatos = computed(() => profesionales.value.filter((p) => p.activo && (!servicio.value?.profesionalIds.length || servicio.value.profesionalIds.includes(p.id))));

const profesionalId = ref('');
const disp = ref<Disponibilidad | null>(null);
const ocupacion = ref<Record<string, Set<string>>>({});
const fecha = ref('');
const inicio = ref('');
const form = reactive({ nombre: '', telefono: '', comentarios: '', adomicilio: false, direccion: '' });
const errores = ref<Record<string, string>>({});
const enviando = ref(false);

onMounted(async () => {
  try {
    [servicio.value, tienda.value] = await Promise.all([obtenerServicio(tiendaId.value, servicioId.value), obtenerTienda(tiendaId.value)]);
    profesionales.value = await listarProfesionales(tiendaId.value);
    if (candidatos.value.length === 1) profesionalId.value = candidatos.value[0].id;
    const u = clienteActual();
    form.nombre = u?.nombre ?? '';
    form.telefono = (u?.telefono ?? '').replace(/\D/g, '').slice(-10);
    if (servicio.value?.modalidad === 'domicilio') form.adomicilio = true;
    const s = sessionUser.value;
    if (form.adomicilio && s?.domicilio) form.direccion = [s.domicilio, s.colonia, s.municipio].filter(Boolean).join(', ');
  } finally {
    cargando.value = false;
  }
});

async function cargarAgenda() {
  disp.value = null;
  fecha.value = '';
  inicio.value = '';
  if (!profesionalId.value) return;
  [disp.value, ocupacion.value] = await Promise.all([leerDisponibilidad(tiendaId.value, profesionalId.value), leerOcupacion(tiendaId.value, profesionalId.value)]);
}
watch(profesionalId, cargarAgenda);
// Con un solo profesional se carga en cuanto está elegido
watch(() => candidatos.value.length, () => candidatos.value.length === 1 && !profesionalId.value && (profesionalId.value = candidatos.value[0].id));

const irALogin = () => router.push({ path: '/login', query: { redirect: `/reservar/${tiendaId.value}/${servicioId.value}` } });

async function enviar() {
  if (enviando.value || !servicio.value || !cliente.value) return;
  const solicitud = {
    servicio: servicio.value,
    profesionalId: profesionalId.value,
    fecha: fecha.value,
    inicio: inicio.value,
    cliente: { id: cliente.value.id, nombre: form.nombre, telefono: form.telefono },
    comentarios: form.comentarios,
    adomicilio: form.adomicilio,
    direccion: form.direccion,
  };
  errores.value = validarSolicitudCita(solicitud);
  if (Object.keys(errores.value).length) return;
  enviando.value = true; // antes de cualquier espera: varios toques seguidos no crean varias citas
  try {
    await reservarCita(tiendaId.value, solicitud);
    await Swal.fire({ icon: 'success', title: '¡Cita solicitada!', text: `${tienda.value?.nombreTienda ?? 'La tienda'} la confirmará pronto. La verás en «Mis citas».`, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
    router.replace('/mis-citas');
  } catch (e: any) {
    enviando.value = false;
    await Swal.fire({ icon: 'warning', title: 'No se pudo agendar', text: mensajeError(e) });
    await cargarAgenda(); // alguien pudo ocupar el horario: se muestra lo que sigue libre
  }
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.estado { padding: 30px 16px; text-align: center; color: var(--text-muted); }
.contenido { max-width: 640px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 18px; }
.intro { color: var(--text-muted); line-height: 1.5; margin: 0; }
.resumen { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.resumen > div { display: flex; flex-direction: column; }
.resumen small { color: var(--text-muted); }
.resumen-foto { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; }
.bloque h2 { margin: 0 0 10px; font-size: 1.02rem; }
.opciones { display: flex; flex-wrap: wrap; gap: 8px; }
.opcion { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface); cursor: pointer; }
.opcion input { position: absolute; opacity: 0; pointer-events: none; }
.opcion span { display: flex; flex-direction: column; }
.opcion small { color: var(--text-muted); }
.opcion.on { border-color: var(--brand-blue-text); background: var(--brand-blue-soft); }
.opcion:has(input:focus-visible) { outline: 2px solid var(--brand-blue-text); outline-offset: 2px; }
.prof-foto { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.formulario { display: flex; flex-direction: column; gap: 14px; }
.elegido { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--brand-blue-soft); color: var(--brand-blue-text); font-weight: 700; text-transform: capitalize; }
.campo { display: flex; flex-direction: column; gap: 5px; font-size: 0.9rem; font-weight: 600; }
.campo input, .campo textarea { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; font-size: 16px; }
.campo .err { border-color: var(--peligro-texto); }
.check { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; }
.pista { color: var(--text-muted); font-size: 0.8rem; margin: 0; }
.centro { text-align: center; }
.error { color: var(--peligro-texto); font-weight: 600; font-size: 0.82rem; margin: 0; }
.btn-pri { padding: 14px 16px; border: 0; border-radius: 12px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
.btn-pri:disabled { opacity: 0.6; cursor: wait; }
</style>
