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
export const PALETAS = ['carbon-lima', 'rosa-negro', 'naranja-cacao', 'azul-anil', 'crustore'] as const;
export type PaletaFija = (typeof PALETAS)[number];
/** Una paleta fija o el id de una personalizada */
export type Paleta = string;
export const PALETA_DEFAULT: PaletaFija = 'carbon-lima';

// Los ids vienen de las paletas anteriores; se conservan para que la elección
// guardada en `configuracion/apariencia/paleta` siga funcionando.
export const NOMBRE_PALETA: Record<PaletaFija, string> = {
  'carbon-lima': 'A · Pin de tienda',
  'rosa-negro': 'B · Burbuja C',
  'naranja-cacao': 'C · Toldo de mercado',
  'azul-anil': 'D · Carrito C',
  crustore: 'Home · Crustore',
};

/** Los tres colores que se ven en la muestra de cada paleta fija: principal, principal en oscuro, acento */
export const MUESTRA_PALETA: Record<PaletaFija, [string, string, string]> = {
  'carbon-lima': ['#1c1f1a', '#c6f432', '#b5e61d'],
  'rosa-negro': ['#d6006f', '#ff2e97', '#ffffff'],
  'naranja-cacao': ['#e85d10', '#ff8a3d', '#3b2418'],
  'azul-anil': ['#2b3a8c', '#8fa6ff', '#f5a623'],
  crustore: ['#1f2430', '#ff2e97', '#7c4dff'],
};

/** Colores de la vista previa de temáticas (modo claro): cabecera, botón y texto del botón */
export const PREVIA_FIJA: Record<PaletaFija, { cabecera: string; boton: string; textoBoton: string }> = {
  'carbon-lima': { cabecera: '#1c1f1a', boton: '#1c1f1a', textoBoton: '#c6f432' },
  'rosa-negro': { cabecera: '#141414', boton: '#d6006f', textoBoton: '#ffffff' },
  'naranja-cacao': { cabecera: '#2a1911', boton: '#e85d10', textoBoton: '#2a1911' },
  'azul-anil': { cabecera: '#2b3a8c', boton: '#2b3a8c', textoBoton: '#ffffff' },
  crustore: { cabecera: '#1f2430', boton: '#ff2e97', textoBoton: '#1e232f' },
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
  // Destellos del logo (LogoCrustore.vue): dependen del fondo sobre el que va el logo,
  // no del modo del sistema, así que van iguales en claro y en oscuro.
  const logo = tokensLogo(p, cabecera, textoMarca);
  return { claro: { ...claro, ...logo }, oscuro: { ...oscuro, ...logo } };
}

/**
 * Colores de los destellos del logo para una paleta personalizada: estrella central y
 * chispa con el resaltado, destello y punto con el color de los botones. Sobre fondo
 * claro se oscurecen y sobre fondo oscuro se aclaran hasta tener 3:1 (se distinguen
 * como gráfico aunque no sean texto).
 */
export function tokensLogo(p: PaletaPersonalizada, cabecera: string, textoMarca: string): Record<string, string> {
  const sobreClaro = (c: string) => asegurar(c, BLANCO, 3, NEGRO);
  const sobreOscuro = (c: string) => asegurar(asegurar(c, cabecera, 3, BLANCO), SUPERFICIE_OSCURA, 3, BLANCO);
  return {
    '--logo-claro-estrella': sobreClaro(p.resaltado),
    '--logo-claro-destello': sobreClaro(p.boton),
    '--logo-claro-chispa': textoMarca,
    '--logo-claro-punto': sobreClaro(p.boton),
    '--logo-oscuro-estrella': sobreOscuro(p.resaltado),
    '--logo-oscuro-destello': sobreOscuro(p.boton),
    '--logo-oscuro-chispa': sobreOscuro(mezclar(p.resaltado, BLANCO, 0.35)),
    '--logo-oscuro-punto': sobreOscuro(p.boton),
  };
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
  'carbon-lima': '#1c1f1a',
  'rosa-negro': '#141414',
  'naranja-cacao': '#2a1911',
  'azul-anil': '#2b3a8c',
  crustore: '#1f2430',
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
