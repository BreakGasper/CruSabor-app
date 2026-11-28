/**
 * Quitar el fondo de la foto de un producto, gratis y en el teléfono (sin servidor ni IA).
 *
 * Funciona con fotos de fondo liso (blanco, un mantel, una pared): toma el color del borde de la foto y borra,
 * desde las orillas hacia adentro, todo lo que se le parezca. Lo que quede encerrado dentro del producto no se toca
 * (por ejemplo el hueco de un asa). Si el fondo no es parejo avisa en lugar de dejar un recorte feo.
 */

export interface ResultadoRecorte {
  ok: boolean;
  motivo?: string;
  /** Parte de la foto que se quitó (0 a 1) */
  fraccionQuitada: number;
  /** Zona que ocupa el producto: útil para recortar los bordes vacíos */
  caja?: { x: number; y: number; ancho: number; alto: number };
}

const MOTIVO_FONDO_NO_LISO = 'El fondo de la foto no es liso. Prueba con el producto sobre una pared, mesa o papel de un solo color.';

const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/**
 * Pone transparente el fondo liso de `data` (RGBA, se modifica en su lugar SOLO si el resultado es bueno).
 * Pura: no usa canvas, así se puede probar con píxeles inventados.
 */
export function quitarFondoLiso(data: Uint8ClampedArray, ancho: number, alto: number, tolerancia = 42): ResultadoRecorte {
  const total = ancho * alto;
  if (ancho < 8 || alto < 8 || data.length < total * 4) return { ok: false, motivo: 'La foto es demasiado pequeña.', fraccionQuitada: 0 };

  // 1) Píxeles del borde
  const borde: number[] = [];
  for (let x = 0; x < ancho; x++) borde.push(x, (alto - 1) * ancho + x);
  for (let y = 1; y < alto - 1; y++) borde.push(y * ancho, y * ancho + ancho - 1);

  // 2) Color del fondo = el color más común (mediana) del borde
  const fr = mediana(borde.map((i) => data[i * 4]));
  const fg = mediana(borde.map((i) => data[i * 4 + 1]));
  const fb = mediana(borde.map((i) => data[i * 4 + 2]));
  const dist = (i: number) => Math.hypot(data[i * 4] - fr, data[i * 4 + 1] - fg, data[i * 4 + 2] - fb);

  const sembrados = borde.filter((i) => dist(i) <= tolerancia);
  if (sembrados.length / borde.length < 0.6) return { ok: false, motivo: MOTIVO_FONDO_NO_LISO, fraccionQuitada: 0 };

  // 3) Relleno desde las orillas: solo se quita lo conectado con el borde
  const fondo = new Uint8Array(total);
  const pila = new Int32Array(total);
  let tope = 0;
  for (const i of sembrados) {
    if (!fondo[i]) {
      fondo[i] = 1;
      pila[tope++] = i;
    }
  }
  let quitados = tope;
  while (tope > 0) {
    const p = pila[--tope];
    const x = p % ancho;
    const y = (p - x) / ancho;
    const vecinos = [x > 0 ? p - 1 : -1, x < ancho - 1 ? p + 1 : -1, y > 0 ? p - ancho : -1, y < alto - 1 ? p + ancho : -1];
    for (const n of vecinos) {
      if (n >= 0 && !fondo[n] && dist(n) <= tolerancia) {
        fondo[n] = 1;
        pila[tope++] = n;
        quitados++;
      }
    }
  }

  const fraccionQuitada = quitados / total;
  if (fraccionQuitada < 0.05) return { ok: false, motivo: 'No se encontró un fondo que quitar en esta foto.', fraccionQuitada };
  if (fraccionQuitada > 0.93) return { ok: false, motivo: 'El producto se parece demasiado al fondo: se borraría casi toda la foto.', fraccionQuitada };

  // 4) Aplicar: el fondo queda transparente y la orilla del producto se suaviza para que no se vea dentada
  let minX = ancho;
  let minY = alto;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < total; i++) {
    const x = i % ancho;
    const y = (i - x) / ancho;
    if (fondo[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const tocaFondo =
      (x > 0 && fondo[i - 1]) || (x < ancho - 1 && fondo[i + 1]) || (y > 0 && fondo[i - ancho]) || (y < alto - 1 && fondo[i + ancho]);
    if (tocaFondo) {
      const d = dist(i);
      if (d < tolerancia * 1.8) data[i * 4 + 3] = Math.round(Math.max(70, Math.min(255, (255 * (d - tolerancia)) / (tolerancia * 0.8))));
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { ok: true, fraccionQuitada, caja: { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 } };
}

/**
 * Devuelve la foto sin fondo (recortada a su contenido) lista para dibujar, o el motivo por el que no se pudo.
 * `maxLado` limita el trabajo: en un teléfono una foto de 12 MP sería lentísima y no hace falta tanta resolución.
 */
export function recortarFondo(img: HTMLImageElement, maxLado = 1100, tolerancia = 42): { canvas: HTMLCanvasElement | null; motivo?: string } {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) return { canvas: null, motivo: 'No se pudo leer la foto.' };
  const escala = Math.min(1, maxLado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { canvas: null, motivo: 'Tu navegador no puede quitar el fondo.' };
  ctx.drawImage(img, 0, 0, w, h);
  let datos: ImageData;
  try {
    datos = ctx.getImageData(0, 0, w, h);
  } catch {
    // Una foto de otro sitio sin permiso (CORS) no se puede leer
    return { canvas: null, motivo: 'No se pudo leer esa foto. Súbela desde tu teléfono para quitarle el fondo.' };
  }
  const r = quitarFondoLiso(datos.data, w, h, tolerancia);
  if (!r.ok || !r.caja) return { canvas: null, motivo: r.motivo };
  ctx.putImageData(datos, 0, 0);
  const salida = document.createElement('canvas');
  salida.width = r.caja.ancho;
  salida.height = r.caja.alto;
  salida.getContext('2d')!.drawImage(lienzo, r.caja.x, r.caja.y, r.caja.ancho, r.caja.alto, 0, 0, r.caja.ancho, r.caja.alto);
  return { canvas: salida };
}
