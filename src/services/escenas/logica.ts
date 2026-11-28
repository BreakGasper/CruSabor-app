/**
 * Escenas de fondo con IA para las publicaciones: reglas puras (sin red), para poder probarlas.
 *
 * La IA solo inventa el FONDO a partir de un texto; el producto de la tienda se pega encima en la app, así que
 * nunca sale distinto del real. Por eso el texto se completa aquí con instrucciones fijas: sin gente, sin letras
 * y con espacio libre al centro.
 */

export const MAX_DESCRIPCION = 200;
export const MODELO_ESCENAS = '@cf/black-forest-labs/flux-1-schnell';

const SUFIJO =
  'professional product photography background, empty surface in the center for placing a product, soft natural lighting, shallow depth of field, no people, no hands, no text, no letters, no logos, no watermark';

/** Texto limpio de la descripción, o null si no sirve */
export function limpiarDescripcion(v: unknown): string | null {
  const t = String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 3 || t.length > MAX_DESCRIPCION) return null;
  return t;
}

/** El prompt que recibe el modelo: lo que pidió la persona + las reglas fijas */
export const promptDeEscena = (descripcion: string) => `${descripcion}, ${SUFIJO}`;

export interface ConfigEscenas {
  cuenta: string;
  token: string;
  /** Imágenes máximas por día en todo el servidor (protege la cuota gratuita) */
  maxDia: number;
  /** Imágenes máximas por hora para una misma persona (IP) */
  maxPorHoraPorIp: number;
}

export function configDesdeEntorno(env: NodeJS.ProcessEnv): ConfigEscenas | null {
  const cuenta = (env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  const token = (env.CLOUDFLARE_API_TOKEN ?? '').trim();
  if (!cuenta || !token) return null;
  const num = (v: string | undefined, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
  };
  return { cuenta, token, maxDia: num(env.ESCENAS_MAX_DIA, 300), maxPorHoraPorIp: num(env.ESCENAS_MAX_HORA_IP, 8) };
}

/** Cuenta de usos por día (global) y por hora (por IP). Se reinicia sola; vive en memoria. */
export function crearLimitador(ahora: () => Date = () => new Date()) {
  let dia = '';
  let total = 0;
  const porIp = new Map<string, number[]>();

  const hoy = () => ahora().toISOString().slice(0, 10);
  function alDia() {
    if (dia !== hoy()) {
      dia = hoy();
      total = 0;
      porIp.clear();
    }
  }

  return {
    /** ¿Se puede generar otra? Si sí, la cuenta. Si no, dice por qué. */
    intentar(ip: string, cfg: Pick<ConfigEscenas, 'maxDia' | 'maxPorHoraPorIp'>): { ok: true } | { ok: false; motivo: 'dia' | 'ip' } {
      alDia();
      if (total >= cfg.maxDia) return { ok: false, motivo: 'dia' };
      const desde = ahora().getTime() - 3_600_000;
      const usos = (porIp.get(ip) ?? []).filter((t) => t > desde);
      if (usos.length >= cfg.maxPorHoraPorIp) {
        porIp.set(ip, usos);
        return { ok: false, motivo: 'ip' };
      }
      usos.push(ahora().getTime());
      porIp.set(ip, usos);
      total++;
      return { ok: true };
    },
    /** Devuelve el uso cuando la generación falló (no debe gastar el cupo) */
    devolver(ip: string) {
      alDia();
      total = Math.max(0, total - 1);
      const usos = porIp.get(ip);
      usos?.pop();
    },
    restantes(cfg: Pick<ConfigEscenas, 'maxDia'>) {
      alDia();
      return Math.max(0, cfg.maxDia - total);
    },
  };
}

/** data URL a partir del base64 que devuelve el modelo (JPEG o PNG según sus primeros bytes) */
export function dataUrlDeImagen(base64: string): string {
  const mime = base64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}
