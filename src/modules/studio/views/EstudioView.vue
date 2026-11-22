<template>
  <div class="estudio" :class="{ enEditor: seccion === 'editor' }">
    <nav v-if="seccion !== 'editor'" class="lateral" aria-label="CG-Rat Promo Studio">
      <div class="logo">
        <span class="marca" aria-hidden="true"><Sparkles :size="18" /></span>
        <div><strong>CG-Rat</strong><small>Promo Studio</small></div>
      </div>
      <button v-for="s in SECCIONES" :key="s.id" type="button" class="item" :class="{ activo: seccion === s.id }" :data-testid="`nav-${s.id}`" @click="ir(s.id)">
        <component :is="s.icono" :size="18" /><span>{{ s.texto }}</span>
      </button>
      <span class="espacio"></span>
      <button type="button" class="item" @click="router.push('/')"><ArrowLeft :size="18" /><span>Volver a Crustore</span></button>
    </nav>

    <div class="contenido">
      <EditorDiseno v-if="seccion === 'editor' && arranque" :key="claveEditor" :arranque="arranque" @salir="alSalirDelEditor" />

      <section v-else-if="seccion === 'inicio'" class="inicio">
        <h1>Convierte la foto de tu producto en publicidad</h1>
        <p>
          Sube una foto, escribe los datos y elige un estilo: el estudio arma varias propuestas que puedes editar y exportar en alta resolución.
          <strong>Es gratis y todo se queda en tu equipo</strong>: la foto no se envía a ningún servidor ni a ninguna IA.
        </p>
        <div class="botones">
          <button type="button" class="btn primario grande" data-testid="empezar" @click="ir('crear')"><Wand2 :size="18" /> Crear promoción</button>
          <button type="button" class="btn" @click="ir('disenos')"><LayoutGrid :size="16" /> Mis diseños</button>
        </div>
        <ul class="puntos">
          <li><strong>8 estilos</strong> con composiciones distintas: fiesta, granja, premium, oferta, artesanal, minimalista, catálogo y personalizado.</li>
          <li><strong>3 propuestas</strong> por tanda, con "Generar otras" para ver más.</li>
          <li><strong>Editor completo:</strong> capas, alineación, tipografías, recursos gráficos, deshacer y rehacer.</li>
          <li><strong>Guardado automático</strong> en este navegador y exportación PNG/JPG hasta 2×.</li>
        </ul>
      </section>

      <AsistenteCrear v-else-if="seccion === 'crear'" @editar="abrirPropuesta" />

      <section v-else-if="seccion === 'plantillas'" class="plantillas">
        <h2>Plantillas (estilos)</h2>
        <p class="nota">Elige un estilo para empezar: cada uno propone composiciones distintas.</p>
        <div class="rejilla">
          <button v-for="e in ESTILOS" :key="e.id" type="button" class="estilo" @click="usarEstilo(e.id)">
            <span class="muestras"><i v-for="p in e.paletas" :key="p.id" :style="{ background: `linear-gradient(135deg, ${p.fondoA}, ${p.fondoB})`, borderColor: p.acento }"></i></span>
            <strong>{{ e.nombre }}</strong>
            <small>{{ e.descripcion }}</small>
          </button>
        </div>
      </section>

      <MisDisenos v-else-if="seccion === 'disenos'" :key="'d' + recarga" @abrir="abrirGuardado" />
      <MisDisenos v-else-if="seccion === 'favoritos'" :key="'f' + recarga" solo-favoritos @abrir="abrirGuardado" />

      <section v-else-if="seccion === 'config'" class="config">
        <h2>Configuración</h2>
        <label class="campo"><span>Nombre de tu tienda (se usa en tus diseños)</span><input v-model="prefs.tienda" maxlength="40" @change="guardarPrefs(prefs)" placeholder="CG-Rat" /></label>
        <p class="nota">Tus diseños y fotos se guardan solo en este navegador (IndexedDB). Si borras los datos del sitio, se pierden: exporta lo que quieras conservar.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Home, LayoutGrid, Settings, Shapes, Sparkles, Star, Wand2 } from 'lucide-vue-next';
import AsistenteCrear from '../components/AsistenteCrear.vue';
import EditorDiseno, { type ArranqueEditor } from '../components/EditorDiseno.vue';
import MisDisenos from '../components/MisDisenos.vue';
import { ESTILOS, FORMATOS_ESTUDIO, type Propuesta } from '../motor/tipos';
import { guardarPrefs, imagenesDeSesion, leerPrefs, sesion } from '../estado';

const router = useRouter();
type Seccion = 'inicio' | 'crear' | 'plantillas' | 'disenos' | 'favoritos' | 'config' | 'editor';
const SECCIONES: { id: Seccion; texto: string; icono: any }[] = [
  { id: 'inicio', texto: 'Inicio', icono: Home },
  { id: 'crear', texto: 'Crear promoción', icono: Wand2 },
  { id: 'disenos', texto: 'Mis diseños', icono: LayoutGrid },
  { id: 'plantillas', texto: 'Plantillas', icono: Shapes },
  { id: 'favoritos', texto: 'Favoritos', icono: Star },
  { id: 'config', texto: 'Configuración', icono: Settings },
];

const seccion = ref<Seccion>('inicio');
const arranque = ref<ArranqueEditor | null>(null);
const recarga = ref(0);
const prefs = reactive(leerPrefs());
const claveEditor = computed(() => arranque.value?.abrirId ?? `n${recarga.value}`);

const ir = (s: Seccion) => {
  seccion.value = s;
};

function abrirPropuesta(p: Propuesta) {
  arranque.value = {
    elems: p.elems, imgs: imagenesDeSesion(), formato: { id: p.formato.id, w: p.formato.w, h: p.formato.h }, estilo: p.estilo, paleta: p.paleta, layout: p.layout,
    datos: JSON.parse(JSON.stringify(sesion.datos)), original: sesion.original,
  };
  recarga.value++;
  seccion.value = 'editor';
}

function abrirGuardado(id: string) {
  arranque.value = { abrirId: id };
  seccion.value = 'editor';
}

function alSalirDelEditor() {
  arranque.value = null;
  recarga.value++;
  seccion.value = 'disenos';
}

function usarEstilo(id: string) {
  sesion.estiloId = id;
  if (!FORMATOS_ESTUDIO.some((f) => f.id === sesion.formatoId)) sesion.formatoId = FORMATOS_ESTUDIO[0].id;
  seccion.value = 'crear';
}
</script>

<style scoped>
.estudio {
  --e-fondo: #1c1d21; --e-fondo2: #17181c; --e-panel: #24262b; --e-panel2: #2c2f35; --e-borde: #3a3d45; --e-texto: #e8e9ec; --e-muted: #9aa0aa; --e-lima: #c6f432; --e-ambar: #ffd166;
  position: fixed; inset: 0; z-index: 10; display: grid; grid-template-columns: 210px 1fr; background: var(--e-fondo); color: var(--e-texto);
  font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
}
.estudio.enEditor { grid-template-columns: 1fr; }
.lateral { background: var(--e-panel); border-right: 1px solid var(--e-borde); padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; overflow: auto; }
.logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 16px; }
.logo small { display: block; color: var(--e-muted); font-size: 0.72rem; }
.marca { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--e-lima); color: #1c1d21; }
.item { display: flex; align-items: center; gap: 10px; background: none; border: 1px solid transparent; border-radius: 8px; color: var(--e-muted); padding: 9px 10px; cursor: pointer; font: inherit; font-size: 0.88rem; text-align: left; transition: background 0.15s, color 0.15s; }
.item:hover { background: var(--e-panel2); color: var(--e-texto); }
.item.activo { background: var(--e-panel2); color: var(--e-texto); border-color: var(--e-borde); box-shadow: 3px 0 0 var(--e-lima) inset; }
.espacio { flex: 1; }
.contenido { overflow: auto; min-width: 0; min-height: 0; height: 100%; }
.enEditor .contenido { overflow: hidden; }
.inicio { max-width: 760px; margin: 0 auto; padding: 56px 20px; }
.inicio h1 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 14px; }
.inicio p { color: var(--e-muted); line-height: 1.55; }
.inicio strong { color: var(--e-texto); }
.botones { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0; }
.btn { display: inline-flex; align-items: center; gap: 7px; background: var(--e-panel2); color: var(--e-texto); border: 1px solid var(--e-borde); border-radius: 8px; padding: 9px 14px; cursor: pointer; font: inherit; }
.btn:hover { border-color: var(--e-lima); }
.btn.primario { background: var(--e-lima); border-color: var(--e-lima); color: #1c1d21; font-weight: 700; }
.btn.grande { padding: 12px 20px; }
.puntos { color: var(--e-muted); line-height: 1.6; padding-left: 18px; }
.plantillas, .config { max-width: 1000px; margin: 0 auto; padding: 22px 16px; }
h2 { margin: 0 0 10px; font-size: 1.05rem; font-weight: 600; }
.nota { color: var(--e-muted); font-size: 0.88rem; }
.rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; margin-top: 14px; }
.estilo { text-align: left; background: var(--e-panel); border: 1px solid var(--e-borde); border-radius: 12px; padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; color: var(--e-texto); font: inherit; }
.estilo:hover { border-color: var(--e-lima); }
.estilo small { color: var(--e-muted); }
.muestras { display: flex; gap: 5px; }
.muestras i { width: 28px; height: 20px; border-radius: 5px; border: 2px solid; display: inline-block; }
.campo { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--e-muted); max-width: 420px; }
.campo input { background: var(--e-fondo2); border: 1px solid var(--e-borde); border-radius: 8px; color: var(--e-texto); padding: 9px 10px; font: inherit; }
@media (max-width: 760px) {
  .estudio { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  .lateral { grid-row: 2; flex-direction: row; overflow-x: auto; border-right: 0; border-top: 1px solid var(--e-borde); padding: 6px; }
  .logo, .espacio { display: none; }
  .item span { display: none; }
  .item { padding: 10px; }
}
</style>
