// src/composables/usePassword.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Largo permitido de una contraseña, en un solo lugar.
 *
 * Vive aquí y no en cada pantalla porque los límites tienen que coincidir entre
 * crear la cuenta, cambiarla y recuperarla: si el registro admite 10 y el cambio
 * solo 8, alguien se queda sin poder volver a poner su propia contraseña.
 * Los formularios de acceso NO llevan tope: si mañana sube el máximo, quien ya
 * tenga una más larga debe poder seguir entrando.
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 10;

/** El error de longitud, o null si la contraseña sirve */
export function errorLongitudPassword(valor: unknown): string | null {
  const p = String(valor ?? '');
  if (p.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (p.length > PASSWORD_MAX) return `La contraseña no puede pasar de ${PASSWORD_MAX} caracteres`;
  return null;
}

/**
 * Encripta una contraseña en texto plano.
 * @param password Texto plano de la contraseña
 * @returns Contraseña encriptada
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Valida si una contraseña coincide con su hash.
 * @param password Texto plano de la contraseña
 * @param hash Hash almacenado
 * @returns true si coincide, false si no
 */
export async function validatePasswordHash(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
