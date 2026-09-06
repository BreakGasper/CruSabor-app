import { db } from '@/firebase';
import { ref as dbRef, get, push, set, update } from 'firebase/database';
import { hashPassword, validatePasswordHash } from '@/composables/usePassword';

/**
 * Administradores del sistema. Viven en `admins/{id}` y entran con celular y
 * contraseña (hash bcrypt), igual que clientes y tiendas.
 *
 *   admins/{id}: { nombre, telefono, password(hash), rol, activo, creadoEn, ultimoAcceso }
 *
 * El primer administrador se crea con `node scripts/crear-admin.mjs`.
 */

export type RolAdmin = 'superadmin' | 'admin';

export interface Admin {
  id: string;
  nombre: string;
  telefono: string; // 10 dígitos, sin guiones
  password?: string; // hash
  rol: RolAdmin;
  activo: boolean;
  creadoEn?: string;
  ultimoAcceso?: string;
}

export type ResultadoLoginAdmin =
  | { ok: true; admin: Admin }
  | { ok: false; motivo: 'no-encontrado' | 'inactivo' | 'password' };

const soloDigitos = (s: string) => String(s || '').replace(/\D/g, '');

export async function findAdminByPhone(telefono: string): Promise<Admin | null> {
  const tel = soloDigitos(telefono);
  if (!tel) return null;
  // Se lee el nodo completo y se filtra aquí: son pocos registros y así no hace falta
  // declarar ".indexOn": "telefono" en las reglas de la base (igual que con las tiendas).
  const snap = await get(dbRef(db, 'admins'));
  if (!snap.exists()) return null;
  const data = snap.val() as Record<string, any>;
  const entrada = Object.entries(data).find(([, a]) => soloDigitos(a?.telefono) === tel);
  if (!entrada) return null;
  const [id, a] = entrada;
  return { ...(a as Omit<Admin, 'id'>), id, activo: a.activo !== false };
}

/** Valida celular + contraseña. No lanza: regresa el motivo para mostrarlo. */
export async function loginAdmin(telefono: string, password: string): Promise<ResultadoLoginAdmin> {
  const admin = await findAdminByPhone(telefono);
  if (!admin) return { ok: false, motivo: 'no-encontrado' };
  if (!admin.activo) return { ok: false, motivo: 'inactivo' };
  const valida = await validatePasswordHash(password, admin.password || '');
  if (!valida) return { ok: false, motivo: 'password' };

  const ahora = new Date().toISOString();
  try {
    await update(dbRef(db, `admins/${admin.id}`), { ultimoAcceso: ahora });
  } catch (e) {
    console.warn('No se pudo registrar el último acceso del admin:', e);
  }
  const { password: _p, ...sinPassword } = admin;
  return { ok: true, admin: { ...sinPassword, ultimoAcceso: ahora } };
}

export async function telefonoAdminExiste(telefono: string): Promise<boolean> {
  return (await findAdminByPhone(telefono)) !== null;
}

/** Crea un administrador (la contraseña se guarda como hash). Devuelve su id. */
export async function crearAdmin(datos: {
  nombre: string;
  telefono: string;
  password: string;
  rol?: RolAdmin;
}): Promise<string> {
  const telefono = soloDigitos(datos.telefono);
  if (telefono.length !== 10) throw new Error('El celular debe tener 10 dígitos');
  if (!datos.password || datos.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  if (await telefonoAdminExiste(telefono)) throw new Error('Ya existe un administrador con ese celular');

  const nuevoRef = push(dbRef(db, 'admins'));
  await set(nuevoRef, {
    nombre: datos.nombre.trim(),
    telefono,
    password: await hashPassword(datos.password),
    rol: datos.rol ?? 'admin',
    activo: true,
    creadoEn: new Date().toISOString(),
  });
  return nuevoRef.key!;
}
