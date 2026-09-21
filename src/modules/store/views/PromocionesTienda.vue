<template>
  <div class="promos-container">
    <PageHeader title="Promociones" :fallback="`/store/profile/${tiendaId}`" />

    <main class="promos-main">
      <p v-if="!esDueno" class="aviso">
        Solo la dueña o el dueño de la tienda puede administrar sus promociones.
      </p>

      <template v-else-if="!habilitadas">
        <p class="aviso">
          Las promociones están apagadas por el administrador. Las que ya tienes se conservan y
          vuelven a mostrarse cuando las encienda.
        </p>
      </template>

      <template v-else>
        <div class="barra">
          <p class="hint">
            Una promoción es un descuento sobre un artículo que ya publicaste. Dura
            <strong>un mes</strong>; al caducar el artículo se sigue vendiendo a su precio normal y
            aquí puedes renovarla.
          </p>
          <button v-if="!editorAbierto" type="button" class="btn-pri" @click="abrirNueva">
            + Nueva promoción
          </button>
        </div>

        <!-- Alta y edición -->
        <form v-if="editorAbierto" class="editor" novalidate @submit.prevent="guardar">
          <h2 class="editor-titulo">{{ editandoId ? 'Editar promoción' : 'Nueva promoción' }}</h2>

          <label class="campo">
            <span>Artículo *</span>
            <select v-model="form.articuloId" class="input" :disabled="!!editandoId" @change="onArticuloElegido">
              <option value="">Elige uno de tus artículos</option>
              <option v-for="a in articulosDisponibles" :key="a.articuloId" :value="a.articuloId">
                {{ a.nombre }} — ${{ Number(a.precio).toFixed(2) }}
              </option>
            </select>
            <small v-if="editandoId" class="pista">El artículo no se cambia: crea otra promoción.</small>
          </label>

          <label class="campo">
            <span>Título de la promoción *</span>
            <input v-model="form.titulo" type="text" maxlength="60" class="input" placeholder="2x1 en jericallas" />
          </label>

          <div class="campo">
            <span>Banner</span>
            <div class="banner-fila">
              <div class="banner-vista">
                <img v-if="bannerVista" :src="bannerVista" alt="Banner de la promoción" />
                <span v-else>Sin banner</span>
              </div>
              <div class="banner-acciones">
                <input ref="archivoBanner" type="file" accept="image/*" hidden @change="onBannerElegido" />
                <button type="button" class="btn-sec" @click="archivoBanner?.click()">Elegir imagen</button>
                <small class="pista">Si no subes una, se usa la foto del artículo.</small>
              </div>
            </div>
          </div>

          <div class="fila-dos">
            <label class="campo">
              <span>Precio normal</span>
              <input :value="`$${form.precioOriginal.toFixed(2)}`" type="text" class="input" readonly />
            </label>
            <label class="campo">
              <span>Precio de promoción *</span>
              <input
                v-model="precioPromoTexto"
                type="text"
                inputmode="decimal"
                class="input"
                placeholder="0.00"
              />
              <small v-if="descuentoVista > 0" class="pista descuento">-{{ descuentoVista }}% de descuento</small>
            </label>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="editor-botones">
            <button type="button" class="btn-sec" :disabled="guardando" @click="cerrarEditor">Cancelar</button>
            <button type="submit" class="btn-pri" :disabled="guardando">
              {{ guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Publicar promoción' }}
            </button>
          </div>
        </form>

        <p v-if="!mias.length" class="vacio">
          Todavía no tienes promociones. La que crees aparecerá en <strong>Destacados</strong>, en la
          portada de la app.
        </p>

        <ul v-else class="lista">
          <li v-for="p in mias" :key="p.id" class="promo" :class="estadoDe(p)">
            <div class="promo-banner">
              <img v-if="p.bannerUrl" :src="p.bannerUrl" :alt="p.titulo" @error="onImgError" />
              <div v-else class="sin-banner"></div>
            </div>

            <div class="promo-datos">
              <div class="promo-linea">
                <h3 class="promo-titulo">{{ p.titulo }}</h3>
                <span class="etq" :class="estadoDe(p)">{{ etiquetaEstado(estadoDe(p)) }}</span>
              </div>
              <p class="promo-articulo">{{ nombreArticulo(p.articuloId) }}</p>
              <p class="promo-precios">
                <span class="precio">${{ p.precioPromo.toFixed(2) }}</span>
                <span class="antes">${{ p.precioOriginal.toFixed(2) }}</span>
                <span v-if="descuentoPorcentaje(p) > 0" class="menos">-{{ descuentoPorcentaje(p) }}%</span>
              </p>
              <p class="promo-fechas">
                Publicada el {{ fechaPublicacion(p.creadaEn) }} ·
                {{ estadoDe(p) === 'caducada' ? 'caducó' : 'caduca' }} el {{ fechaCorta(p.venceEn) }}
              </p>

              <div class="promo-acciones">
                <button type="button" class="btn-txt" @click="abrirEdicion(p)">Editar</button>
                <button v-if="estadoDe(p) !== 'caducada'" type="button" class="btn-txt" @click="alternarPausa(p)">
                  {{ p.activa ? 'Pausar' : 'Reanudar' }}
                </button>
                <button v-else type="button" class="btn-txt" @click="renovar(p)">Renovar un mes</button>
                <button type="button" class="btn-txt peligro" @click="borrar(p)">Eliminar</button>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * Panel de promociones de una tienda: crear, editar, pausar, renovar y eliminar.
 *
 * Una promoción es un descuento sobre un artículo que la tienda ya publicó, con
 * un mes de vigencia (ver `usePromociones.ts`). Aquí no se toca el artículo:
 * mientras la promoción esté vigente, la app cobra el precio de la promoción.
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { useArticulos } from '@/composables/useArticulos';
import { uploadArticuloImagen } from '@/composables/useStorage';
import { useConfiguracion } from '@/composables/useConfiguracion';
import {
  usePromociones,
  crearPromocion,
  actualizarPromocion,
  pausarPromocion,
  renovarPromocion,
  eliminarPromocion,
  descuentoPorcentaje,
  estadoPromocion,
  fechaPublicacion,
  type EstadoPromocion,
  type Promocion,
} from '@/composables/usePromociones';
import defaultArticulo from '@/assets/icons/default_articulo.png';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id || ''));
const tiendaLocal = JSON.parse(localStorage.getItem('tiendas') || '{}');
const esDueno = computed(() => !!tiendaId.value && tiendaLocal?.id === tiendaId.value);

const { promocionesHabilitadas } = useConfiguracion();
const habilitadas = promocionesHabilitadas;

const { articulos, cargarArticulosPorTienda } = useArticulos({ incluirTiendasInactivas: true });
const { dePorTienda } = usePromociones();

onMounted(() => {
  if (!esDueno.value) return;
  cargarArticulosPorTienda(tiendaId.value);
});

const mias = computed(() => dePorTienda(tiendaId.value));
const articulosDisponibles = computed(() => articulos.value.filter((a) => a.baja !== true));

const nombreArticulo = (articuloId: string) =>
  articulos.value.find((a) => a.articuloId === articuloId)?.nombre || 'Artículo eliminado';

const estadoDe = (p: Promocion) => estadoPromocion(p);
const etiquetaEstado = (e: EstadoPromocion) =>
  e === 'vigente' ? 'Vigente' : e === 'pausada' ? 'Pausada' : 'Caducada';

const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(d)
    : '';
};

/* ---------------- Editor ---------------- */

const editorAbierto = ref(false);
const editandoId = ref('');
const guardando = ref(false);
const error = ref('');
const archivoBanner = ref<HTMLInputElement | null>(null);
const bannerFile = ref<File | null>(null);
const precioPromoTexto = ref('');

const form = reactive({ articuloId: '', titulo: '', bannerUrl: '', precioOriginal: 0 });

const bannerVista = computed(() => {
  if (bannerFile.value) return URL.createObjectURL(bannerFile.value);
  if (form.bannerUrl) return form.bannerUrl;
  const a = articulos.value.find((x) => x.articuloId === form.articuloId);
  return a?.url || '';
});

const precioPromoNum = computed(() => Number(precioPromoTexto.value.replace(/[^0-9.]/g, '')) || 0);
const descuentoVista = computed(() =>
  descuentoPorcentaje({ precioPromo: precioPromoNum.value, precioOriginal: form.precioOriginal }),
);

function abrirNueva() {
  editandoId.value = '';
  error.value = '';
  bannerFile.value = null;
  precioPromoTexto.value = '';
  Object.assign(form, { articuloId: '', titulo: '', bannerUrl: '', precioOriginal: 0 });
  editorAbierto.value = true;
}

function abrirEdicion(p: Promocion) {
  editandoId.value = p.id;
  error.value = '';
  bannerFile.value = null;
  precioPromoTexto.value = String(p.precioPromo);
  Object.assign(form, {
    articuloId: p.articuloId,
    titulo: p.titulo,
    bannerUrl: p.bannerUrl,
    precioOriginal: p.precioOriginal,
  });
  editorAbierto.value = true;
}

function cerrarEditor() {
  editorAbierto.value = false;
  bannerFile.value = null;
}

function onArticuloElegido() {
  const a = articulos.value.find((x) => x.articuloId === form.articuloId);
  form.precioOriginal = Number(a?.precio) || 0;
}

function onBannerElegido(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) bannerFile.value = file;
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultArticulo;
}

function validar(): boolean {
  error.value = '';
  if (!form.articuloId) error.value = 'Elige el artículo al que le aplica la promoción.';
  else if (form.titulo.trim().length < 3) error.value = 'Ponle un título de al menos 3 caracteres.';
  else if (!(precioPromoNum.value > 0)) error.value = 'El precio de promoción debe ser mayor a $0.';
  else if (precioPromoNum.value >= form.precioOriginal)
    error.value = `El precio de promoción debe ser menor que el normal ($${form.precioOriginal.toFixed(2)}).`;
  return !error.value;
}

async function guardar() {
  if (guardando.value || !validar()) return;
  guardando.value = true;
  try {
    let bannerUrl = form.bannerUrl;
    if (bannerFile.value) bannerUrl = await uploadArticuloImagen(bannerFile.value);
    if (!bannerUrl) {
      bannerUrl = articulos.value.find((a) => a.articuloId === form.articuloId)?.url || '';
    }

    if (editandoId.value) {
      await actualizarPromocion(editandoId.value, {
        titulo: form.titulo.trim(),
        bannerUrl,
        precioPromo: precioPromoNum.value,
        precioOriginal: form.precioOriginal,
      });
    } else {
      await crearPromocion({
        tiendaId: tiendaId.value,
        tiendaNombre: tiendaLocal?.nombreTienda || tiendaLocal?.nombre || '',
        articuloId: form.articuloId,
        titulo: form.titulo.trim(),
        bannerUrl,
        precioPromo: precioPromoNum.value,
        precioOriginal: form.precioOriginal,
      });
    }
    cerrarEditor();
    await Swal.fire({
      icon: 'success',
      title: editandoId.value ? 'Promoción actualizada' : 'Promoción publicada',
      text: 'Ya se ve en Destacados, en la portada de la app.',
      confirmButtonColor: '#0165d8',
    });
  } catch (e) {
    console.error('Error guardando la promoción:', e);
    error.value = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
  } finally {
    guardando.value = false;
  }
}

async function alternarPausa(p: Promocion) {
  await pausarPromocion(p.id, !p.activa);
}

async function renovar(p: Promocion) {
  await renovarPromocion(p.id);
  await Swal.fire({
    icon: 'success',
    title: 'Promoción renovada',
    text: 'Vuelve a estar vigente por un mes más.',
    confirmButtonColor: '#0165d8',
  });
}

async function borrar(p: Promocion) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar la promoción?',
    text: 'El artículo no se borra: solo deja de tener descuento.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#e74c3c',
  });
  if (r.isConfirmed) await eliminarPromocion(p.id);
}

/** Si alguien llega sin ser la tienda, de vuelta al perfil */
if (!esDueno.value && tiendaId.value) router.replace(`/store/profile/${tiendaId.value}`);
</script>

<style scoped>
.promos-container {
  min-height: 100vh;
  background: var(--bg-page);
}
.promos-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
}
.aviso,
.vacio {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  color: var(--text-muted);
  text-align: center;
}
.barra {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.hint {
  flex: 1;
  min-width: 260px;
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.btn-pri,
.btn-sec {
  border: none;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-pri {
  background: var(--color-bg-blue-dark);
  color: #fff;
}
.btn-pri:disabled {
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: not-allowed;
}
.btn-sec {
  background: var(--surface-2);
  color: var(--text);
}

/* Editor */
.editor {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.editor-titulo {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text);
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.fila-dos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
}
.input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.95rem;
}
.input:read-only {
  background: var(--surface-2);
}
.pista {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.pista.descuento {
  color: #2e7d4f;
  font-weight: 700;
}
.banner-fila {
  display: flex;
  gap: 0.85rem;
  align-items: center;
}
.banner-vista {
  width: 160px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-shrink: 0;
}
/* Igual que en Destacados: se ve entera, como la verá el cliente */
.banner-vista img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.banner-acciones {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
}
.error-msg {
  margin: 0;
  color: #c0392b;
  font-size: 0.88rem;
}
.editor-botones {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

/* Lista */
.lista {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.promo {
  display: flex;
  gap: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.promo.caducada,
.promo.pausada {
  opacity: 0.72;
}
.promo-banner {
  width: 140px;
  flex-shrink: 0;
  background: var(--surface-2);
}
.promo-banner img,
.promo-banner .sin-banner {
  width: 100%;
  height: 100%;
  min-height: 118px;
  object-fit: contain;
  display: block;
}
.promo-datos {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 0.85rem 0.75rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.promo-linea {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}
.promo-titulo {
  margin: 0;
  font-size: 1rem;
  color: var(--text);
}
.etq {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.etq.vigente {
  background: #e6f4ec;
  color: #2e7d4f;
}
.etq.pausada {
  background: #fff4e5;
  color: #8a5a00;
}
.etq.caducada {
  background: #fdecea;
  color: #c0392b;
}
.promo-articulo,
.promo-fechas {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.promo-precios {
  margin: 0.15rem 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
/* Mismo par que en Destacados: se paga en verde, el de antes tachado en rojo */
.precio {
  font-size: 1.05rem;
  font-weight: 800;
  color: #2e7d4f;
}
.antes {
  font-size: 0.85rem;
  color: #c0392b;
  text-decoration: line-through;
}
.menos {
  font-size: 0.72rem;
  font-weight: 700;
  color: #2e7d4f;
}
.promo-acciones {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}
.btn-txt {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--brand-blue-text);
  cursor: pointer;
}
.btn-txt.peligro {
  color: #c0392b;
}

@media (max-width: 520px) {
  .promo {
    flex-direction: column;
  }
  .promo-banner {
    width: 100%;
    height: 120px;
  }
  .promo-datos {
    padding: 0 0.85rem 0.85rem;
  }
}
</style>
