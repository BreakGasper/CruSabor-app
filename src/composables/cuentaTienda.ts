import { db } from '@/firebase';
import { ref as dbRef, get, query, orderByChild, equalTo } from '@/services/baseDatos';
import { validatePasswordHash } from '@/composables/usePassword';
import type { Tienda } from '@/composables/useTiendas';

/**
 * Varias tiendas con un mismo celular ("cuenta" de tienda).
 *
 * Un número de celular puede tener hasta MAX_TIENDAS_POR_TELEFONO tiendas, todas
 * con la MISMA contraseña: celular + contraseña funcionan como una cuenta. No hay
 * nodo nuevo en la base; cada tienda sigue en `tiendas/{id}` con su `telefono` y
 * su `password` (hash), y la cuenta se arma buscando por teléfono.
 *
 * - Registro: con un número que ya tiene tiendas se exige la contraseña de ellas
 *   (así no se puede "colgar" una tienda del número de otra persona) y se respeta
 *   el máximo.
 * - Login: entran las tiendas de ese número cuya contraseña coincide; si son
 *   varias, se elige cuál administrar.
 * - Sesión (`localStorage.tiendas`): la tienda activa + `cuenta`, la lista de
 *   tiendas que se pueden cambiar sin volver a escribir la contraseña.
 */

export const MAX_TIENDAS_POR_TELEFONO = 3;

export type TiendaDeCuenta = Tienda & { id: string };
export interface TiendaEnCuenta {
  id: string;
  nombreTienda: string;
  logoUrl?: string;
}

const soloDigitos = (t: unknown) => String(t ?? '').replace(/\D/g, '');

/** Todas las tiendas registradas con ese celular */
export async function tiendasDelTelefono(telefono: string): Promise<TiendaDeCuenta[]> {
  const tel = soloDigitos(telefono);
  if (!tel) return [];
  const snap = await get(query(dbRef(db, 'tiendas'), orderByChild('telefono'), equalTo(tel)));
  if (!snap.exists()) return [];
  return Object.entries<any>(snap.val() || {})
    .filter(([, t]) => t && typeof t === 'object')
    .map(([id, t]) => ({ ...(t as Tienda), id, tiendaId: id }));
}

/** Las tiendas de ese celular que abre esta contraseña */
export async function tiendasConPassword(telefono: string, password: string): Promise<TiendaDeCuenta[]> {
  const todas = await tiendasDelTelefono(telefono);
  const validas: TiendaDeCuenta[] = [];
  for (const t of todas) {
    if (t.password && (await validatePasswordHash(password, t.password))) validas.push(t);
  }
  return validas;
}

/**
 * ¿Se puede registrar una tienda nueva con este celular y contraseña?
 *  - 'libre':    el número no tiene tiendas
 *  - 'agregar':  ya tiene tiendas, la contraseña coincide y hay lugar
 *  - 'limite':   ya tiene el máximo de tiendas
 *  - 'password': ya tiene tiendas y la contraseña no es la de ellas
 */
export type RevisionTelefono = 'libre' | 'agregar' | 'limite' | 'password';

export async function revisarTelefonoNuevaTienda(telefono: string, password: string): Promise<RevisionTelefono> {
  const tiendas = await tiendasDelTelefono(telefono);
  if (!tiendas.length) return 'libre';
  if (tiendas.length >= MAX_TIENDAS_POR_TELEFONO) return 'limite';
  for (const t of tiendas) {
    if (t.password && (await validatePasswordHash(password, t.password))) return 'agregar';
  }
  return 'password';
}

export const MENSAJE_LIMITE_TIENDAS = `Este número ya tiene ${MAX_TIENDAS_POR_TELEFONO} tiendas, el máximo permitido.`;
export const MENSAJE_PASSWORD_CUENTA =
  'Este número ya tiene una tienda. Para agregar otra usa la misma contraseña (paso 1), así las administras juntas.';

/* ---------------- Sesión de tienda (localStorage "tiendas") ---------------- */

export interface SesionTienda {
  id: string;
  nombre: string;
  nombreTienda: string;
  telefono: string;
  email?: string;
  domicilio?: string;
  colonia?: string;
  municipio?: string;
  codigpostal?: string;
  estado?: string;
  /** Tiendas de la misma cuenta entre las que se puede cambiar (incluye la activa) */
  cuenta: TiendaEnCuenta[];
}

const CLAVE = 'tiendas';

export const resumenTienda = (t: TiendaDeCuenta): TiendaEnCuenta => ({
  id: t.id,
  nombreTienda: t.nombreTienda || 'Mi tienda',
  logoUrl: t.logoUrl || undefined,
});

export function sesionDeTienda(t: TiendaDeCuenta, cuenta: TiendaEnCuenta[]): SesionTienda {
  return {
    id: t.id,
    nombre: t.nombreTienda,
    nombreTienda: t.nombreTienda,
    telefono: t.telefono,
    email: t.email,
    domicilio: t.calle,
    colonia: t.colonia,
    municipio: t.municipio,
    codigpostal: t.cp,
    estado: t.estado,
    cuenta: cuenta.length ? cuenta : [resumenTienda(t)],
  };
}

export function guardarSesionTienda(sesion: SesionTienda) {
  localStorage.setItem(CLAVE, JSON.stringify(sesion));
}

export function leerSesionTienda(): SesionTienda | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!s?.id) return null;
    // Sesiones de antes de las cuentas: solo conocen su propia tienda
    const cuenta = Array.isArray(s.cuenta) && s.cuenta.length ? s.cuenta : [{ id: s.id, nombreTienda: s.nombreTienda || s.nombre || 'Mi tienda' }];
    return { ...s, cuenta };
  } catch {
    return null;
  }
}

/**
 * Cambia la tienda activa a otra de la misma cuenta. Solo acepta tiendas que ya
 * están en `cuenta` (las que abrió la contraseña al entrar) y que siguen teniendo
 * el mismo celular.
 */
export async function cambiarTiendaActiva(id: string): Promise<SesionTienda> {
  const actual = leerSesionTienda();
  if (!actual) throw new Error('No hay sesión de tienda.');
  if (!actual.cuenta.some((t) => t.id === id)) throw new Error('Esa tienda no es de tu cuenta.');
  const snap = await get(dbRef(db, `tiendas/${id}`));
  const t = snap.val();
  if (!t || soloDigitos(t.telefono) !== soloDigitos(actual.telefono)) {
    throw new Error('Esa tienda ya no está registrada con tu número. Vuelve a iniciar sesión.');
  }
  const tienda = { ...(t as Tienda), id, tiendaId: id };
  const cuenta = actual.cuenta.map((c) => (c.id === id ? resumenTienda(tienda) : c));
  const nueva = sesionDeTienda(tienda, cuenta);
  guardarSesionTienda(nueva);
  return nueva;
}
