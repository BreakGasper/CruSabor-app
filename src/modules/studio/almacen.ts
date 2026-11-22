import Dexie, { type Table } from 'dexie';
import type { DatosProducto, Paleta } from './motor/tipos';

/**
 * Los diseños se guardan SOLO en este navegador (IndexedDB): nada se sube a ningún servidor.
 * La foto original del producto se guarda aparte y nunca se modifica.
 */

export interface Diseno {
  id: string;
  nombre: string;
  estilo: string;
  formato: { id: string; w: number; h: number };
  /** JSON de Fabric con las imágenes cambiadas por claves @@img:N */
  json: string;
  miniatura: string;
  favorito: 0 | 1;
  creado: number;
  actualizado: number;
  datos: DatosProducto;
  /** Orden y paleta con que se generó, por si se quiere regenerar */
  layout?: string;
  paleta?: string;
  /** Paleta propia del diseño (p. ej. la del tema de Crustore cuando se creó) */
  paletaObj?: Paleta;
}

export interface ImagenGuardada {
  id: string;
  disenoId: string;
  /** 'original' = la foto del producto sin tocar; 'uso' = imágenes que usa el diseño (en el orden de @@img:N) */
  tipo: 'original' | 'uso';
  orden: number;
  blob: Blob;
}

class EstudioDB extends Dexie {
  disenos!: Table<Diseno, string>;
  imagenes!: Table<ImagenGuardada, string>;
  constructor() {
    super('cgrat-studio');
    this.version(1).stores({ disenos: 'id, actualizado, favorito', imagenes: 'id, disenoId' });
  }
}

let _db: EstudioDB | null = null;
const db = () => (_db ??= new EstudioDB());

export const nuevoDisenoId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function listarDisenos(): Promise<Diseno[]> {
  return (await db().disenos.orderBy('actualizado').reverse().toArray()) ?? [];
}

export const obtenerDiseno = (id: string) => db().disenos.get(id);

export async function guardarDiseno(d: Diseno, usadas: Blob[], original?: Blob): Promise<void> {
  const base = db();
  await base.transaction('rw', base.disenos, base.imagenes, async () => {
    await base.disenos.put({ ...d, actualizado: Date.now() });
    await base.imagenes.where('disenoId').equals(d.id).filter((i) => i.tipo === 'uso').delete();
    await base.imagenes.bulkPut(usadas.map((blob, orden) => ({ id: `${d.id}:uso:${orden}`, disenoId: d.id, tipo: 'uso' as const, orden, blob })));
    if (original) await base.imagenes.put({ id: `${d.id}:original`, disenoId: d.id, tipo: 'original', orden: 0, blob: original });
  });
}

export async function imagenesDe(id: string): Promise<{ usadas: Blob[]; original?: Blob }> {
  const todas = await db().imagenes.where('disenoId').equals(id).toArray();
  return {
    usadas: todas.filter((i) => i.tipo === 'uso').sort((a, b) => a.orden - b.orden).map((i) => i.blob),
    original: todas.find((i) => i.tipo === 'original')?.blob,
  };
}

export async function borrarDiseno(id: string): Promise<void> {
  const base = db();
  await base.transaction('rw', base.disenos, base.imagenes, async () => {
    await base.disenos.delete(id);
    await base.imagenes.where('disenoId').equals(id).delete();
  });
}

export async function alternarFavorito(id: string): Promise<void> {
  const d = await db().disenos.get(id);
  if (d) await db().disenos.update(id, { favorito: d.favorito ? 0 : 1 });
}

export async function renombrarDiseno(id: string, nombre: string): Promise<void> {
  await db().disenos.update(id, { nombre: nombre.trim().slice(0, 60) || 'Sin título' });
}

/** Copia un diseño con todas sus imágenes (incluida la original) */
export async function duplicarDiseno(id: string): Promise<string | null> {
  const d = await db().disenos.get(id);
  if (!d) return null;
  const { usadas, original } = await imagenesDe(id);
  const nuevo = nuevoDisenoId();
  await guardarDiseno({ ...d, id: nuevo, nombre: `${d.nombre} (copia)`, favorito: 0, creado: Date.now() }, usadas, original);
  return nuevo;
}
