<template>
  <div class="pantalla">
    <PageHeader title="Pedir cotización" :fallback="`/servicio/${tiendaId}/${servicioId}`" />

    <p v-if="cargando" class="estado">Cargando…</p>
    <p v-else-if="!servicio || !tienda || !servicio.activo || !puedeCotizar(servicio)" class="estado" data-testid="no-disponible">
      Este servicio no recibe solicitudes de cotización.
    </p>

    <main v-else-if="!cliente" class="contenido" data-testid="pide-sesion">
      <p class="intro">Inicia sesión para pedir tu cotización: así {{ tienda.nombreTienda }} puede responderte y tú ves el avance en «Mis cotizaciones».</p>
      <button type="button" class="btn-pri" data-testid="iniciar-sesion" @click="irALogin">Iniciar sesión</button>
    </main>

    <main v-else class="contenido" data-sin-recarga>
      <section class="resumen" data-testid="resumen-servicio">
        <img v-if="servicio.fotos[0]" :src="servicio.fotos[0]" alt="" class="resumen-foto" />
        <div>
          <strong>{{ servicio.nombre }}</strong>
          <small>{{ tienda.nombreTienda }} · {{ etiquetaPrecio(servicio) }}</small>
        </div>
      </section>

      <form class="formulario" novalidate @submit.prevent="enviar">
        <label class="campo">
          <span>¿Qué necesitas? *</span>
          <textarea v-model="form.descripcion" rows="5" maxlength="2000" placeholder="Cuéntale con detalle lo que quieres: medidas, estilo, cantidad, lugar, ocasión…" data-testid="descripcion" :class="{ err: errores.descripcion }"></textarea>
          <small class="pista">{{ form.descripcion.length }}/2000</small>
          <small v-if="errores.descripcion" class="error">{{ errores.descripcion }}</small>
        </label>

        <div class="campo">
          <span>Imágenes de referencia (opcional, hasta {{ MAX_IMAGENES_COTIZACION }})</span>
          <ul class="fotos">
            <li v-for="(f, i) in form.imagenes" :key="f" class="foto">
              <img :src="f" alt="" />
              <button type="button" class="quitar" :aria-label="`Quitar imagen ${i + 1}`" @click="form.imagenes.splice(i, 1)">✕</button>
            </li>
            <li v-if="form.imagenes.length < MAX_IMAGENES_COTIZACION">
              <button type="button" class="agregar-foto" :disabled="subiendo" data-testid="agregar-imagen" @click="entrada?.click()">{{ subiendo ? 'Subiendo…' : '＋ Imagen' }}</button>
            </li>
          </ul>
          <input ref="entrada" type="file" accept="image/*" multiple hidden data-testid="archivo-imagenes" @change="alElegirImagenes" />
        </div>

        <label class="campo">
          <span>Fecha tentativa (opcional)</span>
          <input v-model="form.fechaTentativa" type="date" :min="hoy" data-testid="fecha" :class="{ err: errores.fechaTentativa }" />
          <small v-if="errores.fechaTentativa" class="error">{{ errores.fechaTentativa }}</small>
        </label>

        <template v-if="atiendeADomicilio(servicio.modalidad)">
          <label v-if="servicio.modalidad === 'ambas'" class="check">
            <input v-model="form.adomicilio" type="checkbox" data-testid="domicilio" @change="alCambiarDomicilio" />
            Lo necesito a domicilio
          </label>
          <p v-else class="pista">Este servicio se da a domicilio.</p>

          <label v-if="form.adomicilio" class="campo">
            <span>Dirección del servicio *</span>
            <textarea v-model="form.direccion" rows="2" maxlength="300" placeholder="Calle, número, colonia y referencias" data-testid="direccion" :class="{ err: errores.direccion }"></textarea>
            <small v-if="errores.direccion" class="error">{{ errores.direccion }}</small>
          </label>
        </template>

        <p v-if="errores.cliente || errores.adomicilio" class="error">{{ errores.cliente || errores.adomicilio }}</p>

        <button type="submit" class="btn-pri" :disabled="enviando || subiendo" data-testid="enviar">
          {{ enviando ? 'Enviando…' : 'Enviar solicitud' }}
        </button>
        <p class="pista centro">{{ tienda.nombreTienda }} te responderá con un precio. No pagas nada hasta que aceptes.</p>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import PageHeader from '@/components/PageHeader.vue';
import { uploadImage } from '@/composables/useCloudinary';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import { sessionUser } from '@/utils/sessionUser';
import type { Servicio } from '../tipos';
import { atiendeADomicilio } from '../negocio';
import { ahoraEnZona } from '../disponibilidad';
import { ErrorServicio, mensajeError, etiquetaPrecio, obtenerServicio, puedeCotizar } from '../catalogo';
import { MAX_IMAGENES_COTIZACION, crearCotizacion, validarSolicitud } from '../cotizaciones';
import { clienteActual } from '../sesion';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.tiendaId ?? ''));
const servicioId = computed(() => String(route.params.servicioId ?? ''));
const { obtenerTienda } = useTiendas();

const servicio = ref<Servicio | null>(null);
const tienda = ref<Tienda | null>(null);
const cargando = ref(true);
const cliente = computed(() => (sessionUser.value, clienteActual()));
const hoy = ahoraEnZona().fecha;

const form = reactive({ descripcion: '', imagenes: [] as string[], fechaTentativa: '', adomicilio: false, direccion: '' });
const errores = ref<Record<string, string>>({});
const enviando = ref(false);
const subiendo = ref(false);
const entrada = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  try {
    [servicio.value, tienda.value] = await Promise.all([obtenerServicio(tiendaId.value, servicioId.value), obtenerTienda(tiendaId.value)]);
    // Un servicio solo a domicilio siempre lo es
    if (servicio.value?.modalidad === 'domicilio') form.adomicilio = true;
    if (form.adomicilio) precargarDireccion();
  } finally {
    cargando.value = false;
  }
});

/** Si el cliente ya tiene su domicilio en el perfil, se le propone (puede cambiarlo) */
function precargarDireccion() {
  const u = sessionUser.value;
  if (!form.direccion && u?.domicilio) form.direccion = [u.domicilio, u.colonia, u.municipio].filter(Boolean).join(', ');
}
const alCambiarDomicilio = () => form.adomicilio && precargarDireccion();

const irALogin = () => router.push({ path: '/login', query: { redirect: `/cotizar/${tiendaId.value}/${servicioId.value}` } });

async function alElegirImagenes(e: Event) {
  const input = e.target as HTMLInputElement;
  const archivos = Array.from(input.files ?? []).slice(0, MAX_IMAGENES_COTIZACION - form.imagenes.length);
  if (!archivos.length) return;
  subiendo.value = true;
  try {
    for (const a of archivos) form.imagenes.push(await uploadImage(a));
  } catch {
    await Swal.fire({ icon: 'error', title: 'No se pudo subir una imagen', text: 'Revisa tu conexión e intenta de nuevo.' });
  } finally {
    subiendo.value = false;
    input.value = '';
  }
}

async function enviar() {
  if (enviando.value || !servicio.value || !cliente.value) return;
  const solicitud = {
    servicio: { id: servicio.value.id, nombre: servicio.value.nombre, modalidad: servicio.value.modalidad },
    cliente: cliente.value,
    descripcion: form.descripcion,
    imagenes: [...form.imagenes],
    fechaTentativa: form.fechaTentativa || undefined,
    adomicilio: form.adomicilio,
    direccion: form.direccion,
  };
  errores.value = validarSolicitud(solicitud);
  if (Object.keys(errores.value).length) return;

  enviando.value = true; // antes de cualquier espera: varios toques seguidos no crean varias solicitudes
  try {
    await crearCotizacion(tiendaId.value, solicitud);
    await Swal.fire({ icon: 'success', title: '¡Solicitud enviada!', text: `${tienda.value?.nombreTienda ?? 'La tienda'} la revisará y te responderá con un precio. La verás en «Mis cotizaciones».`, confirmButtonColor: 'var(--color-bg-blue-ligth)' });
    router.replace('/mis-cotizaciones');
  } catch (e: any) {
    enviando.value = false; // se puede corregir y reintentar
    await Swal.fire({ icon: 'warning', title: 'No se pudo enviar', text: mensajeError(e) });
  }
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.estado { padding: 40px 16px; text-align: center; color: var(--text-muted); }
.contenido { max-width: 640px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); }
.intro { color: var(--text-muted); line-height: 1.5; }
.resumen { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); margin-bottom: 16px; }
.resumen > div { display: flex; flex-direction: column; }
.resumen small { color: var(--text-muted); }
.resumen-foto { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; }
.formulario { display: flex; flex-direction: column; gap: 16px; }
.campo { display: flex; flex-direction: column; gap: 5px; font-size: 0.9rem; font-weight: 600; }
.campo input, .campo textarea { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-weight: 400; font-size: 16px; }
.campo .err { border-color: var(--peligro-texto); }
.check { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; }
.pista { color: var(--text-muted); font-size: 0.8rem; font-weight: 400; margin: 0; }
.centro { text-align: center; }
.error { color: var(--peligro-texto); font-weight: 600; font-size: 0.82rem; margin: 0; }
.fotos { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.foto { position: relative; width: 80px; height: 80px; }
.foto img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
.quitar { position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; border: 0; border-radius: 50%; background: var(--peligro-fondo); color: var(--peligro-texto); font-weight: 700; cursor: pointer; }
.agregar-foto { width: 80px; height: 80px; border: 1.5px dashed var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-muted); font: inherit; font-weight: 600; cursor: pointer; }
.btn-pri { padding: 14px 16px; border: 0; border-radius: 12px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
.btn-pri:disabled { opacity: 0.6; cursor: wait; }
</style>
