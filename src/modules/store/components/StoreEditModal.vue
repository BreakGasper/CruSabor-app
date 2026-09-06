<template>
  <div v-if="visible" class="se-overlay" @click.self="cerrar">
    <div class="se-modal" role="dialog" aria-modal="true" aria-labelledby="se-title">
      <header class="se-header">
        <h2 id="se-title">Editar mi tienda</h2>
        <button class="se-close" type="button" aria-label="Cerrar" @click="cerrar">✕</button>
      </header>

      <!-- Pestañas -->
      <nav class="se-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          class="se-tab"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>

      <form class="se-body" novalidate @submit.prevent="guardar">
        <!-- ============ DATOS ============ -->
        <section v-show="tab === 'datos'" class="se-section">
          <div class="se-imagenes">
            <div class="se-img-col">
              <span class="se-label">Portada</span>
              <div class="se-banner" @click="bannerInput?.click()">
                <img v-if="bannerPreview" :src="bannerPreview" alt="Portada" />
                <span v-else>＋ Subir portada</span>
              </div>
              <input ref="bannerInput" type="file" accept="image/*" hidden @change="onBanner" />
            </div>
            <div class="se-img-col logo">
              <span class="se-label">Logo</span>
              <div class="se-logo" @click="logoInput?.click()">
                <img v-if="logoPreview" :src="logoPreview" alt="Logo" />
                <span v-else>＋</span>
              </div>
              <input ref="logoInput" type="file" accept="image/*" hidden @change="onLogo" />
            </div>
          </div>

          <label class="se-campo">
            <span>Nombre de la tienda *</span>
            <input v-model="form.nombreTienda" type="text" maxlength="60" :class="{ err: errores.nombreTienda }" />
            <small v-if="errores.nombreTienda">{{ errores.nombreTienda }}</small>
          </label>

          <label class="se-campo">
            <span>Categoría</span>
            <select v-model="form.categoria">
              <option value="">Selecciona</option>
              <option v-for="c in categorias" :key="c.id" :value="c.nombre">{{ c.nombre }}</option>
            </select>
          </label>

          <label class="se-campo">
            <span>Descripción breve</span>
            <textarea v-model="form.descripcion" rows="3" maxlength="300"></textarea>
            <small class="hint">{{ form.descripcion.length }}/300</small>
          </label>

          <label class="se-campo">
            <span>Sobre la tienda / Blog</span>
            <textarea v-model="form.blog" rows="3" maxlength="600"></textarea>
          </label>
        </section>

        <!-- ============ CONTACTO ============ -->
        <section v-show="tab === 'contacto'" class="se-section">
          <label class="se-campo">
            <span>Teléfono *</span>
            <input
              v-model="form.telefono"
              type="tel"
              inputmode="numeric"
              maxlength="10"
              :class="{ err: errores.telefono }"
              @input="form.telefono = form.telefono.replace(/\D/g, '').slice(0, 10)"
            />
            <small v-if="errores.telefono">{{ errores.telefono }}</small>
            <small v-else class="hint">Es tu usuario para iniciar sesión.</small>
          </label>

          <label class="se-check">
            <input v-model="form.incluyeWhatsapp" type="checkbox" />
            Este número tiene WhatsApp
          </label>

          <label class="se-campo">
            <span>Correo electrónico</span>
            <input v-model="form.email" type="email" :class="{ err: errores.email }" />
            <small v-if="errores.email">{{ errores.email }}</small>
          </label>

          <div class="se-grid-2">
            <label class="se-campo">
              <span>Facebook</span>
              <input v-model="form.facebook" type="text" placeholder="usuario o enlace" />
            </label>
            <label class="se-campo">
              <span>Instagram</span>
              <input v-model="form.instagram" type="text" placeholder="@usuario" />
            </label>
          </div>
        </section>

        <!-- ============ UBICACIÓN ============ -->
        <section v-show="tab === 'ubicacion'" class="se-section">
          <div class="se-grid-2 calle">
            <label class="se-campo">
              <span>Calle *</span>
              <input v-model="form.calle" type="text" :class="{ err: errores.calle }" />
            </label>
            <label class="se-campo">
              <span>Número *</span>
              <input v-model="form.numero" type="text" :class="{ err: errores.numero }" />
            </label>
          </div>
          <div class="se-grid-2 calle">
            <label class="se-campo">
              <span>Colonia *</span>
              <input v-model="form.colonia" type="text" :class="{ err: errores.colonia }" />
            </label>
            <label class="se-campo">
              <span>C.P. *</span>
              <input v-model="form.cp" type="text" inputmode="numeric" maxlength="5" :class="{ err: errores.cp }" />
              <small v-if="errores.cp">{{ errores.cp }}</small>
            </label>
          </div>
          <div class="se-grid-2">
            <label class="se-campo">
              <span>Municipio *</span>
              <input v-model="form.municipio" type="text" :class="{ err: errores.municipio }" />
            </label>
            <label class="se-campo">
              <span>Estado *</span>
              <input v-model="form.estado" type="text" :class="{ err: errores.estado }" />
            </label>
          </div>
          <small v-if="errores.direccion" class="se-error">{{ errores.direccion }}</small>
        </section>

        <!-- ============ VENTAS ============ -->
        <section v-show="tab === 'ventas'" class="se-section">
          <span class="se-label">Métodos de pago *</span>
          <div class="se-chips">
            <label v-for="mp in METODOS_PAGO" :key="mp" class="se-chip" :class="{ on: form.metodosPago.includes(mp) }">
              <input type="checkbox" :value="mp" v-model="form.metodosPago" />
              {{ mp }}
            </label>
          </div>
          <small v-if="errores.metodosPago" class="se-error">{{ errores.metodosPago }}</small>

          <label class="se-check">
            <input v-model="form.envioDomicilio" type="checkbox" />
            Hago envíos a domicilio
          </label>

          <div v-if="form.envioDomicilio" class="se-campo">
            <span>Zonas de entrega</span>
            <div class="se-zonas">
              <span v-for="(z, i) in form.zonasEntrega" :key="i" class="se-zona">
                {{ z }}
                <button type="button" aria-label="Quitar zona" @click="form.zonasEntrega.splice(i, 1)">✕</button>
              </span>
            </div>
            <div class="se-zona-add">
              <input v-model="nuevaZona" type="text" placeholder="Ej. Centro, Ameca" @keydown.enter.prevent="agregarZona" />
              <button type="button" class="se-btn-sec" @click="agregarZona">Agregar</button>
            </div>
          </div>
        </section>

        <!-- ============ HORARIO ============ -->
        <section v-show="tab === 'horario'" class="se-section">
          <p class="hint">Deja vacío el día que no abres.</p>
          <div v-for="dia in DIAS" :key="dia" class="se-dia">
            <span class="se-dia-nombre">{{ dia }}</span>
            <input v-model="form.horario[dia].inicio" type="time" aria-label="Apertura" />
            <span class="se-sep">a</span>
            <input v-model="form.horario[dia].fin" type="time" aria-label="Cierre" />
            <button
              v-if="form.horario[dia].inicio || form.horario[dia].fin"
              type="button"
              class="se-link"
              @click="form.horario[dia] = { inicio: '', fin: '' }"
            >
              Cerrado
            </button>
          </div>
          <small v-if="errores.horario" class="se-error">{{ errores.horario }}</small>
        </section>

        <p v-if="errorGeneral" class="se-error se-error-general">{{ errorGeneral }}</p>

        <footer class="se-footer">
          <button type="button" class="se-btn-sec" :disabled="guardando" @click="cerrar">Cancelar</button>
          <button type="submit" class="se-btn-pri" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onMounted } from 'vue';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { obtenerCategorias, type CategoriaData } from '@/composables/useCategorias';
import { uploadStoreLogo, uploadStoreBanner } from '@/composables/useStorage';

/**
 * Edición de los datos de la tienda por su dueña o dueño.
 * Emite `saved` con los cambios ya guardados en Firebase.
 */
const props = defineProps<{ visible: boolean; tienda: Tienda }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', cambios: Partial<Tienda>): void }>();

const { actualizarTienda } = useTiendas();

type TabId = 'datos' | 'contacto' | 'ubicacion' | 'ventas' | 'horario';
const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'ubicacion', label: 'Ubicación' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'horario', label: 'Horario' },
];
const tab = ref<TabId>('datos');

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];

const categorias = ref<CategoriaData[]>([]);
onMounted(async () => {
  categorias.value = await obtenerCategorias();
});

/* ---------- formulario ---------- */
const horarioVacio = () =>
  Object.fromEntries(DIAS.map((d) => [d, { inicio: '', fin: '' }])) as Record<string, { inicio: string; fin: string }>;

const form = reactive({
  nombreTienda: '',
  categoria: '',
  descripcion: '',
  blog: '',
  telefono: '',
  incluyeWhatsapp: false,
  email: '',
  facebook: '',
  instagram: '',
  calle: '',
  numero: '',
  colonia: '',
  cp: '',
  municipio: '',
  estado: '',
  metodosPago: [] as string[],
  envioDomicilio: false,
  zonasEntrega: [] as string[],
  horario: horarioVacio(),
});

function cargarDesde(t: Tienda) {
  form.nombreTienda = t.nombreTienda || '';
  form.categoria = t.categoria || '';
  form.descripcion = t.descripcion || '';
  form.blog = t.blog || '';
  form.telefono = String(t.telefono || '');
  form.incluyeWhatsapp = !!t.incluyeWhatsapp;
  form.email = t.email || '';
  form.facebook = t.facebook || '';
  form.instagram = t.instagram || '';
  form.calle = t.calle || '';
  form.numero = String(t.numero || '');
  form.colonia = t.colonia || '';
  form.cp = String(t.cp || '');
  form.municipio = t.municipio || '';
  form.estado = t.estado || '';
  form.metodosPago = [...(t.metodosPago || [])];
  form.envioDomicilio = !!t.envioDomicilio;
  form.zonasEntrega = [...(t.zonasEntrega || [])];
  const h = horarioVacio();
  for (const d of DIAS) if (t.horario?.[d]) h[d] = { inicio: t.horario[d].inicio || '', fin: t.horario[d].fin || '' };
  form.horario = h;
  logoPreview.value = t.logoUrl || '';
  bannerPreview.value = t.bannerUrl || '';
  logoFile.value = null;
  bannerFile.value = null;
  errorGeneral.value = '';
  Object.keys(errores).forEach((k) => delete errores[k]);
  tab.value = 'datos';
}

/* ---------- imágenes ---------- */
const logoInput = ref<HTMLInputElement | null>(null);
const bannerInput = ref<HTMLInputElement | null>(null);
const logoFile = ref<File | null>(null);
const bannerFile = ref<File | null>(null);
const logoPreview = ref('');
const bannerPreview = ref('');

function tomarImagen(e: Event, destino: 'logo' | 'banner') {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return (errorGeneral.value = 'El archivo debe ser una imagen.');
  if (file.size > 5 * 1024 * 1024) return (errorGeneral.value = 'La imagen no debe pesar más de 5 MB.');
  errorGeneral.value = '';
  const url = URL.createObjectURL(file);
  if (destino === 'logo') { logoFile.value = file; logoPreview.value = url; }
  else { bannerFile.value = file; bannerPreview.value = url; }
}
const onLogo = (e: Event) => tomarImagen(e, 'logo');
const onBanner = (e: Event) => tomarImagen(e, 'banner');

/* ---------- zonas ---------- */
const nuevaZona = ref('');
function agregarZona() {
  const z = nuevaZona.value.trim();
  if (!z) return;
  if (!form.zonasEntrega.some((x) => x.toLowerCase() === z.toLowerCase())) form.zonasEntrega.push(z);
  nuevaZona.value = '';
}

/* ---------- validación y guardado ---------- */
const errores = reactive<Record<string, string>>({});
const errorGeneral = ref('');
const guardando = ref(false);

function validar(): TabId | null {
  Object.keys(errores).forEach((k) => delete errores[k]);
  let primeraTab: TabId | null = null;
  const marca = (campo: string, msg: string, t: TabId) => {
    errores[campo] = msg;
    if (!primeraTab) primeraTab = t;
  };

  if (form.nombreTienda.trim().length < 3) marca('nombreTienda', 'El nombre debe tener al menos 3 caracteres.', 'datos');
  if (!/^\d{10}$/.test(form.telefono)) marca('telefono', 'El teléfono debe tener 10 dígitos.', 'contacto');
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) marca('email', 'Correo no válido.', 'contacto');

  const dir: Array<[keyof typeof form, string]> = [['calle', 'calle'], ['numero', 'número'], ['colonia', 'colonia'], ['municipio', 'municipio'], ['estado', 'estado']];
  const faltan = dir.filter(([k]) => !String(form[k]).trim()).map(([, n]) => n);
  if (faltan.length) {
    faltan.forEach((n) => (errores[dir.find(([, x]) => x === n)![0] as string] = ' '));
    marca('direccion', `Completa: ${faltan.join(', ')}.`, 'ubicacion');
  }
  if (!/^\d{5}$/.test(form.cp)) marca('cp', 'C.P. de 5 dígitos.', 'ubicacion');

  if (form.metodosPago.length === 0) marca('metodosPago', 'Selecciona al menos un método de pago.', 'ventas');

  for (const d of DIAS) {
    const { inicio, fin } = form.horario[d];
    if ((inicio && !fin) || (!inicio && fin)) { marca('horario', `${d}: indica apertura y cierre.`, 'horario'); break; }
    if (inicio && fin && inicio >= fin) { marca('horario', `${d}: la apertura debe ser antes del cierre.`, 'horario'); break; }
  }
  return primeraTab;
}

async function guardar() {
  errorGeneral.value = '';
  const tabConError = validar();
  if (tabConError) {
    tab.value = tabConError;
    errorGeneral.value = 'Revisa los campos marcados.';
    return;
  }

  guardando.value = true;
  try {
    const id = props.tienda.tiendaId!;
    const cambios: Partial<Tienda> = {
      nombreTienda: form.nombreTienda.trim(),
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      blog: form.blog.trim(),
      telefono: form.telefono,
      incluyeWhatsapp: form.incluyeWhatsapp,
      email: form.email.trim(),
      facebook: form.facebook.trim(),
      instagram: form.instagram.trim(),
      calle: form.calle.trim(),
      numero: form.numero.trim(),
      colonia: form.colonia.trim(),
      cp: form.cp,
      municipio: form.municipio.trim(),
      estado: form.estado.trim(),
      metodosPago: [...form.metodosPago],
      envioDomicilio: form.envioDomicilio,
      zonasEntrega: form.envioDomicilio ? [...form.zonasEntrega] : [],
      horario: JSON.parse(JSON.stringify(form.horario)),
    };
    if (logoFile.value) cambios.logoUrl = await uploadStoreLogo(logoFile.value, id);
    if (bannerFile.value) cambios.bannerUrl = await uploadStoreBanner(bannerFile.value, id);

    await actualizarTienda(id, cambios);
    emit('saved', cambios);
  } catch (e: any) {
    errorGeneral.value = e?.message || 'No se pudieron guardar los cambios.';
  } finally {
    guardando.value = false;
  }
}

function cerrar() {
  if (!guardando.value) emit('close');
}

// Al abrir (o cambiar de tienda) se cargan los datos. Va al final: usa refs declaradas arriba.
watch(
  () => [props.visible, props.tienda] as const,
  ([v, t]) => {
    if (v && t) cargarDesde(t);
  },
  { immediate: true },
);
</script>

<style scoped>
.se-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
  padding: 0;
}
.se-modal {
  width: 100%;
  max-width: 560px;
  max-height: 92vh;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  animation: se-in 0.22s ease;
}
@keyframes se-in {
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (min-width: 700px) {
  .se-overlay { align-items: center; padding: 1rem; }
  .se-modal { border-radius: 20px; max-height: 88vh; }
}

.se-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem 0.5rem;
}
.se-header h2 { margin: 0; font-size: 1.15rem; color: var(--brand-blue-text); }
.se-close {
  width: 34px; height: 34px; border: none; border-radius: 50%;
  background: var(--surface-2); cursor: pointer; font-size: 0.9rem; padding: 0;
}

.se-tabs {
  display: flex; gap: 4px; padding: 0 0.75rem 0.5rem; overflow-x: auto; scrollbar-width: none;
}
.se-tabs::-webkit-scrollbar { display: none; }
.se-tab {
  flex: 1 0 auto; padding: 7px 12px; border: none; border-radius: 999px;
  background: var(--surface-2); color: var(--text-muted); font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.se-tab.active { background: #1f70b2; color: #fff; }

.se-body { overflow-y: auto; padding: 0.5rem 1.1rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.se-section { display: flex; flex-direction: column; gap: 0.75rem; }

.se-label { font-size: 0.8rem; font-weight: 600; color: var(--text); }
.se-campo { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--text); min-width: 0; }
.se-campo span { font-weight: 600; }
.se-campo input, .se-campo select, .se-campo textarea {
  width: 100%; padding: 0.65rem 0.75rem; border: 1px solid var(--border); border-radius: 10px;
  font-size: 16px; box-sizing: border-box; background: var(--surface); font-family: inherit;
}
.se-campo input:focus, .se-campo select:focus, .se-campo textarea:focus {
  outline: none; border-color: #1f70b2; box-shadow: 0 0 0 3px rgba(31, 112, 178, 0.15);
}
.se-campo input.err, .se-campo select.err { border-color: #e74c3c; }
.se-campo small, .hint { color: var(--text-muted); font-size: 0.75rem; }
.se-campo small:not(.hint) { color: #c0392b; }
.se-error { color: #c0392b; font-size: 0.82rem; }
.se-error-general { margin: 0; padding: 8px 10px; background: #fdecea; border-radius: 8px; }

.se-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.se-grid-2.calle { grid-template-columns: 2fr 1fr; }

.se-check { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--text); cursor: pointer; }
.se-check input { width: 16px; height: 16px; accent-color: #1f70b2; }

.se-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.se-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--border); font-size: 0.85rem; cursor: pointer; user-select: none;
}
.se-chip input { display: none; }
.se-chip.on { background: #1f70b2; border-color: #1f70b2; color: #fff; }

.se-zonas { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.se-zona {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: #eef6fd; color: var(--brand-blue-text); font-size: 0.82rem;
}
.se-zona button { border: none; background: transparent; color: var(--brand-blue-text); cursor: pointer; padding: 0; font-size: 0.75rem; }
.se-zona-add { display: flex; gap: 8px; }
.se-zona-add input {
  flex: 1; padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 10px; font-size: 16px; min-width: 0;
}

.se-dia { display: grid; grid-template-columns: 90px 1fr auto 1fr auto; align-items: center; gap: 6px; font-size: 0.85rem; }
.se-dia input { padding: 0.45rem 0.5rem; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; min-width: 0; }
.se-dia-nombre { font-weight: 600; color: var(--text); }
.se-sep { color: var(--text-muted); }
.se-link { border: none; background: none; color: var(--brand-blue-text); font-size: 0.78rem; cursor: pointer; padding: 0 4px; }

.se-imagenes { display: grid; grid-template-columns: 1fr 110px; gap: 10px; align-items: end; }
.se-img-col { display: flex; flex-direction: column; gap: 4px; }
.se-banner {
  height: 110px; border-radius: 12px; border: 2px dashed var(--border); background: var(--surface-2); overflow: hidden;
  display: flex; align-items: center; justify-content: center; color: var(--brand-blue-text); font-weight: 600; cursor: pointer;
}
.se-banner img { width: 100%; height: 100%; object-fit: cover; }
.se-logo {
  width: 100px; height: 100px; border-radius: 50%; border: 2px dashed var(--border); background: var(--surface-2); overflow: hidden;
  display: flex; align-items: center; justify-content: center; color: var(--brand-blue-text); font-size: 1.5rem; cursor: pointer;
}
.se-logo img { width: 100%; height: 100%; object-fit: cover; }

.se-footer { display: flex; gap: 8px; padding-top: 0.5rem; border-top: 1px solid #eef1f5; }
.se-btn-pri, .se-btn-sec { flex: 1; height: 42px; border-radius: 10px; font-weight: 700; font-size: 0.92rem; cursor: pointer; }
.se-btn-pri { border: none; background: #1f70b2; color: #fff; }
.se-btn-sec { border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.se-btn-pri:disabled, .se-btn-sec:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 480px) {
  .se-grid-2 { grid-template-columns: 1fr; }
  .se-grid-2.calle { grid-template-columns: 2fr 1fr; }
  .se-imagenes { grid-template-columns: 1fr 90px; }
  .se-logo { width: 84px; height: 84px; }
  .se-dia { grid-template-columns: 80px 1fr auto 1fr auto; }
}
</style>
