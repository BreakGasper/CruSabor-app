<template>
  <div class="pantalla">
    <PageHeader title="Mis servicios" :fallback="`/store/profile/${tiendaId}`" />

    <main class="contenido" v-if="!esDueno" data-testid="no-es-dueno">
      <p class="aviso">Inicia sesión como esta tienda para administrar sus servicios.</p>
      <button type="button" class="btn-pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido" data-sin-recarga>
      <p class="ayuda">Este es el catálogo de tu trabajo: lo que ven tus clientes en tu perfil. Cada servicio se contrata con una cotización (o una cita, cuando esté disponible).</p>

      <!-- Formulario -->
      <section class="tarjeta" data-testid="form-servicio">
        <h2>{{ editandoId ? 'Editar servicio' : 'Nuevo servicio' }}</h2>

        <label class="campo">
          <span>Nombre del servicio *</span>
          <input v-model="form.nombre" type="text" maxlength="80" placeholder="Ej. Corte clásico, Manicura en gel…" data-testid="servicio-nombre" :class="{ err: errores.nombre }" />
          <small v-if="errores.nombre" class="error">{{ errores.nombre }}</small>
        </label>

        <label class="campo">
          <span>Categoría *</span>
          <select v-model="form.categoria" data-testid="servicio-categoria" :class="{ err: errores.categoria }">
            <option value="">Selecciona…</option>
            <option v-for="c in CATEGORIAS_SERVICIO" :key="c.id" :value="c.id">{{ c.icono }} {{ c.nombre }}</option>
          </select>
          <small v-if="errores.categoria" class="error">{{ errores.categoria }}</small>
        </label>

        <label class="campo">
          <span>Descripción</span>
          <textarea v-model="form.descripcion" rows="3" maxlength="1000" placeholder="Qué incluye, cómo trabajas, qué materiales usas…" data-testid="servicio-descripcion"></textarea>
        </label>

        <!-- Fotos del trabajo -->
        <div class="campo">
          <span>Fotos de tu trabajo (hasta {{ MAX_FOTOS_SERVICIO }})</span>
          <ul class="fotos">
            <li v-for="(f, i) in form.fotos" :key="f" class="foto">
              <img :src="f" alt="" />
              <button type="button" class="quitar" :aria-label="`Quitar foto ${i + 1}`" @click="form.fotos.splice(i, 1)">✕</button>
            </li>
            <li v-if="form.fotos.length < MAX_FOTOS_SERVICIO">
              <button type="button" class="agregar-foto" :disabled="subiendo" data-testid="agregar-foto" @click="entrada?.click()">
                {{ subiendo ? 'Subiendo…' : '＋ Foto' }}
              </button>
            </li>
          </ul>
          <input ref="entrada" type="file" accept="image/*" multiple hidden data-testid="archivo-fotos" @change="alElegirFotos" />
          <small v-if="errores.fotos" class="error">{{ errores.fotos }}</small>
        </div>

        <!-- Precio -->
        <div class="campo">
          <span>¿Cómo cobras? *</span>
          <div class="opciones">
            <label v-for="o in OPCIONES_PRECIO" :key="o.id" class="opcion" :class="{ on: form.tipoPrecio === o.id }">
              <input v-model="form.tipoPrecio" type="radio" name="tipoPrecio" :value="o.id" :data-testid="'precio-' + o.id" />
              {{ o.texto }}
            </label>
          </div>
        </div>
        <label v-if="form.tipoPrecio !== 'cotizar'" class="campo">
          <span>{{ form.tipoPrecio === 'desde' ? 'Precio desde (MXN) *' : 'Precio (MXN) *' }}</span>
          <input v-model.number="form.precio" type="number" min="0" step="1" inputmode="decimal" data-testid="servicio-precio" :class="{ err: errores.precio }" />
          <small v-if="errores.precio" class="error">{{ errores.precio }}</small>
        </label>

        <label class="campo">
          <span>Duración estimada</span>
          <select v-model.number="form.duracionMin" data-testid="servicio-duracion" :class="{ err: errores.duracionMin }">
            <option :value="0">Sin definir</option>
            <option v-for="m in DURACIONES" :key="m" :value="m">{{ etiquetaDuracion(m) }}</option>
          </select>
          <small v-if="errores.duracionMin" class="error">{{ errores.duracionMin }}</small>
        </label>

        <!-- Contratación -->
        <div class="campo">
          <span>¿Cómo lo contratan? *</span>
          <div class="opciones">
            <label v-for="o in OPCIONES_CONTRATACION" :key="o.id" class="opcion" :class="{ on: form.contratacion === o.id }">
              <input v-model="form.contratacion" type="radio" name="contratacion" :value="o.id" :data-testid="'contratacion-' + o.id" />
              {{ o.texto }}
            </label>
          </div>
          <small class="pista">La agenda de citas llega pronto. Mientras tanto, tus clientes te piden cotización.</small>
          <small v-if="errores.contratacion" class="error">{{ errores.contratacion }}</small>
        </div>

        <!-- Modalidad -->
        <div v-if="permitidas.length > 1" class="campo">
          <span>¿Dónde lo das?</span>
          <div class="opciones">
            <label v-for="m in permitidas" :key="m" class="opcion" :class="{ on: form.modalidad === m }">
              <input v-model="form.modalidad" type="radio" name="modalidad" :value="m" :data-testid="'modalidad-' + m" />
              {{ etiquetaModalidad(m) }}
            </label>
          </div>
        </div>
        <small v-if="errores.modalidad" class="error">{{ errores.modalidad }}</small>

        <label class="check">
          <input v-model="form.activo" type="checkbox" />
          Visible para mis clientes
        </label>

        <div class="acciones">
          <button type="button" class="btn-pri" :disabled="guardando || subiendo" data-testid="guardar-servicio" @click="guardar">
            {{ guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Publicar servicio' }}
          </button>
          <button v-if="editandoId" type="button" class="btn-sec" @click="reiniciar">Cancelar</button>
        </div>
      </section>

      <!-- Lista -->
      <h2 class="titulo-lista">Mis servicios ({{ servicios.length }})</h2>
      <p v-if="cargando" class="ayuda">Cargando…</p>
      <p v-else-if="!servicios.length" class="ayuda">Todavía no tienes servicios publicados.</p>
      <ul v-else class="lista">
        <li v-for="s in servicios" :key="s.id" class="fila" :class="{ oculto: !s.activo }" :data-servicio="s.id">
          <img v-if="s.fotos[0]" :src="s.fotos[0]" alt="" class="miniatura" />
          <span v-else class="miniatura vacia" aria-hidden="true">{{ icono(s.categoria) }}</span>
          <div class="info">
            <strong>{{ s.nombre }}</strong>
            <span class="meta">{{ etiquetaPrecio(s) }}<template v-if="s.duracionMin"> · {{ etiquetaDuracion(s.duracionMin) }}</template> · {{ ETIQUETA_CONTRATACION[s.contratacion] }}<template v-if="!s.activo"> · Oculto</template></span>
          </div>
          <div class="botones">
            <button type="button" class="mini" data-testid="ver-servicio" @click="router.push(`/servicio/${tiendaId}/${s.id}`)">Ver</button>
            <button type="button" class="mini" data-testid="editar-servicio" @click="editar(s)">Editar</button>
            <button type="button" class="mini" data-testid="alternar-servicio" @click="alternar(s)">{{ s.activo ? 'Ocultar' : 'Mostrar' }}</button>
            <button type="button" class="mini peligro" data-testid="eliminar-servicio" @click="eliminar(s)">Eliminar</button>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { uploadImage } from '@/composables/useCloudinary';
import { useTiendas } from '@/composables/useTiendas';
import { CATEGORIAS_SERVICIO, type Servicio, type TipoPrecio, type Contratacion } from '../tipos';
import { modalidadDe } from '../negocio';
import { esDuenoDeTienda } from '../sesion';
import {
  ErrorServicio,
  MAX_FOTOS_SERVICIO,
  ETIQUETA_CONTRATACION,
  alternarServicio,
  eliminarServicio,
  etiquetaDuracion,
  etiquetaModalidad,
  etiquetaPrecio,
  guardarServicio,
  modalidadesPermitidas,
  servicioVacio,
  useServiciosTienda,
  validarServicio,
  type DatosServicio,
} from '../catalogo';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const { obtenerTienda } = useTiendas();
const { servicios, cargando } = useServiciosTienda(() => (esDueno.value ? tiendaId.value : undefined));

const OPCIONES_PRECIO: { id: TipoPrecio; texto: string }[] = [
  { id: 'fijo', texto: 'Precio fijo' },
  { id: 'desde', texto: 'Precio desde' },
  { id: 'cotizar', texto: 'A cotizar' },
];
const OPCIONES_CONTRATACION: { id: Contratacion; texto: string }[] = [
  { id: 'cotizacion', texto: 'Solo cotización' },
  { id: 'cita', texto: 'Solo cita' },
  { id: 'ambas', texto: 'Cita o cotización' },
];
const DURACIONES = Array.from({ length: 32 }, (_, i) => (i + 1) * 15); // 15 min … 8 h

const modalidadTienda = ref(modalidadDe(null));
const permitidas = computed(() => modalidadesPermitidas(modalidadTienda.value));

const form = reactive<DatosServicio>(servicioVacio());
const errores = ref<Record<string, string>>({});
const editandoId = ref<string | null>(null);
const guardando = ref(false);
const subiendo = ref(false);
const entrada = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  if (!esDueno.value) return;
  const t = await obtenerTienda(tiendaId.value);
  modalidadTienda.value = modalidadDe(t);
  if (!editandoId.value) form.modalidad = permitidas.value.includes('local') && modalidadTienda.value !== 'domicilio' ? 'local' : permitidas.value[0];
});

const icono = (cat: string) => CATEGORIAS_SERVICIO.find((c) => c.id === cat)?.icono ?? '✨';

function reiniciar() {
  Object.assign(form, servicioVacio(permitidas.value.includes('local') ? 'local' : permitidas.value[0]));
  errores.value = {};
  editandoId.value = null;
}

async function alElegirFotos(e: Event) {
  const input = e.target as HTMLInputElement;
  const archivos = Array.from(input.files ?? []).slice(0, MAX_FOTOS_SERVICIO - form.fotos.length);
  if (!archivos.length) return;
  subiendo.value = true;
  try {
    for (const a of archivos) form.fotos.push(await uploadImage(a));
  } catch {
    await Swal.fire({ icon: 'error', title: 'No se pudo subir una foto', text: 'Revisa tu conexión e intenta de nuevo.' });
  } finally {
    subiendo.value = false;
    input.value = '';
  }
}

async function guardar() {
  errores.value = validarServicio(form, modalidadTienda.value);
  if (Object.keys(errores.value).length) return;
  guardando.value = true;
  try {
    await guardarServicio(tiendaId.value, editandoId.value, { ...form, fotos: [...form.fotos] }, modalidadTienda.value);
    Swal.fire({ toast: true, position: 'bottom', timer: 1600, showConfirmButton: false, icon: 'success', title: editandoId.value ? 'Servicio actualizado' : 'Servicio publicado' });
    reiniciar();
  } catch (e: any) {
    await Swal.fire({ icon: 'warning', title: 'No se pudo guardar', text: e instanceof ErrorServicio ? e.message : 'Intenta de nuevo en unos minutos.' });
  } finally {
    guardando.value = false;
  }
}

function editar(s: Servicio) {
  editandoId.value = s.id;
  errores.value = {};
  Object.assign(form, {
    nombre: s.nombre,
    descripcion: s.descripcion,
    fotos: [...s.fotos],
    categoria: s.categoria,
    tipoPrecio: s.tipoPrecio,
    precio: s.precio,
    duracionMin: s.duracionMin,
    modalidad: s.modalidad,
    contratacion: s.contratacion,
    activo: s.activo,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const alternar = (s: Servicio) => alternarServicio(tiendaId.value, s.id, !s.activo);

async function eliminar(s: Servicio) {
  const r = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar este servicio?',
    text: `«${s.nombre}» dejará de verse en tu catálogo. Las cotizaciones que ya te pidieron se conservan.`,
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  await eliminarServicio(tiendaId.value, s.id);
  if (editandoId.value === s.id) reiniciar();
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; }
.aviso, .ayuda { color: var(--text-muted); font-size: 0.9rem; line-height: 1.45; margin: 6px 0 14px; }
.tarjeta { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 22px; display: flex; flex-direction: column; gap: 14px; color: var(--text); }
.tarjeta h2, .titulo-lista { margin: 0; font-size: 1.05rem; color: var(--text); }
.campo { display: flex; flex-direction: column; gap: 5px; font-size: 0.88rem; font-weight: 600; color: var(--text); }
.campo input, .campo select, .campo textarea { padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; font-size: 16px; }
.campo .err { border-color: var(--peligro-texto); }
.error { color: var(--peligro-texto); font-weight: 600; font-size: 0.8rem; }
.pista { color: var(--text-muted); font-weight: 400; font-size: 0.78rem; }
.opciones { display: flex; flex-wrap: wrap; gap: 8px; }
.opcion { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.opcion input { position: absolute; opacity: 0; pointer-events: none; }
.opcion.on { border-color: var(--brand-blue-text); background: var(--brand-blue-soft); color: var(--brand-blue-text); }
.opcion:has(input:focus-visible) { outline: 2px solid var(--brand-blue-text); outline-offset: 2px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text); }
.fotos { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.foto { position: relative; width: 84px; height: 84px; }
.foto img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
.quitar { position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; border: 0; border-radius: 50%; background: var(--peligro-fondo); color: var(--peligro-texto); font-weight: 700; cursor: pointer; }
.agregar-foto { width: 84px; height: 84px; border: 1.5px dashed var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-muted); font: inherit; font-weight: 600; cursor: pointer; }
.acciones { display: flex; gap: 10px; }
.btn-pri { padding: 10px 18px; border: 0; border-radius: 10px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-weight: 700; cursor: pointer; }
.btn-sec { padding: 10px 18px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
.btn-pri:disabled { opacity: 0.6; cursor: wait; }
.lista { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); }
.fila.oculto { opacity: 0.65; }
.miniatura { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; flex: none; background: var(--surface-2); }
.miniatura.vacia { display: flex; align-items: center; justify-content: center; font-size: 1.6rem; }
.info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 160px; }
.meta { color: var(--text-muted); font-size: 0.8rem; }
.botones { display: flex; gap: 6px; flex-wrap: wrap; }
.mini { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.mini.peligro { background: var(--peligro-fondo); color: var(--peligro-texto); border-color: transparent; }
</style>
