import type { Paleta } from './tipos';

/**
 * Paleta de un diseño a partir del tema activo de Crustore (paleta de la app, temática y modo claro/oscuro).
 * Los colores se eligen cuidando el contraste: el fondo es el color oscuro de las cabeceras de la app y el
 * acento, el que más se distinga sobre él (en "Carbón y lima", por ejemplo, el botón es oscuro y el lima
 * viene del texto sobre el botón).
 */

export interface VarsTema {
  /** --color-bg-blue-dark: cabeceras (siempre oscuro) */
  oscuro: string;
  /** --color-bg-blue-ligth: botones */
  boton: string;
  /** --on-primary: texto sobre el botón */
  sobreBoton: string;
  /** --color-acento */
  acento: string;
  /** --brand-blue-text */
  marca: string;
}

export function leerColor(c: string): [number, number, number] | null {
  const t = String(c ?? '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = /^#([0-9a-f]{3})$/i.exec(t);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)) as [number, number, number];
  const r = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(t);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : null;
}

export const aHex = (rgb: [number, number, number]) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

function luminancia([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Relación de contraste WCAG entre dos colores (1 a 21); 1 si alguno no se puede leer */
export function contraste(a: string, b: string): number {
  const x = leerColor(a);
  const y = leerColor(b);
  if (!x || !y) return 1;
  const [l1, l2] = [luminancia(x), luminancia(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

const oscurecer = (hex: string, k: number) => {
  const c = leerColor(hex);
  return c ? aHex([c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k)]) : hex;
};

export function paletaDesdeTema(v: VarsTema): Paleta {
  const base = leerColor(v.oscuro) ? aHex(leerColor(v.oscuro)!) : '#1f2430';
  const fondoB = oscurecer(base, 0.4);
  const candidatos = [v.boton, v.acento, v.sobreBoton, v.marca].map((c) => leerColor(c)).filter(Boolean).map((c) => aHex(c as [number, number, number]));
  const unicos = [...new Set(candidatos)];
  const legibles = unicos.filter((c) => contraste(c, base) >= 3).sort((a, b) => contraste(b, base) - contraste(a, base));
  // Prioriza el orden del tema (botón, acento…) entre los legibles; si ninguno lo es, el de más contraste
  const orden = unicos.filter((c) => legibles.includes(c));
  const acento = orden[0] ?? [...unicos].sort((a, b) => contraste(b, base) - contraste(a, base))[0] ?? '#ffd166';
  const acento2 = orden.find((c) => c !== acento) ?? (contraste('#ffffff', base) >= 3 ? '#ffffff' : '#ffd166');
  const sobreAcento = contraste('#141414', acento) >= contraste('#ffffff', acento) ? '#141414' : '#ffffff';
  return {
    id: 'tema', nombre: 'Tema de Crustore', fondoA: base, fondoB, titulo: '#ffffff', texto: '#f2f2f2', acento, acento2, sobreAcento,
    barra: 'rgba(255,255,255,0.1)', textoBarra: '#ffffff',
  };
}
