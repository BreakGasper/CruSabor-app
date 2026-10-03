import { computed, ref, watch } from 'vue';
import { DIAS_SEMANA } from './useHorarioTienda';

/**
 * Captura rápida del horario de una tienda (registro y edición del perfil).
 *
 * La mayoría abre de lunes a viernes a la misma hora, así que hay dos casillas:
 *  - "Mismo horario de lunes a viernes": se captura una sola fila (la del lunes)
 *    y se copia de martes a viernes.
 *  - "Sábado y domingo con el mismo horario" (solo con la anterior marcada): copia
 *    también al fin de semana. Sin marcar, sábado y domingo se capturan a mano
 *    y vacíos cuentan como cerrado.
 *
 * El lunes es la referencia: al abrir el perfil, las casillas se marcan solas si
 * el horario guardado coincide con el del lunes. Se guarda igual que siempre:
 * una entrada por día, así que el resto de la app no cambia.
 */

export type HorarioEditable = Record<string, { inicio: string; fin: string }>;

export const ENTRE_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;
export const FIN_DE_SEMANA = ['Sábado', 'Domingo'] as const;
const REFERENCIA = 'Lunes';

const igual = (a?: { inicio: string; fin: string }, b?: { inicio: string; fin: string }) =>
  (a?.inicio || '') === (b?.inicio || '') && (a?.fin || '') === (b?.fin || '');

/** Casillas que corresponden a un horario ya guardado (o vacío, para una tienda nueva) */
export function detectarModo(h: HorarioEditable): { mismo: boolean; incluirFin: boolean } {
  const vacio = DIAS_SEMANA.every((d) => !h[d]?.inicio && !h[d]?.fin);
  // Tienda nueva: arranca en el modo rápido, que es el caso más común
  if (vacio) return { mismo: true, incluirFin: false };
  const lunes = h[REFERENCIA];
  const mismo = !!(lunes?.inicio && lunes?.fin) && ENTRE_SEMANA.every((d) => igual(h[d], lunes));
  const incluirFin = mismo && FIN_DE_SEMANA.every((d) => igual(h[d], lunes));
  return { mismo, incluirFin };
}

/** Copia el horario del lunes a los días indicados (modifica `h`) */
export function copiarDelLunes(h: HorarioEditable, dias: readonly string[]) {
  const lunes = h[REFERENCIA] ?? { inicio: '', fin: '' };
  for (const d of dias) h[d] = { inicio: lunes.inicio, fin: lunes.fin };
}

/**
 * @param horario función que devuelve el objeto de horario del formulario (reactivo).
 *   Si el formulario lo reemplaza (p. ej. al abrir el perfil de otra tienda), las
 *   casillas se vuelven a calcular.
 */
export function useHorarioRapido(horario: () => HorarioEditable) {
  const inicial = detectarModo(horario());
  const mismoEntreSemana = ref(inicial.mismo);
  const incluirFinDeSemana = ref(inicial.incluirFin);

  watch(horario, (h) => {
    const m = detectarModo(h);
    mismoEntreSemana.value = m.mismo;
    incluirFinDeSemana.value = m.incluirFin;
  });

  // Mientras las casillas estén marcadas, lo que se escriba en la fila del lunes se copia
  watch(
    [mismoEntreSemana, incluirFinDeSemana, () => horario()[REFERENCIA]?.inicio, () => horario()[REFERENCIA]?.fin],
    () => {
      if (!mismoEntreSemana.value) return;
      const h = horario();
      copiarDelLunes(h, ENTRE_SEMANA.slice(1));
      if (incluirFinDeSemana.value) copiarDelLunes(h, FIN_DE_SEMANA);
    },
    { immediate: true },
  );

  /** Al desmarcar "lunes a viernes" los días quedan con lo copiado para ajustarlos uno por uno */
  function alCambiarMismo() {
    if (!mismoEntreSemana.value && incluirFinDeSemana.value) incluirFinDeSemana.value = false;
  }

  /** Al desmarcar el fin de semana, sábado y domingo quedan cerrados hasta que se capturen a mano */
  function alCambiarFinDeSemana() {
    if (!incluirFinDeSemana.value) {
      const h = horario();
      for (const d of FIN_DE_SEMANA) h[d] = { inicio: '', fin: '' };
    }
  }

  /** Filas que se muestran: con el modo rápido, el lunes representa a los días agrupados */
  const diasVisibles = computed<string[]>(() => {
    if (!mismoEntreSemana.value) return [...DIAS_SEMANA];
    return incluirFinDeSemana.value ? [REFERENCIA] : [REFERENCIA, ...FIN_DE_SEMANA];
  });

  function etiquetaDia(dia: string): string {
    if (dia !== REFERENCIA || !mismoEntreSemana.value) return dia;
    return incluirFinDeSemana.value ? 'Lunes a domingo' : 'Lunes a viernes';
  }

  return { mismoEntreSemana, incluirFinDeSemana, alCambiarMismo, alCambiarFinDeSemana, diasVisibles, etiquetaDia };
}
