import type { DecorId, Elem, Paleta } from './tipos';
import { esClaro as esClaroHex } from './util';

/** Biblioteca local de recursos gráficos: todo se genera con formas (nada se descarga) */

export type Borrador = Omit<Elem, 'id'>;

export interface CtxDecor {
  w: number;
  h: number;
  rng: () => number;
  paleta: Paleta;
}

export function hexA(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Polígono con puntos absolutos → elemento con caja y puntos relativos */
export function poligono(pts: number[][], extra: Partial<Borrador> & { rol: string; nombre: string }): Borrador {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { tipo: 'poly', x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, puntos: pts.map((p) => [p[0] - x, p[1] - y]), ...extra };
}

export function estrella(cx: number, cy: number, r: number, puntas = 5, interno = 0.45, rot = -Math.PI / 2): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const rad = i % 2 === 0 ? r : r * interno;
    const a = rot + (i * Math.PI) / puntas;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

/** Explosión de picos, para etiquetas de precio y descuento */
export const burst = (cx: number, cy: number, r: number, picos = 16) => estrella(cx, cy, r, picos, 0.84, 0);

const colores = (p: Paleta) => [p.acento, p.acento2, p.titulo, '#ffffff'];
const entre = (rng: () => number, a: number, b: number) => a + rng() * (b - a);
const elige = <T,>(rng: () => number, l: T[]) => l[Math.floor(rng() * l.length) % l.length];

/** Posición en uno de los costados (alternando), para que los adornos no caigan sobre el texto del centro */
const lateral = (rng: () => number, w: number, r: number, i: number) => {
  const banda = Math.max(r * 1.4, w * 0.06);
  return i % 2 === 0 ? entre(rng, r, banda) : entre(rng, w - banda, w - r);
};

const GENERADORES: Record<DecorId, (c: CtxDecor) => Borrador[]> = {
  confeti: ({ w, h, rng, paleta }) => {
    const n = Math.max(24, Math.min(70, Math.round((w * h) / 40000)));
    const out: Borrador[] = [];
    for (let i = 0; i < n; i++) {
      const col = elige(rng, colores(paleta));
      const x = entre(rng, 0, w);
      const y = entre(rng, 0, h);
      const t = entre(rng, 14, 34);
      const k = Math.floor(rng() * 3);
      const base = { rol: 'decor-confeti', nombre: 'Confeti', fill: col, opacidad: entre(rng, 0.55, 0.95), rot: entre(rng, 0, 360) };
      if (k === 0) out.push({ ...base, tipo: 'rect', x, y, w: t, h: t * 0.45 });
      else if (k === 1) out.push({ ...base, tipo: 'circle', x, y, w: t * 0.6, h: t * 0.6 });
      else out.push(poligono([[x, y], [x + t, y + t * 0.3], [x + t * 0.4, y + t]], base));
    }
    return out;
  },
  estrellas: ({ w, h, rng, paleta }) =>
    Array.from({ length: 10 }, (_, i) => {
      const r = entre(rng, 18, 44);
      return poligono(estrella(lateral(rng, w, r, i), entre(rng, r, h - r), r), { rol: 'decor-estrella', nombre: 'Estrella', fill: elige(rng, [paleta.acento, paleta.acento2, '#ffffff']), opacidad: entre(rng, 0.35, 0.8) });
    }),
  burbujas: ({ w, h, rng, paleta }) =>
    Array.from({ length: 14 }, () => {
      const d = entre(rng, 30, 130);
      return { tipo: 'circle' as const, rol: 'decor-burbuja', nombre: 'Burbuja', x: entre(rng, 0, w - d), y: entre(rng, 0, h - d), w: d, h: d, stroke: elige(rng, [paleta.titulo, paleta.acento2]), strokeW: 4, opacidad: entre(rng, 0.25, 0.55) };
    }),
  destellos: ({ w, h, rng, paleta }) =>
    Array.from({ length: 8 }, (_, i) => {
      const r = entre(rng, 20, 46);
      return poligono(estrella(lateral(rng, w, r, i), entre(rng, r, h - r), r, 4, 0.22), { rol: 'decor-destello', nombre: 'Destello', fill: elige(rng, [paleta.acento, '#ffffff']), opacidad: entre(rng, 0.5, 0.9) });
    }),
  rayos: ({ w, h, paleta }) => {
    const cx = w / 2;
    const cy = h * 0.46;
    const R = Math.hypot(w, h);
    const n = 16;
    return Array.from({ length: n }, (_, i) => {
      const a0 = (i * 2 * Math.PI) / n;
      const a1 = a0 + Math.PI / n;
      return poligono([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], { rol: 'decor-rayo', nombre: 'Rayo', fill: paleta.acento, opacidad: i % 2 ? 0.1 : 0.04 });
    });
  },
  franjas: ({ w, h, paleta }) =>
    [0.14, 0.4, 0.66].map((f, i) =>
      poligono([[0, h * f], [w, h * (f - 0.16)], [w, h * (f - 0.16) + h * 0.06], [0, h * f + h * 0.06]], { rol: 'decor-franja', nombre: 'Franja', fill: i % 2 ? paleta.acento : '#ffffff', opacidad: 0.14 }),
    ),
  colinas: ({ w, h }) => {
    const capa = (base: number, alto: number, fase: number, color: string, nombre: string) => {
      const pts: number[][] = [[0, h]];
      for (let i = 0; i <= 24; i++) pts.push([(i / 24) * w, h * base - Math.sin((i / 24) * Math.PI * 2 + fase) * h * alto]);
      pts.push([w, h]);
      return poligono(pts, { rol: 'decor-colina', nombre, fill: color });
    };
    return [capa(0.84, 0.03, 0.4, '#5cb85c', 'Colina lejana'), capa(0.9, 0.035, 2.2, '#2e8b2e', 'Colina media'), capa(0.96, 0.02, 4.1, '#1f6f24', 'Colina cercana')];
  },
  sol: ({ w, h, paleta }) => {
    // Medio sol asomando por la esquina de arriba: así no queda detrás del título
    const r = Math.min(w, h) * 0.09;
    const cx = w - r * 1.5;
    const cy = r * 0.1;
    return [
      { tipo: 'circle', rol: 'decor-sol', nombre: 'Halo', x: cx - r * 1.6, y: cy - r * 1.6, w: r * 3.2, h: r * 3.2, fill: hexA(paleta.acento, 0.25) },
      { tipo: 'circle', rol: 'decor-sol', nombre: 'Sol', x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill: paleta.acento },
    ];
  },
  tablones: ({ w, h }) => {
    const n = 6;
    const alto = (h * 0.34) / n;
    return Array.from({ length: n }, (_, i) => ({ tipo: 'rect' as const, rol: 'decor-tablon', nombre: 'Tablón', x: 0, y: h * 0.66 + i * alto, w, h: alto, fill: i % 2 ? '#a0693a' : '#8a5a2b', stroke: '#5b3a1a', strokeW: 2, opacidad: 0.45 }));
  },
  'papel-picado': ({ w, h, paleta }) => {
    const n = Math.max(7, Math.round(w / 130));
    const fw = w / n;
    const fh = Math.min(h * 0.085, fw * 1.1);
    const cols = [paleta.acento, paleta.acento2, paleta.titulo, '#f57c00', '#00a99d'];
    const out: Borrador[] = [{ tipo: 'rect', rol: 'decor-hilo', nombre: 'Hilo', x: 0, y: 6, w, h: 4, fill: paleta.sobreAcento, opacidad: 0.5 }];
    for (let i = 0; i < n; i++) {
      const x = i * fw + fw * 0.06;
      const ww = fw * 0.88;
      out.push(poligono([[x, 10], [x + ww, 10], [x + ww, 10 + fh * 0.8], [x + ww / 2, 10 + fh], [x, 10 + fh * 0.8]], { rol: 'decor-papel', nombre: 'Papel picado', fill: cols[i % cols.length], opacidad: 0.92 }));
      out.push({ tipo: 'circle', rol: 'decor-papel', nombre: 'Calado', x: x + ww / 2 - fh * 0.12, y: 10 + fh * 0.3, w: fh * 0.24, h: fh * 0.24, fill: paleta.fondoA, opacidad: 0.8 });
    }
    return out;
  },
  tablero: ({ w, h, paleta }) => {
    // Cuadros alternados, como el fondo de los carteles de comida
    const lado = Math.round(Math.min(w, h) / 5);
    const out: Borrador[] = [];
    for (let r = 0; r * lado < h; r++) {
      for (let c = 0; c * lado < w; c++) {
        if ((r + c) % 2 === 0) out.push({ tipo: 'rect', rol: 'decor-tablero', nombre: 'Cuadro', x: c * lado, y: r * lado, w: lado, h: lado, fill: esClaroHex(paleta.fondoA) ? '#ffffff' : '#000000', opacidad: esClaroHex(paleta.fondoA) ? 0.55 : 0.25 });
      }
    }
    return out;
  },
  rayas: ({ w, h, paleta }) => {
    const n = 8;
    const ancho = w / n;
    return Array.from({ length: n }, (_, i) => ({ tipo: 'rect' as const, rol: 'decor-raya', nombre: 'Raya', x: i * ancho, y: 0, w: ancho / 2, h, fill: paleta.acento, opacidad: 0.07 }));
  },
  puntos: ({ w, h, paleta }) => {
    const paso = Math.max(48, Math.round(Math.min(w, h) / 16));
    const out: Borrador[] = [];
    for (let y = paso / 2; y < h; y += paso) for (let x = paso / 2; x < w; x += paso) out.push({ tipo: 'circle', rol: 'decor-punto', nombre: 'Punto', x, y, w: 7, h: 7, fill: paleta.titulo, opacidad: 0.1 });
    return out;
  },
  marco: ({ w, h, paleta }) => [
    { tipo: 'rect', rol: 'decor-marco', nombre: 'Marco', x: 24, y: 24, w: w - 48, h: h - 48, stroke: paleta.acento, strokeW: 3, opacidad: 0.9 },
    { tipo: 'rect', rol: 'decor-marco', nombre: 'Marco interior', x: 38, y: 38, w: w - 76, h: h - 76, stroke: paleta.acento, strokeW: 1, opacidad: 0.5 },
  ],
  brillo: ({ w, h, paleta }) => [
    { tipo: 'circle', rol: 'decor-brillo', nombre: 'Luz', x: w * 0.5 - w * 0.6, y: h * 0.42 - w * 0.6, w: w * 1.2, h: w * 1.2, degradado: { tipo: 'radial', colores: [hexA(paleta.acento, 0.35), hexA(paleta.acento, 0)] } },
  ],
  circulos: ({ w, h, paleta }) => {
    const m = Math.min(w, h);
    return [
      { tipo: 'circle', rol: 'decor-circulo', nombre: 'Círculo grande', x: w * 0.5 - m * 0.42, y: h * 0.42 - m * 0.42, w: m * 0.84, h: m * 0.84, fill: paleta.acento2, opacidad: 0.22 },
      { tipo: 'circle', rol: 'decor-circulo', nombre: 'Círculo esquina', x: -m * 0.12, y: h - m * 0.2, w: m * 0.34, h: m * 0.34, fill: paleta.acento, opacidad: 0.3 },
    ];
  },
  lineas: ({ w, h, paleta }) => [
    { tipo: 'rect', rol: 'decor-linea', nombre: 'Línea superior', x: w * 0.06, y: h * 0.035, w: w * 0.88, h: 3, fill: paleta.acento, opacidad: 0.8 },
    { tipo: 'rect', rol: 'decor-linea', nombre: 'Línea inferior', x: w * 0.06, y: h * 0.965, w: w * 0.88, h: 3, fill: paleta.acento, opacidad: 0.8 },
  ],
  esquinas: ({ w, h, paleta }) => {
    const l = Math.min(w, h) * 0.08;
    const g = 4;
    const m = 26;
    const c = (x: number, y: number, dx: number, dy: number): Borrador[] => [
      { tipo: 'rect', rol: 'decor-esquina', nombre: 'Esquina', x: dx > 0 ? x : x - l, y: dy > 0 ? y : y - g, w: l, h: g, fill: paleta.acento, opacidad: 0.9 },
      { tipo: 'rect', rol: 'decor-esquina', nombre: 'Esquina', x: dx > 0 ? x : x - g, y: dy > 0 ? y : y - l, w: g, h: l, fill: paleta.acento, opacidad: 0.9 },
    ];
    return [...c(m, m, 1, 1), ...c(w - m, m, -1, 1), ...c(m, h - m, 1, -1), ...c(w - m, h - m, -1, -1)];
  },
};

export const DECOR_NOMBRES: Record<DecorId, string> = {
  confeti: 'Confeti', estrellas: 'Estrellas', burbujas: 'Burbujas', destellos: 'Destellos', rayos: 'Rayos', franjas: 'Franjas', colinas: 'Colinas',
  sol: 'Sol', tablones: 'Tablones', tablero: 'Tablero', rayas: 'Rayas', 'papel-picado': 'Papel picado', puntos: 'Puntos', marco: 'Marco', brillo: 'Brillo', circulos: 'Círculos', lineas: 'Líneas', esquinas: 'Esquinas',
};

export const DECOR_CATEGORIAS: { nombre: string; ids: DecorId[] }[] = [
  { nombre: 'Fiesta', ids: ['confeti', 'estrellas', 'burbujas', 'destellos'] },
  { nombre: 'Fondos y luz', ids: ['rayos', 'brillo', 'franjas', 'circulos', 'tablero', 'rayas'] },
  { nombre: 'Campo', ids: ['colinas', 'sol', 'tablones'] },
  { nombre: 'Tradicional', ids: ['papel-picado', 'esquinas', 'puntos'] },
  { nombre: 'Marcos y líneas', ids: ['marco', 'lineas'] },
];

export function generarDecor(id: DecorId, ctx: CtxDecor): Borrador[] {
  return GENERADORES[id]?.(ctx) ?? [];
}
