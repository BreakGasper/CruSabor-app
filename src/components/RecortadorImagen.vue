<template>
  <Teleport to="body">
    <div v-if="archivo" class="rec-overlay" role="dialog" aria-modal="true" aria-label="Recortar y ajustar foto" @keydown.escape="cancelar">
      <div class="rec-caja">
        <header class="rec-cabeza">
          <strong>✂️ Recortar y ajustar tu foto</strong>
          <button type="button" class="rec-x" aria-label="Cerrar" @click="cancelar">✕</button>
        </header>

        <p v-if="error" class="rec-error" role="alert">{{ error }}</p>

        <div ref="marco" class="rec-marco" :style="{ aspectRatio: String(aspecto.valor) }" @pointerdown="alPresionar" @pointermove="alMover" @pointerup="alSoltar" @pointercancel="alSoltar" @wheel.prevent="alRueda">
          <canvas ref="lienzo" class="rec-lienzo" data-testid="rec-lienzo"></canvas>
          <p v-if="cargando" class="rec-cargando">Abriendo foto…</p>
        </div>
        <p class="rec-ayuda">Arrastra la foto para encuadrarla.</p>

        <div class="rec-fila">
          <button v-for="a in ASPECTOS" :key="a.id" type="button" class="rec-chip" :class="{ activo: a.id === aspectoId }" :data-testid="`aspecto-${a.id}`" @click="cambiarAspecto(a.id)">{{ a.nombre }}</button>
        </div>

        <label class="rec-control">
          <span>Acercar</span>
          <input v-model.number="zoom" type="range" :min="ZOOM_MIN" :max="ZOOM_MAX" step="0.05" data-testid="rec-zoom" @input="redibujar" />
          <small>{{ zoom.toFixed(1) }}×</small>
        </label>

        <div class="rec-fila">
          <button type="button" class="rec-btn" data-testid="rec-girar-izq" @click="girar(-90)">↺ Girar</button>
          <button type="button" class="rec-btn" data-testid="rec-girar-der" @click="girar(90)">↻ Girar</button>
          <button type="button" class="rec-btn" @click="restablecer">Restablecer</button>
        </div>

        <label class="rec-control"><span>Brillo</span><input v-model.number="ajustes.brillo" type="range" min="-100" max="100" step="1" data-testid="rec-brillo" @input="redibujar" /><small>{{ ajustes.brillo }}</small></label>
        <label class="rec-control"><span>Contraste</span><input v-model.number="ajustes.contraste" type="range" min="-100" max="100" step="1" data-testid="rec-contraste" @input="redibujar" /><small>{{ ajustes.contraste }}</small></label>
        <label class="rec-control"><span>Color</span><input v-model.number="ajustes.color" type="range" min="-100" max="100" step="1" data-testid="rec-color" @input="redibujar" /><small>{{ ajustes.color }}</small></label>

        <footer class="rec-pie">
          <button type="button" class="rec-btn" @click="cancelar">Cancelar</button>
          <button type="button" class="rec-btn" data-testid="rec-original" :disabled="procesando" @click="$emit('sinCambios')">Usar sin recortar</button>
          <button type="button" class="rec-btn primario" data-testid="rec-aplicar" :disabled="cargando || procesando || !!error" @click="aplicar">{{ procesando ? 'Procesando…' : 'Aplicar' }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Recorte y ajuste de una foto antes de subirla: encuadre (arrastrar y acercar), proporción, giro de 90° y
 * brillo / contraste / color. Todo en el teléfono: la foto no sale a ningún servidor hasta que la tienda guarda.
 */
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  ASPECTOS, SIN_AJUSTES, ZOOM_MAX, ZOOM_MIN, ajustarPixeles, calcularRecorte, dimsGiradas, hayAjustes, moverCentro, sumarGiro, tamanoSalida, type Giro,
} from '@/utils/recorte';

const props = defineProps<{ archivo: File | null; aspectoInicial?: string }>();
const emit = defineEmits<{ (e: 'listo', archivo: File): void; (e: 'cancelar'): void; (e: 'sinCambios'): void }>();

const marco = ref<HTMLElement | null>(null);
const lienzo = ref<HTMLCanvasElement | null>(null);
const cargando = ref(false);
const procesando = ref(false);
const error = ref('');

const aspectoId = ref(props.aspectoInicial || '1:1');
const aspecto = reactive({ valor: 1 });
const zoom = ref(1);
const giro = ref<Giro>(0);
const ajustes = reactive({ ...SIN_AJUSTES });
let centro: { cx?: number; cy?: number } = {};

let fuente: ImageBitmap | null = null;
let girada: HTMLCanvasElement | null = null;

const BASE_W = 520; // píxeles del dibujo de vista previa (se muestra más chico con CSS)

function fijarAspecto() {
  aspecto.valor = ASPECTOS.find((a) => a.id === aspectoId.value)?.valor ?? 1;
}
fijarAspecto();

async function abrir(f: File) {
  // Cada foto puede pedir su proporción (logo cuadrado, banner 3:1…); sin pedirla se conserva la última elegida
  if (props.aspectoInicial && props.aspectoInicial !== aspectoId.value) {
    aspectoId.value = props.aspectoInicial;
    fijarAspecto();
  }
  cargando.value = true;
  error.value = '';
  fuente?.close?.();
  fuente = null;
  try {
    fuente = await createImageBitmap(f); // respeta la orientación de la cámara
    giro.value = 0;
    zoom.value = 1;
    centro = {};
    Object.assign(ajustes, SIN_AJUSTES);
    prepararGirada();
    await nextTick();
    redibujar();
  } catch {
    error.value = 'No se pudo abrir esta foto. Prueba con otra (JPG, PNG o WebP).';
  } finally {
    cargando.value = false;
  }
}

watch(() => props.archivo, (f) => { if (f) void abrir(f); }, { immediate: true });
onBeforeUnmount(() => fuente?.close?.());

/** La imagen ya girada, en un lienzo aparte, para recortarla sin volver a rotar cada vez */
function prepararGirada() {
  if (!fuente) return;
  const d = dimsGiradas(fuente.width, fuente.height, giro.value);
  const c = document.createElement('canvas');
  c.width = d.w;
  c.height = d.h;
  const ctx = c.getContext('2d')!;
  ctx.translate(d.w / 2, d.h / 2);
  ctx.rotate((giro.value * Math.PI) / 180);
  ctx.drawImage(fuente, -fuente.width / 2, -fuente.height / 2);
  girada = c;
}

const recorteActual = () => (girada ? calcularRecorte(girada.width, girada.height, aspecto.valor, zoom.value, centro.cx, centro.cy) : null);

function redibujar() {
  const cv = lienzo.value;
  const r = recorteActual();
  if (!cv || !girada || !r) return;
  const W = BASE_W;
  const H = Math.round(BASE_W / aspecto.valor);
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(girada, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
  if (hayAjustes(ajustes)) {
    const datos = ctx.getImageData(0, 0, W, H);
    ajustarPixeles(datos.data, ajustes);
    ctx.putImageData(datos, 0, 0);
  }
}

function cambiarAspecto(id: string) {
  aspectoId.value = id;
  fijarAspecto();
  centro = {};
  void nextTick(redibujar);
}

function girar(g: 90 | -90) {
  giro.value = sumarGiro(giro.value, g);
  centro = {};
  prepararGirada();
  redibujar();
}

function restablecer() {
  zoom.value = 1;
  centro = {};
  giro.value = 0;
  Object.assign(ajustes, SIN_AJUSTES);
  prepararGirada();
  redibujar();
}

/* ---- arrastrar para encuadrar ---- */
let arrastre: { x: number; y: number } | null = null;
function alPresionar(e: PointerEvent) {
  arrastre = { x: e.clientX, y: e.clientY };
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}
function alMover(e: PointerEvent) {
  const r = recorteActual();
  if (!arrastre || !r || !marco.value) return;
  const c = moverCentro(r, e.clientX - arrastre.x, e.clientY - arrastre.y, marco.value.clientWidth);
  centro = c;
  arrastre = { x: e.clientX, y: e.clientY };
  redibujar();
}
function alSoltar() {
  arrastre = null;
}
function alRueda(e: WheelEvent) {
  zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.value + (e.deltaY < 0 ? 0.15 : -0.15)));
  redibujar();
}

function cancelar() {
  if (!procesando.value) emit('cancelar');
}

/** Dibuja el recorte a tamaño final (máx. 1600 px) y entrega la foto como JPG */
async function aplicar() {
  const r = recorteActual();
  if (!girada || !r || !props.archivo) return;
  procesando.value = true;
  error.value = '';
  try {
    const s = tamanoSalida(r.sw, r.sh);
    const c = document.createElement('canvas');
    c.width = s.w;
    c.height = s.h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.drawImage(girada, r.sx, r.sy, r.sw, r.sh, 0, 0, s.w, s.h);
    if (hayAjustes(ajustes)) {
      const datos = ctx.getImageData(0, 0, s.w, s.h);
      ajustarPixeles(datos.data, ajustes);
      ctx.putImageData(datos, 0, 0);
    }
    const blob: Blob = await new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('sin imagen'))), 'image/jpeg', 0.9));
    const nombre = (props.archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    emit('listo', new File([blob], nombre, { type: 'image/jpeg' }));
  } catch {
    error.value = 'No se pudo procesar la foto. Intenta de nuevo.';
  } finally {
    procesando.value = false;
  }
}
</script>

<style scoped>
.rec-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(0, 0, 0, 0.72); display: grid; place-items: center; padding: 12px; overflow-y: auto; }
.rec-caja { width: min(440px, 100%); max-height: 100%; overflow-y: auto; background: var(--surface); color: var(--text); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45); }
.rec-cabeza { display: flex; align-items: center; justify-content: space-between; }
.rec-x { border: 0; background: transparent; color: var(--text); font-size: 1.1rem; cursor: pointer; width: 32px; height: 32px; }
.rec-marco { position: relative; width: 100%; max-width: 360px; align-self: center; background: #ddd; border-radius: 10px; overflow: hidden; touch-action: none; cursor: grab; user-select: none; }
.rec-marco:active { cursor: grabbing; }
.rec-lienzo { width: 100%; height: 100%; display: block; }
.rec-cargando { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; background: rgba(255, 255, 255, 0.8); color: #333; font-size: 0.9rem; }
.rec-ayuda { margin: 0; text-align: center; font-size: 0.8rem; color: var(--text-muted); }
.rec-error { margin: 0; color: #d93025; font-size: 0.85rem; text-align: center; }
.rec-fila { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.rec-chip, .rec-btn { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 0.82rem; cursor: pointer; }
.rec-chip.activo { border-color: var(--color-bg-blue-ligth); box-shadow: 0 0 0 1px var(--color-bg-blue-ligth) inset; font-weight: 700; }
.rec-btn { border-radius: 10px; }
.rec-btn.primario { background: var(--color-bg-blue-ligth); color: var(--on-primary); border-color: transparent; font-weight: 700; }
.rec-btn:disabled { opacity: 0.55; cursor: default; }
.rec-control { display: grid; grid-template-columns: 74px 1fr 38px; align-items: center; gap: 8px; font-size: 0.82rem; }
.rec-control input { width: 100%; accent-color: var(--color-bg-blue-ligth); }
.rec-control small { text-align: right; color: var(--text-muted); }
.rec-pie { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; position: sticky; bottom: 0; background: var(--surface); padding-top: 6px; }
</style>
