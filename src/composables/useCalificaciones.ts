import { ref, computed, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, set, remove } from 'firebase/database';
import { sessionUser, sessionUsuarioValidation } from '@/utils/sessionUser';

/**
 * Calificación con estrellas (1 a 5) de artículos y tiendas, por cliente.
 *
 *   calificaciones/{tipo}/{id}/{usuarioId} = { estrellas, fecha }
 *
 * Cada cliente tiene un voto por artículo o tienda; volver a calificar lo reemplaza.
 * El promedio y el total se calculan al leer (no se guarda un acumulado que pueda
 * desincronizarse). Todo el nodo de cada tipo se escucha en vivo una sola vez y lo
 * comparten todas las pantallas, igual que el mapa de tiendas.
 */
export type TipoCalificable = 'articulos' | 'tiendas';

export interface Voto {
  estrellas: number;
  fecha: string;
}

export interface ResumenCalificacion {
  /** Promedio redondeado a un decimal (0 si nadie ha votado) */
  promedio: number;
  total: number;
}

export const ESTRELLAS_MAX = 5;

type Votos = Record<string, Record<string, Voto>>; // id -> usuarioId -> voto

const votosPorTipo: Record<TipoCalificable, Ref<Votos>> = {
  articulos: ref<Votos>({}),
  tiendas: ref<Votos>({}),
};
const suscrito: Record<TipoCalificable, boolean> = { articulos: false, tiendas: false };

function asegurarSuscripcion(tipo: TipoCalificable) {
  if (suscrito[tipo]) return;
  suscrito[tipo] = true;
  onValue(dbRef(db, `calificaciones/${tipo}`), (snap) => {
    votosPorTipo[tipo].value = (snap.val() as Votos) || {};
  });
}

/** Solo para pruebas: fija los votos sin Firebase (null vuelve a suscribirse) */
export function __setVotos(tipo: TipoCalificable, votos: Votos | null) {
  suscrito[tipo] = votos !== null;
  votosPorTipo[tipo].value = votos || {};
}

/** Promedio y total a partir de los votos de un artículo o tienda */
export function resumirVotos(votos: Record<string, Voto> | null | undefined): ResumenCalificacion {
  const valores = Object.values(votos || {})
    .map((v) => Number(v?.estrellas))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= ESTRELLAS_MAX);
  if (!valores.length) return { promedio: 0, total: 0 };
  const suma = valores.reduce((a, b) => a + b, 0);
  return { promedio: Math.round((suma / valores.length) * 10) / 10, total: valores.length };
}

export function useCalificaciones(tipo: TipoCalificable) {
  asegurarSuscripcion(tipo);
  const votos = votosPorTipo[tipo];

  const resumenDe = (id?: string | null): ResumenCalificacion => resumirVotos(id ? votos.value[id] : null);

  /** Estrellas que dio el cliente en sesión (0 si no ha votado o no hay sesión) */
  const miVoto = (id?: string | null): number => {
    const uid = sessionUser.value?.id;
    if (!id || !uid) return 0;
    return Number(votos.value[id]?.[uid]?.estrellas) || 0;
  };

  /**
   * Guarda (o reemplaza) el voto del cliente en sesión. Devuelve false si no hay sesión
   * de cliente, para que la pantalla mande al login.
   */
  const calificar = async (id: string, estrellas: number): Promise<boolean> => {
    if (!sessionUsuarioValidation() || !sessionUser.value?.id) return false;
    const n = Math.min(ESTRELLAS_MAX, Math.max(1, Math.round(estrellas)));
    await set(dbRef(db, `calificaciones/${tipo}/${id}/${sessionUser.value.id}`), {
      estrellas: n,
      fecha: new Date().toISOString(),
    });
    return true;
  };

  /** Quita el voto del cliente en sesión */
  const quitarVoto = async (id: string) => {
    if (!sessionUser.value?.id) return;
    await remove(dbRef(db, `calificaciones/${tipo}/${id}/${sessionUser.value.id}`));
  };

  const cargado = computed(() => suscrito[tipo]);

  return { votos, resumenDe, miVoto, calificar, quitarVoto, cargado };
}
