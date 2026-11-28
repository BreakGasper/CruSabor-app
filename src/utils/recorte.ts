/**
 * Lógica del recorte y ajuste de fotos (pura, sin DOM) para poder probarla sola.
 * El editor (RecortadorImagen.vue) la usa para mover, acercar, girar y ajustar la foto.
 */

export type Giro = 0 | 90 | 180 | 270;

export interface Aspecto {
  id: string;
  nombre: string;
  /** ancho / alto */
  valor: number;
}

export const ASPECTOS: Aspecto[] = [
  { id: '1:1', nombre: 'Cuadrada 1:1', valor: 1 },
  { id: '4:3', nombre: 'Horizontal 4:3', valor: 4 / 3 },
  { id: '3:4', nombre: 'Vertical 3:4', valor: 3 / 4 },
  { id: '16:9', nombre: 'Panorámica 16:9', valor: 16 / 9 },
  { id: '3:1', nombre: 'Banner 3:1', valor: 3 },
];

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const LADO_MAXIMO = 1600;

/** Tamaño de la imagen después de girarla */
export const dimsGiradas = (w: number, h: number, giro: Giro) => (giro === 90 || giro === 270 ? { w: h, h: w } : { w, h });

export const sumarGiro = (giro: Giro, grados: 90 | -90): Giro => (((giro + grados) % 360 + 360) % 360) as Giro;

export interface Recorte {
  /** Esquina y tamaño del recorte, en píxeles de la imagen ya girada */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Recorte que se ve en el marco: el rectángulo más grande con esa proporción que cabe en la imagen, dividido
 * entre el zoom, centrado en (cx, cy). Nunca se sale de la imagen: el centro se ajusta si hace falta.
 */
export function calcularRecorte(imgW: number, imgH: number, aspecto: number, zoom: number, cx?: number, cy?: number): Recorte {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(zoom) ? zoom : 1));
  let sw: number;
  let sh: number;
  if (imgW / imgH > aspecto) {
    sh = imgH;
    sw = imgH * aspecto;
  } else {
    sw = imgW;
    sh = imgW / aspecto;
  }
  sw /= z;
  sh /= z;
  const x = Math.min(imgW - sw / 2, Math.max(sw / 2, cx ?? imgW / 2));
  const y = Math.min(imgH - sh / 2, Math.max(sh / 2, cy ?? imgH / 2));
  return { sx: x - sw / 2, sy: y - sh / 2, sw, sh };
}

/** Centro nuevo del recorte después de arrastrar `dx`,`dy` píxeles del marco (de ancho `anchoMarco`): la foto sigue al dedo */
export function moverCentro(r: Recorte, dx: number, dy: number, anchoMarco: number): { cx: number; cy: number } {
  const k = r.sw / Math.max(1, anchoMarco);
  return { cx: r.sx + r.sw / 2 - dx * k, cy: r.sy + r.sh / 2 - dy * k };
}

/** Tamaño de la foto final: el del recorte, sin pasar de `max` en su lado más largo */
export function tamanoSalida(sw: number, sh: number, max = LADO_MAXIMO): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(sw, sh, 1));
  return { w: Math.max(1, Math.round(sw * k)), h: Math.max(1, Math.round(sh * k)) };
}

export interface Ajustes {
  /** -100 a 100 (0 = sin cambio) */
  brillo: number;
  contraste: number;
  color: number;
}

export const SIN_AJUSTES: Ajustes = { brillo: 0, contraste: 0, color: 0 };
export const hayAjustes = (a: Ajustes) => a.brillo !== 0 || a.contraste !== 0 || a.color !== 0;

const limitar = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Aplica brillo, contraste y color (saturación) sobre los píxeles RGBA, en el mismo arreglo.
 * Se hace a mano (y no con `ctx.filter`) porque no todos los navegadores del teléfono lo soportan.
 */
export function ajustarPixeles(data: Uint8ClampedArray | number[], a: Ajustes): void {
  if (!hayAjustes(a)) return;
  const b = (Math.max(-100, Math.min(100, a.brillo)) / 100) * 255 * 0.6; // suma
  const c = 1 + Math.max(-100, Math.min(100, a.contraste)) / 100; // factor
  const s = 1 + Math.max(-100, Math.min(100, a.color)) / 100; // factor de saturación
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let bl = data[i + 2];
    // color: se aleja (o acerca) de la luminosidad del propio píxel
    const gris = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = gris + (r - gris) * s;
    g = gris + (g - gris) * s;
    bl = gris + (bl - gris) * s;
    // contraste alrededor del gris medio y brillo
    r = (r - 128) * c + 128 + b;
    g = (g - 128) * c + 128 + b;
    bl = (bl - 128) * c + 128 + b;
    data[i] = limitar(r);
    data[i + 1] = limitar(g);
    data[i + 2] = limitar(bl);
  }
}
