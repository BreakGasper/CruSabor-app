<template>
  <div class="admin-container">
    <AdminTopbar titulo="Configuración" />

    <main class="admin-main">
      <h1 class="page-title">Configuración del sistema</h1>
      <p class="page-hint">
        Estos valores aplican a toda la app en cuanto se guardan.
        <span v-if="configuracion.actualizadoEn">
          Última actualización: {{ fechaCorta(configuracion.actualizadoEn) }} por {{ configuracion.actualizadoPor }}.
        </span>
      </p>

      <form class="secciones" novalidate @submit.prevent="guardar">
        <!-- Membresía -->
        <section class="card">
          <h2>Membresía</h2>
          <div class="row">
            <div class="form-group">
              <label for="cfg-mensual">Precio mensual (MXN)</label>
              <input id="cfg-mensual" v-model="form.membresia.precioMensual" type="number" min="0" step="0.01" inputmode="decimal" class="form-input" :class="{ 'input-error': errores.precioMensual }" />
              <small v-if="errores.precioMensual" class="error-text">{{ errores.precioMensual }}</small>
            </div>
            <div class="form-group">
              <label for="cfg-anual">Precio anual (MXN)</label>
              <input id="cfg-anual" v-model="form.membresia.precioAnual" type="number" min="0" step="0.01" inputmode="decimal" class="form-input" :class="{ 'input-error': errores.precioAnual }" />
              <small v-if="errores.precioAnual" class="error-text">{{ errores.precioAnual }}</small>
            </div>
            <div class="form-group">
              <label for="cfg-gracia">Días de gracia</label>
              <input id="cfg-gracia" v-model="form.membresia.diasGracia" type="number" min="0" max="90" step="1" inputmode="numeric" class="form-input" :class="{ 'input-error': errores.diasGracia }" />
              <small class="hint">Días que la tienda sigue vendiendo después de vencer su membresía.</small>
              <small v-if="errores.diasGracia" class="error-text">{{ errores.diasGracia }}</small>
            </div>
          </div>
        </section>

        <!-- Registro de tiendas -->
        <section class="card">
          <h2>Registro de tiendas</h2>
          <label class="switch">
            <input id="cfg-registro" v-model="form.registro.tiendasAbierto" type="checkbox" />
            <span>Permitir que se registren tiendas nuevas</span>
          </label>
          <div v-if="!form.registro.tiendasAbierto" class="form-group">
            <label for="cfg-registro-msg">Mensaje cuando el registro está cerrado</label>
            <textarea id="cfg-registro-msg" v-model="form.registro.mensajeCerrado" class="form-input" rows="2" maxlength="200"></textarea>
          </div>
        </section>

        <!-- Mantenimiento -->
        <section class="card" :class="{ alerta: form.mantenimiento.activo }">
          <h2>Modo mantenimiento</h2>
          <label class="switch">
            <input id="cfg-mant" v-model="form.mantenimiento.activo" type="checkbox" />
            <span>Activar mantenimiento</span>
          </label>
          <p class="hint">
            Clientes y tiendas verán solo el aviso y no podrán usar la app. El panel de administración sigue disponible.
          </p>
          <div class="form-group">
            <label for="cfg-mant-msg">Mensaje del aviso</label>
            <textarea id="cfg-mant-msg" v-model="form.mantenimiento.mensaje" class="form-input" rows="2" maxlength="200"></textarea>
          </div>
        </section>

        <!-- Soporte -->
        <section class="card">
          <h2>Contacto de soporte</h2>
          <p class="hint">Se muestra a las tiendas bloqueadas o vencidas y en el aviso de mantenimiento.</p>
          <div class="row">
            <div class="form-group">
              <label for="cfg-wa">WhatsApp (10 dígitos)</label>
              <input id="cfg-wa" v-model="form.soporte.whatsapp" type="tel" inputmode="numeric" maxlength="12" class="form-input" :class="{ 'input-error': errores.whatsapp }" placeholder="3312345678" @input="form.soporte.whatsapp = form.soporte.whatsapp.replace(/\D/g, '').slice(0, 10)" />
              <small v-if="errores.whatsapp" class="error-text">{{ errores.whatsapp }}</small>
            </div>
            <div class="form-group">
              <label for="cfg-email">Correo</label>
              <input id="cfg-email" v-model="form.soporte.email" type="email" class="form-input" :class="{ 'input-error': errores.email }" placeholder="soporte@mavi.mx" />
              <small v-if="errores.email" class="error-text">{{ errores.email }}</small>
            </div>
          </div>
        </section>

        <!-- Pagos en línea -->
        <section class="card">
          <h2>Pagos en línea (Mercado Pago)</h2>
          <div class="modos">
            <label class="modo" :class="{ activo: form.pagos.modo === 'automatico' }">
              <input id="cfg-modo-auto" v-model="form.pagos.modo" type="radio" value="automatico" />
              <span>
                <strong>Automático</strong>
                <small>La tienda paga en Mercado Pago y su membresía se activa sola en segundos. Requiere el servidor Express publicado con MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y API_PUBLIC_URL, y los precios de membresía.</small>
              </span>
            </label>
            <label class="modo" :class="{ activo: form.pagos.modo === 'links' }">
              <input id="cfg-modo-links" v-model="form.pagos.modo" type="radio" value="links" />
              <span>
                <strong>Con links y confirmación manual</strong>
                <small>La tienda abre un link de pago y avisa con "Ya pagué"; tú confirmas el cobro y registras el pago desde el tablero.</small>
              </span>
            </label>
          </div>
          <p v-if="form.pagos.modo === 'automatico' && !Number(form.membresia.precioMensual) && !Number(form.membresia.precioAnual)" class="error-text">
            Configura al menos un precio de membresía para que el pago automático funcione.
          </p>
          <p class="hint" v-if="form.pagos.modo === 'links'">
            Crea un link de pago por plan en tu panel de Mercado Pago (Tu negocio › Link de pago) con el precio de la membresía y
            pégalo aquí. Deja vacío el plan que no quieras ofrecer en línea.
          </p>
          <div class="row" v-if="form.pagos.modo === 'links'">
            <div class="form-group">
              <label for="cfg-link-mensual">Link de pago · plan mensual</label>
              <input id="cfg-link-mensual" v-model="form.pagos.linkMensual" type="url" class="form-input" :class="{ 'input-error': errores.linkMensual }" placeholder="https://mpago.la/..." />
              <small v-if="errores.linkMensual" class="error-text">{{ errores.linkMensual }}</small>
            </div>
            <div class="form-group">
              <label for="cfg-link-anual">Link de pago · plan anual</label>
              <input id="cfg-link-anual" v-model="form.pagos.linkAnual" type="url" class="form-input" :class="{ 'input-error': errores.linkAnual }" placeholder="https://mpago.la/..." />
              <small v-if="errores.linkAnual" class="error-text">{{ errores.linkAnual }}</small>
            </div>
          </div>
          <div class="form-group" v-if="form.pagos.modo === 'links'">
            <label for="cfg-pago-instr">Instrucciones que ve la tienda después de pagar</label>
            <textarea id="cfg-pago-instr" v-model="form.pagos.instrucciones" class="form-input" rows="2" maxlength="300"></textarea>
          </div>
        </section>

        <p v-if="errores.general" class="error-banner">{{ errores.general }}</p>

        <div class="acciones">
          <button type="button" class="btn-outline" :disabled="guardando || !hayCambios" @click="restablecer">Descartar cambios</button>
          <button type="submit" class="btn-primary" :disabled="guardando || !hayCambios">
            {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import { useConfiguracion, type Configuracion } from '@/composables/useConfiguracion';

const { configuracion, cargada, guardarConfiguracion } = useConfiguracion();

type Form = {
  membresia: { precioMensual: string | number; precioAnual: string | number; diasGracia: string | number };
  registro: Configuracion['registro'];
  mantenimiento: Configuracion['mantenimiento'];
  soporte: Configuracion['soporte'];
  pagos: Configuracion['pagos'];
};

const desdeConfig = (c: Configuracion): Form => ({
  membresia: { ...c.membresia },
  registro: { ...c.registro },
  mantenimiento: { ...c.mantenimiento },
  soporte: { ...c.soporte },
  pagos: { ...c.pagos },
});

const form = reactive<Form>(desdeConfig(configuracion.value));
const errores = reactive<Record<string, string | undefined>>({});
const guardando = ref(false);
const editando = ref(false);

// Mientras no se haya tocado el formulario, sigue los cambios que lleguen de Firebase
watch(
  configuracion,
  (c) => {
    if (!editando.value) Object.assign(form, desdeConfig(c));
  },
  { deep: true, immediate: true },
);
watch(form, () => (editando.value = true), { deep: true });

const normalizado = computed(() => ({
  membresia: {
    precioMensual: Number(form.membresia.precioMensual),
    precioAnual: Number(form.membresia.precioAnual),
    diasGracia: Number(form.membresia.diasGracia),
  },
  registro: { ...form.registro, mensajeCerrado: form.registro.mensajeCerrado.trim() },
  mantenimiento: { ...form.mantenimiento, mensaje: form.mantenimiento.mensaje.trim() },
  soporte: { whatsapp: form.soporte.whatsapp.replace(/\D/g, ''), email: form.soporte.email.trim() },
  pagos: {
    modo: (form.pagos.modo === 'automatico' ? 'automatico' : 'links') as 'automatico' | 'links',
    linkMensual: form.pagos.linkMensual.trim(),
    linkAnual: form.pagos.linkAnual.trim(),
    instrucciones: form.pagos.instrucciones.trim(),
  },
}));

const hayCambios = computed(() => {
  const c = configuracion.value;
  const n = normalizado.value;
  return JSON.stringify({ m: c.membresia, r: c.registro, t: c.mantenimiento, s: c.soporte, p: c.pagos }) !==
    JSON.stringify({ m: n.membresia, r: n.registro, t: n.mantenimiento, s: n.soporte, p: n.pagos });
});

function restablecer() {
  Object.assign(form, desdeConfig(configuracion.value));
  Object.keys(errores).forEach((k) => (errores[k] = undefined));
  // el watch marca editando=true; se limpia en el siguiente tick
  setTimeout(() => (editando.value = false));
}

function validar(): boolean {
  Object.keys(errores).forEach((k) => (errores[k] = undefined));
  const n = normalizado.value;
  if (!(n.membresia.precioMensual >= 0)) errores.precioMensual = 'Indica un precio válido';
  if (!(n.membresia.precioAnual >= 0)) errores.precioAnual = 'Indica un precio válido';
  if (!Number.isInteger(n.membresia.diasGracia) || n.membresia.diasGracia < 0 || n.membresia.diasGracia > 90)
    errores.diasGracia = 'Entre 0 y 90 días';
  if (n.soporte.whatsapp && n.soporte.whatsapp.length !== 10) errores.whatsapp = 'Deben ser 10 dígitos';
  if (n.soporte.email && !/\S+@\S+\.\S+/.test(n.soporte.email)) errores.email = 'Correo inválido';
  const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);
  if (n.pagos.linkMensual && !esUrl(n.pagos.linkMensual)) errores.linkMensual = 'Debe ser un link que empiece con https://';
  if (n.pagos.linkAnual && !esUrl(n.pagos.linkAnual)) errores.linkAnual = 'Debe ser un link que empiece con https://';
  return !Object.values(errores).some(Boolean);
}

async function guardar() {
  if (!validar() || !cargada.value) return;
  const n = normalizado.value;

  if (n.mantenimiento.activo && !configuracion.value.mantenimiento.activo) {
    const r = await Swal.fire({
      icon: 'warning',
      title: '¿Activar modo mantenimiento?',
      text: 'Todos los clientes y tiendas dejarán de poder usar la app hasta que lo desactives.',
      showCancelButton: true,
      confirmButtonText: 'Activar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d9534f',
    });
    if (!r.isConfirmed) return;
  }

  guardando.value = true;
  try {
    await guardarConfiguracion(n);
    editando.value = false;
    Swal.fire({ toast: true, position: 'top-end', timer: 2200, showConfirmButton: false, icon: 'success', title: 'Configuración guardada' });
  } catch (e: any) {
    errores.general = e?.message || 'No se pudo guardar la configuración';
  } finally {
    guardando.value = false;
  }
}

function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #f3f4f6;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: #111827;
}
.admin-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}
.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}
.page-hint {
  margin: 0.25rem 0 1.25rem;
  color: #5b6472;
  font-size: 0.9rem;
}
.secciones {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: #fff;
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
  border-left: 5px solid transparent;
}
.card.alerta {
  border-left-color: #d9534f;
}
.card h2 {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ecfdf5;
}
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.form-group {
  display: flex;
  flex-direction: column;
  margin-top: 0.6rem;
}
.form-group label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #333;
  margin-bottom: 5px;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #ccc;
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
  background: #fff;
  resize: vertical;
}
.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.input-error {
  border-color: #d9534f !important;
}
.hint {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: #5b6472;
}
.error-text {
  color: #d9534f;
  font-size: 0.8rem;
  margin-top: 4px;
}
.error-banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffebee;
  border: 1px solid #f5c2c0;
  color: #b71c1c;
  font-size: 0.85rem;
  text-align: center;
}
.modos {
  display: grid;
  gap: 8px;
  margin-bottom: 0.6rem;
}
.modo {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
}
.modo.activo {
  border-color: #10b981;
  background: #ecfdf5;
}
.modo input {
  margin-top: 3px;
  accent-color: #10b981;
}
.modo span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.modo small {
  font-size: 0.8rem;
  color: #5b6472;
}
.switch {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
}
.switch input {
  width: 20px;
  height: 20px;
  accent-color: #10b981;
  cursor: pointer;
}
.acciones {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  position: sticky;
  bottom: 0;
  padding: 0.75rem 0;
  background: linear-gradient(to top, #f3f4f6 70%, transparent);
}
.btn-primary,
.btn-outline {
  padding: 12px 22px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #047857);
}
.btn-outline {
  border: 2px solid #111827;
  background: #fff;
  color: #111827;
}
.btn-primary:disabled,
.btn-outline:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 480px) {
  .acciones {
    flex-direction: column-reverse;
  }
}
</style>
