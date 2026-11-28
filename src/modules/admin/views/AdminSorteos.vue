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
            <label>Banner del sorteo (opcional)</label>
            <div class="dropzone" data-testid="banner-sorteo" @click="fileInput?.click()">
              <img v-if="form.imagenUrl" :src="form.imagenUrl" alt="Vista previa del banner" class="preview" />
              <span v-else class="dropzone-texto">{{ subiendo ? 'Subiendo...' : 'Toca para elegir la imagen del banner' }}</span>
            </div>
            <input ref="fileInput" type="file" accept="image/*" hidden data-testid="archivo-banner" @change="onArchivo" />
            <small class="pista">Se publica en el carrusel de la pantalla principal, con los logos de las tiendas participantes abajo. Sin imagen sale con un fondo de colores.</small>
            <button v-if="form.imagenUrl" type="button" class="btn btn-mini quitar-img" @click="form.imagenUrl = ''">Quitar imagen</button>
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
        <li v-for="s in sorteos" :key="s.id" class="sorteo" :data-sorteo="s.id">
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
              <button type="button" class="btn btn-mini" data-testid="administrar" @click="seleccionado = s.id">Administrar</button>
              <button type="button" class="btn btn-mini" @click="editar(s)">Editar</button>
              <button v-if="!s.cerradoEn" type="button" class="btn btn-mini" @click="alternarSorteo(s.id, !s.activo)">{{ s.activo ? 'Pausar' : 'Activar' }}</button>
              <button type="button" class="btn btn-mini btn-borrar" @click="borrar(s)">Eliminar</button>
            </div>
          </div>

        </li>
      </ul>
    </main>

    <!-- Detalle del sorteo: tiendas participantes, clientes registrados, códigos y sorteo -->
    <SorteoDetalleModal :sorteo="sorteoActual" :tiendas="tiendas" @close="seleccionado = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import SorteoDetalleModal from '../components/SorteoDetalleModal.vue';
import { uploadImage, eliminarImagenReemplazada } from '@/composables/useCloudinary';
import { recortarFoto } from '@/utils/recortarFoto';
import { useTiendas } from '@/composables/useTiendas';
import {
  useSorteos,
  crearSorteo,
  actualizarSorteo,
  eliminarSorteo,
  alternarSorteo,
  alternarCodigo,
  estadoSorteo,
  ESTADO_SORTEO_LABEL,
  ErrorSorteo,
  type Sorteo,
} from '@/composables/useSorteos';

const { sorteos, cargando } = useSorteos();
const { tiendas: todasTiendas, cargarTiendas } = useTiendas();
onMounted(cargarTiendas);
const tiendas = computed(() => [...todasTiendas.value].sort((a, b) => a.nombreTienda.localeCompare(b.nombreTienda)));

const seleccionado = ref<string | null>(null);
const sorteoActual = computed(() => sorteos.value.find((s) => s.id === seleccionado.value) || null);

const formVacio = () => ({ titulo: '', imagenUrl: '', premio: '', descripcion: '', fechaInicio: '', fechaFin: '', activo: true });
const form = reactive(formVacio());
const editandoId = ref<string | null>(null);
const guardando = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const subiendo = ref(false);
/** Imagen con la que se abrió la edición: si se cambia o se quita, la vieja se borra */
const imagenAlEditar = ref('');

async function onArchivo(e: Event) {
  const elegida = (e.target as HTMLInputElement).files?.[0];
  if (!elegida) return;
  const file = await recortarFoto(elegida, '3:1'); // recorte básico del banner
  if (!file) {
    if (fileInput.value) fileInput.value.value = '';
    return;
  }
  subiendo.value = true;
  try {
    form.imagenUrl = await uploadImage(file);
  } catch {
    await Swal.fire({ icon: 'error', title: 'No se pudo subir la imagen' });
  } finally {
    subiendo.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function reset() {
  Object.assign(form, formVacio());
  editandoId.value = null;
  imagenAlEditar.value = '';
}

const aviso = (icon: 'success' | 'error' | 'warning', title: string, text = '') =>
  Swal.fire({ icon, title, text, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
const textoError = (e: any) => (e instanceof ErrorSorteo ? e.message : e?.message || 'Intenta de nuevo.');

async function guardar() {
  guardando.value = true;
  try {
    if (editandoId.value) {
      await actualizarSorteo(editandoId.value, { ...form });
      // Ya guardada la nueva (o ninguna): la anterior queda sin uso
      void eliminarImagenReemplazada(imagenAlEditar.value, form.imagenUrl);
    } else seleccionado.value = await crearSorteo({ ...form });
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
  imagenAlEditar.value = s.imagenUrl || '';
  Object.assign(form, { imagenUrl: s.imagenUrl || '', titulo: s.titulo, premio: s.premio, descripcion: s.descripcion, fechaInicio: s.fechaInicio || '', fechaFin: s.fechaFin || '', activo: s.activo });
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
.dropzone { border: 1.5px dashed var(--border); border-radius: 12px; min-height: 110px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; background: var(--surface-2); }
.dropzone-texto { color: var(--text-muted); font-size: 0.9rem; padding: 0 12px; text-align: center; }
.preview { width: 100%; max-height: 190px; object-fit: cover; }
.quitar-img { align-self: flex-start; margin-top: 6px; }
.pista { color: var(--text-muted); font-size: 0.78rem; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text); cursor: pointer; }
.acciones-form { display: flex; gap: 10px; margin-top: 14px; }
.btn { padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; font-weight: 600; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #059669; color: #fff; }
.btn-secundario { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn-mini { padding: 6px 10px; font-size: 0.78rem; background: var(--surface-2); color: var(--text); border-color: var(--border); }
.btn-borrar { background: var(--peligro-fondo); color: var(--peligro-texto); border-color: transparent; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.sorteo { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
.fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.info strong { color: var(--text); font-size: 0.95rem; }
.meta { color: var(--text-muted); font-size: 0.8rem; word-break: break-word; }
.est { font-weight: 700; }
.est-abierto { color: var(--ok-texto); }
.est-pausado, .est-terminado { color: var(--peligro-texto); }
.est-proximo { color: var(--brand-blue-text); }
.est-sorteado { color: var(--aviso-texto); }
.botones { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.pista { color: var(--text-muted); font-size: 0.78rem; margin: 6px 0; }
@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
