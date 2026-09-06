// src/constants/firebase_util.ts
//
// Prefijo para las imágenes guardadas en la base.
// Las URLs de artículos y tiendas ya son absolutas (Cloudinary), por eso va vacío.
// Si algún día guardas rutas relativas de Firebase Storage, pon aquí la base, por ejemplo:
// "https://firebasestorage.googleapis.com/v0/b/mrapp-b8d1e.appspot.com/o/"
export const FIREBASE_STORAGE_BASE_URL = '';

/** Devuelve la URL lista para <img>: respeta URLs absolutas y antepone la base a las relativas. */
export function imagenUrl(url?: string | null): string {
  if (!url) return '';
  return /^(https?:)?\/\//i.test(url) || url.startsWith('data:')
    ? url
    : FIREBASE_STORAGE_BASE_URL + url;
}
