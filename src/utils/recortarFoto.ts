import { ref } from 'vue';

/**
 * Recorte de fotos «al elegirlas», para cualquier pantalla:
 *
 *   const foto = await recortarFoto(archivo, '1:1');
 *   if (!foto) return;            // la persona canceló
 *
 * Abre el editor (RecortadorGlobal.vue, montado una sola vez en App.vue) y devuelve la foto recortada, la original si
 * se eligió «Usar sin recortar», o null si se canceló. Todo ocurre en el teléfono.
 */

export interface PeticionRecorte {
  archivo: File;
  /** id de ASPECTOS (utils/recorte.ts): '1:1', '4:3', '3:4', '16:9', '3:1' */
  aspecto?: string;
}

export const peticionRecorte = ref<PeticionRecorte | null>(null);
let resolver: ((f: File | null) => void) | null = null;

/** Solo las imágenes se recortan; cualquier otra cosa pasa tal cual para que la pantalla muestre su propio error */
const esImagen = (f: File) => /^image\//.test(f.type);

export function recortarFoto(archivo: File, aspecto?: string): Promise<File | null> {
  if (!esImagen(archivo)) return Promise.resolve(archivo);
  resolver?.(null); // si había otra pendiente, se cancela
  return new Promise((ok) => {
    resolver = ok;
    peticionRecorte.value = { archivo, aspecto };
  });
}

/** Lo usa el editor global para contestar */
export function resolverRecorte(f: File | null) {
  const r = resolver;
  resolver = null;
  peticionRecorte.value = null;
  r?.(f);
}

/** Recorta varias fotos una tras otra; las canceladas se omiten */
export async function recortarFotos(archivos: File[], aspecto?: string): Promise<File[]> {
  const salida: File[] = [];
  for (const a of archivos) {
    const f = await recortarFoto(a, aspecto);
    if (f) salida.push(f);
  }
  return salida;
}
