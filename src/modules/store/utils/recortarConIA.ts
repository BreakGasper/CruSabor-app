/**
 * Quitar el fondo de CUALQUIER foto, gratis y en el teléfono, con un modelo de segmentación interactiva de Google
 * MediaPipe (Apache-2.0): la persona toca el producto y el modelo dibuja su silueta. No se envía la foto a ningún
 * servidor. Los archivos del modelo viven en `public/mediapipe/` y solo se descargan la primera vez que se usa
 * (unos 15 MB), por eso se cargan de forma diferida.
 */

export interface PuntoToque {
  /** Posición del toque dentro de la foto, de 0 a 1 */
  x: number;
  y: number;
}

/** Confianza del modelo (0 a 1) → opacidad (0 a 255), con una transición corta para que la orilla no quede dentada */
export function alfaDesdeConfianza(c: number): number {
  const t = (c - 0.35) / 0.3;
  return Math.round(255 * Math.min(1, Math.max(0, t)));
}

/** Lado máximo con el que se trabaja: más grande no mejora la silueta y en un teléfono tarda mucho más */
const LADO_MAXIMO = 1100;

let segmentador: any = null;
let cargando: Promise<any> | null = null;

const base = () => String((import.meta as any).env?.BASE_URL ?? '/').replace(/\/?$/, '/');

/** Prepara el modelo (descarga la primera vez). Si falla, el error explica qué hacer. */
async function modelo() {
  if (segmentador) return segmentador;
  if (!cargando) {
    cargando = (async () => {
      const { FilesetResolver, InteractiveSegmenter } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(`${base()}mediapipe/wasm`);
      segmentador = await InteractiveSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base()}mediapipe/magic_touch.tflite`, delegate: 'CPU' },
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      return segmentador;
    })().catch((e) => {
      cargando = null;
      throw e;
    });
  }
  return cargando;
}

export class ErrorRecorteIA extends Error {}

/**
 * Devuelve la foto con solo el producto tocado (fondo transparente), recortada a su contenido.
 * Lanza ErrorRecorteIA con un mensaje para mostrar.
 */
export async function quitarFondoConIA(img: HTMLImageElement, punto: PuntoToque): Promise<HTMLCanvasElement> {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new ErrorRecorteIA('No se pudo leer la foto.');
  const escala = Math.min(1, LADO_MAXIMO / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));

  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const ctx = base.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  let seg: any;
  try {
    seg = await modelo();
  } catch {
    throw new ErrorRecorteIA('No se pudo preparar la herramienta (revisa tu internet e intenta de nuevo).');
  }

  let resultado: any;
  try {
    resultado = seg.segment(base, { keypoint: { x: Math.min(1, Math.max(0, punto.x)), y: Math.min(1, Math.max(0, punto.y)) } });
  } catch {
    throw new ErrorRecorteIA('No se pudo recortar esa foto. Intenta tocar otra parte del producto.');
  }

  try {
    const mascara = resultado?.confidenceMasks?.[0];
    if (!mascara) throw new ErrorRecorteIA('No se encontró el producto. Toca justo sobre él.');
    const mw: number = mascara.width;
    const mh: number = mascara.height;
    const conf: Float32Array = mascara.getAsFloat32Array();

    // La máscara se pasa a un lienzo (su resolución suele ser menor) y se estira a la foto: así la orilla queda suave
    const lm = document.createElement('canvas');
    lm.width = mw;
    lm.height = mh;
    const mctx = lm.getContext('2d')!;
    const px = mctx.createImageData(mw, mh);
    let dentro = 0;
    for (let i = 0; i < mw * mh; i++) {
      const a = alfaDesdeConfianza(conf[i]);
      px.data[i * 4 + 3] = a;
      if (a > 128) dentro++;
    }
    mctx.putImageData(px, 0, 0);
    const fraccion = dentro / (mw * mh);
    if (fraccion < 0.01) throw new ErrorRecorteIA('No se encontró el producto. Toca justo sobre él.');
    if (fraccion > 0.97) throw new ErrorRecorteIA('Se marcó casi toda la foto. Toca otra parte del producto.');

    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(lm, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Recorta los bordes vacíos
    const datos = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (datos[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) throw new ErrorRecorteIA('No se encontró el producto. Toca justo sobre él.');
    const salida = document.createElement('canvas');
    salida.width = maxX - minX + 1;
    salida.height = maxY - minY + 1;
    salida.getContext('2d')!.drawImage(base, minX, minY, salida.width, salida.height, 0, 0, salida.width, salida.height);
    return salida;
  } finally {
    resultado?.close?.();
  }
}
