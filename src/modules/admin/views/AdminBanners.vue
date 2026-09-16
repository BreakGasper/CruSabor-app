<template>
  <div class="admin-container">
    <AdminTopbar titulo="Banners" />

    <main class="admin-main">
      <p class="ayuda">
        Los banners activos y vigentes se muestran en un carrusel arriba de "Explorar" en la portada.
      </p>

      <!-- Formulario: nuevo / editar -->
      <section class="card">
        <h2>{{ editandoId ? 'Editar banner' : 'Nuevo banner' }}</h2>

        <div class="form-grid">
          <!-- Imagen -->
          <div class="campo campo-imagen">
            <label>Imagen del banner</label>
            <div class="dropzone" @click="fileInput?.click()">
              <img v-if="form.imagenUrl" :src="form.imagenUrl" alt="Vista previa" class="preview" />
              <span v-else class="dropzone-texto">{{ subiendo ? 'Subiendo...' : 'Toca para elegir una imagen' }}</span>
            </div>
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onArchivo" />
          </div>

          <div class="campo">
            <label for="b-titulo">Título</label>
            <input id="b-titulo" v-model="form.titulo" type="text" class="form-input" maxlength="80" placeholder="Ej. Ofertas de la semana" />
          </div>

          <div class="campo">
            <label for="b-subtitulo">Subtítulo (opcional)</label>
            <input id="b-subtitulo" v-model="form.subtitulo" type="text" class="form-input" maxlength="120" placeholder="Texto secundario" />
          </div>

          <div class="campo campo-ancho">
            <label for="b-enlace">Enlace al tocarlo (opcional)</label>
            <input id="b-enlace" v-model="form.enlace" type="text" class="form-input" placeholder="/tiendas  ·  /categoria  ·  https://..." />
            <small class="pista">Ruta interna (empieza con “/”) o dirección web completa. Vacío = no clickeable.</small>
          </div>

          <div class="campo">
            <label for="b-inicio">Vigencia desde (opcional)</label>
            <input id="b-inicio" v-model="form.fechaInicio" type="date" class="form-input" />
          </div>
          <div class="campo">
            <label for="b-fin">Vigencia hasta (opcional)</label>
            <input id="b-fin" v-model="form.fechaFin" type="date" class="form-input" />
          </div>

          <div class="campo">
            <label for="b-orden">Orden</label>
            <input id="b-orden" v-model.number="form.orden" type="number" min="0" class="form-input" />
          </div>
          <div class="campo campo-check">
            <label class="switch">
              <input v-model="form.activo" type="checkbox" />
              <span>Activo (visible en la portada)</span>
            </label>
          </div>
        </div>

        <div class="acciones-form">
          <button type="button" class="btn btn-primary" :disabled="subiendo || !form.imagenUrl || guardando" @click="guardar">
            {{ guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar banner' }}
          </button>
          <button v-if="editandoId" type="button" class="btn btn-secundario" @click="cancelarEdicion">Cancelar</button>
        </div>
      </section>

      <!-- Lista -->
      <h2 class="lista-titulo">Banners ({{ banners.length }})</h2>
      <p v-if="cargando" class="ayuda">Cargando...</p>
      <p v-else-if="!banners.length" class="ayuda">Aún no hay banners.</p>

      <ul v-else class="lista">
        <li v-for="b in banners" :key="b.id" class="fila" :class="{ inactivo: !esVisible(b) }">
          <img :src="b.imagenUrl" alt="" class="miniatura" />
          <div class="info">
            <strong>{{ b.titulo || '(sin título)' }}</strong>
            <span v-if="b.subtitulo" class="sub">{{ b.subtitulo }}</span>
            <span class="meta">
              Orden {{ b.orden }} ·
              <span :class="esVisible(b) ? 'ok' : 'off'">{{ estadoTexto(b) }}</span>
              <span v-if="b.enlace"> · → {{ b.enlace }}</span>
            </span>
          </div>
          <div class="botones">
            <button type="button" class="btn btn-mini" @click="editar(b)">Editar</button>
            <button type="button" class="btn btn-mini" @click="alternar(b)">{{ b.activo ? 'Ocultar' : 'Mostrar' }}</button>
            <button type="button" class="btn btn-mini btn-borrar" @click="borrar(b)">Eliminar</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import { uploadImage } from '@/composables/useCloudinary';
import {
  useBannersAdmin,
  crearBanner,
  actualizarBanner,
  alternarBannerActivo,
  eliminarBanner,
  bannerVigente,
  type Banner,
} from '@/composables/useBanners';

const { banners, cargando } = useBannersAdmin();

const fileInput = ref<HTMLInputElement | null>(null);
const subiendo = ref(false);
const guardando = ref(false);
const editandoId = ref<string | null>(null);

const formVacio = () => ({
  imagenUrl: '',
  titulo: '',
  subtitulo: '',
  enlace: '',
  activo: true,
  orden: 0,
  fechaInicio: '',
  fechaFin: '',
});
const form = reactive(formVacio());

function reset() {
  Object.assign(form, formVacio());
  editandoId.value = null;
}

async function onArchivo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  subiendo.value = true;
  try {
    form.imagenUrl = await uploadImage(file);
  } catch {
    Swal.fire({ icon: 'error', title: 'No se pudo subir la imagen' });
  } finally {
    subiendo.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

async function guardar() {
  if (!form.imagenUrl) return;
  if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
    Swal.fire({ icon: 'warning', title: 'La fecha de fin no puede ser anterior a la de inicio' });
    return;
  }
  guardando.value = true;
  try {
    if (editandoId.value) {
      await actualizarBanner(editandoId.value, { ...form });
      Swal.fire({ toast: true, position: 'bottom', timer: 1500, showConfirmButton: false, icon: 'success', title: 'Banner actualizado' });
    } else {
      await crearBanner({ ...form });
      Swal.fire({ toast: true, position: 'bottom', timer: 1500, showConfirmButton: false, icon: 'success', title: 'Banner agregado' });
    }
    reset();
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: e?.message || '' });
  } finally {
    guardando.value = false;
  }
}

function editar(b: Banner) {
  editandoId.value = b.id;
  Object.assign(form, {
    imagenUrl: b.imagenUrl,
    titulo: b.titulo || '',
    subtitulo: b.subtitulo || '',
    enlace: b.enlace || '',
    activo: b.activo,
    orden: b.orden,
    fechaInicio: b.fechaInicio || '',
    fechaFin: b.fechaFin || '',
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  reset();
}

async function alternar(b: Banner) {
  await alternarBannerActivo(b.id, !b.activo);
}

async function borrar(b: Banner) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar este banner?',
    text: b.titulo || '',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (r.isConfirmed) {
    await eliminarBanner(b.id);
    if (editandoId.value === b.id) reset();
  }
}

const esVisible = (b: Banner) => bannerVigente(b);
function estadoTexto(b: Banner): string {
  if (!b.activo) return 'Oculto';
  if (!bannerVigente(b)) return 'Fuera de vigencia';
  return 'Visible';
}
</script>

<style scoped>
.admin-container { min-height: 100vh; background: var(--bg-page); }
.admin-main { max-width: 900px; margin: 0 auto; padding: 1rem; }
.ayuda { color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0 1rem; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 1.5rem;
}
.card h2, .lista-titulo { font-size: 1.05rem; margin: 0 0 12px; color: var(--text); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.campo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.campo-ancho, .campo-imagen { grid-column: 1 / -1; }
.campo label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
.form-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
}
.pista { color: var(--text-muted); font-size: 0.78rem; }
.dropzone {
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: var(--surface-2);
}
.dropzone-texto { color: var(--text-muted); font-size: 0.9rem; }
.preview { width: 100%; max-height: 200px; object-fit: cover; }
.campo-check { justify-content: flex-end; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text); cursor: pointer; }
.acciones-form { display: flex; gap: 10px; margin-top: 14px; }
.btn {
  padding: 8px 16px; border-radius: 10px; border: 1px solid transparent;
  font-weight: 600; font-size: 0.85rem; cursor: pointer; font-family: inherit;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #059669; color: #fff; }
.btn-secundario { background: var(--surface); color: var(--text); border-color: var(--border); }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.fila {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 10px;
}
.fila.inactivo { opacity: 0.6; }
.miniatura { width: 84px; height: 52px; object-fit: cover; border-radius: 8px; flex: none; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.info strong { color: var(--text); font-size: 0.92rem; }
.info .sub { color: var(--text-muted); font-size: 0.82rem; }
.info .meta { color: var(--text-muted); font-size: 0.78rem; word-break: break-word; }
.info .ok { color: #059669; font-weight: 600; }
.info .off { color: #b91c1c; font-weight: 600; }
.botones { display: flex; gap: 6px; flex: none; flex-wrap: wrap; justify-content: flex-end; }
.btn-mini { padding: 6px 10px; font-size: 0.78rem; background: var(--surface-2); color: var(--text); border-color: var(--border); }
.btn-borrar { color: #b91c1c; border-color: #fca5a5; }
@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
