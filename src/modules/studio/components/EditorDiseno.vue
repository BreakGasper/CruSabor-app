<template>
  <div class="editor" @keydown="alTeclear" tabindex="-1" ref="raiz">
    <header class="cabeza">
      <button type="button" class="ico" title="Volver" aria-label="Volver" @click="salir"><ArrowLeft :size="18" /></button>
      <input v-model="nombre" class="nombre" maxlength="60" aria-label="Nombre del proyecto" @change="programarGuardado" />
      <span class="estado" :class="{ ocupado: guardando }" role="status" data-testid="estado-guardado">
        <Check v-if="!guardando && guardado" :size="14" /> {{ guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Sin guardar' }}
      </span>
      <span class="espacio"></span>
      <button type="button" class="ico" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" :disabled="!puedeDeshacer" data-testid="deshacer" @click="escena?.deshacer()"><Undo2 :size="18" /></button>
      <button type="button" class="ico" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" :disabled="!puedeRehacer" data-testid="rehacer" @click="escena?.rehacer()"><Redo2 :size="18" /></button>
      <span class="sep"></span>
      <button type="button" class="ico" title="Alejar" aria-label="Alejar" @click="zoom(-0.1)"><ZoomOut :size="18" /></button>
      <button type="button" class="zoom" title="Ajustar a la pantalla" @click="ajustar">{{ Math.round(nivel * 100) }}%</button>
      <button type="button" class="ico" title="Acercar" aria-label="Acercar" @click="zoom(0.1)"><ZoomIn :size="18" /></button>
      <span class="sep"></span>
      <button type="button" class="btn" data-testid="vista-previa" @click="verPrevia"><Eye :size="16" /> Vista previa</button>
      <div class="menu-exp">
        <button type="button" class="btn primario" data-testid="exportar" @click="menuExp = !menuExp"><Download :size="16" /> Exportar</button>
        <div v-if="menuExp" class="desplegable" role="menu">
          <button v-for="o in OPCIONES_EXPORTAR" :key="o.id" type="button" role="menuitem" @click="exportar(o)">{{ o.texto }}</button>
        </div>
      </div>
    </header>

    <div class="cuerpo">
      <!-- Recursos -->
      <aside class="izq" aria-label="Recursos">
        <nav class="tabs">
          <button v-for="t in TABS_IZQ" :key="t.id" type="button" :class="{ activo: tabIzq === t.id }" @click="tabIzq = t.id">{{ t.texto }}</button>
        </nav>
        <div v-if="tabIzq === 'elementos'" class="panel">
          <h4>Agregar</h4>
          <div class="botones">
            <button type="button" class="btn" @click="escena?.agregarTexto({ texto: paleta.titulo, fuente: FUENTES.moderna })"><Type :size="16" /> Texto</button>
            <button type="button" class="btn" @click="escena?.agregarForma('rect', paleta.acento)"><Square :size="16" /> Rectángulo</button>
            <button type="button" class="btn" @click="escena?.agregarForma('circulo', paleta.acento2)"><Circle :size="16" /> Círculo</button>
            <button type="button" class="btn" @click="escena?.agregarForma('linea', paleta.acento)"><Minus :size="16" /> Línea</button>
            <button type="button" class="btn" @click="subirImagen?.click()"><ImageIcon :size="16" /> Imagen</button>
            <input ref="subirImagen" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="alAgregarImagen" />
          </div>
          <h4>Recursos gráficos</h4>
          <div v-for="c in DECOR_CATEGORIAS" :key="c.nombre" class="cat">
            <p>{{ c.nombre }}</p>
            <div class="botones">
              <button v-for="id in c.ids" :key="id" type="button" class="btn chico" :data-testid="`decor-${id}`" @click="escena?.agregarDecor(id, paleta)">{{ DECOR_NOMBRES[id] }}</button>
            </div>
          </div>
        </div>
        <div v-else class="panel">
          <h4>Fondo</h4>
          <div class="fondos">
            <button v-for="f in FONDOS" :key="f.nombre" type="button" class="fondo" :style="{ background: f.colores.length > 1 ? `linear-gradient(${f.colores.join(',')})` : f.colores[0] }" :title="f.nombre" :aria-label="`Fondo ${f.nombre}`" @click="escena?.poner_fondo(f.colores)"></button>
          </div>
          <label class="campo"><span>Color sólido</span><input type="color" value="#ffffff" @input="(e) => escena?.poner_fondo([(e.target as HTMLInputElement).value])" /></label>
        </div>
      </aside>

      <!-- Lienzo -->
      <main ref="area" class="area" @wheel="alRueda">
        <div class="hoja"><canvas ref="lienzo" data-testid="lienzo"></canvas></div>
        <p v-if="error" class="error flotante" role="alert">{{ error }}</p>
      </main>

      <!-- Propiedades y capas -->
      <aside class="der" aria-label="Propiedades y capas">
        <nav class="tabs">
          <button type="button" :class="{ activo: tabDer === 'props' }" @click="tabDer = 'props'">Propiedades</button>
          <button type="button" :class="{ activo: tabDer === 'capas' }" data-testid="tab-capas" @click="tabDer = 'capas'">Capas ({{ capas.length }})</button>
        </nav>

        <div v-if="tabDer === 'props'" class="panel">
          <p v-if="!sel" class="vacio">Selecciona un elemento del lienzo para editarlo.</p>
          <template v-else>
            <p class="titulo-sel">{{ sel.nombre }}</p>
            <div class="acciones-sel">
              <button type="button" class="ico" title="Duplicar (Ctrl+D)" aria-label="Duplicar" data-testid="duplicar" @click="escena?.duplicar()"><Copy :size="16" /></button>
              <button type="button" class="ico" title="Eliminar (Supr)" aria-label="Eliminar" data-testid="eliminar" @click="escena?.eliminar()"><Trash2 :size="16" /></button>
              <button v-if="sel.id" type="button" class="ico" :title="sel.bloqueado ? 'Desbloquear' : 'Bloquear'" :aria-label="sel.bloqueado ? 'Desbloquear' : 'Bloquear'" @click="escena?.alternarBloqueo(sel.id)"><Lock v-if="sel.bloqueado" :size="16" /><Unlock v-else :size="16" /></button>
            </div>

            <h4>Alinear</h4>
            <div class="botones">
              <button v-for="a in ALINEACIONES" :key="a.id" type="button" class="ico" :title="a.texto" :aria-label="a.texto" @click="escena?.alinear(a.id)"><component :is="a.icono" :size="16" /></button>
              <button type="button" class="ico" title="Distribuir horizontal" aria-label="Distribuir horizontal" :disabled="sel.cantidad < 3" @click="escena?.distribuir('h')"><AlignHorizontalSpaceAround :size="16" /></button>
              <button type="button" class="ico" title="Distribuir vertical" aria-label="Distribuir vertical" :disabled="sel.cantidad < 3" @click="escena?.distribuir('v')"><AlignVerticalSpaceAround :size="16" /></button>
            </div>

            <h4>Posición y tamaño</h4>
            <div class="grid2">
              <label class="campo"><span>X</span><input type="number" :value="sel.x" @change="cambiar({ x: num($event) })" /></label>
              <label class="campo"><span>Y</span><input type="number" :value="sel.y" @change="cambiar({ y: num($event) })" /></label>
              <label class="campo"><span>Ancho</span><input type="number" min="1" :value="sel.w" @change="cambiar({ w: num($event) })" /></label>
              <label class="campo"><span>Alto</span><input type="number" min="1" :value="sel.h" :disabled="sel.tipo === 'textbox'" @change="cambiar({ h: num($event) })" /></label>
              <label class="campo"><span>Rotación</span><input type="number" :value="sel.rot" @change="cambiar({ rot: num($event) })" /></label>
              <label class="campo"><span>Opacidad %</span><input type="number" min="0" max="100" :value="sel.opacidad" @change="cambiar({ opacidad: num($event) })" /></label>
            </div>

            <template v-if="sel.tipo === 'textbox'">
              <h4>Texto</h4>
              <textarea class="area-texto" rows="3" :value="sel.texto" data-testid="texto-sel" @change="cambiar({ texto: ($event.target as HTMLTextAreaElement).value })"></textarea>
              <label class="campo"><span>Tipografía</span>
                <select :value="sel.fuente" @change="cambiar({ fuente: ($event.target as HTMLSelectElement).value })">
                  <option v-for="(f, k) in FUENTES" :key="k" :value="f">{{ NOMBRES_FUENTE[k] }}</option>
                  <option v-if="!fuenteConocida" :value="sel.fuente">Actual</option>
                </select>
              </label>
              <div class="grid2">
                <label class="campo"><span>Tamaño</span><input type="number" min="8" :value="sel.tam" @change="cambiar({ tam: num($event) })" /></label>
                <label class="campo"><span>Grosor</span>
                  <select :value="sel.peso" @change="cambiar({ peso: Number(($event.target as HTMLSelectElement).value) })">
                    <option :value="400">Normal</option><option :value="600">Seminegrita</option><option :value="800">Negrita</option><option :value="900">Extra</option>
                  </select>
                </label>
                <label class="campo"><span>Interlineado</span><input type="number" step="0.05" min="0.6" :value="sel.interlineado" @change="cambiar({ interlineado: num($event) })" /></label>
                <label class="campo"><span>Espaciado</span><input type="number" step="0.01" :value="sel.espaciado" @change="cambiar({ espaciado: num($event) })" /></label>
              </div>
              <div class="botones">
                <button v-for="a in ['left', 'center', 'right']" :key="a" type="button" class="ico" :class="{ activo: sel.alinear === a }" :aria-label="`Texto ${a}`" @click="cambiar({ alinear: a })"><component :is="a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight" :size="16" /></button>
              </div>
            </template>

            <template v-if="sel.tipo !== 'image'">
              <h4>Color y contorno</h4>
              <div class="grid2">
                <label class="campo"><span>Color</span><input type="color" :value="colorHex(sel.fill)" data-testid="color-sel" @input="cambiar({ fill: ($event.target as HTMLInputElement).value })" /></label>
                <label class="campo"><span>Contorno</span><input type="color" :value="colorHex(sel.stroke || '#000000')" @input="cambiar({ stroke: ($event.target as HTMLInputElement).value, strokeW: sel.strokeW || 2 })" /></label>
                <label class="campo"><span>Grosor contorno</span><input type="number" min="0" :value="sel.strokeW" @change="cambiar({ strokeW: num($event) })" /></label>
                <label class="campo casilla"><input type="checkbox" :checked="sel.sombra" @change="cambiar({ sombra: ($event.target as HTMLInputElement).checked })" /><span>Sombra</span></label>
              </div>
            </template>
            <label v-else class="campo casilla"><input type="checkbox" :checked="sel.sombra" @change="cambiar({ sombra: ($event.target as HTMLInputElement).checked })" /><span>Sombra</span></label>

            <template v-if="sel.id">
              <h4>Orden de capa</h4>
              <div class="botones">
                <button type="button" class="btn chico" @click="escena?.mover(sel.id, 'frente')">Al frente</button>
                <button type="button" class="btn chico" @click="escena?.mover(sel.id, 'arriba')">Subir</button>
                <button type="button" class="btn chico" @click="escena?.mover(sel.id, 'abajo')">Bajar</button>
                <button type="button" class="btn chico" @click="escena?.mover(sel.id, 'fondo')">Al fondo</button>
              </div>
            </template>
          </template>
        </div>

        <div v-else class="panel capas" data-testid="lista-capas">
          <p v-if="!capas.length" class="vacio">Aún no hay elementos.</p>
          <ul>
            <li v-for="c in capas" :key="c.id" :class="{ sel: c.seleccionada, oculta: !c.visible }" :data-testid="`capa-${c.id}`">
              <button type="button" class="nombre-capa" @click="escena?.seleccionar(c.id)">{{ c.nombre }}</button>
              <button type="button" class="ico chico" :aria-label="c.visible ? 'Ocultar' : 'Mostrar'" :title="c.visible ? 'Ocultar' : 'Mostrar'" @click="escena?.alternarVisible(c.id)"><Eye v-if="c.visible" :size="14" /><EyeOff v-else :size="14" /></button>
              <button type="button" class="ico chico" :aria-label="c.bloqueado ? 'Desbloquear' : 'Bloquear'" :title="c.bloqueado ? 'Desbloquear' : 'Bloquear'" @click="escena?.alternarBloqueo(c.id)"><Lock v-if="c.bloqueado" :size="14" /><Unlock v-else :size="14" /></button>
              <button type="button" class="ico chico" aria-label="Subir capa" title="Subir" @click="escena?.mover(c.id, 'arriba')"><ChevronUp :size="14" /></button>
              <button type="button" class="ico chico" aria-label="Bajar capa" title="Bajar" @click="escena?.mover(c.id, 'abajo')"><ChevronDown :size="14" /></button>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <div v-if="previa" class="modal" role="dialog" aria-label="Vista previa" @click.self="cerrarPrevia">
      <div class="modal-caja">
        <img :src="previa" alt="Vista previa" />
        <button type="button" class="btn" @click="cerrarPrevia">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import {
  AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalSpaceAround, AlignLeft, AlignRight,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceAround, ArrowLeft, Check, ChevronDown, ChevronUp, Circle, Copy, Download, Eye, EyeOff,
  Image as ImageIcon, Lock, Minus, Redo2, Square, Trash2, Type, Undo2, Unlock, ZoomIn, ZoomOut,
} from 'lucide-vue-next';
import { Escena, blobDeUrl, desempaquetarJSON, empaquetarJSON, registrarBlob, type Imagenes, type InfoCapa, type Seleccion } from '../escena';
import { DECOR_CATEGORIAS, DECOR_NOMBRES } from '../motor/decor';
import { ESTILOS, FUENTES, estiloPorId, type DatosProducto, type Elem, type Paleta } from '../motor/tipos';
import { guardarDiseno, imagenesDe, nuevoDisenoId, obtenerDiseno, type Diseno } from '../almacen';

export interface ArranqueEditor {
  /** Diseño nuevo desde una propuesta */
  elems?: Elem[];
  imgs?: Imagenes;
  formato?: { id: string; w: number; h: number };
  estilo?: string;
  paleta?: string;
  paletaObj?: Paleta;
  layout?: string;
  datos?: DatosProducto;
  original?: Blob | null;
  nombre?: string;
  /** Diseño guardado que se reabre */
  abrirId?: string;
}

const props = defineProps<{ arranque: ArranqueEditor }>();
const emit = defineEmits<{ (e: 'salir'): void }>();

const raiz = ref<HTMLElement | null>(null);
const lienzo = ref<HTMLCanvasElement | null>(null);
const area = ref<HTMLElement | null>(null);
const subirImagen = ref<HTMLInputElement | null>(null);
const escena = shallowRef<Escena | null>(null);

const nombre = ref('Sin título');
const disenoId = ref('');
const guardando = ref(false);
const guardado = ref(false);
const error = ref('');
const menuExp = ref(false);
const previa = ref('');
const nivel = ref(1);
const tabIzq = ref<'elementos' | 'fondo'>('elementos');
const tabDer = ref<'props' | 'capas'>('props');
const capas = ref<InfoCapa[]>([]);
const sel = ref<Seleccion | null>(null);
const puedeDeshacer = ref(false);
const puedeRehacer = ref(false);
const estiloId = ref('personalizado');
const paletaId = ref('');
const formato = ref({ id: 'flyer', w: 1080, h: 1620 });
const datos = ref<DatosProducto | null>(null);
const paletaPropia = ref<Paleta | null>(null);
let original: Blob | null = null;
let layout = '';
let creado = Date.now();
let temporizador: ReturnType<typeof setTimeout> | null = null;

const TABS_IZQ = [{ id: 'elementos', texto: 'Elementos' }, { id: 'fondo', texto: 'Fondo' }] as const;
const NOMBRES_FUENTE: Record<string, string> = { impacto: 'Impacto', moderna: 'Moderna', elegante: 'Elegante (serif)', redonda: 'Redonda', limpia: 'Limpia', mono: 'Monoespaciada' };
const ALINEACIONES = [
  { id: 'izq', texto: 'Alinear a la izquierda', icono: AlignHorizontalJustifyStart },
  { id: 'centroH', texto: 'Centrar horizontalmente', icono: AlignHorizontalJustifyCenter },
  { id: 'der', texto: 'Alinear a la derecha', icono: AlignHorizontalJustifyEnd },
  { id: 'arriba', texto: 'Alinear arriba', icono: AlignVerticalJustifyStart },
  { id: 'centroV', texto: 'Centrar verticalmente', icono: AlignVerticalJustifyCenter },
  { id: 'abajo', texto: 'Alinear abajo', icono: AlignVerticalJustifyEnd },
] as const;
const FONDOS = [
  { nombre: 'Blanco', colores: ['#ffffff'] }, { nombre: 'Carbón', colores: ['#2a2c31', '#14151a'] }, { nombre: 'Cielo', colores: ['#4aa8ff', '#bfe6ff'] },
  { nombre: 'Atardecer', colores: ['#ff8a00', '#c2185b'] }, { nombre: 'Chicle', colores: ['#ff4f9a', '#7b2ff7'] }, { nombre: 'Pradera', colores: ['#8bd450', '#2e8b2e'] },
  { nombre: 'Oro negro', colores: ['#1b1b1f', '#000000'] }, { nombre: 'Rojo', colores: ['#e01e1e', '#8e0f0f'] }, { nombre: 'Crema', colores: ['#fff1d6', '#ffd9a0'] },
];
const OPCIONES_EXPORTAR = [
  { id: 'png1', texto: 'PNG · tamaño normal', formato: 'png', escala: 1 },
  { id: 'png2', texto: 'PNG · alta resolución (2×)', formato: 'png', escala: 2 },
  { id: 'jpg1', texto: 'JPG · tamaño normal', formato: 'jpeg', escala: 1 },
  { id: 'jpg2', texto: 'JPG · alta resolución (2×)', formato: 'jpeg', escala: 2 },
] as const;

const paleta = computed<Paleta>(() => {
  if (paletaPropia.value) return paletaPropia.value;
  const e = estiloPorId(estiloId.value);
  return e.paletas.find((p) => p.id === paletaId.value) ?? e.paletas[0] ?? ESTILOS[0].paletas[0];
});
const fuenteConocida = computed(() => !sel.value || Object.values(FUENTES).includes(sel.value.fuente as any));

/* ---------- ciclo de vida ---------- */

onMounted(async () => {
  const a = props.arranque;
  try {
    if (a.abrirId) await abrir(a.abrirId);
    else await nuevo(a);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo abrir el diseño.';
  }
  await nextTick();
  ajustar();
  raiz.value?.focus();
});

onBeforeUnmount(() => {
  if (temporizador) clearTimeout(temporizador);
  void guardarYa();
  escena.value?.destruir();
});

function conectar(ed: Escena) {
  ed.alCambiar = () => {
    capas.value = ed.capas();
    guardado.value = false;
    programarGuardado();
  };
  ed.alSeleccionar = () => {
    sel.value = ed.seleccionActual();
    capas.value = ed.capas();
  };
  ed.alHistorial = () => {
    puedeDeshacer.value = ed.puedeDeshacer;
    puedeRehacer.value = ed.puedeRehacer;
  };
}

async function nuevo(a: ArranqueEditor) {
  const f = a.formato ?? formato.value;
  formato.value = f;
  estiloId.value = a.estilo ?? 'personalizado';
  paletaId.value = a.paleta ?? '';
  paletaPropia.value = a.paletaObj ?? null;
  layout = a.layout ?? '';
  datos.value = a.datos ?? null;
  original = a.original ?? null;
  nombre.value = a.nombre || a.datos?.nombre || 'Sin título';
  disenoId.value = nuevoDisenoId();
  const ed = new Escena(lienzo.value!, f.w, f.h);
  conectar(ed);
  escena.value = ed;
  await ed.cargarElementos(a.elems ?? [], a.imgs ?? { producto: '' }, f.w, f.h);
  capas.value = ed.capas();
  await guardarYa(); // el diseño existe desde el primer momento
}

async function abrir(id: string) {
  const d = await obtenerDiseno(id);
  if (!d) throw new Error('Ese diseño ya no existe.');
  const { usadas, original: orig } = await imagenesDe(id);
  disenoId.value = d.id;
  creado = d.creado;
  nombre.value = d.nombre;
  estiloId.value = d.estilo;
  paletaId.value = d.paleta ?? '';
  paletaPropia.value = d.paletaObj ?? null;
  layout = d.layout ?? '';
  datos.value = d.datos;
  original = orig ?? null;
  formato.value = d.formato;
  const ed = new Escena(lienzo.value!, d.formato.w, d.formato.h);
  conectar(ed);
  escena.value = ed;
  await ed.cargarJSON(desempaquetarJSON(d.json, usadas, registrarBlob), d.formato.w, d.formato.h);
  capas.value = ed.capas();
  guardado.value = true;
}

/* ---------- guardado automático ---------- */

function programarGuardado() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void guardarYa(), 900);
}

async function guardarYa() {
  const ed = escena.value;
  if (!ed || !disenoId.value) return;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  guardando.value = true;
  try {
    const { json, imagenes } = empaquetarJSON(ed.serializar(), blobDeUrl);
    const mini = ed.canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: Math.min(1, 360 / ed.w) });
    const d: Diseno = {
      id: disenoId.value, nombre: nombre.value.trim() || 'Sin título', estilo: estiloId.value, formato: { ...formato.value }, json, miniatura: mini, favorito: 0,
      creado, actualizado: Date.now(), // IndexedDB no puede clonar los proxies de Vue: se guardan copias simples
      datos: JSON.parse(JSON.stringify(datos.value ?? {})) as DatosProducto, layout, paleta: paletaId.value, paletaObj: paletaPropia.value ? { ...paletaPropia.value } : undefined,
    };
    // Conserva el favorito si ya existía
    const previo = await obtenerDiseno(d.id);
    if (previo) d.favorito = previo.favorito;
    await guardarDiseno(d, imagenes, original ?? undefined);
    guardado.value = true;
  } catch (e: any) {
    error.value = `No se pudo guardar en este navegador: ${e?.message || e}`;
  } finally {
    guardando.value = false;
  }
}

async function salir() {
  await guardarYa();
  emit('salir');
}

/* ---------- vista, zoom y teclado ---------- */

function zoom(delta: number) {
  const ed = escena.value;
  if (!ed) return;
  ed.poner(ed.zoom + delta);
  nivel.value = ed.zoom;
}
function ajustar() {
  const ed = escena.value;
  const a = area.value;
  if (!ed || !a) return;
  ed.ajustarA(a.clientWidth - 48, a.clientHeight - 48);
  nivel.value = ed.zoom;
}
function alRueda(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoom(e.deltaY < 0 ? 0.1 : -0.1);
}

function alTeclear(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  const escribiendo = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t as any).isContentEditable;
  const ed = escena.value;
  if (!ed || escribiendo) return;
  // Mientras se edita el texto directamente sobre el lienzo, las teclas son de ese texto
  const activo: any = ed.canvas.getActiveObject();
  if (activo?.isEditing) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    ed.eliminar();
  } else if (ctrl && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    void (e.shiftKey ? ed.rehacer() : ed.deshacer());
  } else if (ctrl && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    void ed.rehacer();
  } else if (ctrl && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    void ed.duplicar();
  } else if (e.key.startsWith('Arrow') && sel.value) {
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1;
    ed.aplicar({
      x: sel.value.x + (e.key === 'ArrowRight' ? paso : e.key === 'ArrowLeft' ? -paso : 0),
      y: sel.value.y + (e.key === 'ArrowDown' ? paso : e.key === 'ArrowUp' ? -paso : 0),
    });
  }
}

/* ---------- propiedades ---------- */

const num = (e: Event) => Number((e.target as HTMLInputElement).value);
function cambiar(c: Partial<Seleccion>) {
  for (const v of Object.values(c)) if (typeof v === 'number' && !Number.isFinite(v)) return;
  escena.value?.aplicar(c);
}
/** <input type="color"> solo entiende #rrggbb */
const colorHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#888888');

async function alAgregarImagen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) {
    error.value = 'La imagen debe ser JPG, PNG o WEBP de máximo 15 MB.';
    return;
  }
  error.value = '';
  await escena.value?.agregarImagen(registrarBlob(f));
}

/* ---------- vista previa y exportación ---------- */

async function verPrevia() {
  try {
    const b = await escena.value!.exportar({ formato: 'jpeg', escala: 0.6, calidad: 0.85 });
    previa.value = URL.createObjectURL(b);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo crear la vista previa.';
  }
}
function cerrarPrevia() {
  if (previa.value) URL.revokeObjectURL(previa.value);
  previa.value = '';
}

const nombreArchivo = () => (nombre.value || 'diseno').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'diseno';

async function exportar(o: (typeof OPCIONES_EXPORTAR)[number]) {
  menuExp.value = false;
  error.value = '';
  try {
    const b = await escena.value!.exportar({ formato: o.formato, escala: o.escala });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreArchivo()}-${o.escala}x.${o.formato === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e: any) {
    error.value = e?.message || 'No se pudo exportar.';
  }
}
</script>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100%; min-height: 0; outline: none; }
.cabeza { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--e-panel); border-bottom: 1px solid var(--e-borde); flex-wrap: wrap; }
.nombre { background: transparent; border: 1px solid transparent; border-radius: 6px; color: var(--e-texto); font: inherit; font-weight: 600; padding: 5px 8px; min-width: 140px; max-width: 260px; }
.nombre:hover, .nombre:focus { border-color: var(--e-borde); outline: none; }
.estado { display: inline-flex; align-items: center; gap: 4px; color: var(--e-muted); font-size: 0.78rem; }
.estado.ocupado { color: var(--e-ambar); }
.espacio { flex: 1; }
.sep { width: 1px; height: 22px; background: var(--e-borde); margin: 0 4px; }
.ico { display: inline-grid; place-items: center; width: 32px; height: 32px; background: transparent; color: var(--e-texto); border: 1px solid transparent; border-radius: 8px; cursor: pointer; }
.ico:hover:not(:disabled) { background: var(--e-panel2); border-color: var(--e-borde); }
.ico:disabled { opacity: 0.35; cursor: default; }
.ico.activo { background: var(--e-panel2); border-color: var(--e-lima); }
.ico.chico { width: 26px; height: 26px; }
.zoom { background: var(--e-panel2); border: 1px solid var(--e-borde); border-radius: 6px; color: var(--e-texto); padding: 4px 8px; font: inherit; font-size: 0.8rem; min-width: 52px; cursor: pointer; }
.btn { display: inline-flex; align-items: center; gap: 6px; background: var(--e-panel2); color: var(--e-texto); border: 1px solid var(--e-borde); border-radius: 8px; padding: 7px 11px; cursor: pointer; font: inherit; font-size: 0.85rem; transition: border-color 0.15s; }
.btn:hover { border-color: var(--e-lima); }
.btn.primario { background: var(--e-lima); color: var(--e-on); border-color: var(--e-lima); font-weight: 700; }
.btn.chico { padding: 5px 9px; font-size: 0.8rem; }
.menu-exp { position: relative; }
.desplegable { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; background: var(--e-panel); border: 1px solid var(--e-borde); border-radius: 10px; padding: 6px; display: flex; flex-direction: column; min-width: 230px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); }
.desplegable button { text-align: left; background: none; border: 0; color: var(--e-texto); padding: 9px 10px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 0.88rem; }
.desplegable button:hover { background: var(--e-panel2); }
.cuerpo { flex: 1; min-height: 0; display: grid; grid-template-columns: 230px 1fr 280px; }
.izq, .der { background: var(--e-panel); border-right: 1px solid var(--e-borde); overflow: auto; min-height: 0; }
.der { border-right: 0; border-left: 1px solid var(--e-borde); }
.tabs { display: flex; border-bottom: 1px solid var(--e-borde); position: sticky; top: 0; background: var(--e-panel); z-index: 1; }
.tabs button { flex: 1; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--e-muted); padding: 10px 6px; cursor: pointer; font: inherit; font-size: 0.82rem; }
.tabs .activo { color: var(--e-texto); border-bottom-color: var(--e-lima); }
.panel { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.panel h4 { margin: 8px 0 2px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--e-muted); font-weight: 600; }
.cat p { margin: 4px 0; font-size: 0.78rem; color: var(--e-muted); }
.botones { display: flex; flex-wrap: wrap; gap: 6px; }
.fondos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.fondo { aspect-ratio: 1.4; border-radius: 8px; border: 1px solid var(--e-borde); cursor: pointer; }
.fondo:hover { border-color: var(--e-lima); }
.area { overflow: auto; background: var(--e-fondo2); display: grid; place-items: center; padding: 24px; min-height: 0; position: relative; }
.hoja { box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55); line-height: 0; }
.vacio { color: var(--e-muted); font-size: 0.85rem; margin: 6px 0; }
.titulo-sel { margin: 0; font-weight: 600; font-size: 0.9rem; }
.acciones-sel { display: flex; gap: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.campo { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: var(--e-muted); }
.campo input, .campo select, .area-texto { background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 6px; color: var(--e-texto); padding: 6px 8px; font: inherit; font-size: 0.85rem; width: 100%; box-sizing: border-box; }
.campo input[type='color'] { padding: 2px; height: 32px; }
.campo.casilla { flex-direction: row; align-items: center; gap: 6px; }
.campo.casilla input { width: auto; }
.area-texto { resize: vertical; }
.capas ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.capas li { display: flex; align-items: center; gap: 2px; border-radius: 6px; padding: 2px 4px; border: 1px solid transparent; }
.capas li.sel { background: var(--e-panel2); border-color: var(--e-lima); }
.capas li.oculta .nombre-capa { opacity: 0.45; text-decoration: line-through; }
.nombre-capa { flex: 1; text-align: left; background: none; border: 0; color: var(--e-texto); cursor: pointer; font: inherit; font-size: 0.82rem; padding: 6px 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.error { color: #e5484d; font-size: 0.85rem; }
.error.flotante { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: var(--e-panel); border: 1px solid #e5484d; border-radius: 8px; padding: 8px 12px; z-index: 5; }
.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: grid; place-items: center; z-index: 50; padding: 20px; }
.modal-caja { display: flex; flex-direction: column; gap: 12px; align-items: center; max-height: 100%; }
.modal-caja img { max-width: min(92vw, 900px); max-height: 80vh; border-radius: 8px; }
@media (max-width: 900px) {
  .cuerpo { grid-template-columns: 1fr; grid-template-rows: minmax(300px, 1fr) auto auto; }
  .area { order: 1; }
  .der { order: 2; max-height: 40vh; border-left: 0; border-top: 1px solid var(--e-borde); }
  .izq { order: 3; max-height: 30vh; border-right: 0; border-top: 1px solid var(--e-borde); }
}
</style>
