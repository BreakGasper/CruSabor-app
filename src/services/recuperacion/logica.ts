/**
 * Reglas puras del recuperar contraseña. Sin red ni estado: se pueden probar solas.
 *
 * El servidor genera el código, lo guarda (hasheado) con caducidad y cuenta los
 * intentos; el navegador nunca lo conoce ni lo valida. Ver router.ts.
 */
import { randomInt } from 'node:crypto';

export const MINUTOS_VIGENCIA = 10;
export const MAX_INTENTOS = 5;
export const LARGO_CODIGO = 4;

export const soloDigitos = (s: unknown): string => String(s ?? '').replace(/\D/g, '');

/** Código numérico de LARGO_CODIGO dígitos, con aleatoriedad criptográfica */
export function generarCodigo(largo = LARGO_CODIGO): string {
  const min = 10 ** (largo - 1);
  const max = 10 ** largo; // exclusivo
  return String(randomInt(min, max));
}

/** Datos que el servidor guarda mientras la solicitud está viva (el código va HASHEADO) */
export interface SolicitudRecuperacion {
  codigoHash: string;
  userId: string;
  email: string;
  expiraMs: number;
  intentos: number;
}

/** Momento de caducidad de una solicitud creada ahora */
export const expiraEn = (ahoraMs: number): number => ahoraMs + MINUTOS_VIGENCIA * 60_000;

export type EstadoCodigo = 'ok' | 'sin-solicitud' | 'expirado' | 'bloqueado' | 'incorrecto';

/**
 * Evalúa una solicitud contra un código. `coincide` lo calcula quien llama con bcrypt
 * (async), pero la decisión —caducidad, intentos, orden— es pura y vive aquí.
 */
export function evaluarCodigo(
  sol: SolicitudRecuperacion | undefined | null,
  coincide: boolean,
  ahoraMs: number,
): EstadoCodigo {
  if (!sol) return 'sin-solicitud';
  if (ahoraMs > sol.expiraMs) return 'expirado';
  if (sol.intentos >= MAX_INTENTOS) return 'bloqueado';
  return coincide ? 'ok' : 'incorrecto';
}

export const MENSAJE_ESTADO: Record<Exclude<EstadoCodigo, 'ok'>, string> = {
  'sin-solicitud': 'No hay una solicitud activa. Pide un código nuevo.',
  expirado: 'El código venció. Pide uno nuevo.',
  bloqueado: 'Demasiados intentos. Pide un código nuevo.',
  incorrecto: 'Código incorrecto.',
};

/**
 * Valida la contraseña nueva. Devuelve el error o null si es válida.
 *
 * Los mismos topes que los formularios (ver PASSWORD_MIN/MAX en usePassword.ts),
 * repetidos aquí a propósito: esto corre en el servidor, que no comparte código
 * con la app y es el único que decide qué se guarda. Si cambian allá, cambian aquí.
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 10;

export function validarPassword(p: unknown): string | null {
  const s = String(p ?? '');
  if (s.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (s.length > PASSWORD_MAX) return `La contraseña no puede pasar de ${PASSWORD_MAX} caracteres`;
  return null;
}

/** Oculta el correo para mostrarlo sin exponerlo: b***@gmail.com */
export function ocultarCorreo(email: string): string {
  const [usuario, dominio] = String(email || '').split('@');
  if (!dominio) return '';
  const visible = usuario.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(2, usuario.length - 1))}@${dominio}`;
}
