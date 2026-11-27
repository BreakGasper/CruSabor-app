import { db } from '@/firebase';
import { ref as dbRef, get, update, push, set } from '@/services/baseDatos';
import { eliminarImagenes } from '@/composables/useCloudinary';
import { sessionAdmin } from '@/utils/sessionAdmin';

/**
 * Vaciar los artículos de una tienda (o de todas), para limpiar datos de prueba.
 *
 * Qué borra:
 *  - los artículos (`articulos/{id}`) de la tienda;
 *  - sus promociones con descuento (`promociones/{id}`), que apuntan a esos artículos;
 *  - sus imágenes en Cloudinary (el servidor solo borra las que ninguna otra cosa usa).
 * Qué NO toca: la tienda ni su perfil, los pedidos ya hechos (son historial: guardan su propia copia del nombre,
 * precio y foto del artículo), ni los carritos y favoritos que cada cliente guarda en su teléfono.
 * Deja un registro en `auditoria/` con quién lo hizo y cuántos borró.
 */

export interface ArticuloResumen {
  id: string;
  tiendaId: string;
  nombre: string;
}

export interface PlanVaciado {
  /** Ids de los artículos que se borrarían */
  articulos: ArticuloResumen[];
  /** Ids de las promociones que apuntan a esos artículos */
  promociones: string[];
  /** Imágenes que usaban */
  imagenes: string[];
}

/** Todas las imágenes de un artículo: la principal y las de sus variantes (sin vistas previas locales) */
export function urlsDeImagenes(url: unknown, variantes: unknown): string[] {
  const lista = Array.isArray(variantes) ? variantes : Object.values((variantes as object) || {});
  const todas = [url, ...lista.map((v: any) => v?.url)];
  return [...new Set(todas.filter((u): u is string => typeof u === 'string' && u.trim() !== '' && !u.startsWith('blob:')))];
}

/**
 * Qué se borraría, sin borrar nada. `tiendaId` null = de todas las tiendas.
 * Función pura: recibe lo leído de la base y devuelve el plan.
 */
export function planearVaciado(
  articulos: Record<string, any> | null | undefined,
  promociones: Record<string, any> | null | undefined,
  tiendaId: string | null,
): PlanVaciado {
  const elegidos: ArticuloResumen[] = [];
  const imagenes = new Set<string>();
  for (const [id, a] of Object.entries(articulos ?? {})) {
    if (!a || typeof a !== 'object') continue;
    if (tiendaId !== null && String((a as any).tiendaId) !== String(tiendaId)) continue;
    elegidos.push({ id, tiendaId: String((a as any).tiendaId ?? ''), nombre: String((a as any).nombre ?? '') });
    urlsDeImagenes((a as any).url, (a as any).variantes).forEach((u) => imagenes.add(u));
  }
  const ids = new Set(elegidos.map((a) => a.id));
  const promos = Object.entries(promociones ?? {})
    .filter(([, p]) => p && typeof p === 'object' && (ids.has(String((p as any).articuloId)) || (tiendaId !== null && String((p as any).tiendaId) === String(tiendaId))))
    .map(([id]) => id);
  return { articulos: elegidos, promociones: promos, imagenes: [...imagenes] };
}

/** Lee la base y arma el plan */
export async function leerPlanVaciado(tiendaId: string | null): Promise<PlanVaciado> {
  const [a, p] = await Promise.all([get(dbRef(db, 'articulos')), get(dbRef(db, 'promociones'))]);
  return planearVaciado(a.exists() ? a.val() : null, p.exists() ? p.val() : null, tiendaId);
}

export interface ResultadoVaciado {
  articulos: number;
  promociones: number;
  imagenes: number;
}

/** Borra según el plan (máximo 400 rutas por escritura) y deja constancia en `auditoria/` */
export async function vaciarArticulos(tiendaId: string | null, plan?: PlanVaciado): Promise<ResultadoVaciado> {
  const p = plan ?? (await leerPlanVaciado(tiendaId));
  const rutas: Record<string, null> = {};
  for (const a of p.articulos) rutas[`articulos/${a.id}`] = null;
  for (const id of p.promociones) rutas[`promociones/${id}`] = null;
  const claves = Object.keys(rutas);
  for (let i = 0; i < claves.length; i += 400) {
    const trozo: Record<string, null> = {};
    for (const k of claves.slice(i, i + 400)) trozo[k] = null;
    await update(dbRef(db), trozo);
  }
  // Constancia: quién, cuándo y cuántos (si falla, el borrado ya se hizo y no se revierte)
  try {
    const nuevo = push(dbRef(db, 'auditoria'));
    await set(nuevo, {
      accion: 'vaciar-articulos',
      tiendaId: tiendaId ?? 'todas',
      articulos: p.articulos.length,
      promociones: p.promociones.length,
      por: sessionAdmin.value?.id ?? '',
      porNombre: sessionAdmin.value?.nombre ?? '',
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('No se pudo guardar el registro de auditoría:', e);
  }
  // Las imágenes se piden borrar DESPUÉS de borrar los artículos; el servidor solo quita las que nada más usa
  if (p.imagenes.length) void eliminarImagenes(p.imagenes);
  return { articulos: p.articulos.length, promociones: p.promociones.length, imagenes: p.imagenes.length };
}
