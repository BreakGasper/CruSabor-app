/**
 * Paleta de colores de la app. La elige el administrador en Admin › Apariencia
 * y se guarda en `configuracion/apariencia/paleta`.
 *
 * - Paletas fijas: sus tokens están escritos a mano en assets/styles/ColorsVarCss.css
 *   y se activan con <html data-paleta="id">.
 * - Paletas personalizadas (`configuracion/apariencia/personalizadas/{id}`): el admin
 *   elige tres colores y aquí se calculan los demás (texto encima, modo oscuro, fondos
 *   suaves) cuidando el contraste. Se inyectan en <style id="paleta-personalizada">
 *   y se activan con <html data-paleta="personalizada">.
 *
 * La última paleta aplicada se recuerda en localStorage (id y, si es personalizada,
 * su CSS) para que index.html la ponga antes de pintar y no haya parpadeo.
 */
export const PALETAS = ['carbon-lima', 'rosa-negro', 'naranja-cacao', 'azul-anil'] as const;
export type PaletaFija = (typeof PALETAS)[number];
/** Una paleta fija o el id de una personalizada */
export type Paleta = string;
export const PALETA_DEFAULT: PaletaFija = 'carbon-lima';

export const NOMBRE_PALETA: Record<PaletaFija, string> = {
  'carbon-lima': 'Carbón y lima',
  'rosa-negro': 'Negro y rosa mexicano',
  'naranja-cacao': 'Naranja y cacao',
  'azul-anil': 'Azul añil',
};

/** Los tres colores que se ven en la muestra de cada paleta fija: cabecera, botón, resaltado */
export const MUESTRA_PALETA: Record<PaletaFija, [string, string, string]> = {
  'carbon-lima': ['#141414', '#1f1f1f', '#c6f432'],
  'rosa-negro': ['#141414', '#d1006f', '#d1006f'],
  'naranja-cacao': ['#2b1d14', '#c2410c', '#f5b83d'],
  'azul-anil': ['#0f1e3d', '#1d4ed8', '#f59e0b'],
};

export interface PaletaPersonalizada {
  nombre: string;
  /** Cabeceras, barras y menús */
  cabecera: string;
  /** Botones y acciones principales */
  boton: string;
  /** Enlaces, precios destacados, insignias y fondos suaves */
  resaltado: string;
}

export function esPaletaFija(v: unknown): v is PaletaFija {
  return typeof v === 'string' && (PALETAS as readonly string[]).includes(v);
}

/** Id válido para guardar: una fija o una personalizada que exista */
export function esPaleta(v: unknown, personalizadas: Record<string, PaletaPersonalizada> = {}): v is Paleta {
  return esPaletaFija(v) || (typeof v === 'string' && !!personalizadas[v]);
}

/* ---------------- Color: contraste y mezclas ---------------- */

export const esHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function rgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function aHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
}
/** Mezcla `a` hacia `b`; t=0 → a, t=1 → b */
export function mezclar(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return aHex(x.map((v, i) => v + (y[i] - v) * t));
}
function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Contraste WCAG entre dos colores (1 a 21) */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Acerca `color` a `hacia` lo mínimo necesario para tener `minimo` de contraste con `fondo` */
function asegurar(color: string, fondo: string, minimo: number, hacia: string): string {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mezclar(color, hacia, t);
    if (contraste(c, fondo) >= minimo) return c;
  }
  return hacia;
}
/** Texto blanco o casi negro, el que más contraste tenga sobre `fondo` */
export function textoSobre(fondo: string): string {
  return contraste(fondo, '#ffffff') >= contraste(fondo, '#141414') ? '#ffffff' : '#141414';
}

const BLANCO = '#ffffff';
const NEGRO = '#000000';
const SUPERFICIE_OSCURA = '#1a1a1a';

/**
 * Tokens de una paleta personalizada, en claro y en oscuro. Mismos nombres que en
 * ColorsVarCss.css; los neutros (fondos, texto, bordes) se quedan los de por defecto.
 */
export function tokensPersonalizados(p: PaletaPersonalizada) {
  const cabecera = asegurar(p.cabecera, BLANCO, 4.5, NEGRO);
  const textoMarca = asegurar(p.resaltado, BLANCO, 4.5, NEGRO);
  const claro: Record<string, string> = {
    '--color-bg-blue-dark': cabecera,
    '--color-bg-blue-ligth': p.boton,
    '--on-primary': textoSobre(p.boton),
    '--color-acento': p.resaltado,
    '--on-acento': textoSobre(p.resaltado),
    '--color-link-hover': mezclar(textoMarca, NEGRO, 0.25),
    '--brand-navy-text': cabecera,
    '--brand-blue-text': textoMarca,
    '--brand-blue-soft': mezclar(p.resaltado, BLANCO, 0.88),
    '--brand-blue-soft-hover': mezclar(p.resaltado, BLANCO, 0.78),
  };
  // En oscuro: cabecera más oscura, botón y resaltado se aclaran hasta distinguirse del fondo
  const botonOscuro = asegurar(p.boton, SUPERFICIE_OSCURA, 3, BLANCO);
  const textoMarcaOscuro = asegurar(p.resaltado, SUPERFICIE_OSCURA, 4.5, BLANCO);
  const oscuro: Record<string, string> = {
    '--color-bg-blue-dark': asegurar(mezclar(p.cabecera, NEGRO, 0.35), BLANCO, 7, NEGRO),
    '--color-bg-blue-ligth': botonOscuro,
    '--on-primary': textoSobre(botonOscuro),
    '--color-acento': p.resaltado,
    '--on-acento': textoSobre(p.resaltado),
    '--color-link-hover': mezclar(textoMarcaOscuro, BLANCO, 0.3),
    '--brand-navy-text': '#f2f2ee',
    '--brand-blue-text': textoMarcaOscuro,
    '--brand-blue-soft': mezclar(p.resaltado, SUPERFICIE_OSCURA, 0.82),
    '--brand-blue-soft-hover': mezclar(p.resaltado, SUPERFICIE_OSCURA, 0.74),
  };
  return { claro, oscuro };
}

/** Avisos de contraste para mostrar al admin mientras elige colores */
export function avisosContraste(p: PaletaPersonalizada): string[] {
  const avisos: string[] = [];
  if (contraste(p.cabecera, BLANCO) < 4.5) avisos.push('La cabecera es clara: se oscurecerá para que el texto blanco se lea.');
  if (contraste(p.boton, textoSobre(p.boton)) < 4.5) avisos.push('El texto sobre los botones queda con poco contraste. Prueba un botón más oscuro o más claro.');
  if (contraste(p.resaltado, BLANCO) < 4.5) avisos.push('El resaltado es claro: en textos y enlaces se usará una versión más oscura.');
  return avisos;
}

const bloque = (sel: string, vars: Record<string, string>) =>
  `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;

export function cssPersonalizado(p: PaletaPersonalizada): string {
  const { claro, oscuro } = tokensPersonalizados(p);
  const sel = ':root[data-paleta="personalizada"]';
  return bloque(sel, claro) + `@media (prefers-color-scheme: dark){${bloque(sel, oscuro)}}`;
}

/* ---------------- Aplicar ---------------- */

const THEME_COLOR: Record<PaletaFija, string> = {
  'carbon-lima': '#141414',
  'rosa-negro': '#141414',
  'naranja-cacao': '#2b1d14',
  'azul-anil': '#0f1e3d',
};
const CLAVE = 'paleta';
const CLAVE_CSS = 'paleta-css';
const ID_STYLE = 'paleta-personalizada';

function guardarLocal(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: solo se pierde el recuerdo para la próxima carga */
  }
}

/**
 * Aplica una paleta a toda la página. Si el id no existe (p. ej. una personalizada
 * que se borró) usa la de por defecto.
 */
export function aplicarPaleta(paleta: Paleta, personalizadas: Record<string, PaletaPersonalizada> = {}) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  const propia = !esPaletaFija(paleta) ? personalizadas[paleta] : undefined;
  let style = document.getElementById(ID_STYLE) as HTMLStyleElement | null;

  let colorBarra: string;
  if (propia) {
    const css = cssPersonalizado(propia);
    if (!style) {
      style = document.createElement('style');
      style.id = ID_STYLE;
      document.head.appendChild(style);
    }
    style.textContent = css;
    raiz.dataset.paleta = 'personalizada';
    colorBarra = tokensPersonalizados(propia).claro['--color-bg-blue-dark'];
    guardarLocal(CLAVE, 'personalizada');
    guardarLocal(CLAVE_CSS, css);
  } else {
    const fija = esPaletaFija(paleta) ? paleta : PALETA_DEFAULT;
    style?.remove();
    raiz.dataset.paleta = fija;
    colorBarra = THEME_COLOR[fija];
    guardarLocal(CLAVE, fija);
    guardarLocal(CLAVE_CSS, null);
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = m.media.includes('dark') ? '#0d0d0d' : colorBarra;
  });
}
