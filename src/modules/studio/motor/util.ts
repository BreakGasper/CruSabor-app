import type { Elem } from './tipos';

/** Número pseudoaleatorio con semilla (mulberry32): mismo resultado para la misma semilla, para que las propuestas sean repetibles */
export function crearRng(semilla: number): () => number {
  let a = (semilla >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Medir = (texto: string, tam: number, peso: number, fuente: string) => number;

export function formatearPrecio(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  const entero = Number.isInteger(n);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Descuento entero en %, 0 si no hay */
export function porcentajeOferta(precio: number | null, antes: number | null): number {
  if (!precio || !antes || antes <= precio) return 0;
  return Math.round((1 - precio / antes) * 100);
}

/**
 * Parte `texto` en renglones que quepan en `ancho` (por palabras). Si pasa de `maxLineas`, el último termina en "…".
 * Una palabra más ancha que el renglón se corta.
 */
export function partir(medirTexto: (t: string) => number, texto: string, ancho: number, maxLineas: number): { lineas: string[]; recortado: boolean } {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  // Una palabra más ancha que el renglón se corta, y eso cuenta como "recortado" para que se pruebe un tamaño menor
  let cortada = false;
  const cortar = (t: string) => {
    let x = t;
    while (x.length > 1 && medirTexto(x) > ancho) x = x.slice(0, -1);
    cortada = true;
    return x;
  };
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (medirTexto(prueba) <= ancho) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = medirTexto(p) > ancho ? cortar(p) : p;
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return { lineas, recortado: cortada };
  const res = lineas.slice(0, maxLineas);
  let ultima = res[maxLineas - 1];
  while (ultima.length > 1 && medirTexto(`${ultima}…`) > ancho) ultima = ultima.slice(0, -1);
  res[maxLineas - 1] = `${ultima}…`;
  return { lineas: res, recortado: true };
}

export interface AjusteTexto {
  tam: number;
  lineas: string[];
  alto: number;
  ancho: number;
}

/**
 * Busca el tamaño más grande (entre tamMax y tamMin) con el que el texto cabe en `ancho` x `alto` y en `maxLineas`.
 * Si ni al mínimo cabe, lo deja en el mínimo recortando con "…": nunca se sale de la caja.
 */
export function ajustarTexto(
  medir: Medir,
  texto: string,
  ancho: number,
  alto: number,
  o: { tamMax: number; tamMin?: number; maxLineas: number; peso: number; fuente: string; interlineado: number; espaciado?: number },
): AjusteTexto {
  const tamMin = Math.max(8, o.tamMin ?? Math.round(o.tamMax * 0.4));
  const med = (tam: number) => (t: string) => medir(t, tam, o.peso, o.fuente) + (o.espaciado ?? 0) * tam * Math.max(0, t.length - 1);
  const lineaAlto = (tam: number) => tam * o.interlineado;
  const paso = Math.max(1, Math.round(o.tamMax * 0.03));
  for (let tam = Math.round(o.tamMax); tam >= tamMin; tam -= paso) {
    const r = partir(med(tam), texto, ancho, o.maxLineas);
    if (!r.recortado && r.lineas.length * lineaAlto(tam) <= alto) {
      return { tam, lineas: r.lineas, alto: r.lineas.length * lineaAlto(tam), ancho: Math.max(0, ...r.lineas.map(med(tam))) };
    }
  }
  const lineasPosibles = Math.max(1, Math.min(o.maxLineas, Math.floor(alto / lineaAlto(tamMin))));
  const r = partir(med(tamMin), texto, ancho, lineasPosibles);
  return { tam: tamMin, lineas: r.lineas, alto: r.lineas.length * lineaAlto(tamMin), ancho: Math.max(0, ...r.lineas.map(med(tamMin))) };
}

export interface Problema {
  tipo: 'fuera' | 'solape-texto' | 'tapa-producto';
  a: string;
  b?: string;
}

const esTexto = (e: Elem) => e.tipo === 'texto';
const esDecor = (e: Elem) => e.rol.startsWith('decor') || e.rol === 'fondo';
const inter = (a: Elem, b: Elem) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 1 && h > 1 ? w * h : 0;
};

/**
 * Comprueba que la pieza esté bien armada: nada importante sale del lienzo, los textos no se encimen entre sí
 * y no tapen el producto (salvo las etiquetas hechas para ir encima, y aun así a lo mucho sobre una parte pequeña).
 */
export function verificar(elems: Elem[], w: number, h: number): Problema[] {
  const p: Problema[] = [];
  const tol = 2;
  for (const e of elems) {
    if (esDecor(e)) continue;
    if (e.x < -tol || e.y < -tol || e.x + e.w > w + tol || e.y + e.h > h + tol) p.push({ tipo: 'fuera', a: e.id });
  }
  const textos = elems.filter(esTexto);
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      if (inter(textos[i], textos[j]) > 0) p.push({ tipo: 'solape-texto', a: textos[i].id, b: textos[j].id });
    }
  }
  const producto = elems.find((e) => e.rol === 'producto');
  if (producto) {
    for (const t of textos) {
      if (inter(t, producto) > 0 && !t.permiteSolape) p.push({ tipo: 'tapa-producto', a: t.id, b: producto.id });
    }
    // Las etiquetas que sí pueden ir encima no deben cubrir más de una quinta parte del producto en total
    // (un texto que va dentro de su etiqueta no suma aparte: ya cuenta la etiqueta)
    const etiquetas = elems.filter((e) => e.permiteSolape && e.rol !== 'producto');
    const formas = etiquetas.filter((e) => e.tipo !== 'texto');
    const dentroDeForma = (t: Elem) => formas.some((f) => t.x + t.w / 2 >= f.x && t.x + t.w / 2 <= f.x + f.w && t.y + t.h / 2 >= f.y && t.y + t.h / 2 <= f.y + f.h);
    const cubierto = etiquetas.filter((e) => e.tipo !== 'texto' || !dentroDeForma(e)).reduce((s, e) => s + inter(e, producto), 0);
    if (cubierto > producto.w * producto.h * 0.2) p.push({ tipo: 'tapa-producto', a: 'etiquetas', b: producto.id });
  }
  return p;
}

/** ¿Es un color claro? (#rrggbb) — para elegir paneles y textos que se lean encima */
export function esClaro(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6;
}
