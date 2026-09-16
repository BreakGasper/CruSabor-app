<template>
  <span class="compartir">
    <button
      type="button"
      class="compartir-btn"
      :class="{ 'con-texto': mostrarTexto }"
      :title="etiqueta"
      :aria-label="etiqueta"
      @click.stop="compartir"
    >
      <Share2 :size="18" />
      <span v-if="mostrarTexto">{{ etiqueta }}</span>
    </button>

    <!-- La lista se monta en <body>: el banner de la tienda tiene overflow:hidden y la recortaría -->
    <Teleport to="body">
    <transition name="cmp-hoja">
      <div v-if="hojaAbierta" class="cmp-fondo" @click.self="cerrar">
        <section class="cmp-panel" role="dialog" aria-modal="true" aria-label="Compartir">
          <header class="cmp-head">
            <div>
              <h2 class="cmp-titulo">Compartir</h2>
              <p class="cmp-sub">{{ titulo }}</p>
            </div>
            <button type="button" class="cmp-cerrar" aria-label="Cerrar" @click="cerrar">✕</button>
          </header>

          <div class="cmp-cuerpo">
            <a
              v-for="o in opciones"
              :key="o.destino"
              class="cmp-opcion"
              :href="enlaceDestino(o.destino, contenido)"
              target="_blank"
              rel="noopener"
              @click="cerrar"
            >
              <img v-if="o.icono" :src="o.icono" :alt="o.nombre" class="cmp-icono" />
              <component :is="o.componente" v-else :size="22" class="cmp-icono-svg" />
              <span>{{ o.nombre }}</span>
            </a>

            <button type="button" class="cmp-opcion" @click="copiar">
              <Link2 :size="22" class="cmp-icono-svg" />
              <span>{{ copiado ? '¡Enlace copiado!' : 'Copiar enlace' }}</span>
            </button>
          </div>

          <p class="cmp-url">{{ url }}</p>
        </section>
      </div>
      </transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
/**
 * Botón de compartir reutilizable (perfil de tienda, producto...).
 *
 * En el teléfono abre la hoja del sistema con todas las apps instaladas. Si el
 * navegador no la tiene (escritorio), muestra la lista propia con WhatsApp,
 * Facebook, correo y copiar enlace.
 */
import { ref, computed, onUnmounted } from 'vue';
import { Share2, Link2, Mail } from 'lucide-vue-next';
import whatsappIcon from '@/assets/icons/whatsapp.png';
import facebookIcon from '@/assets/icons/facebook.png';
import {
  compartirNativo,
  copiarTexto,
  enlaceDestino,
  type ContenidoCompartir,
  type DestinoCompartir,
} from '@/composables/useCompartir';

const props = withDefaults(
  defineProps<{
    /** Nombre de lo que se comparte (tienda, producto) */
    titulo: string;
    /** Mensaje que acompaña al enlace */
    texto: string;
    /** Enlace absoluto y público */
    url: string;
    etiqueta?: string;
    /** Con texto visible se integra en una tarjeta; sin él es el círculo flotante */
    mostrarTexto?: boolean;
  }>(),
  { etiqueta: 'Compartir', mostrarTexto: false },
);

const emit = defineEmits<{ (e: 'compartido'): void }>();

const hojaAbierta = ref(false);
const copiado = ref(false);

const contenido = computed<ContenidoCompartir>(() => ({
  titulo: props.titulo,
  texto: props.texto,
  url: props.url,
}));

const opciones: { destino: DestinoCompartir; nombre: string; icono?: string; componente?: any }[] = [
  { destino: 'whatsapp', nombre: 'WhatsApp', icono: whatsappIcon },
  { destino: 'facebook', nombre: 'Facebook', icono: facebookIcon },
  { destino: 'correo', nombre: 'Correo', componente: Mail },
];

async function compartir() {
  const resultado = await compartirNativo(contenido.value);
  if (resultado === 'compartido') {
    emit('compartido');
    return;
  }
  if (resultado === 'cancelado') return;
  abrir(); // el navegador no tiene menú del sistema: lista propia
}

function abrir() {
  copiado.value = false;
  hojaAbierta.value = true;
  document.addEventListener('keydown', alPresionarTecla);
}

function cerrar() {
  hojaAbierta.value = false;
  document.removeEventListener('keydown', alPresionarTecla);
}

function alPresionarTecla(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrar();
}

async function copiar() {
  copiado.value = await copiarTexto(props.url);
  if (copiado.value) emit('compartido');
}

onUnmounted(() => document.removeEventListener('keydown', alPresionarTecla));

defineExpose({ abrir, cerrar });
</script>

<style scoped>
/* Raíz única: el padre le pone posición o márgenes y Vue le pasa su scope */
.compartir {
  display: inline-flex;
}
.compartir-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: #4a5568;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s, color 0.2s;
}
.compartir-btn:hover {
  color: #0165d8;
  transform: scale(1.08);
}

/* Dentro de una tarjeta: píldora con texto, como el resto de los botones del perfil */
.compartir-btn.con-texto {
  width: auto;
  height: auto;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid #1f70b2;
  background: var(--surface);
  color: var(--brand-blue-text);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  box-shadow: none;
}
.compartir-btn.con-texto:hover {
  transform: none;
  background: var(--surface-2);
}
</style>

<!-- La hoja vive en <body> por el Teleport: sus estilos no pueden ser scoped -->
<style>
.cmp-fondo {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.cmp-fondo .cmp-panel {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  color: var(--text);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  text-align: left;
  padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 640px) {
  .cmp-fondo {
    align-items: center;
    padding: 16px;
  }
  .cmp-fondo .cmp-panel {
    border-radius: 20px;
  }
}
.cmp-fondo .cmp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border);
}
.cmp-fondo .cmp-titulo {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}
.cmp-fondo .cmp-sub {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.cmp-fondo .cmp-cerrar {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
  flex: none;
}
.cmp-fondo .cmp-cuerpo {
  display: flex;
  flex-direction: column;
  padding: 8px;
}
.cmp-fondo .cmp-opcion {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  font-size: 1rem;
  font-family: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.cmp-fondo .cmp-opcion:hover {
  background: var(--surface-2);
}
.cmp-fondo .cmp-icono {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex: none;
}
.cmp-fondo .cmp-icono-svg {
  width: 26px;
  flex: none;
  color: var(--text-muted);
}
.cmp-fondo .cmp-url {
  margin: 0;
  padding: 0 18px 16px;
  font-size: 0.8rem;
  color: var(--text-muted);
  word-break: break-all;
}
.cmp-hoja-enter-active,
.cmp-hoja-leave-active {
  transition: opacity 0.2s ease;
}
.cmp-hoja-enter-active .cmp-panel,
.cmp-hoja-leave-active .cmp-panel {
  transition: transform 0.22s ease;
}
.cmp-hoja-enter-from,
.cmp-hoja-leave-to {
  opacity: 0;
}
.cmp-hoja-enter-from .cmp-panel,
.cmp-hoja-leave-to .cmp-panel {
  transform: translateY(100%);
}
</style>
