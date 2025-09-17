// src/composables/usePassword.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

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
