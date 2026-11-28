import { sessionUser } from '@/utils/sessionUser';

/**
 * Quién es quién en las pantallas de servicios. Crustore guarda la identidad en el navegador (no usa Firebase Auth):
 *  - la tienda en `localStorage.tiendas` (la misma sesión que ya usan StoreProfile, ProductForm…)
 *  - el cliente en `sessionUser`
 */

/** ¿Esta sesión de tienda es la dueña de `tiendaId`? */
export function esDuenoDeTienda(tiendaId?: string | null): boolean {
  if (!tiendaId) return false;
  try {
    return JSON.parse(localStorage.getItem('tiendas') || '{}')?.id === tiendaId;
  } catch {
    return false;
  }
}

/** Cliente con sesión (id, nombre y celular) o null */
export function clienteActual(): { id: string; nombre: string; telefono: string } | null {
  const u = sessionUser.value;
  return u?.id ? { id: String(u.id), nombre: String(u.nombre ?? ''), telefono: String(u.telefono ?? u.celular ?? '') } : null;
}
