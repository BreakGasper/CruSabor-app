<template>
  <div class="pantalla">
    <PageHeader title="Horarios y equipo" :fallback="`/store/profile/${tiendaId}`" />

    <main v-if="!esDueno" class="contenido" data-testid="no-es-dueno">
      <p class="ayuda">Inicia sesión como esta tienda para configurar sus horarios.</p>
      <button type="button" class="btn pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido" data-sin-recarga>
      <!-- Equipo -->
      <section class="tarjeta" data-testid="equipo">
        <h2>Equipo</h2>
        <p class="ayuda">Cada profesional tiene su propia agenda. Si trabajas solo, no necesitas agregar a nadie: tu agenda es la «principal».</p>
        <ul class="equipo">
          <li v-for="p in profesionales" :key="p.id" class="miembro" :class="{ inactivo: !p.activo }" :data-prof="p.id">
            <strong>{{ p.nombre }}</strong>
            <small v-if="p.especialidad">{{ p.especialidad }}</small>
            <span v-if="p.id === 'principal'" class="etiqueta">Tú</span>
            <button v-else type="button" class="mini" data-testid="alternar-prof" @click="alternarProfesional(p)">{{ p.activo ? 'Desactivar' : 'Activar' }}</button>
          </li>
        </ul>
        <div class="alta">
          <input v-model="nuevo.nombre" type="text" maxlength="60" placeholder="Nombre del profesional" data-testid="prof-nombre" />
          <input v-model="nuevo.especialidad" type="text" maxlength="60" placeholder="Especialidad (opcional)" data-testid="prof-especialidad" />
          <button type="button" class="btn pri" data-testid="agregar-prof" @click="agregarProfesional">Agregar</button>
        </div>
      </section>

      <!-- Horario -->
      <section class="tarjeta" data-testid="horario">
        <h2>Horario de atención</h2>
        <label v-if="profesionales.filter((p) => p.activo).length > 1" class="campo">
          <span>Agenda de</span>
          <select v-model="profId" data-testid="agenda-de">
            <option v-for="p in profesionales.filter((x) => x.activo)" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
        </label>
        <p v-if="cargandoAgenda" class="ayuda">Cargando…</p>

        <template v-else>
          <p class="ayuda">Los clientes solo podrán agendar dentro de estas horas. Parte del horario que capturaste al registrar tu tienda.</p>
          <ul class="dias">
            <li v-for="d in DIAS" :key="d.clave" class="dia" :data-dia="d.clave">
              <label class="dia-cab">
                <input v-model="semana[d.clave].abierto" type="checkbox" :data-testid="'abre-' + d.clave" />
                <strong>{{ d.nombre }}</strong>
              </label>
              <div v-if="semana[d.clave].abierto" class="dia-horas">
                <input v-model="semana[d.clave].abre" type="time" :data-testid="'desde-' + d.clave" />
                <span>a</span>
                <input v-model="semana[d.clave].cierra" type="time" :data-testid="'hasta-' + d.clave" />
                <button type="button" class="mini" :data-testid="'descanso-' + d.clave" @click="semana[d.clave].descansos.push({ desde: '14:00', hasta: '15:00' })">+ Descanso</button>
              </div>
              <div v-for="(x, i) in semana[d.clave].abierto ? semana[d.clave].descansos : []" :key="i" class="descanso">
                <small>Descanso</small>
                <input v-model="x.desde" type="time" /><span>a</span><input v-model="x.hasta" type="time" />
                <button type="button" class="mini peligro" aria-label="Quitar descanso" @click="semana[d.clave].descansos.splice(i, 1)">✕</button>
              </div>
              <small v-if="!semana[d.clave].abierto" class="cerrado">Cerrado</small>
            </li>
          </ul>

          <div class="dos">
            <label class="campo">
              <span>Anticipación mínima</span>
              <select v-model.number="anticipacionMin" data-testid="anticipacion">
                <option v-for="o in ANTICIPACIONES" :key="o.min" :value="o.min">{{ o.texto }}</option>
              </select>
            </label>
            <label class="campo">
              <span>Se puede reservar hasta</span>
              <select v-model.number="maxDiasAdelante" data-testid="max-dias">
                <option v-for="o in MAX_DIAS" :key="o" :value="o">{{ o }} días adelante</option>
              </select>
            </label>
          </div>

          <!-- Bloquear horarios -->
          <h3>Bloquear un día u horario</h3>
          <div class="alta">
            <input v-model="bloqueo.fecha" type="date" :min="hoy" data-testid="bloqueo-fecha" />
            <label class="check"><input v-model="bloqueo.todoElDia" type="checkbox" data-testid="bloqueo-todo" /> Todo el día</label>
            <template v-if="!bloqueo.todoElDia"><input v-model="bloqueo.desde" type="time" /><span>a</span><input v-model="bloqueo.hasta" type="time" /></template>
            <input v-model="bloqueo.motivo" type="text" maxlength="60" placeholder="Motivo (opcional)" />
            <button type="button" class="btn" data-testid="agregar-bloqueo" @click="agregarBloqueo">Bloquear</button>
          </div>
          <ul class="chips">
            <li v-for="(b, i) in bloqueos" :key="i" data-testid="bloqueo">
              {{ fechaDia(b.fecha) }}<template v-if="b.desde"> · {{ b.desde }}–{{ b.hasta }}</template><template v-else> · todo el día</template><template v-if="b.motivo"> · {{ b.motivo }}</template>
              <button type="button" aria-label="Quitar bloqueo" @click="bloqueos.splice(i, 1)">✕</button>
            </li>
          </ul>

          <!-- Vacaciones -->
          <h3>Vacaciones y días no laborables</h3>
          <div class="alta">
            <input v-model="vacacion.desde" type="date" :min="hoy" data-testid="vac-desde" />
            <span>a</span>
            <input v-model="vacacion.hasta" type="date" :min="vacacion.desde || hoy" data-testid="vac-hasta" />
            <input v-model="vacacion.motivo" type="text" maxlength="60" placeholder="Motivo (opcional)" />
            <button type="button" class="btn" data-testid="agregar-vacaciones" @click="agregarVacaciones">Agregar</button>
          </div>
          <ul class="chips">
            <li v-for="(v, i) in vacaciones" :key="i" data-testid="vacaciones">
              {{ fechaDia(v.desde) }} → {{ fechaDia(v.hasta) }}<template v-if="v.motivo"> · {{ v.motivo }}</template>
              <button type="button" aria-label="Quitar vacaciones" @click="vacaciones.splice(i, 1)">✕</button>
            </li>
          </ul>

          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button type="button" class="btn pri grande" :disabled="guardando" data-testid="guardar-horario" @click="guardar">{{ guardando ? 'Guardando…' : 'Guardar horario' }}</button>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { ahoraEnZona, validarSemana } from '../disponibilidad';
import { ErrorServicio } from '../catalogo';
import { guardarDisponibilidad, guardarProfesional, leerDisponibilidad, useProfesionales } from '../agenda';
import { esDuenoDeTienda } from '../sesion';
import { fechaDia } from '../formato';
import { DIAS_CLAVE, PROFESIONAL_PRINCIPAL, type Bloqueo, type DiaClave, type Disponibilidad, type Profesional, type Vacaciones } from '../tipos';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const { profesionales } = useProfesionales(() => (esDueno.value ? tiendaId.value : undefined));
const hoy = ahoraEnZona().fecha;

const NOMBRES: Record<DiaClave, string> = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' };
const DIAS = DIAS_CLAVE.map((clave) => ({ clave, nombre: NOMBRES[clave] }));
const ANTICIPACIONES = [
  { min: 0, texto: 'Sin anticipación' },
  { min: 30, texto: '30 minutos' },
  { min: 60, texto: '1 hora' },
  { min: 120, texto: '2 horas' },
  { min: 240, texto: '4 horas' },
  { min: 1440, texto: '1 día' },
];
const MAX_DIAS = [7, 15, 30, 60, 90];

const vacioDia = () => ({ abierto: false, abre: '09:00', cierra: '18:00', descansos: [] as { desde: string; hasta: string }[] });
const semana = reactive(Object.fromEntries(DIAS_CLAVE.map((d) => [d, vacioDia()])) as Record<DiaClave, ReturnType<typeof vacioDia>>);
const anticipacionMin = ref(60);
const maxDiasAdelante = ref(60);
const bloqueos = ref<Bloqueo[]>([]);
const vacaciones = ref<Vacaciones[]>([]);
const profId = ref(PROFESIONAL_PRINCIPAL);
const cargandoAgenda = ref(true);
const guardando = ref(false);
const error = ref('');

async function cargar() {
  if (!esDueno.value) return;
  cargandoAgenda.value = true;
  const d = await leerDisponibilidad(tiendaId.value, profId.value);
  for (const dia of DIAS_CLAVE) {
    const h = d.semana[dia];
    Object.assign(semana[dia], h ? { abierto: true, abre: h.abre, cierra: h.cierra, descansos: (h.descansos ?? []).map((x) => ({ ...x })) } : vacioDia());
  }
  anticipacionMin.value = d.anticipacionMin ?? 60;
  maxDiasAdelante.value = d.maxDiasAdelante ?? 60;
  bloqueos.value = (d.bloqueos ?? []).map((b) => ({ ...b }));
  vacaciones.value = (d.vacaciones ?? []).map((v) => ({ ...v }));
  cargandoAgenda.value = false;
}
watch([profId, esDueno], cargar, { immediate: true });

/* ---------- Equipo ---------- */
const nuevo = reactive({ nombre: '', especialidad: '' });
const avisar = (title: string, text: string) => Swal.fire({ icon: 'warning', title, text, confirmButtonColor: 'var(--color-bg-blue-ligth)' });

async function agregarProfesional() {
  try {
    await guardarProfesional(tiendaId.value, null, { ...nuevo });
    Object.assign(nuevo, { nombre: '', especialidad: '' });
  } catch (e: any) {
    await avisar('No se pudo agregar', e instanceof ErrorServicio ? e.message : 'Intenta de nuevo.');
  }
}
async function alternarProfesional(p: Profesional) {
  try {
    await guardarProfesional(tiendaId.value, p.id, { nombre: p.nombre, especialidad: p.especialidad, fotoUrl: p.fotoUrl, activo: !p.activo });
    if (!p.activo === false && profId.value === p.id) profId.value = PROFESIONAL_PRINCIPAL;
  } catch (e: any) {
    await avisar('No se pudo actualizar', e instanceof ErrorServicio ? e.message : 'Intenta de nuevo.');
  }
}

/* ---------- Bloqueos y vacaciones ---------- */
const bloqueo = reactive({ fecha: '', todoElDia: true, desde: '09:00', hasta: '10:00', motivo: '' });
const vacacion = reactive({ desde: '', hasta: '', motivo: '' });

function agregarBloqueo() {
  error.value = '';
  if (!bloqueo.fecha) return void (error.value = 'Elige la fecha que quieres bloquear.');
  if (!bloqueo.todoElDia && bloqueo.hasta <= bloqueo.desde) return void (error.value = 'La hora final debe ser después de la inicial.');
  bloqueos.value.push({ fecha: bloqueo.fecha, ...(bloqueo.todoElDia ? {} : { desde: bloqueo.desde, hasta: bloqueo.hasta }), ...(bloqueo.motivo.trim() ? { motivo: bloqueo.motivo.trim() } : {}) });
  Object.assign(bloqueo, { fecha: '', motivo: '' });
}
function agregarVacaciones() {
  error.value = '';
  if (!vacacion.desde || !vacacion.hasta) return void (error.value = 'Elige desde y hasta qué día.');
  if (vacacion.hasta < vacacion.desde) return void (error.value = 'El último día no puede ser antes del primero.');
  vacaciones.value.push({ desde: vacacion.desde, hasta: vacacion.hasta, ...(vacacion.motivo.trim() ? { motivo: vacacion.motivo.trim() } : {}) });
  Object.assign(vacacion, { desde: '', hasta: '', motivo: '' });
}

async function guardar() {
  error.value = '';
  const d: Disponibilidad = {
    semana: Object.fromEntries(DIAS_CLAVE.map((dia) => [dia, semana[dia].abierto ? { abre: semana[dia].abre, cierra: semana[dia].cierra, descansos: semana[dia].descansos.map((x) => ({ ...x })) } : null])),
    anticipacionMin: anticipacionMin.value,
    maxDiasAdelante: maxDiasAdelante.value,
    bloqueos: bloqueos.value,
    vacaciones: vacaciones.value,
  };
  const problemas = validarSemana(d.semana);
  if (problemas.length) return void (error.value = problemas[0]);
  guardando.value = true;
  try {
    await guardarDisponibilidad(tiendaId.value, profId.value, d);
    Swal.fire({ toast: true, position: 'bottom', timer: 1600, showConfirmButton: false, icon: 'success', title: 'Horario guardado' });
  } catch (e: any) {
    error.value = e instanceof ErrorServicio ? e.message : 'No se pudo guardar. Intenta de nuevo.';
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 18px; }
.ayuda { margin: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.45; }
.tarjeta { padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 12px; }
.tarjeta h2, .tarjeta h3 { margin: 0; }
.tarjeta h3 { font-size: 0.98rem; margin-top: 6px; }
.equipo, .dias, .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.miembro { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); }
.miembro.inactivo { opacity: 0.6; }
.miembro small { color: var(--text-muted); }
.miembro .mini, .etiqueta { margin-left: auto; }
.etiqueta { padding: 2px 10px; border-radius: 999px; background: var(--brand-blue-soft); color: var(--brand-blue-text); font-size: 0.75rem; font-weight: 700; }
.alta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
input, select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; font-size: 16px; min-width: 0; }
.alta input[type='text'] { flex: 1; min-width: 140px; }
.campo { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; font-weight: 600; }
.dos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dia { padding: 8px 10px; border-radius: 10px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
.dia-cab { display: flex; align-items: center; gap: 8px; }
.dia-horas, .descanso { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.descanso small { color: var(--text-muted); min-width: 60px; }
.cerrado { color: var(--text-muted); }
.check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.88rem; }
.chips li { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: var(--surface-2); font-size: 0.85rem; text-transform: capitalize; }
.chips button { margin-left: auto; border: 0; background: var(--peligro-fondo); color: var(--peligro-texto); border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: 700; }
.error { margin: 0; color: var(--peligro-texto); font-weight: 600; font-size: 0.88rem; }
.btn { padding: 9px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.grande { padding: 13px; font-size: 1rem; }
.btn:disabled { opacity: 0.6; cursor: wait; }
.mini { padding: 5px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.mini.peligro { border-color: transparent; background: var(--peligro-fondo); color: var(--peligro-texto); }
@media (max-width: 520px) { .dos { grid-template-columns: 1fr; } }
</style>
