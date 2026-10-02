/**
 * Indicador global de carga ("cargando con el logo").
 *
 * Idea: después de que el usuario toca algo (botón, enlace, enviar un formulario),
 * las lecturas y escrituras a la base y las llamadas al servidor que arranquen en
 * ese momento se cuentan como "pendientes". Si siguen pendientes más de RETRASO_MS,
 * aparece CargandoCrustore.vue; si terminan antes, no se ve nada (no parpadea en
 * lo que es rápido). Lo que corre solo en segundo plano (respaldos, listeners que
 * ya estaban abiertos) no cuenta, para no tapar la pantalla sin que nadie lo pidiera.
 *
 * Fuentes que se rastrean:
 *  - src/services/baseDatos.ts: get/set/update/remove/push/runTransaction y la
 *    primera respuesta de onValue (envoltorio de firebase/database).
 *  - fetch del navegador (servidor de Render, Cloudinary): instalarCarga().
 *  - Cualquier tarea a mano: conCarga(promesa), que siempre cuenta.
 *
 * Nunca se queda pegado: cada operación se suelta sola a los TOPE_MS.
 */
import { ref, readonly } from 'vue';

/** Tiempo que debe tardar algo antes de mostrar el indicador */
export const RETRASO_MS = 450;
/** Una vez visible, se queda al menos esto (evita un destello de un instante) */
export const MINIMO_VISIBLE_MS = 400;
/** Lo que arranca dentro de esta ventana después de un toque cuenta como "lo pidió el usuario" */
export const VENTANA_INTERACCION_MS = 1500;
/** A partir de aquí se avisa que está tardando más de lo normal */
export const LENTO_MS = 8000;
/** Ninguna operación cuenta más de esto, pase lo que pase */
export const TOPE_MS = 45000;

const pendientes = ref(0);
const visible = ref(false);
const lento = ref(false);

let ultimaInteraccion = Number.NEGATIVE_INFINITY;
let timerMostrar: ReturnType<typeof setTimeout> | null = null;
let timerLento: ReturnType<typeof setTimeout> | null = null;
let timerOcultar: ReturnType<typeof setTimeout> | null = null;
let visibleDesde = 0;

/** Estado de solo lectura para la vista */
export const estadoCarga = {
  pendientes: readonly(pendientes),
  visible: readonly(visible),
  lento: readonly(lento),
};

/** Registra un toque del usuario (lo llama el listener global de instalarCarga) */
export function marcarInteraccion(ahora = Date.now()) {
  ultimaInteraccion = ahora;
}

/** ¿Lo que arranca ahora viene de un toque reciente? */
export function enInteraccion(ahora = Date.now()) {
  return ahora - ultimaInteraccion <= VENTANA_INTERACCION_MS;
}

function limpiar(t: ReturnType<typeof setTimeout> | null) {
  if (t) clearTimeout(t);
  return null;
}

function alSubir() {
  timerOcultar = limpiar(timerOcultar);
  if (visible.value || timerMostrar) return;
  timerMostrar = setTimeout(() => {
    timerMostrar = null;
    if (pendientes.value > 0) {
      visible.value = true;
      visibleDesde = Date.now();
      timerLento = setTimeout(() => (lento.value = true), LENTO_MS - RETRASO_MS);
    }
  }, RETRASO_MS);
}

function alBajar() {
  if (pendientes.value > 0) return;
  timerMostrar = limpiar(timerMostrar);
  if (!visible.value) return;
  const resta = Math.max(0, MINIMO_VISIBLE_MS - (Date.now() - visibleDesde));
  timerOcultar = limpiar(timerOcultar);
  timerOcultar = setTimeout(() => {
    timerOcultar = null;
    if (pendientes.value === 0) ocultar();
  }, resta);
}

function ocultar() {
  visible.value = false;
  lento.value = false;
  timerLento = limpiar(timerLento);
}

/**
 * Empieza una operación pendiente y devuelve la función que la termina.
 * La función se puede llamar varias veces (solo cuenta la primera).
 */
export function iniciarOperacion(): () => void {
  pendientes.value++;
  alSubir();
  let suelta = false;
  const tope = setTimeout(() => terminar(), TOPE_MS);
  function terminar() {
    if (suelta) return;
    suelta = true;
    clearTimeout(tope);
    pendientes.value = Math.max(0, pendientes.value - 1);
    alBajar();
  }
  return terminar;
}

/** Cuenta una promesa como pendiente hasta que se resuelva o falle. Devuelve la misma promesa. */
export function rastrear<T>(promesa: PromiseLike<T>): PromiseLike<T> {
  const terminar = iniciarOperacion();
  Promise.resolve(promesa).then(terminar, terminar);
  return promesa;
}

/** Como rastrear, pero solo si viene de un toque reciente del usuario */
export function rastrearSiInteraccion<T>(promesa: PromiseLike<T>): PromiseLike<T> {
  return enInteraccion() ? rastrear(promesa) : promesa;
}

/** Para envolver a mano una tarea que siempre debe mostrar el indicador si tarda */
export async function conCarga<T>(tarea: Promise<T> | (() => Promise<T>)): Promise<T> {
  const terminar = iniciarOperacion();
  try {
    return await (typeof tarea === 'function' ? tarea() : tarea);
  } finally {
    terminar();
  }
}

/** Botón "Ocultar" del indicador: lo esconde, aunque lo pendiente siga corriendo */
export function ocultarIndicador() {
  timerMostrar = limpiar(timerMostrar);
  ocultar();
}

let instalado = false;
/**
 * Escucha los toques del usuario y rastrea fetch. Se llama una vez en main.ts
 * (no en pruebas, que no tienen navegador real).
 */
export function instalarCarga() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  const marcar = () => marcarInteraccion();
  document.addEventListener('click', marcar, true);
  document.addEventListener('submit', marcar, true);
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') marcar();
    },
    true,
  );
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = ((...args: Parameters<typeof fetch>) =>
    rastrearSiInteraccion(fetchOriginal(...args))) as typeof fetch;
}

/** Solo para pruebas */
export function __resetCarga() {
  timerMostrar = limpiar(timerMostrar);
  timerLento = limpiar(timerLento);
  timerOcultar = limpiar(timerOcultar);
  pendientes.value = 0;
  visible.value = false;
  lento.value = false;
  ultimaInteraccion = Number.NEGATIVE_INFINITY;
}
