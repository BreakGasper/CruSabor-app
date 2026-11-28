<template>
  <div class="admin-container">
    <AdminTopbar titulo="Sorteos" />

    <main class="admin-main">
      <p class="ayuda">
        Todos los clientes registrados participan en el <strong>mismo sorteo</strong>. Cada tienda patrocinadora recibe un
        código para repartir: el cliente lo escribe en su perfil y así sabes qué tienda lo trajo.
      </p>

      <!-- Nuevo / editar sorteo -->
      <section class="card" data-testid="form-sorteo">
        <h2>{{ editandoId ? 'Editar sorteo' : 'Nuevo sorteo' }}</h2>
        <div class="form-grid">
          <div class="campo campo-ancho">
            <label for="s-titulo">Nombre del sorteo</label>
            <input id="s-titulo" v-model="form.titulo" class="form-input" maxlength="80" placeholder="Ej. Sorteo de aniversario" data-testid="titulo" />
          </div>
          <div class="campo campo-ancho">
            <label for="s-premio">Premio</label>
            <input id="s-premio" v-model="form.premio" class="form-input" maxlength="120" placeholder="Ej. Pantalla de 43 pulgadas" data-testid="premio" />
          </div>
          <div class="campo campo-ancho">
            <label for="s-desc">Cómo participar (opcional)</label>
            <textarea id="s-desc" v-model="form.descripcion" class="form-input" rows="2" maxlength="300" placeholder="Ej. Pide tu código en cualquiera de las tiendas participantes."></textarea>
          </div>
          <div class="campo">
            <label for="s-ini">Empieza (opcional)</label>
            <input id="s-ini" v-model="form.fechaInicio" type="date" class="form-input" />
          </div>
          <div class="campo">
            <label for="s-fin">Se puede participar hasta (opcional)</label>
            <input id="s-fin" v-model="form.fechaFin" type="date" class="form-input" />
          </div>
          <div class="campo campo-ancho">
            <label class="switch"><input v-model="form.activo" type="checkbox" /><span>Activo (visible para los clientes)</span></label>
          </div>
        </div>
        <div class="acciones-form">
          <button type="button" class="btn btn-primary" :disabled="guardando" data-testid="guardar-sorteo" @click="guardar">
            {{ guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear sorteo' }}
          </button>
          <button v-if="editandoId" type="button" class="btn btn-secundario" @click="reset">Cancelar</button>
        </div>
      </section>

      <h2 class="lista-titulo">Sorteos ({{ sorteos.length }})</h2>
      <p v-if="cargando" class="ayuda">Cargando...</p>
      <p v-else-if="!sorteos.length" class="ayuda">Aún no hay sorteos.</p>

      <ul v-else class="lista">
        <li v-for="s in sorteos" :key="s.id" class="sorteo" :class="{ abierto: seleccionado === s.id }" :data-sorteo="s.id">
          <div class="fila">
            <div class="info">
              <strong>{{ s.titulo }}</strong>
              <span class="meta">
                <span :class="'est est-' + estadoSorteo(s)">{{ ESTADO_SORTEO_LABEL[estadoSorteo(s)] }}</span>
                <span v-if="s.premio"> · 🏆 {{ s.premio }}</span>
                <span> · {{ s.codigos.length }} código(s)</span>
              </span>
            </div>
            <div class="botones">
              <button type="button" class="btn btn-mini" data-testid="administrar" @click="abrir(s.id)">{{ seleccionado === s.id ? 'Cerrar' : 'Administrar' }}</button>
              <button type="button" class="btn btn-mini" @click="editar(s)">Editar</button>
              <button v-if="!s.cerradoEn" type="button" class="btn btn-mini" @click="alternarSorteo(s.id, !s.activo)">{{ s.activo ? 'Pausar' : 'Activar' }}</button>
              <button type="button" class="btn btn-mini btn-borrar" @click="borrar(s)">Eliminar</button>
            </div>
          </div>

          <!-- Panel del sorteo seleccionado -->
          <div v-if="seleccionado === s.id" class="panel">
            <h3>Códigos de las tiendas patrocinadoras</h3>
            <div class="form-codigo">
              <select v-model="nuevo.tiendaId" class="form-input" data-testid="tienda-codigo">
                <option value="">Elige una tienda…</option>
                <option v-for="t in tiendas" :key="t.tiendaId" :value="t.tiendaId">{{ t.nombreTienda }}</option>
              </select>
              <input v-model="nuevo.codigo" class="form-input" maxlength="24" placeholder="Código (vacío = se genera uno)" data-testid="codigo-propio" />
              <input v-model.number="nuevo.limite" type="number" min="0" class="form-input corto" placeholder="Límite" title="Veces que se puede usar (0 = sin límite)" />
              <button type="button" class="btn btn-primary" :disabled="agregando" data-testid="agregar-codigo" @click="agregar(s)">Agregar</button>
            </div>
            <p class="pista">Límite de usos: cuántas personas pueden entrar con ese código (0 = sin límite).</p>

            <p v-if="!s.codigos.length" class="ayuda">Aún no hay códigos. Crea uno por cada tienda patrocinadora.</p>
            <ul v-else class="codigos">
              <li v-for="c in s.codigos" :key="c.codigo" class="codigo" :class="{ inactivo: !c.activo }">
                <img :src="c.logoUrl || placeholderLogo" alt="" class="logo" @error="onImgError" />
                <div class="info">
                  <strong class="cod" :data-codigo="c.codigo">{{ c.codigo }}</strong>
                  <span class="meta">{{ c.nombreTienda }} · {{ c.usos }}{{ c.limite ? ` / ${c.limite}` : '' }} uso(s){{ c.activo ? '' : ' · desactivado' }}</span>
                </div>
                <div class="botones">
                  <button type="button" class="btn btn-mini" @click="copiar(c.codigo)">Copiar</button>
                  <button type="button" class="btn btn-mini" @click="alternarCodigo(s.id, c.codigo, !c.activo)">{{ c.activo ? 'Desactivar' : 'Activar' }}</button>
                  <button type="button" class="btn btn-mini btn-borrar" @click="quitarCodigo(s, c.codigo)">Quitar</button>
                </div>
              </li>
            </ul>

            <h3>Participantes: {{ participantes.length }}</h3>
            <p v-if="cargandoParticipantes" class="ayuda">Cargando...</p>
            <p v-else-if="!participantes.length" class="ayuda">Todavía no participa nadie.</p>
            <ul v-else class="resumen" data-testid="resumen-tiendas">
              <li v-for="r in resumen" :key="r.tiendaId">
                <span>{{ r.nombreTienda }}</span><strong>{{ r.participantes }}</strong>
              </li>
            </ul>

            <h3>Ganador</h3>
            <ul v-if="s.ganadores.length" class="ganadores" data-testid="ganadores">
              <li v-for="g in s.ganadores" :key="g.id">
                🎉 <strong>{{ g.nombre }}</strong>
                <span v-if="g.telefono"> · 📞 {{ g.telefono }}</span>
                <span v-if="g.nombreTienda"> · vino por {{ g.nombreTienda }} ({{ g.codigo }})</span>
              </li>
            </ul>
            <button type="button" class="btn btn-primary" :disabled="sorteando || !participantes.length" data-testid="sortear" @click="sortear(s)">
              {{ sorteando ? 'Sorteando…' : s.ganadores.length ? 'Sortear otro ganador' : '🎲 Sortear ganador' }}
            </button>
            <p class="pista">Al sortear se cierra la participación. El ganador se elige al azar entre todos los participantes que no hayan ganado ya.</p>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import placeholderLogo from '@/assets/icons/user_back_profile.png';
import { sessionAdmin } from '@/utils/sessionAdmin';
import { useTiendas } from '@/composables/useTiendas';
import {
  useSorteos,
  useParticipantes,
  crearSorteo,
  actualizarSorteo,
  eliminarSorteo,
  alternarSorteo,
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

const { sorteos, cargando } = useSorteos();
const { tiendas: todasTiendas, cargarTiendas } = useTiendas();
onMounted(cargarTiendas);
const tiendas = computed(() => [...todasTiendas.value].sort((a, b) => a.nombreTienda.localeCompare(b.nombreTienda)));

const seleccionado = ref<string | null>(null);
const { participantes, cargando: cargandoParticipantes, observar } = useParticipantes(() => seleccionado.value);
watch(seleccionado, () => observar());
const sorteoActual = computed(() => sorteos.value.find((s) => s.id === seleccionado.value) || null);
const resumen = computed(() => participantesPorTienda(participantes.value, sorteoActual.value?.codigos ?? []));

const formVacio = () => ({ titulo: '', premio: '', descripcion: '', fechaInicio: '', fechaFin: '', activo: true });
const form = reactive(formVacio());
const editandoId = ref<string | null>(null);
const guardando = ref(false);

function reset() {
  Object.assign(form, formVacio());
  editandoId.value = null;
}

const aviso = (icon: 'success' | 'error' | 'warning', title: string, text = '') =>
  Swal.fire({ icon, title, text, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
const textoError = (e: any) => (e instanceof ErrorSorteo ? e.message : e?.message || 'Intenta de nuevo.');

async function guardar() {
  guardando.value = true;
  try {
    if (editandoId.value) await actualizarSorteo(editandoId.value, { ...form });
    else seleccionado.value = await crearSorteo({ ...form });
    Swal.fire({ toast: true, position: 'bottom', timer: 1500, showConfirmButton: false, icon: 'success', title: editandoId.value ? 'Sorteo actualizado' : 'Sorteo creado' });
    reset();
  } catch (e: any) {
    await aviso('warning', 'No se pudo guardar', textoError(e));
  } finally {
    guardando.value = false;
  }
}

function editar(s: Sorteo) {
  editandoId.value = s.id;
  Object.assign(form, { titulo: s.titulo, premio: s.premio, descripcion: s.descripcion, fechaInicio: s.fechaInicio || '', fechaFin: s.fechaFin || '', activo: s.activo });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrir(id: string) {
  seleccionado.value = seleccionado.value === id ? null : id;
}

async function borrar(s: Sorteo) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar este sorteo?',
    text: `«${s.titulo}» se borra con sus códigos y participantes. No se puede deshacer.`,
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  await eliminarSorteo(s.id);
  if (seleccionado.value === s.id) seleccionado.value = null;
  if (editandoId.value === s.id) reset();
}

/* ---------- Códigos ---------- */
const nuevo = reactive({ tiendaId: '', codigo: '', limite: 0 });
const agregando = ref(false);

async function agregar(s: Sorteo) {
  const t = tiendas.value.find((x) => x.tiendaId === nuevo.tiendaId);
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

async function quitarCodigo(s: Sorteo, codigo: string) {
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Quitar el código ${codigo}?`,
    text: 'Nadie más podrá entrar con él. Quienes ya participan con ese código siguen participando.',
    showCancelButton: true,
    confirmButtonText: 'Quitar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (r.isConfirmed) await eliminarCodigo(s.id, codigo);
}

/* ---------- Sorteo ---------- */
const sorteando = ref(false);

async function sortear(s: Sorteo) {
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
.admin-container { min-height: 100vh; background: var(--bg-page); }
.admin-main { max-width: 900px; margin: 0 auto; padding: 1rem; }
.ayuda { color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0 1rem; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 1.5rem; }
.card h2, .lista-titulo { font-size: 1.05rem; margin: 0 0 12px; color: var(--text); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.campo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.campo-ancho { grid-column: 1 / -1; }
.campo label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.form-input { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; font-size: 16px; min-width: 0; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text); cursor: pointer; }
.acciones-form { display: flex; gap: 10px; margin-top: 14px; }
.btn { padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; font-weight: 600; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #059669; color: #fff; }
.btn-secundario { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn-mini { padding: 6px 10px; font-size: 0.78rem; background: var(--surface-2); color: var(--text); border-color: var(--border); }
.btn-borrar { color: #b91c1c; border-color: #fca5a5; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.sorteo { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
.sorteo.abierto { border-color: #059669; }
.fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.info strong { color: var(--text); font-size: 0.95rem; }
.meta { color: var(--text-muted); font-size: 0.8rem; word-break: break-word; }
.est { font-weight: 700; }
.est-abierto { color: #059669; }
.est-pausado, .est-terminado { color: #b91c1c; }
.est-proximo { color: #1d4ed8; }
.est-sorteado { color: #b45309; }
.botones { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.panel { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border); }
.panel h3 { font-size: 0.95rem; margin: 14px 0 8px; color: var(--text); }
.form-codigo { display: grid; grid-template-columns: 1.4fr 1.2fr 90px auto; gap: 8px; }
.corto { width: 100%; }
.pista { color: var(--text-muted); font-size: 0.78rem; margin: 6px 0; }
.codigos, .resumen, .ganadores { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.codigo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px; border-radius: 10px; background: var(--surface-2); }
.codigo.inactivo { opacity: 0.6; }
.logo { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: none; background: var(--surface); }
.cod { letter-spacing: 0.08em; font-size: 1rem; }
.resumen li { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 8px; background: var(--surface-2); font-size: 0.88rem; color: var(--text); }
.ganadores li { padding: 8px 10px; border-radius: 8px; background: #fef3c7; color: #78350f; font-size: 0.9rem; }
@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-codigo { grid-template-columns: 1fr 1fr; }
  .form-codigo .btn { grid-column: 1 / -1; }
}
</style>
