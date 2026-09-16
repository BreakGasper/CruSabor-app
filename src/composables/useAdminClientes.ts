import { db } from '@/firebase';
import { ref as dbRef, get, update } from 'firebase/database';
import { hashPassword } from '@/composables/usePassword';

/**
 * Soporte a clientes desde el panel de administración (`/admin/cuentas`, pestaña Clientes).
 * Permite buscar clientes de `usuarios/` y resolver problemas comunes: restablecer su
 * contraseña o corregir su nombre/correo. NO cambia el celular (es su usuario de acceso).
 */
export interface ClienteAdmin {
  id: string;
  nombre: string;
  celular: string;
  email: string;
}

const soloDigitos = (s: string) => String(s || '').replace(/\D/g, '');

/** Regla pura: filtra clientes por nombre, celular o correo (usada por la búsqueda) */
export function filtrarClientes(lista: ClienteAdmin[], query: string): ClienteAdmin[] {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return lista;
  const qDig = soloDigitos(q);
  return lista.filter(
    (c) =>
      c.nombre.toLowerCase().includes(q) ||
      (!!qDig && soloDigitos(c.celular).includes(qDig)) ||
      c.email.toLowerCase().includes(q),
  );
}

/** Busca clientes (por nombre, celular o correo). Devuelve hasta `limite` resultados. */
export async function buscarClientes(query: string, limite = 50): Promise<ClienteAdmin[]> {
  const snap = await get(dbRef(db, 'usuarios'));
  if (!snap.exists()) return [];
  const data = snap.val() as Record<string, any>;
  const lista: ClienteAdmin[] = Object.entries(data).map(([id, u]) => ({
    id,
    nombre: String(u?.nombre || ''),
    celular: String(u?.celular || ''),
    email: String(u?.email || ''),
  }));
  return filtrarClientes(lista, query)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite);
}

/** Restablece la contraseña de un cliente (se guarda como hash bcrypt) */
export async function restablecerPasswordCliente(id: string, nueva: string): Promise<void> {
  if (!nueva || nueva.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  await update(dbRef(db, `usuarios/${id}`), { pass: await hashPassword(nueva) });
}

/** Corrige el nombre y/o correo de un cliente (no toca el celular ni la contraseña) */
export async function actualizarClienteAdmin(
  id: string,
  cambios: { nombre?: string; email?: string },
): Promise<void> {
  const limpio: Record<string, any> = {};
  if (cambios.nombre !== undefined) {
    if (cambios.nombre.trim().length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
    limpio.nombre = cambios.nombre.trim();
  }
  if (cambios.email !== undefined) {
    const email = cambios.email.trim();
    if (email && !/\S+@\S+\.\S+/.test(email)) throw new Error('Correo inválido');
    limpio.email = email;
  }
  if (Object.keys(limpio).length) await update(dbRef(db, `usuarios/${id}`), limpio);
}
