<template>
  <div class="asistente">
    <ol class="pasos" aria-label="Pasos">
      <li v-for="(p, i) in PASOS" :key="p" :class="{ activo: paso === i, hecho: paso > i }">
        <button type="button" :disabled="i > maxPaso" @click="paso = i"><span class="n">{{ i + 1 }}</span>{{ p }}</button>
      </li>
    </ol>

    <!-- 1. Producto -->
    <section v-show="paso === 0" class="bloque">
      <h2>Sube la foto de tu producto</h2>
      <div
        class="zona"
        :class="{ sobre: arrastrando, con: !!sesion.urlProducto }"
        @dragover.prevent="arrastrando = true"
        @dragleave.prevent="arrastrando = false"
        @drop.prevent="alSoltar"
      >
        <template v-if="sesion.urlProducto">
          <img :src="sesion.urlProducto" alt="Foto del producto" class="previa" />
        </template>
        <template v-else>
          <Upload :size="30" aria-hidden="true" />
          <p>Arrastra tu foto aquí o <button type="button" class="enlace" @click="archivo?.click()">elige un archivo</button></p>
          <small>JPG, PNG o WEBP · máximo 15 MB · se queda en tu equipo</small>
        </template>
        <input ref="archivo" type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="subir-foto" @change="alElegir" />
      </div>
      <p v-if="errorFoto" class="error" role="alert">{{ errorFoto }}</p>
      <div v-if="sesion.urlProducto" class="barra-botones">
        <button type="button" class="btn" @click="archivo?.click()"><RefreshCw :size="16" /> Reemplazar</button>
        <button type="button" class="btn" @click="girar(-90)"><RotateCcw :size="16" /> Girar izquierda</button>
        <button type="button" class="btn" @click="girar(90)"><RotateCw :size="16" /> Girar derecha</button>
        <button type="button" class="btn" @click="restaurarOriginal"><Undo2 :size="16" /> Foto original</button>
      </div>
      <p v-if="sesion.urlProducto" class="nota">La foto original nunca se modifica: los giros se aplican a una copia.</p>
    </section>

    <!-- 2. Datos -->
    <section v-show="paso === 1" class="bloque">
      <h2>Datos del producto</h2>
      <div class="rejilla">
        <label class="campo"><span>Texto superior (opcional)</span><input v-model="sesion.datos.kicker" maxlength="30" placeholder="Hoy jueves" /></label>
        <label class="campo"><span>Nombre de la tienda</span><input v-model="sesion.datos.tienda" maxlength="40" placeholder="CG-Rat" @change="recordarTienda" /></label>
        <label class="campo ancho"><span>Nombre *</span><input v-model="sesion.datos.nombre" maxlength="80" placeholder="Piñata de tractor" /></label>
        <label class="campo"><span>Precio</span><input v-model="precioTexto" inputmode="decimal" placeholder="550" /></label>
        <label class="campo"><span>Precio anterior (opcional)</span><input v-model="antesTexto" inputmode="decimal" placeholder="700" /></label>
        <label class="campo ancho"><span>Descripción</span><textarea v-model="sesion.datos.descripcion" rows="2" maxlength="300" placeholder="Piñata con forma de tractor John Deere"></textarea></label>
        <label class="campo"><span>Categoría</span><input v-model="sesion.datos.categoria" maxlength="40" placeholder="Piñatas" /></label>
        <label class="campo"><span>Medidas</span><input v-model="sesion.datos.medidas" maxlength="50" placeholder="80 cm alto x 1 m ancho" /></label>
        <label class="campo">
          <span>Disponibilidad</span>
          <select v-model="sesion.datos.disponibilidad">
            <option value="">No mostrar</option>
            <option>Disponible</option>
            <option>Bajo pedido</option>
            <option>Pocas piezas</option>
            <option>Agotado</option>
          </select>
        </label>
        <label class="campo"><span>Color</span><input v-model="sesion.datos.color" maxlength="30" placeholder="Verde" /></label>
        <label class="campo ancho"><span>Características (una por línea, máximo 4)</span><textarea v-model="caracteristicasTexto" rows="3" placeholder="Hecha a mano&#10;Papel de china"></textarea></label>
        <label class="campo"><span>Llamada a la acción (opcional)</span><input v-model="sesion.datos.cta" maxlength="40" placeholder="Haz tu pedido" /></label>
        <label class="campo"><span>Teléfono (opcional)</span><input v-model="sesion.datos.telefono" maxlength="24" inputmode="tel" placeholder="341 123 4567" /></label>
        <div class="campo">
          <span>Logo de la tienda (opcional)</span>
          <div class="fila-logo">
            <img v-if="sesion.urlLogo" :src="sesion.urlLogo" alt="Logo" class="logo-mini" />
            <button type="button" class="btn" @click="archivoLogo?.click()">{{ sesion.urlLogo ? 'Cambiar' : 'Subir logo' }}</button>
            <button v-if="sesion.urlLogo" type="button" class="btn" @click="quitarLogo">Quitar</button>
          </div>
          <input ref="archivoLogo" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="alElegirLogo" />
        </div>
      </div>
      <p v-if="errorDatos" class="error" role="alert">{{ errorDatos }}</p>
    </section>

    <!-- 3. Estilo -->
    <section v-show="paso === 2" class="bloque">
      <h2>Elige un estilo y un formato</h2>
      <div class="estilos">
        <button v-for="e in ESTILOS" :key="e.id" type="button" class="estilo" :class="{ activo: sesion.estiloId === e.id }" :data-testid="`estilo-${e.id}`" @click="sesion.estiloId = e.id">
          <span class="muestras"><i v-for="p in e.paletas" :key="p.id" :style="{ background: `linear-gradient(135deg, ${p.fondoA}, ${p.fondoB})`, borderColor: p.acento }"></i></span>
          <strong>{{ e.nombre }}</strong>
          <small>{{ e.descripcion }}</small>
        </button>
      </div>
      <div class="campo">
        <span>Colores</span>
        <div class="chips">
          <button type="button" class="chip" :class="{ activo: sesion.colores === 'estilo' }" data-testid="colores-estilo" @click="sesion.colores = 'estilo'">Los del estilo</button>
          <button type="button" class="chip tema" :class="{ activo: sesion.colores === 'tema' }" data-testid="colores-tema" @click="sesion.colores = 'tema'">
            <span class="muestras"><i :style="{ background: `linear-gradient(135deg, ${tema.fondoA}, ${tema.fondoB})`, borderColor: tema.acento }"></i><i :style="{ background: tema.acento, borderColor: tema.acento }"></i><i :style="{ background: tema.acento2, borderColor: tema.acento2 }"></i></span>
            Tema de Crustore
          </button>
        </div>
        <small class="nota">El tema es el que tiene la app ahora (paleta y temática); los diseños ya guardados no cambian.</small>
      </div>
      <div class="campo">
        <span>Formato</span>
        <div class="chips">
          <button v-for="f in FORMATOS_ESTUDIO" :key="f.id" type="button" class="chip" :class="{ activo: sesion.formatoId === f.id }" @click="sesion.formatoId = f.id">{{ f.nombre }}</button>
        </div>
      </div>
    </section>

    <!-- 4. Propuestas -->
    <section v-show="paso === 3" class="bloque">
      <h2>Propuestas</h2>
      <p v-if="generando" class="nota" role="status">Armando propuestas…</p>
      <p v-if="errorGen" class="error" role="alert">{{ errorGen }}</p>
      <div v-if="sesion.propuestas.length" class="propuestas">
        <figure v-for="(p, i) in sesion.propuestas" :key="p.id" class="propuesta">
          <img :src="p.mini" :alt="`Propuesta ${i + 1}`" />
          <figcaption>
            <strong>Propuesta {{ i + 1 }}</strong>
            <small>{{ nombreLayout(p.layout) }} · {{ nombrePaleta(p) }}</small>
            <button type="button" class="btn primario" :data-testid="`elegir-${i}`" @click="$emit('editar', p)"><Pencil :size="16" /> Editar esta</button>
          </figcaption>
        </figure>
      </div>
    </section>

    <footer class="pie">
      <button v-if="paso > 0" type="button" class="btn" @click="paso--"><ChevronLeft :size="16" /> Atrás</button>
      <span class="espacio"></span>
      <button v-if="paso < 2" type="button" class="btn primario" data-testid="siguiente" @click="siguiente">Siguiente <ChevronRight :size="16" /></button>
      <template v-else>
        <button v-if="paso === 3" type="button" class="btn" :disabled="generando" data-testid="otras" @click="generar(true)"><Shuffle :size="16" /> Generar otras propuestas</button>
        <button v-if="paso === 2" type="button" class="btn primario grande" :disabled="generando" data-testid="generar" @click="generar(false)"><Sparkles :size="16" /> Generar diseño</button>
      </template>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ChevronLeft, ChevronRight, Pencil, RefreshCw, RotateCcw, RotateCw, Shuffle, Sparkles, Undo2, Upload } from 'lucide-vue-next';
import { dimensionesImagen, medirTexto, miniatura, registrarBlob } from '../escena';
import { generarPropuestas } from '../motor/generar';
import { ESTILOS, FORMATOS_ESTUDIO, LAYOUTS, estiloPorId, type Propuesta } from '../motor/tipos';
import { guardarPrefs, imagenesDeSesion, leerPrefs, leerTemaCrustore, sesion } from '../estado';

defineEmits<{ (e: 'editar', p: Propuesta): void }>();

const PASOS = ['Producto', 'Datos', 'Estilo', 'Propuestas'];
const paso = ref(0);
const maxPaso = ref(0);
const tema = ref(leerTemaCrustore());
const archivo = ref<HTMLInputElement | null>(null);
const archivoLogo = ref<HTMLInputElement | null>(null);
const arrastrando = ref(false);
const errorFoto = ref('');
const errorDatos = ref('');
const errorGen = ref('');
const generando = ref(false);

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_LADO = 3200;

onMounted(() => {
  tema.value = leerTemaCrustore(); // por si cambió la paleta o la temática
  if (!sesion.datos.tienda) sesion.datos.tienda = leerPrefs().tienda;
  if (sesion.urlProducto) maxPaso.value = Math.max(maxPaso.value, 1);
});

const recordarTienda = () => guardarPrefs({ tienda: sesion.datos.tienda });

const num = (t: string): number | null => {
  const m = String(t ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null;
};
const precioTexto = computed({ get: () => (sesion.datos.precio ?? '').toString(), set: (v: string) => (sesion.datos.precio = num(v)) });
const antesTexto = computed({ get: () => (sesion.datos.precioAntes ?? '').toString(), set: (v: string) => (sesion.datos.precioAntes = num(v)) });
const caracteristicasTexto = computed({
  get: () => sesion.datos.caracteristicas.join('\n'),
  set: (v: string) => (sesion.datos.caracteristicas = v.split('\n').map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 4)),
});

/* ---------- foto ---------- */

function validar(f: File): string {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return 'La imagen debe ser JPG, PNG o WEBP.';
  if (f.size > MAX_BYTES) return 'La imagen pesa más de 15 MB.';
  return '';
}

async function usarFoto(f: File) {
  errorFoto.value = validar(f);
  if (errorFoto.value) return;
  try {
    const url = registrarBlob(f);
    const dim = await dimensionesImagen(url);
    sesion.original = f; // la original no se toca nunca
    sesion.trabajo = f;
    sesion.urlProducto = url;
    sesion.prod = dim;
    sesion.propuestas = [];
    maxPaso.value = Math.max(maxPaso.value, 1);
  } catch (e: any) {
    errorFoto.value = e?.message || 'No se pudo abrir la imagen.';
  }
}

const alElegir = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void usarFoto(f);
  (e.target as HTMLInputElement).value = '';
};
const alSoltar = (e: DragEvent) => {
  arrastrando.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) void usarFoto(f);
};

/** Gira una COPIA de trabajo; el original queda intacto */
async function girar(grados: 90 | -90) {
  if (!sesion.trabajo) return;
  try {
    const img = await createImageBitmap(sesion.trabajo);
    const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
    const w = Math.round(img.width * k);
    const h = Math.round(img.height * k);
    const c = document.createElement('canvas');
    c.width = h;
    c.height = w;
    const ctx = c.getContext('2d')!;
    ctx.translate(h / 2, w / 2);
    ctx.rotate((grados * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    const blob: Blob = await new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo girar la imagen.'))), 'image/jpeg', 0.95));
    sesion.trabajo = blob;
    sesion.urlProducto = registrarBlob(blob);
    sesion.prod = { w: h, h: w };
    sesion.propuestas = [];
  } catch (e: any) {
    errorFoto.value = e?.message || 'No se pudo girar la imagen.';
  }
}

async function restaurarOriginal() {
  if (sesion.original) await usarFoto(sesion.original as File);
}

async function alElegirLogo(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  const err = validar(f);
  if (err) {
    errorDatos.value = err;
    return;
  }
  sesion.logo = f;
  sesion.urlLogo = registrarBlob(f);
  sesion.datos.conLogo = true;
  errorDatos.value = '';
}
function quitarLogo() {
  sesion.logo = null;
  sesion.urlLogo = '';
  sesion.datos.conLogo = false;
}

/* ---------- pasos ---------- */

function siguiente() {
  errorDatos.value = '';
  if (paso.value === 0 && !sesion.urlProducto) {
    errorFoto.value = 'Sube la foto de tu producto para continuar.';
    return;
  }
  if (paso.value === 1) {
    if (sesion.datos.nombre.trim().length < 2) {
      errorDatos.value = 'Escribe el nombre del producto.';
      return;
    }
    if (sesion.datos.precio && sesion.datos.precioAntes && sesion.datos.precioAntes <= sesion.datos.precio) {
      errorDatos.value = 'El precio anterior debe ser mayor que el precio.';
      return;
    }
  }
  paso.value++;
  maxPaso.value = Math.max(maxPaso.value, paso.value);
}

async function generar(otras: boolean) {
  errorGen.value = '';
  if (!sesion.urlProducto || sesion.datos.nombre.trim().length < 2) {
    errorGen.value = 'Falta la foto o el nombre del producto.';
    paso.value = 0;
    return;
  }
  generando.value = true;
  paso.value = 3;
  maxPaso.value = 3;
  try {
    sesion.tanda = otras ? sesion.tanda + 1 : 0;
    const formato = FORMATOS_ESTUDIO.find((f) => f.id === sesion.formatoId) ?? FORMATOS_ESTUDIO[0];
    const props = generarPropuestas({ datos: { ...sesion.datos }, prod: { ...sesion.prod }, estiloId: sesion.estiloId, formato, medir: medirTexto, tanda: sesion.tanda, paleta: sesion.colores === 'tema' ? leerTemaCrustore() : undefined });
    const imgs = imagenesDeSesion();
    sesion.propuestas = await Promise.all(props.map(async (p) => ({ ...p, mini: await miniatura(p.elems, imgs, formato.w, formato.h) })));
  } catch (e: any) {
    errorGen.value = e?.message || 'No se pudieron generar las propuestas.';
  } finally {
    generando.value = false;
  }
}

const nombreLayout = (id: string) => LAYOUTS.find((l) => l.id === id)?.nombre ?? id;
const nombrePaleta = (p: Propuesta) => p.paletaObj?.nombre ?? estiloPorId(p.estilo).paletas.find((x) => x.id === p.paleta)?.nombre ?? '';
</script>

<style scoped>
.asistente { display: flex; flex-direction: column; gap: 16px; max-width: 980px; margin: 0 auto; padding: 20px 16px 90px; }
.pasos { display: flex; gap: 6px; list-style: none; padding: 0; margin: 0; flex-wrap: wrap; }
.pasos button { display: flex; align-items: center; gap: 8px; background: var(--e-panel); color: var(--e-muted); border: 1px solid var(--e-borde); border-radius: 8px; padding: 7px 12px; cursor: pointer; font: inherit; font-size: 0.85rem; }
.pasos .activo button { color: var(--e-texto); border-color: var(--e-lima); }
.pasos .hecho button { color: var(--e-texto); }
.pasos button:disabled { opacity: 0.45; cursor: default; }
.n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--e-panel2); font-size: 0.75rem; }
.activo .n { background: var(--e-lima); color: var(--e-on); font-weight: 700; }
.bloque { background: var(--e-panel); border: 1px solid var(--e-borde); border-radius: 12px; padding: 18px; }
h2 { margin: 0 0 14px; font-size: 1.05rem; font-weight: 600; }
.zona { border: 1.5px dashed var(--e-borde); border-radius: 12px; min-height: 230px; display: grid; place-items: center; gap: 8px; text-align: center; padding: 18px; color: var(--e-muted); background: var(--e-fondo2); }
.zona.sobre { border-color: var(--e-lima); background: color-mix(in srgb, var(--e-lima) 10%, transparent); }
.zona.con { padding: 10px; }
.previa { max-width: 100%; max-height: 340px; border-radius: 8px; object-fit: contain; }
.enlace { background: none; border: 0; color: var(--e-lima); cursor: pointer; font: inherit; text-decoration: underline; padding: 0; }
.barra-botones { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.btn { display: inline-flex; align-items: center; gap: 6px; background: var(--e-panel2); color: var(--e-texto); border: 1px solid var(--e-borde); border-radius: 8px; padding: 8px 12px; cursor: pointer; font: inherit; font-size: 0.88rem; transition: border-color 0.15s, transform 0.1s; }
.btn:hover:not(:disabled) { border-color: var(--e-lima); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.55; cursor: default; }
.btn.primario { background: var(--e-lima); color: var(--e-on); border-color: var(--e-lima); font-weight: 700; }
.btn.grande { padding: 11px 18px; letter-spacing: 0.04em; text-transform: uppercase; }
.nota { color: var(--e-muted); font-size: 0.85rem; margin: 10px 0 0; }
.error { color: #e5484d; font-size: 0.88rem; margin: 10px 0 0; }
.rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
.campo { display: flex; flex-direction: column; gap: 5px; font-size: 0.82rem; color: var(--e-muted); }
.campo.ancho { grid-column: 1 / -1; }
.campo input, .campo textarea, .campo select { background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 8px; color: var(--e-texto); padding: 9px 10px; font: inherit; font-size: 0.92rem; }
.campo input:focus, .campo textarea:focus, .campo select:focus { outline: none; border-color: var(--e-lima); }
.fila-logo { display: flex; align-items: center; gap: 8px; }
.logo-mini { width: 38px; height: 38px; object-fit: contain; border-radius: 6px; background: #fff; }
.estilos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px; }
.estilo { text-align: left; background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 10px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 5px; color: var(--e-texto); font: inherit; }
.estilo.activo { border-color: var(--e-lima); box-shadow: 0 0 0 1px var(--e-lima) inset; }
.estilo small { color: var(--e-muted); font-size: 0.78rem; }
.muestras { display: flex; gap: 5px; }
.muestras i { width: 26px; height: 18px; border-radius: 5px; border: 2px solid; display: inline-block; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 999px; padding: 6px 12px; color: var(--e-texto); cursor: pointer; font: inherit; font-size: 0.85rem; }
.chip.activo { border-color: var(--e-lima); color: var(--e-texto); box-shadow: 0 0 0 1px var(--e-lima) inset; }
.chip.tema { display: inline-flex; align-items: center; gap: 8px; }
.propuestas { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.propuesta { margin: 0; background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.propuesta img { width: 100%; display: block; background: #000; }
.propuesta figcaption { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.propuesta small { color: var(--e-muted); }
.pie { position: sticky; bottom: 0; display: flex; gap: 8px; align-items: center; padding: 12px 0; background: linear-gradient(transparent, var(--e-fondo) 30%); }
.espacio { flex: 1; }
@media (max-width: 640px) { .rejilla { grid-template-columns: 1fr; } }
</style>
