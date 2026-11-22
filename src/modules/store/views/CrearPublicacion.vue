<template>
  <div class="pub-container">
    <PageHeader title="Crear publicación" :fallback="`/store/profile/${tiendaId}`" />

    <main class="pub-main">
      <p v-if="!esDueno" class="aviso">Solo la dueña o el dueño de la tienda puede crear publicaciones.</p>

      <template v-else>
        <p class="hint">
          Sube una foto, elige una plantilla y comparte la imagen en WhatsApp, Facebook, Instagram y más. Es gratis:
          la imagen se crea aquí mismo.
        </p>

        <div class="pestanas" role="tablist">
          <button type="button" role="tab" :class="{ activa: pestana === 'crear' }" :aria-selected="pestana === 'crear'" @click="pestana = 'crear'">Crear</button>
          <button type="button" role="tab" :class="{ activa: pestana === 'lista' }" :aria-selected="pestana === 'lista'" data-testid="ver-lista" @click="pestana = 'lista'">
            Mis publicaciones <span v-if="lista.length" class="contador">{{ lista.length }}</span>
          </button>
        </div>

        <!-- ================= Crear ================= -->
        <section v-show="pestana === 'crear'" class="crear">
          <div class="form">
            <label class="campo">
              <span>1. Tu foto *</span>
              <input ref="archivo" type="file" accept="image/jpeg,image/png,image/webp" class="input" @change="alElegirFoto" />
            </label>

            <label v-if="articulosDisponibles.length" class="campo">
              <span>…o usa uno de tus artículos (opcional)</span>
              <select v-model="articuloId" class="input" @change="alElegirArticulo">
                <option value="">— Ninguno —</option>
                <option v-for="a in articulosDisponibles" :key="a.articuloId" :value="a.articuloId">{{ a.nombre }}</option>
              </select>
            </label>

            <label class="campo">
              <span>2. Título *</span>
              <input v-model="form.titulo" class="input" :maxlength="MAX_TITULO" placeholder="Ej. Pastel de chocolate" />
            </label>

            <div class="fila">
              <label class="campo">
                <span>Precio</span>
                <input v-model="form.precio" class="input" inputmode="decimal" placeholder="350" />
              </label>
              <label class="campo">
                <span>Precio anterior (opcional)</span>
                <input v-model="form.precioAntes" class="input" inputmode="decimal" placeholder="450" />
              </label>
            </div>

            <label class="campo">
              <span>Texto corto (opcional)</span>
              <textarea v-model="form.texto" class="input" rows="3" :maxlength="MAX_TEXTO" placeholder="Hecho a mano, entrega el mismo día"></textarea>
              <small>{{ form.texto.length }}/{{ MAX_TEXTO }}</small>
            </label>

            <div class="campo">
              <span>3. Plantilla</span>
              <div class="chips">
                <button v-for="p in PLANTILLAS" :key="p.id" type="button" class="chip" :class="{ activa: form.plantilla === p.id }" :data-testid="`plantilla-${p.id}`" @click="form.plantilla = p.id">
                  <i class="muestra" :style="{ background: `linear-gradient(${p.fondo[0]}, ${p.fondo[1]})` }"></i>{{ p.nombre }}
                </button>
              </div>
            </div>

            <div class="campo">
              <span>4. Formato</span>
              <div class="chips">
                <button v-for="f in FORMATOS" :key="f.id" type="button" class="chip" :class="{ activa: form.formato === f.id }" @click="form.formato = f.id">{{ f.nombre }}</button>
              </div>
            </div>
          </div>

          <div class="vista">
            <p class="vista-titulo">Vista previa</p>
            <canvas ref="lienzo" class="lienzo" :class="{ vertical: form.formato === 'historia' }" aria-label="Vista previa de la publicación"></canvas>

            <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
            <p v-if="aviso" class="ok-msg" role="status">{{ aviso }}</p>

            <div class="acciones">
              <button type="button" class="btn-pri" :disabled="guardando" data-testid="guardar" @click="guardar">
                {{ guardando ? 'Guardando…' : '💾 Guardar en mis publicaciones' }}
              </button>
              <button type="button" class="btn-sec" :disabled="guardando" data-testid="compartir-borrador" @click="compartirBorrador">📤 Compartir…</button>
              <button type="button" class="btn-sec" :disabled="guardando" @click="descargarBorrador">⬇️ Descargar</button>
            </div>

            <label class="campo">
              <span>Texto para acompañar la imagen</span>
              <textarea :value="textoSugerido" class="input" rows="5" readonly></textarea>
              <button type="button" class="btn-txt" @click="copiar(textoSugerido)">Copiar texto</button>
            </label>
          </div>
        </section>

        <!-- ================= Lista ================= -->
        <section v-show="pestana === 'lista'" class="lista">
          <p v-if="cargando" class="hint">Cargando…</p>
          <p v-else-if="!lista.length" class="hint">Aún no has guardado publicaciones. Crea la primera en la pestaña "Crear".</p>

          <ul v-else class="tarjetas">
            <li v-for="p in lista" :key="p.id" class="tarjeta" :data-testid="`pub-${p.id}`">
              <img :src="p.imagenUrl" :alt="p.titulo" class="tarjeta-img" loading="lazy" />
              <div class="tarjeta-datos">
                <h3>{{ p.titulo }}</h3>
                <p v-if="p.precio" class="precio">{{ formatoPesos(p.precio) }}</p>
                <small>{{ fecha(p.creadaEn) }}</small>
                <div class="tarjeta-acciones">
                  <button type="button" class="btn-txt" @click="compartirGuardada(p)">📤 Compartir</button>
                  <a class="btn-txt" :href="enlaceWhatsapp(textoDe(p))" target="_blank" rel="noopener">WhatsApp</a>
                  <a class="btn-txt" :href="enlaceFacebook(urlTienda, textoDe(p))" target="_blank" rel="noopener">Facebook</a>
                  <button type="button" class="btn-txt" @click="copiar(textoDe(p))">Copiar texto</button>
                  <a class="btn-txt" :href="p.imagenUrl" download target="_blank" rel="noopener">Descargar</a>
                  <button type="button" class="btn-txt peligro" @click="borrar(p)">Eliminar</button>
                </div>
              </div>
            </li>
          </ul>
          <p v-if="lista.length" class="hint">
            Para Facebook, Instagram o estados de WhatsApp lo más cómodo es <strong>Compartir</strong> (o Descargar y subir la imagen).
          </p>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * Herramienta de difusión de la tienda: crea la imagen de una publicación (foto + título + precio sobre una
 * plantilla), la guarda en "Mis publicaciones" y la comparte por WhatsApp, Facebook y demás.
 * No cuesta nada: la imagen se dibuja en el navegador y se comparte con el menú de compartir del teléfono.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { useArticulos } from '@/composables/useArticulos';
import { uploadArticuloImagen } from '@/composables/useStorage';
import {
  FORMATOS,
  MAX_TEXTO,
  MAX_TITULO,
  PLANTILLAS,
  armarTexto,
  eliminarPublicacion,
  enlaceFacebook,
  enlaceWhatsapp,
  formatoPesos,
  guardarPublicacion,
  leerMonto,
  marcarCompartida,
  usePublicaciones,
  validarPublicacion,
  type Publicacion,
} from '@/composables/usePublicaciones';
import { canvasABlob, dibujarPublicacion } from '../utils/dibujarPublicacion';

const route = useRoute();
const tiendaId = computed(() => String(route.params.id || ''));
const tiendaLocal = JSON.parse(localStorage.getItem('tiendas') || '{}');
const esDueno = computed(() => !!tiendaId.value && tiendaLocal?.id === tiendaId.value);
const nombreTienda = String(tiendaLocal?.nombreTienda || '');
const urlTienda = computed(() => `${window.location.origin}/store/profile/${tiendaId.value}`);

const pestana = ref<'crear' | 'lista'>('crear');
const lienzo = ref<HTMLCanvasElement | null>(null);
const archivo = ref<HTMLInputElement | null>(null);
const guardando = ref(false);
const error = ref('');
const aviso = ref('');

const form = reactive({ titulo: '', precio: '', precioAntes: '', texto: '', plantilla: 'clasica', formato: 'cuadrado' });
const articuloId = ref('');
let foto: HTMLImageElement | null = null;
let urlFotoLocal = '';

const { articulos, cargarArticulosPorTienda } = useArticulos({ incluirTiendasInactivas: true });
const articulosDisponibles = computed(() => articulos.value.filter((a) => a.baja !== true));

const { lista, cargando, detener } = esDueno.value ? usePublicaciones(tiendaId.value) : { lista: ref<Publicacion[]>([]), cargando: ref(false), detener: () => {} };

onMounted(() => {
  if (!esDueno.value) return;
  cargarArticulosPorTienda(tiendaId.value);
  redibujar();
});
onBeforeUnmount(() => {
  try {
    detener();
  } catch {
    /* ya estaba detenida */
  }
  if (urlFotoLocal) URL.revokeObjectURL(urlFotoLocal);
});

const precioNum = computed(() => leerMonto(form.precio));
const antesNum = computed(() => leerMonto(form.precioAntes));
const textoSugerido = computed(() =>
  armarTexto({ titulo: form.titulo || 'Tu publicación', texto: form.texto, precio: precioNum.value, precioAntes: antesNum.value, tienda: nombreTienda, enlace: urlTienda.value }),
);
const textoDe = (p: Publicacion) =>
  armarTexto({ titulo: p.titulo, texto: p.texto, precio: p.precio, precioAntes: p.precioAntes, tienda: p.tiendaNombre || nombreTienda, enlace: urlTienda.value });

function redibujar() {
  if (!lienzo.value) return;
  dibujarPublicacion(lienzo.value, {
    foto,
    plantilla: form.plantilla,
    formato: form.formato,
    titulo: form.titulo || 'Título de tu publicación',
    texto: form.texto,
    precio: precioNum.value,
    precioAntes: antesNum.value,
    tienda: nombreTienda,
  });
}
watch(form, redibujar, { deep: true });

function cargarImagen(url: string, conPermiso: boolean): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    // Una foto de otro sitio solo se puede exportar si el servidor lo permite; la del teléfono no lo necesita
    if (conPermiso) img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo abrir la foto.'));
    img.src = url;
  });
}

async function alElegirFoto(e: Event) {
  error.value = '';
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 8 * 1024 * 1024) {
    error.value = 'Elige una foto JPG, PNG o WebP de máximo 8 MB.';
    (e.target as HTMLInputElement).value = '';
    return;
  }
  try {
    if (urlFotoLocal) URL.revokeObjectURL(urlFotoLocal);
    urlFotoLocal = URL.createObjectURL(f);
    foto = await cargarImagen(urlFotoLocal, false);
    articuloId.value = '';
    redibujar();
  } catch (err: any) {
    error.value = err?.message || 'No se pudo abrir la foto.';
  }
}

async function alElegirArticulo() {
  error.value = '';
  const a = articulosDisponibles.value.find((x) => x.articuloId === articuloId.value);
  if (!a) return;
  form.titulo = String(a.nombre || '').slice(0, MAX_TITULO);
  form.precio = a.precio ? String(a.precio) : '';
  form.texto = String(a.descripcion || '').slice(0, MAX_TEXTO);
  if (archivo.value) archivo.value.value = '';
  try {
    foto = await cargarImagen(a.url, true);
  } catch {
    foto = null;
    error.value = 'No se pudo usar la foto de ese artículo. Sube una foto desde tu teléfono.';
  }
  redibujar();
}

/** Valida y devuelve la imagen lista, o null (con el motivo en pantalla) */
async function imagenLista(): Promise<Blob | null> {
  error.value = '';
  aviso.value = '';
  const errores = validarPublicacion(form);
  if (!foto) errores.unshift('Sube una foto.');
  if (errores.length) {
    error.value = errores[0];
    return null;
  }
  redibujar();
  try {
    return await canvasABlob(lienzo.value!);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo crear la imagen.';
    return null;
  }
}

const nombreArchivo = (titulo: string) => `${(titulo || 'publicacion').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'publicacion'}.jpg`;

/** Menú de compartir del teléfono (WhatsApp, Facebook, Instagram…) con la imagen adjunta; si no existe, descarga */
async function compartirArchivo(blob: Blob, titulo: string, texto: string): Promise<boolean> {
  const f = new File([blob], nombreArchivo(titulo), { type: blob.type || 'image/jpeg' });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [f] })) {
    try {
      await nav.share({ files: [f], text: texto, title: titulo });
      return true;
    } catch (e: any) {
      if (e?.name === 'AbortError') return false; // la persona cerró el menú
    }
  }
  descargar(blob, titulo);
  aviso.value = 'Tu navegador no puede compartir directo: se descargó la imagen para que la subas donde quieras.';
  return false;
}

function descargar(blob: Blob, titulo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(titulo);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function descargarBorrador() {
  const blob = await imagenLista();
  if (blob) descargar(blob, form.titulo);
}

async function compartirBorrador() {
  const blob = await imagenLista();
  if (blob) await compartirArchivo(blob, form.titulo, textoSugerido.value);
}

async function guardar() {
  const blob = await imagenLista();
  if (!blob) return;
  guardando.value = true;
  try {
    const url = await uploadArticuloImagen(new File([blob], nombreArchivo(form.titulo), { type: 'image/jpeg' }));
    await guardarPublicacion({
      tiendaId: tiendaId.value,
      tiendaNombre: nombreTienda,
      titulo: form.titulo,
      texto: form.texto,
      precio: precioNum.value,
      precioAntes: antesNum.value,
      plantilla: form.plantilla,
      formato: form.formato,
      imagenUrl: url,
      articuloId: articuloId.value,
    });
    aviso.value = '✅ Guardada en "Mis publicaciones". Ya puedes compartirla.';
    pestana.value = 'lista';
  } catch (e: any) {
    error.value = e?.message || 'No se pudo guardar. Intenta de nuevo.';
  } finally {
    guardando.value = false;
  }
}

async function compartirGuardada(p: Publicacion) {
  try {
    const r = await fetch(p.imagenUrl);
    const blob = await r.blob();
    if (await compartirArchivo(blob, p.titulo, textoDe(p))) void marcarCompartida(tiendaId.value, p.id).catch(() => {});
  } catch {
    // Sin poder bajar la imagen (permisos del servidor), se comparte el enlace con el texto
    window.open(enlaceWhatsapp(`${textoDe(p)}\n${p.imagenUrl}`), '_blank', 'noopener');
  }
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso.value = 'Texto copiado.';
  } catch {
    aviso.value = 'No se pudo copiar. Selecciona el texto y cópialo.';
  }
}

async function borrar(p: Publicacion) {
  const r = await Swal.fire({
    title: '¿Eliminar esta publicación?',
    text: p.titulo,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--color-bg-blue-ligth)',
  });
  if (!r.isConfirmed) return;
  try {
    await eliminarPublicacion(tiendaId.value, p.id);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo eliminar.';
  }
}

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(d) : '';
};
</script>

<style scoped>
.pub-container { min-height: 100vh; background: var(--color-bg, #f5f6f8); }
.pub-main { max-width: 1000px; margin: 0 auto; padding: 16px; }
.hint, .aviso { color: #555; font-size: 0.95rem; margin: 8px 0 14px; }
.pestanas { display: flex; gap: 8px; margin-bottom: 16px; }
.pestanas button { flex: 1; padding: 10px; border: 1px solid #ccd; border-radius: 10px; background: #fff; font-weight: 600; cursor: pointer; }
.pestanas button.activa { background: var(--color-bg-blue-ligth); color: var(--on-primary, #fff); border-color: transparent; }
.contador { background: rgba(0, 0, 0, 0.15); border-radius: 999px; padding: 0 8px; margin-left: 4px; font-size: 0.8rem; }
.crear { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 820px) { .crear { grid-template-columns: 1fr 1fr; align-items: start; } }
.form, .vista { background: #fff; border-radius: 14px; padding: 16px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08); }
.campo { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-weight: 600; font-size: 0.92rem; }
.campo small { color: #777; font-weight: 400; }
.input { padding: 10px 12px; border: 1px solid #ccd; border-radius: 10px; font: inherit; font-weight: 400; width: 100%; box-sizing: border-box; }
.fila { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #ccd; border-radius: 999px; background: #fff; cursor: pointer; font-weight: 600; }
.chip.activa { border-color: var(--color-bg-blue-ligth); box-shadow: 0 0 0 2px var(--color-bg-blue-ligth) inset; }
.muestra { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
.vista-titulo { margin: 0 0 8px; font-weight: 700; }
.lienzo { width: 100%; height: auto; border-radius: 12px; background: #e9ecf1; display: block; }
.lienzo.vertical { max-width: 340px; margin: 0 auto; }
.acciones { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
.btn-pri, .btn-sec { padding: 11px 14px; border-radius: 10px; border: 0; font-weight: 700; cursor: pointer; }
.btn-pri { background: var(--color-bg-blue-ligth); color: var(--on-primary, #fff); }
.btn-sec { background: #eef1f6; color: #222; }
.btn-pri:disabled, .btn-sec:disabled { opacity: 0.6; cursor: wait; }
.btn-txt { background: none; border: 0; color: var(--brand-blue-text, #1f5fbf); font-weight: 600; cursor: pointer; padding: 6px 8px; text-decoration: none; font-size: 0.9rem; }
.btn-txt.peligro { color: #c0392b; }
.error-msg { color: #c0392b; font-weight: 600; }
.ok-msg { color: #1b7a43; font-weight: 600; }
.tarjetas { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.tarjeta { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08); }
.tarjeta-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; background: #e9ecf1; display: block; }
.tarjeta-datos { padding: 12px; }
.tarjeta-datos h3 { margin: 0 0 4px; font-size: 1.05rem; }
.precio { margin: 0; font-weight: 700; }
.tarjeta-acciones { display: flex; flex-wrap: wrap; margin-top: 8px; }
</style>
