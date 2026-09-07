import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, push, set, update, onValue, type Unsubscribe } from 'firebase/database';
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
  creadoPor?: string;
}): Promise<string> {
  const telefono = soloDigitos(datos.telefono);
  if (!datos.nombre || datos.nombre.trim().length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
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
    ...(datos.creadoPor ? { creadoPor: datos.creadoPor } : {}),
  });
  return nuevoRef.key!;
}

/* =========================================================================
 *  GESTIÓN DE CUENTAS (vista /admin/cuentas)
 * ========================================================================= */

export const ROL_LABEL: Record<RolAdmin, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
};

/**
 * Regla pura: ¿puede `quien` cambiar la cuenta `objetivo` a `cambios`?
 *  - Solo un superadmin gestiona cuentas.
 *  - Nadie se desactiva ni se quita el rol de superadmin a sí mismo.
 *  - Siempre debe quedar al menos un superadmin activo.
 * Devuelve el motivo del bloqueo o null si se permite.
 */
export function motivoBloqueoCambio(
  quien: Pick<Admin, 'id' | 'rol'> | null | undefined,
  objetivo: Admin,
  cambios: Partial<Pick<Admin, 'rol' | 'activo'>>,
  todos: Admin[],
): string | null {
  if (!quien || quien.rol !== 'superadmin') return 'Solo un superadministrador puede gestionar cuentas.';
  const esYo = quien.id === objetivo.id;
  if (esYo && cambios.activo === false) return 'No puedes desactivar tu propia cuenta.';
  if (esYo && cambios.rol && cambios.rol !== 'superadmin') return 'No puedes quitarte el rol de superadministrador.';
  const despues = todos.map((a) => (a.id === objetivo.id ? { ...a, ...cambios } : a));
  if (!despues.some((a) => a.rol === 'superadmin' && a.activo !== false)) return 'Debe quedar al menos un superadministrador activo.';
  return null;
}

/** Cambia nombre, rol o activo de una cuenta */
export async function actualizarAdmin(id: string, cambios: Partial<Pick<Admin, 'nombre' | 'rol' | 'activo'>>) {
  const limpio: Record<string, any> = {};
  if (cambios.nombre !== undefined) {
    if (cambios.nombre.trim().length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
    limpio.nombre = cambios.nombre.trim();
  }
  if (cambios.rol !== undefined) limpio.rol = cambios.rol;
  if (cambios.activo !== undefined) limpio.activo = cambios.activo;
  if (!Object.keys(limpio).length) return;
  limpio.actualizadoEn = new Date().toISOString();
  await update(dbRef(db, `admins/${id}`), limpio);
}

/** Asigna una contraseña nueva (hash) a una cuenta */
export async function cambiarPasswordAdmin(id: string, nueva: string) {
  if (!nueva || nueva.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  await update(dbRef(db, `admins/${id}`), { password: await hashPassword(nueva), passwordCambiadaEn: new Date().toISOString() });
}

/** Lista de administradores en vivo (sin la contraseña) */
export function useAdminsEnVivo(): { admins: Ref<Admin[]>; cargando: Ref<boolean> } {
  const admins = ref<Admin[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    off = onValue(dbRef(db, 'admins'), (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      admins.value = Object.entries(data)
        .map(([id, a]) => {
          const { password: _p, ...resto } = a;
          return { ...(resto as Omit<Admin, 'id'>), id, activo: a.activo !== false };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { admins, cargando };
}
