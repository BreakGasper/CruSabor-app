<template>
  <div class="admin-container">
    <AdminTopbar titulo="Apariencia" />

    <main class="admin-main">
      <h1 class="page-title">Apariencia</h1>
      <p class="page-hint">Colores y temáticas de toda la app: clientes, tiendas y este panel. Los cambios se ven al instante para todos.</p>

      <!-- ===================== Paletas ===================== -->
      <section class="card">
        <h2>Paleta de colores</h2>
        <p v-if="tematicaActual?.[1].paleta" class="aviso">
          Mientras la temática "{{ tematicaActual[1].nombre }}" esté activa, la app usa la paleta
          "{{ nombrePaleta(tematicaActual[1].paleta) }}". Al terminar vuelve a la que marques aquí.
        </p>
        <div class="paletas">
          <article
            v-for="p in listaPaletas"
            :key="p.id"
            class="paleta"
            :class="{ activa: apariencia.paleta === p.id }"
            :data-testid="`paleta-${p.id}`"
          >
            <span class="muestra" aria-hidden="true">
              <span v-for="(c, i) in p.colores" :key="i" :style="{ background: c }"></span>
            </span>
            <div class="paleta-info">
              <strong>{{ p.nombre }}</strong>
              <small>{{ p.propia ? 'Creada por ti' : 'Incluida' }}</small>
            </div>
            <div class="paleta-acciones">
              <span v-if="apariencia.paleta === p.id" class="badge">En uso</span>
              <button v-else type="button" class="btn-sm btn-primary" :disabled="ocupado" @click="usar(p.id)">Usar</button>
              <template v-if="p.propia">
                <button type="button" class="btn-sm btn-outline" @click="editarPaleta(p.id)">Editar</button>
                <button type="button" class="btn-sm btn-peligro" :aria-label="`Eliminar ${p.nombre}`" @click="borrarPaleta(p.id)">Eliminar</button>
              </template>
            </div>
          </article>
        </div>
      </section>

      <!-- ===================== Crear paleta ===================== -->
      <section ref="seccionPaleta" class="card">
        <h2>{{ paletaEditando ? `Editar "${formPaleta.nombre || 'paleta'}"` : 'Crear mi paleta' }}</h2>
        <p class="hint">Elige tres colores; el resto (texto sobre botones, modo oscuro, fondos suaves) se calcula para que todo se lea bien.</p>

        <div class="crear">
          <div class="campos">
            <div class="form-group">
              <label for="pal-nombre">Nombre</label>
              <input id="pal-nombre" v-model="formPaleta.nombre" type="text" maxlength="40" class="form-input" placeholder="Ej. Verde nopal" />
            </div>
            <div v-for="c in CAMPOS_COLOR" :key="c.clave" class="form-group">
              <label :for="`pal-${c.clave}`">{{ c.etiqueta }}</label>
              <div class="color-campo">
                <input :id="`pal-${c.clave}-picker`" v-model="formPaleta[c.clave]" type="color" class="color-picker" :aria-label="`${c.etiqueta}: elegir color`" />
                <input
                  :id="`pal-${c.clave}`"
                  :value="formPaleta[c.clave]"
                  type="text"
                  maxlength="7"
                  class="form-input hex"
                  :class="{ 'input-error': !esHex(formPaleta[c.clave]) }"
                  @input="escribirHex(c.clave, ($event.target as HTMLInputElement).value)"
                />
              </div>
              <small class="hint">{{ c.ayuda }}</small>
            </div>
            <ul v-if="avisos.length" class="avisos">
              <li v-for="a in avisos" :key="a">{{ a }}</li>
            </ul>
          </div>

          <!-- Vista previa en claro y oscuro -->
          <div class="previas">
            <div v-for="modo in ['claro', 'oscuro'] as const" :key="modo" class="previa" :class="modo" :style="tokensPrevia?.[modo]">
              <div class="p-cabecera">
                <span class="p-logo"></span>
                <span>CruShop</span>
                <span class="p-modo">{{ modo === 'claro' ? 'Claro' : 'Oscuro' }}</span>
              </div>
              <div class="p-cuerpo">
                <div class="p-card">
                  <div class="p-foto"></div>
                  <div class="p-nombre">Chocoflán de la casa</div>
                  <div class="p-precio">$45.00</div>
                  <button type="button" class="p-boton" tabindex="-1">Agregar</button>
                </div>
                <div class="p-lateral">
                  <span class="p-chip">Envío a domicilio</span>
                  <a class="p-link" tabindex="-1">Ver tienda</a>
                  <span class="p-acento">-20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="acciones">
          <button v-if="paletaEditando" type="button" class="btn-outline" @click="nuevaPaleta">Cancelar</button>
          <button type="button" class="btn-outline" :disabled="!paletaValida || ocupado" @click="guardarPaleta(false)">Guardar paleta</button>
          <button type="button" class="btn-primary" :disabled="!paletaValida || ocupado" @click="guardarPaleta(true)">Guardar y usar</button>
        </div>
      </section>

      <!-- ===================== Temáticas ===================== -->
      <section class="card">
        <h2>Temáticas de temporada</h2>
        <p class="hint">
          Una imagen o GIF animado encima de las pantallas que elijas (por ejemplo, una araña colgando en el login en
          Halloween). Solo una temática puede estar activa; si le pones fechas, se apaga sola al terminar.
        </p>

        <ul v-if="listaTematicas.length" class="tematicas">
          <li v-for="[id, t] in listaTematicas" :key="id" class="tematica-fila" :data-testid="`tematica-${id}`">
            <span class="miniatura">
              <img v-if="urlImagenTematica(t.imagen)" :src="urlImagenTematica(t.imagen)" alt="" />
              <span v-else class="falta" title="El archivo ya no está en la carpeta">?</span>
            </span>
            <div class="tematica-info">
              <strong>{{ t.nombre }}</strong>
              <small>
                {{ ANIMACIONES[t.animacion] }} · {{ t.pantallas.map((p) => PANTALLAS[p].nombre).join(', ') }}
                <template v-if="t.desde || t.hasta"> · {{ rangoFechas(t) }}</template>
              </small>
            </div>
            <span class="badge" :class="estadoTematica(t).clase">{{ estadoTematica(t).texto }}</span>
            <div class="paleta-acciones">
              <button v-if="t.activa" type="button" class="btn-sm btn-outline" :disabled="ocupado" @click="activar(null)">Apagar</button>
              <button v-else type="button" class="btn-sm btn-primary" :disabled="ocupado" @click="activar(id)">Activar</button>
              <button type="button" class="btn-sm btn-outline" @click="editarTematica(id)">Editar</button>
              <button type="button" class="btn-sm btn-peligro" :aria-label="`Eliminar ${t.nombre}`" @click="borrarTematica(id)">Eliminar</button>
            </div>
          </li>
        </ul>
        <p v-else class="hint">Todavía no hay temáticas.</p>
      </section>

      <section ref="seccionTematica" class="card">
        <h2>{{ tematicaEditando ? `Editar "${formTematica.nombre || 'temática'}"` : 'Nueva temática' }}</h2>

        <div class="crear">
          <div class="campos">
            <div class="form-group">
              <label for="tem-nombre">Nombre</label>
              <input id="tem-nombre" v-model="formTematica.nombre" type="text" maxlength="40" class="form-input" placeholder="Ej. Día de Muertos" />
            </div>

            <div class="form-group">
              <span class="etiqueta">Imagen o GIF</span>
              <div v-if="imagenes.length" class="imagenes" role="radiogroup" aria-label="Imagen de la temática">
                <label v-for="[archivo, url] in imagenes" :key="archivo" class="imagen-op" :class="{ activo: formTematica.imagen === archivo }" :title="archivo">
                  <input v-model="formTematica.imagen" type="radio" :value="archivo" :data-testid="`img-${archivo}`" />
                  <img :src="url" alt="" />
                  <small>{{ archivo }}</small>
                </label>
              </div>
              <p v-else class="aviso">No hay imágenes en la carpeta <code>src/assets/tematicas/</code>.</p>
              <details class="ayuda-archivos">
                <summary>¿Cómo agrego mis propios GIFs?</summary>
                <ol>
                  <li>Copia el archivo (<code>.gif</code>, <code>.png</code>, <code>.webp</code> o <code>.svg</code>) a la carpeta <code>src/assets/tematicas/</code> del proyecto. Usa fondo transparente para que se vea bien.</li>
                  <li>Compila y publica: <code>npm run build</code> y <code>firebase deploy --only hosting</code>. En desarrollo (<code>npm run dev</code>) aparece al guardar el archivo.</li>
                  <li>La imagen aparece aquí para elegirla. Viaja dentro de la app: no se sube a Cloudinary ni a otro servidor.</li>
                </ol>
                <p>Consejo: GIFs de menos de 500 KB para que la pantalla cargue rápido en el teléfono.</p>
              </details>
            </div>

            <div class="row">
              <div class="form-group">
                <label for="tem-anim">Animación</label>
                <select id="tem-anim" v-model="formTematica.animacion" class="form-input">
                  <option v-for="(n, k) in ANIMACIONES" :key="k" :value="k">{{ n }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="tem-pos">Posición</label>
                <select id="tem-pos" v-model="formTematica.posicion" class="form-input" :disabled="formTematica.animacion === 'caminando'">
                  <option v-for="(n, k) in POSICIONES" :key="k" :value="k">{{ n }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="tem-tam">Tamaño</label>
                <select id="tem-tam" v-model="formTematica.tamano" class="form-input">
                  <option v-for="(n, k) in TAMANOS" :key="k" :value="k">{{ n }}</option>
                </select>
              </div>
            </div>

            <fieldset class="form-group pantallas">
              <legend class="etiqueta">Dónde se ve</legend>
              <label v-for="(p, k) in PANTALLAS" :key="k" class="check">
                <input v-model="formTematica.pantallas" type="checkbox" :value="k" :data-testid="`pant-${k}`" />
                <span>{{ p.nombre }}</span>
              </label>
            </fieldset>

            <div class="form-group">
              <label for="tem-paleta">Paleta mientras esté activa</label>
              <select id="tem-paleta" v-model="formTematica.paleta" class="form-input">
                <option value="">No cambiar colores</option>
                <option v-for="p in listaPaletas" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>

            <div class="row">
              <div class="form-group">
                <label for="tem-desde">Desde (opcional)</label>
                <input id="tem-desde" v-model="formTematica.desde" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label for="tem-hasta">Hasta (opcional)</label>
                <input id="tem-hasta" v-model="formTematica.hasta" type="date" class="form-input" :class="{ 'input-error': fechasInvalidas }" />
                <small v-if="fechasInvalidas" class="error-text">"Hasta" no puede ser antes de "Desde"</small>
              </div>
            </div>
          </div>

          <!-- Vista previa -->
          <div class="previa-tematica" :style="tokensDe(formTematica.paleta || apariencia.paleta)">
            <div class="pt-login">
              <div class="pt-cabecera">Iniciar sesión</div>
              <div class="pt-campo"></div>
              <div class="pt-campo"></div>
              <div class="pt-boton">Entrar</div>
            </div>
            <TematicaDecoracion
              v-if="formTematica.imagen"
              :key="previaClave"
              :tematica="formTematica"
              :url="urlImagenTematica(formTematica.imagen)"
              contenida
            />
            <span v-else class="pt-vacio">Elige una imagen para ver la vista previa</span>
          </div>
        </div>

        <div class="acciones">
          <button v-if="tematicaEditando" type="button" class="btn-outline" @click="nuevaTematica">Cancelar</button>
          <button type="button" class="btn-outline" :disabled="!tematicaValida || ocupado" @click="guardarTem(false)">Guardar temática</button>
          <button type="button" class="btn-primary" :disabled="!tematicaValida || ocupado" @click="guardarTem(true)">Guardar y activar</button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import TematicaDecoracion from '@/components/TematicaDecoracion.vue';
import {
  useConfiguracion,
  usarPaleta,
  guardarPaletaPersonalizada,
  eliminarPaletaPersonalizada,
  guardarTematica,
  eliminarTematica,
  activarTematica,
  nuevoIdApariencia,
} from '@/composables/useConfiguracion';
import {
  PALETAS,
  NOMBRE_PALETA,
  MUESTRA_PALETA,
  esHex,
  esPaletaFija,
  avisosContraste,
  tokensPersonalizados,
  type PaletaPersonalizada,
} from '@/composables/usePaleta';
import {
  ANIMACIONES,
  POSICIONES,
  TAMANOS,
  PANTALLAS,
  IMAGENES_TEMATICA,
  urlImagenTematica,
  tematicaEnCurso,
  tematicaVigente,
  hoyISO,
  type Tematica,
} from '@/composables/useTematicas';

const { configuracion } = useConfiguracion();
const apariencia = computed(() => configuracion.value.apariencia);
const ocupado = ref(false);
const seccionPaleta = ref<HTMLElement | null>(null);
const seccionTematica = ref<HTMLElement | null>(null);

const aviso = (title: string) =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2200, showConfirmButton: false, icon: 'success', title });

async function ejecutar(fn: () => Promise<void>, ok: string) {
  ocupado.value = true;
  try {
    await fn();
    aviso(ok);
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: e?.message || 'Intenta de nuevo.', confirmButtonColor: 'var(--color-bg-blue-ligth)' });
  } finally {
    ocupado.value = false;
  }
}

/* ---------------- Paletas ---------------- */

const listaPaletas = computed(() => [
  ...PALETAS.map((id) => ({ id, nombre: NOMBRE_PALETA[id], colores: MUESTRA_PALETA[id], propia: false })),
  ...Object.entries(apariencia.value.personalizadas).map(([id, p]) => ({
    id,
    nombre: p.nombre,
    colores: [p.cabecera, p.boton, p.resaltado],
    propia: true,
  })),
]);

function nombrePaleta(id: string) {
  return listaPaletas.value.find((p) => p.id === id)?.nombre ?? id;
}

function usar(id: string) {
  return ejecutar(() => usarPaleta(id), `Paleta "${nombrePaleta(id)}" en uso`);
}

const CAMPOS_COLOR = [
  { clave: 'cabecera', etiqueta: 'Cabeceras y menús', ayuda: 'Barras de arriba y menú lateral. Mejor un tono oscuro.' },
  { clave: 'boton', etiqueta: 'Botones', ayuda: '"Agregar al carrito", "Guardar" y acciones principales.' },
  { clave: 'resaltado', etiqueta: 'Resaltado', ayuda: 'Enlaces, insignias, promociones y fondos suaves.' },
] as const;
type ClaveColor = (typeof CAMPOS_COLOR)[number]['clave'];

const paletaVacia = (): PaletaPersonalizada => ({ nombre: '', cabecera: '#1b2a24', boton: '#2f7a3a', resaltado: '#f5b83d' });
const formPaleta = reactive<PaletaPersonalizada>(paletaVacia());
const paletaEditando = ref<string | null>(null);

function escribirHex(clave: ClaveColor, v: string) {
  const limpio = ('#' + v.replace(/[^0-9a-f]/gi, '')).slice(0, 7).toLowerCase();
  formPaleta[clave] = limpio;
}

const coloresValidos = computed(() => esHex(formPaleta.cabecera) && esHex(formPaleta.boton) && esHex(formPaleta.resaltado));
const paletaValida = computed(() => coloresValidos.value && formPaleta.nombre.trim().length > 0);
const avisos = computed(() => (coloresValidos.value ? avisosContraste(formPaleta) : []));
const tokensPrevia = computed(() => (coloresValidos.value ? tokensPersonalizados(formPaleta) : null));

function nuevaPaleta() {
  Object.assign(formPaleta, paletaVacia());
  paletaEditando.value = null;
}

function editarPaleta(id: string) {
  const p = apariencia.value.personalizadas[id];
  if (!p) return;
  Object.assign(formPaleta, p);
  paletaEditando.value = id;
  seccionPaleta.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function guardarPaleta(usarla: boolean) {
  if (!paletaValida.value) return;
  const id = paletaEditando.value ?? nuevoIdApariencia();
  const datos: PaletaPersonalizada = {
    nombre: formPaleta.nombre.trim(),
    cabecera: formPaleta.cabecera,
    boton: formPaleta.boton,
    resaltado: formPaleta.resaltado,
  };
  await ejecutar(async () => {
    await guardarPaletaPersonalizada(id, datos);
    if (usarla) await usarPaleta(id);
  }, usarla ? `Paleta "${datos.nombre}" guardada y en uso` : `Paleta "${datos.nombre}" guardada`);
  nuevaPaleta();
}

async function borrarPaleta(id: string) {
  const nombre = nombrePaleta(id);
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Eliminar "${nombre}"?`,
    text: apariencia.value.paleta === id ? 'Está en uso: la app volverá a la paleta Carbón y lima.' : 'No se puede deshacer.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  if (paletaEditando.value === id) nuevaPaleta();
  await ejecutar(() => eliminarPaletaPersonalizada(id), `Paleta "${nombre}" eliminada`);
}

/** Variables CSS de una paleta para pintar la vista previa de la temática */
function tokensDe(id: string) {
  if (esPaletaFija(id)) return { '--pv-cabecera': MUESTRA_PALETA[id][0], '--pv-boton': MUESTRA_PALETA[id][1], '--pv-texto-boton': id === 'carbon-lima' ? '#c6f432' : '#ffffff' };
  const p = apariencia.value.personalizadas[id];
  if (!p) return {};
  const t = tokensPersonalizados(p).claro;
  return { '--pv-cabecera': t['--color-bg-blue-dark'], '--pv-boton': t['--color-bg-blue-ligth'], '--pv-texto-boton': t['--on-primary'] };
}

/* ---------------- Temáticas ---------------- */

const imagenes = computed(() => Object.entries(IMAGENES_TEMATICA));
const listaTematicas = computed(() => Object.entries(apariencia.value.tematicas));
const tematicaActual = computed(() => tematicaEnCurso(apariencia.value.tematicas, hoyISO()));

const tematicaVacia = (): Tematica => ({
  nombre: '',
  imagen: imagenes.value[0]?.[0] ?? '',
  animacion: 'colgando',
  posicion: 'derecha',
  tamano: 'mediano',
  pantallas: ['login'],
  paleta: '',
  activa: false,
  desde: '',
  hasta: '',
});
const formTematica = reactive<Tematica>(tematicaVacia());
const tematicaEditando = ref<string | null>(null);

// Reinicia la animación de la vista previa cuando cambian sus opciones
const previaClave = ref(0);
watch(
  () => [formTematica.imagen, formTematica.animacion, formTematica.posicion, formTematica.tamano],
  () => previaClave.value++,
);

const fechasInvalidas = computed(() => !!(formTematica.desde && formTematica.hasta && formTematica.hasta < formTematica.desde));
const tematicaValida = computed(
  () => formTematica.nombre.trim().length > 0 && !!formTematica.imagen && formTematica.pantallas.length > 0 && !fechasInvalidas.value,
);

function nuevaTematica() {
  Object.assign(formTematica, tematicaVacia());
  tematicaEditando.value = null;
}

function editarTematica(id: string) {
  const t = apariencia.value.tematicas[id];
  if (!t) return;
  Object.assign(formTematica, { ...t, pantallas: [...t.pantallas] });
  tematicaEditando.value = id;
  seccionTematica.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function guardarTem(activarla: boolean) {
  if (!tematicaValida.value) return;
  const id = tematicaEditando.value ?? nuevoIdApariencia();
  const datos: Tematica = {
    ...formTematica,
    nombre: formTematica.nombre.trim(),
    pantallas: [...formTematica.pantallas],
    activa: activarla || formTematica.activa,
  };
  await ejecutar(async () => {
    await guardarTematica(id, datos);
    if (activarla) await activarTematica(id);
  }, activarla ? `Temática "${datos.nombre}" activa` : `Temática "${datos.nombre}" guardada`);
  nuevaTematica();
}

function activar(id: string | null) {
  const nombre = id ? apariencia.value.tematicas[id]?.nombre : '';
  return ejecutar(() => activarTematica(id), id ? `Temática "${nombre}" activa` : 'Temática apagada');
}

async function borrarTematica(id: string) {
  const nombre = apariencia.value.tematicas[id]?.nombre ?? '';
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Eliminar "${nombre}"?`,
    text: 'La imagen se queda en la carpeta del proyecto; solo se borra esta configuración.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  if (tematicaEditando.value === id) nuevaTematica();
  await ejecutar(() => eliminarTematica(id), `Temática "${nombre}" eliminada`);
}

function estadoTematica(t: Tematica) {
  if (tematicaVigente(t)) return { texto: 'Activa', clase: 'b-activa' };
  if (t.activa && t.desde && hoyISO() < t.desde) return { texto: 'Programada', clase: 'b-programada' };
  if (t.activa) return { texto: 'Terminada', clase: 'b-apagada' };
  return { texto: 'Apagada', clase: 'b-apagada' };
}

const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
function rangoFechas(t: Tematica) {
  if (t.desde && t.hasta) return `del ${fechaCorta(t.desde)} al ${fechaCorta(t.hasta)}`;
  if (t.desde) return `desde el ${fechaCorta(t.desde)}`;
  return `hasta el ${fechaCorta(t.hasta)}`;
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: var(--surface-2);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: var(--text);
}
.admin-main {
  text-align: left;
  max-width: 980px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}
.page-hint {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.card {
  background: var(--surface);
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}
.card h2 {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.hint {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.aviso {
  margin: 0 0 0.8rem;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--brand-blue-soft);
  color: var(--brand-blue-text);
  font-size: 0.85rem;
}
.error-text {
  color: #d9534f;
  font-size: 0.8rem;
  margin-top: 4px;
}

/* Botones */
button {
  font-family: inherit;
}
.btn-primary,
.btn-outline,
.btn-peligro {
  border-radius: 10px;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-primary {
  border: none;
  background: var(--color-bg-blue-ligth);
  color: var(--on-primary);
}
.btn-outline {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.btn-peligro {
  border: 1px solid #f5c2c0;
  background: var(--surface);
  color: #b71c1c;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.acciones {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 1rem;
}
.badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--brand-blue-soft);
  color: var(--brand-blue-text);
  white-space: nowrap;
}
.b-activa {
  background: #e6f4ec;
  color: #1e6b41;
}
.b-programada {
  background: #fff4e5;
  color: #8a5a00;
}
.b-apagada {
  background: var(--surface-2);
  color: var(--text-muted);
}

/* Lista de paletas */
.paletas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.paleta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 2px solid var(--border);
}
.paleta.activa {
  border-color: var(--brand-blue-text);
  background: var(--brand-blue-soft);
}
.muestra {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.muestra span {
  width: 16px;
  height: 36px;
}
.paleta-info,
.tematica-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.paleta-info small,
.tematica-info small {
  color: var(--text-muted);
  font-size: 0.75rem;
}
.paleta-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

/* Formulario + vista previa */
.crear {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  margin-top: 0.6rem;
}
@media (max-width: 760px) {
  .crear {
    grid-template-columns: minmax(0, 1fr);
  }
}
.campos {
  display: flex;
  flex-direction: column;
}
.form-group {
  display: flex;
  flex-direction: column;
  margin-top: 0.6rem;
  min-width: 0;
}
.form-group label,
.etiqueta {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text);
  margin-bottom: 5px;
}
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--surface);
}
.form-input:focus {
  outline: none;
  border-color: var(--brand-blue-text);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-blue-text) 20%, transparent);
}
.input-error {
  border-color: #d9534f !important;
}
.color-campo {
  display: flex;
  gap: 8px;
  align-items: center;
}
.color-picker {
  width: 48px;
  height: 42px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}
.hex {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  text-transform: lowercase;
}
.avisos {
  margin: 0.8rem 0 0;
  padding: 10px 12px 10px 28px;
  border-radius: 10px;
  background: #fff4e5;
  color: #7a4a00;
  font-size: 0.8rem;
}

/* Vista previa de paleta (colores fijos de neutros para que no dependa del tema del panel) */
.previas {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.previa {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #dcdcd6;
  --pv-fondo: #f6f6f3;
  --pv-sup: #ffffff;
  --pv-texto: #141414;
  --pv-borde: #dcdcd6;
  background: var(--pv-fondo);
  color: var(--pv-texto);
}
.previa.oscuro {
  border-color: #34342f;
  --pv-fondo: #0d0d0d;
  --pv-sup: #1a1a1a;
  --pv-texto: #edede9;
  --pv-borde: #34342f;
}
.p-cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg-blue-dark);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
}
.p-logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: var(--color-acento);
}
.p-modo {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 500;
  opacity: 0.75;
}
.p-cuerpo {
  display: flex;
  gap: 10px;
  padding: 12px;
}
.p-card {
  flex: 1;
  background: var(--pv-sup);
  border: 1px solid var(--pv-borde);
  border-radius: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.78rem;
}
.p-foto {
  height: 44px;
  border-radius: 8px;
  background: var(--pv-fondo);
}
.p-nombre {
  font-weight: 600;
}
.p-precio {
  font-weight: 700;
  font-size: 0.95rem;
}
.p-boton {
  border: none;
  border-radius: 8px;
  padding: 6px 0;
  background: var(--color-bg-blue-ligth);
  color: var(--on-primary);
  font-weight: 700;
  font-size: 0.75rem;
  cursor: default;
}
.p-lateral {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.78rem;
}
.p-chip {
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--brand-blue-soft);
  color: var(--brand-blue-text);
  font-weight: 600;
}
.p-link {
  color: var(--brand-blue-text);
  font-weight: 600;
  text-decoration: underline;
}
.p-acento {
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--color-acento);
  color: var(--on-acento);
  font-weight: 700;
}

/* Temáticas */
.tematicas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tematica-fila {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.miniatura {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.miniatura img {
  max-width: 40px;
  max-height: 40px;
}
.falta {
  font-weight: 700;
  color: var(--text-muted);
}
.imagenes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.imagen-op {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  background: var(--surface-2);
}
.imagen-op.activo {
  border-color: var(--brand-blue-text);
  background: var(--brand-blue-soft);
}
.imagen-op input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.imagen-op:has(input:focus-visible) {
  outline: 3px solid var(--brand-blue-text);
  outline-offset: 2px;
}
.imagen-op img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}
.imagen-op small {
  font-size: 0.7rem;
  color: var(--text-muted);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ayuda-archivos {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.ayuda-archivos summary {
  cursor: pointer;
  color: var(--brand-blue-text);
  font-weight: 600;
}
.ayuda-archivos ol {
  margin: 6px 0;
  padding-left: 18px;
}
.pantallas {
  border: none;
  padding: 0;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 500 !important;
  margin: 3px 0 !important;
  cursor: pointer;
}
.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--brand-blue-text);
}

/* Vista previa de temática: un login en miniatura */
.previa-tematica {
  position: relative;
  min-height: 420px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pt-login {
  width: 70%;
  max-width: 260px;
  background: var(--surface);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
}
.pt-cabecera {
  background: var(--pv-cabecera, var(--color-bg-blue-dark));
  color: #fff;
  font-weight: 700;
  padding: 14px;
  font-size: 0.9rem;
}
.pt-campo {
  height: 30px;
  margin: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.pt-boton {
  margin: 4px 14px 0;
  border-radius: 8px;
  padding: 8px 0;
  text-align: center;
  font-weight: 700;
  font-size: 0.8rem;
  background: var(--pv-boton, var(--color-bg-blue-ligth));
  color: var(--pv-texto-boton, var(--on-primary));
}
.pt-vacio {
  position: absolute;
  bottom: 12px;
  font-size: 0.8rem;
  color: var(--text-muted);
}
</style>
