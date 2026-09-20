import { createHash } from 'node:crypto';

/**
 * Borrar imágenes de Cloudinary: reglas puras.
 *
 * Al cambiar la foto de un artículo o el logo de una tienda se sube una nueva y
 * la anterior se quedaba en Cloudinary para siempre, sin que nada la referencie.
 * Esto permite quitarla.
 *
 * Tiene que correr en el SERVIDOR: el `upload_preset` sin firmar que usa la app
 * puede subir, pero borrar exige la `api_secret`, y esa no puede viajar en el
 * bundle —quien la leyera podría borrar las imágenes de todas las tiendas—.
 *
 * No hace falta guardar nada nuevo en la base: el identificador que Cloudinary
 * necesita (`public_id`) se saca de la propia URL que ya está guardada.
 */

/**
 * Saca el `public_id` de una URL de Cloudinary, o null si no lo es.
 *
 * Formato: .../image/upload/[transformaciones/][vNNN/]carpeta/nombre.ext
 * Se descartan las transformaciones y la versión; el resto, sin extensión, es
 * el identificador. Las carpetas sí cuentan: "tiendas/logo" no es "logo".
 *
 * @example .../upload/v1773683511/abc.jpg          → 'abc'
 * @example .../upload/f_auto,q_auto/v1/dir/x.webp  → 'dir/x'
 */
export function publicIdDesdeUrl(url: unknown): string | null {
  const texto = String(url ?? '').trim();
  if (!texto) return null;

  let ruta: string;
  try {
    const u = new URL(texto);
    if (!/(^|\.)cloudinary\.com$/i.test(u.hostname)) return null;
    ruta = u.pathname;
  } catch {
    return null;
  }

  const marca = '/upload/';
  const i = ruta.indexOf(marca);
  if (i === -1) return null;

  let partes = ruta.slice(i + marca.length).split('/').filter(Boolean);
  if (!partes.length) return null;

  // Las transformaciones van antes de la versión y traen "coma" o "clave_valor"
  while (partes.length > 1 && /(^|,)[a-z]{1,3}_/i.test(partes[0])) partes = partes.slice(1);
  // La versión: v seguida de dígitos
  if (partes.length > 1 && /^v\d+$/.test(partes[0])) partes = partes.slice(1);
  if (!partes.length) return null;

  const completo = partes.join('/');
  const sinExtension = completo.replace(/\.[a-z0-9]+$/i, '');
  return sinExtension || null;
}

/**
 * Firma que pide Cloudinary para borrar: sha1 de los parámetros ordenados
 * más la api_secret. Si cambia el juego de parámetros, cambia la firma.
 */
export function firmaDestroy(publicId: string, timestamp: number, apiSecret: string): string {
  const aFirmar = `public_id=${publicId}&timestamp=${timestamp}`;
  return createHash('sha1').update(aFirmar + apiSecret).digest('hex');
}

/** Las URLs que de verdad se pueden borrar, sin repetir y sin las que no son de Cloudinary */
export function idsBorrables(urls: unknown): string[] {
  const lista = Array.isArray(urls) ? urls : [urls];
  const ids = new Set<string>();
  for (const u of lista) {
    const id = publicIdDesdeUrl(u);
    if (id) ids.add(id);
  }
  return [...ids];
}

export interface ConfigCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Lee la configuración del entorno. null si falta algo: sin credenciales no se borra. */
export function configDesdeEntorno(env: NodeJS.ProcessEnv = process.env): ConfigCloudinary | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}


/* ---------------- Solo se borran las que ya nadie usa ---------------- */

/** Las colecciones que guardan imágenes y de dónde salen */
export const COLECCIONES_CON_IMAGEN = ['articulos', 'tiendas', 'categorias', 'banners'] as const;

/**
 * Recorre un valor cualquiera y junta las URLs de Cloudinary que encuentre.
 *
 * Se camina el árbol entero en vez de mirar campos concretos (`logoUrl`,
 * `variantes[].url`...) a propósito: si mañana se agrega otro campo con imagen,
 * queda protegido solo, sin que nadie se acuerde de actualizar esta lista.
 */
function recolectar(valor: unknown, ids: Set<string>, profundidad = 0): void {
  if (profundidad > 12 || valor == null) return;
  if (typeof valor === 'string') {
    const id = publicIdDesdeUrl(valor);
    if (id) ids.add(id);
    return;
  }
  if (typeof valor !== 'object') return;
  for (const v of Object.values(valor as Record<string, unknown>)) {
    recolectar(v, ids, profundidad + 1);
  }
}

/** public_ids de todas las imágenes que la base sigue referenciando */
export function publicIdsEnUso(datos: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  recolectar(datos, ids);
  return ids;
}
