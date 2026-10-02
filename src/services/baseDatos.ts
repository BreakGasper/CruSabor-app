/**
 * Mismo API que `firebase/database`, con un agregado: las operaciones que arrancan
 * justo después de un toque del usuario se cuentan para el indicador de carga
 * (ver services/carga.ts). Todo lo demás pasa tal cual.
 *
 * La app importa de aquí en lugar de 'firebase/database'. Excepción a propósito:
 * db/sync.ts (respaldo del carrito en segundo plano), que nunca debe tapar la pantalla.
 */
import {
  get as fbGet,
  set as fbSet,
  update as fbUpdate,
  remove as fbRemove,
  push as fbPush,
  runTransaction as fbRunTransaction,
  onValue as fbOnValue,
} from 'firebase/database';
import { enInteraccion, iniciarOperacion, rastrearSiInteraccion } from './carga';

export * from 'firebase/database';

export const get: typeof fbGet = (query) => rastrearSiInteraccion(fbGet(query)) as ReturnType<typeof fbGet>;

export const set: typeof fbSet = (ref, value) => rastrearSiInteraccion(fbSet(ref, value)) as ReturnType<typeof fbSet>;

export const update: typeof fbUpdate = (ref, values) =>
  rastrearSiInteraccion(fbUpdate(ref, values)) as ReturnType<typeof fbUpdate>;

export const remove: typeof fbRemove = (ref) => rastrearSiInteraccion(fbRemove(ref)) as ReturnType<typeof fbRemove>;

export const runTransaction: typeof fbRunTransaction = (ref, fn, options) =>
  rastrearSiInteraccion(fbRunTransaction(ref, fn, options)) as ReturnType<typeof fbRunTransaction>;

/** push devuelve una referencia que además es "promesa": se rastrea sin cambiar lo que devuelve */
export const push: typeof fbPush = (parent, value) => {
  const r = value === undefined ? fbPush(parent) : fbPush(parent, value);
  if (value !== undefined && enInteraccion()) {
    const terminar = iniciarOperacion();
    Promise.resolve(r).then(terminar, terminar);
  }
  return r;
};

/**
 * onValue: si se abre justo después de un toque (p. ej. al entrar a una lista),
 * cuenta como pendiente hasta que llega la primera respuesta, falla o se cierra.
 * Las actualizaciones posteriores en vivo no cuentan.
 */
export const onValue = ((query: any, callback: any, a?: any, b?: any) => {
  if (!enInteraccion()) return (fbOnValue as any)(query, callback, a, b);
  const terminar = iniciarOperacion();
  const cb = (snap: any) => {
    terminar();
    return callback(snap);
  };
  const conCancel = typeof a === 'function';
  const cancel = conCancel
    ? (err: Error) => {
        terminar();
        return a(err);
      }
    : undefined;
  const off = conCancel ? (fbOnValue as any)(query, cb, cancel, b) : (fbOnValue as any)(query, cb, a);
  return () => {
    terminar();
    off?.();
  };
}) as typeof fbOnValue;
