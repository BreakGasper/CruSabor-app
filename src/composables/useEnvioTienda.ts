import { ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue } from 'firebase/database';

/**
 * Regla de negocio: solo se pueden agregar al carrito productos de tiendas
 * que hacen envío a domicilio (`tiendas/{id}/envioDomicilio === true`),
 * porque el cliente recibe el pedido en su casa.
 *
 * Mantiene un mapa compartido tiendaId -> envioDomicilio, cargado una sola vez
 * y actualizado en vivo, para que todas las pantallas consulten lo mismo.
 */
const envioPorTienda = ref<Record<string, boolean>>({});
const cargado = ref(false);
let suscrito = false;

export const MENSAJE_SIN_ENVIO =
  'Esta tienda no hace envíos a domicilio, por eso no se puede agregar al carrito.';

function asegurarSuscripcion() {
  if (suscrito) return;
  suscrito = true;
  onValue(dbRef(db, 'tiendas'), (snap) => {
    const data = snap.val() || {};
    const mapa: Record<string, boolean> = {};
    for (const id of Object.keys(data)) mapa[id] = data[id]?.envioDomicilio === true;
    envioPorTienda.value = mapa;
    cargado.value = true;
  });
}

/** Solo para pruebas: permite fijar el mapa sin Firebase */
export function __setEnvioPorTienda(mapa: Record<string, boolean> | null) {
  suscrito = mapa !== null;
  cargado.value = mapa !== null;
  envioPorTienda.value = mapa || {};
}

export function useEnvioTienda() {
  asegurarSuscripcion();

  /**
   * true  -> la tienda envía a domicilio
   * false -> no envía (bloquear carrito)
   * undefined -> aún no sabemos (tienda desconocida o datos sin cargar)
   */
  const permiteEnvio = (tiendaId?: string | null): boolean | undefined => {
    if (!tiendaId) return undefined;
    if (!(tiendaId in envioPorTienda.value)) return cargado.value ? undefined : undefined;
    return envioPorTienda.value[tiendaId];
  };

  /** Bloquea solo cuando sabemos con certeza que la tienda NO envía */
  const sinEnvio = (tiendaId?: string | null) => permiteEnvio(tiendaId) === false;

  return { envioPorTienda, cargado, permiteEnvio, sinEnvio };
}
