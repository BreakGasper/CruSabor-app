<template>
  <Teleport to="body">
    <div class="stock-fondo" @click.self="cerrar">
      <section class="stock-panel" role="dialog" aria-modal="true" aria-label="Actualizar stock">
        <header class="stock-head">
          <div>
            <h2 class="stock-titulo">📦 Actualizar stock</h2>
            <p class="stock-sub">{{ articulo.nombre }}</p>
          </div>
          <button type="button" class="stock-cerrar" aria-label="Cerrar" @click="cerrar">✕</button>
        </header>

        <div class="stock-cuerpo">
          <p v-if="!variantes.length" class="stock-vacio">
            Este artículo es bajo pedido o tiene existencias ilimitadas: no hay piezas que contar.
          </p>

          <template v-else>
            <label
              v-for="v in variantes"
              :key="v.indice"
              class="stock-fila"
              :class="{ resaltada: ultimoSumado === v.indice }"
            >
              <span class="stock-etiqueta">
                {{ variantes.length === 1 ? 'Piezas disponibles' : v.etiqueta }}
                <em v-if="v.sku" class="stock-sku">{{ v.sku }}</em>
              </span>
              <span class="stock-controles">
                <button type="button" class="stock-paso" aria-label="Quitar una" @click="sumar(v.indice, -1)">−</button>
                <input
                  v-model="piezas[v.indice]"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  class="stock-input"
                  :aria-label="`Piezas de ${v.etiqueta}`"
                />
                <button type="button" class="stock-paso" aria-label="Agregar una" @click="sumar(v.indice, 1)">+</button>
              </span>
            </label>

            <!-- Escanear: cada lectura que coincide con un SKU suma una pieza -->
            <button type="button" class="stock-escanear" @click="alternarCamara">
              {{ escaneando ? '✕ Cerrar cámara' : '📷 Escanear código' }}
            </button>

            <div v-show="escaneando" class="stock-camara">
              <div :id="LECTOR_ID" class="stock-lector"></div>
              <p class="stock-ayuda">
                Apunta al código de cada pieza: si coincide con el SKU de una variante, se suma sola.
              </p>
            </div>

            <p v-if="avisoEscaneo" class="stock-aviso" :class="avisoEscaneo.tipo">
              {{ avisoEscaneo.texto }}
            </p>
          </template>
        </div>

        <footer class="stock-pie">
          <button type="button" class="stock-btn" :disabled="guardando" @click="cerrar">Cancelar</button>
          <button
            v-if="variantes.length"
            type="button"
            class="stock-btn primario"
            :disabled="guardando || !hayCambios"
            @click="guardar"
          >
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Diálogo para resurtir: cuántas piezas quedan de cada variante.
 *
 * Es un componente y no un `Swal` con html porque la cámara necesita ciclo de
 * vida propio (arrancar al abrirla, detenerse al cerrar o al desmontar) y los
 * campos tienen que reaccionar a cada lectura. Con una cadena de html eso serían
 * manipulaciones del DOM a mano, imposibles de probar.
 *
 * Al escanear, el código se compara con el SKU de cada variante: si coincide,
 * suma una pieza a esa fila. Es el modo natural de contar inventario con el
 * teléfono, pieza por pieza, sin teclear.
 */
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import {
  variantesConStock,
  indicePorCodigo,
  normalizarStock,
  actualizarStockArticulo,
} from '@/composables/useArticulos';
import type { Producto } from '@/types/Producto';

const props = defineProps<{ articulo: Producto }>();
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'guardado'): void }>();

const LECTOR_ID = 'lector-stock';

const variantes = computed(() => variantesConStock(props.articulo));

/** Lo capturado, por índice de variante. Arranca con lo que hay registrado. */
const piezas = reactive<Record<number, number | string>>({});
variantes.value.forEach((v) => (piezas[v.indice] = v.stock));

const guardando = ref(false);
const escaneando = ref(false);
const ultimoSumado = ref<number | null>(null);
const avisoEscaneo = ref<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

/** Nada que guardar si no se movió ningún número */
const hayCambios = computed(() =>
  variantes.value.some((v) => String(piezas[v.indice]) !== String(v.stock)),
);

function sumar(indice: number, delta: number) {
  const actual = normalizarStock(piezas[indice]) ?? 0;
  piezas[indice] = Math.max(0, actual + delta);
}

let resaltado: ReturnType<typeof setTimeout> | undefined;
function avisar(tipo: 'ok' | 'error', texto: string, indice: number | null = null) {
  avisoEscaneo.value = { tipo, texto };
  ultimoSumado.value = indice;
  clearTimeout(resaltado);
  resaltado = setTimeout(() => {
    ultimoSumado.value = null;
    avisoEscaneo.value = null;
  }, 2500);
}

/** Una lectura de la cámara: suma una pieza si el código es de este artículo */
function alEscanear(codigo: string) {
  const indice = indicePorCodigo(variantes.value, codigo);
  if (indice === null) {
    avisar('error', `El código ${codigo} no es de este artículo`);
    return;
  }
  sumar(indice, 1);
  const v = variantes.value.find((x) => x.indice === indice)!;
  avisar('ok', `+1 ${v.etiqueta} · ahora ${piezas[indice]}`, indice);
}

/* ---------------- Cámara ---------------- */

let lector: any = null;

async function abrirCamara() {
  escaneando.value = true;
  await nextTick(); // el contenedor debe existir antes de arrancar
  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    lector = new Html5Qrcode(LECTOR_ID);
    await lector.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      // La cámara sigue encendida: contar inventario es escanear varias piezas seguidas
      (texto: string) => alEscanear(texto),
      () => {
        /* cada cuadro sin código llega aquí; no es un error que mostrar */
      },
    );
  } catch (e) {
    console.error('No se pudo abrir la cámara', e);
    escaneando.value = false;
    avisar('error', 'No se pudo abrir la cámara. Revisa los permisos del navegador.');
  }
}

async function cerrarCamara() {
  escaneando.value = false;
  if (!lector) return;
  try {
    await lector.stop();
  } catch {
    // ya estaba detenida
  }
  lector = null;
}

function alternarCamara() {
  if (escaneando.value) void cerrarCamara();
  else void abrirCamara();
}

/* ---------------- Guardar y cerrar ---------------- */

async function guardar() {
  const capturado: Record<number, number> = {};
  for (const v of variantes.value) {
    const n = normalizarStock(piezas[v.indice]);
    if (n === null) {
      avisar('error', `Escribe un número entero de piezas en "${v.etiqueta}"`);
      return;
    }
    capturado[v.indice] = n;
  }

  guardando.value = true;
  try {
    await actualizarStockArticulo(props.articulo.articuloId, capturado);
    await cerrarCamara();
    emit('guardado');
  } catch (e: any) {
    avisar('error', e?.message || 'No se pudo guardar el stock');
  } finally {
    guardando.value = false;
  }
}

async function cerrar() {
  await cerrarCamara();
  emit('cerrar');
}

function alPulsarTecla(e: KeyboardEvent) {
  if (e.key === 'Escape') void cerrar();
}

onMounted(() => document.addEventListener('keydown', alPulsarTecla));
onUnmounted(() => {
  document.removeEventListener('keydown', alPulsarTecla);
  clearTimeout(resaltado);
  void cerrarCamara(); // la cámara nunca debe quedarse encendida
});
</script>

<style scoped>
.stock-fondo {
  position: fixed;
  inset: 0;
  /* Por encima del panel de la campana, que usa 5000: al abrir este diálogo el
     panel se cierra, pero su transición de salida dura 0.18 s y con un z-index
     menor se pintaba encima —parecía que el aviso nunca se iba—. */
  z-index: 5200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}
.stock-panel {
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  color: var(--text);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
}
@media (min-width: 700px) {
  .stock-fondo {
    align-items: center;
  }
  .stock-panel {
    border-radius: 18px;
  }
}

.stock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.stock-titulo {
  margin: 0;
  font-size: 1.05rem;
}
.stock-sub {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.stock-cerrar {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.stock-cuerpo {
  padding: 0.85rem 1rem;
  overflow-y: auto;
}
.stock-vacio {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.stock-fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem;
  border-radius: 10px;
  transition: background 0.3s;
}
.stock-fila.resaltada {
  background: #e8f5e9;
}
.stock-etiqueta {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}
.stock-sku {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-style: normal;
}
.stock-controles {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.stock-paso {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.stock-input {
  width: 4.5rem;
  height: 2rem;
  text-align: center;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.stock-escanear {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.6rem;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--brand-blue-text);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.stock-camara {
  margin-top: 0.6rem;
}
.stock-lector {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
}
.stock-ayuda {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: center;
}
/* Verde y rojo fijos: se leen igual en claro y en oscuro, como los badges */
.stock-aviso {
  margin: 0.6rem 0 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  font-size: 0.85rem;
  text-align: center;
}
.stock-aviso.ok {
  background: #e8f5e9;
  color: #1b5e20;
}
.stock-aviso.error {
  background: #ffebee;
  color: #b71c1c;
}

.stock-pie {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem 1rem 1rem;
  border-top: 1px solid var(--border);
}
.stock-btn {
  padding: 0.55rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
}
.stock-btn.primario {
  border-color: transparent;
  background: #0165d8;
  color: #fff;
  font-weight: 600;
}
.stock-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
