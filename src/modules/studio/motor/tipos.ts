/**
 * CG-Rat Promo Studio — motor de diseño (reglas puras, sin DOM): describe una pieza como una lista de
 * elementos (`Elem`) que luego el editor (Fabric.js) convierte en objetos del lienzo.
 */

export interface Formato {
  id: string;
  nombre: string;
  w: number;
  h: number;
}

export const FORMATOS_ESTUDIO: Formato[] = [
  { id: 'flyer', nombre: 'Flyer vertical 2:3', w: 1080, h: 1620 },
  { id: 'post', nombre: 'Publicación 1:1', w: 1080, h: 1080 },
  { id: 'vertical', nombre: 'Publicación 4:5', w: 1080, h: 1350 },
  { id: 'historia', nombre: 'Historia / estado 9:16', w: 1080, h: 1920 },
  { id: 'banner', nombre: 'Banner horizontal 16:9', w: 1920, h: 1080 },
];

export type Orientacion = 'v' | 's' | 'h';
/** Vertical alto, cuadrada o horizontal, según el formato */
export const orientacionDe = (w: number, h: number): Orientacion => (w >= h * 1.2 ? 'h' : h >= w * 1.3 ? 'v' : 's');

export interface DatosProducto {
  nombre: string;
  precio: number | null;
  precioAntes: number | null;
  descripcion: string;
  categoria: string;
  medidas: string;
  disponibilidad: string;
  color: string;
  caracteristicas: string[];
  tienda: string;
  /** Hay logo de la tienda para colocar */
  conLogo?: boolean;
  /** Línea pequeña sobre el título: "HOY JUEVES", "NOVEDAD"… */
  kicker: string;
  /** Llamada a la acción: "Haz tu pedido" */
  cta: string;
  telefono: string;
}

export const DATOS_VACIOS: DatosProducto = {
  nombre: '', precio: null, precioAntes: null, descripcion: '', categoria: '', medidas: '', disponibilidad: 'Disponible', color: '', caracteristicas: [], tienda: '', conLogo: false, kicker: '', cta: '', telefono: '',
};

export type TipoElem = 'rect' | 'circle' | 'poly' | 'texto' | 'imagen' | 'linea';

export interface Degradado {
  tipo: 'lineal' | 'radial';
  /** Colores de arriba abajo (lineal) o del centro al borde (radial) */
  colores: string[];
}

export interface Elem {
  id: string;
  /** Qué es: fondo, titulo, precio, producto, decor-…; sirve para reglas y para el panel de capas */
  rol: string;
  nombre: string;
  tipo: TipoElem;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  opacidad?: number;
  fill?: string;
  degradado?: Degradado;
  stroke?: string;
  strokeW?: number;
  rx?: number;
  /** Para poly: puntos relativos a la caja (0..w, 0..h) */
  puntos?: number[][];
  texto?: string;
  fuente?: string;
  tam?: number;
  peso?: number;
  alinear?: 'left' | 'center' | 'right';
  interlineado?: number;
  espaciado?: number;
  sombra?: { color: string; blur: number; x: number; y: number };
  trazo?: { color: string; w: number };
  tachado?: boolean;
  /** imagen: cuál de las imágenes cargadas es */
  imagen?: 'producto' | 'logo';
  ajuste?: 'cubrir' | 'contener';
  /** Forma en que se recorta la foto (además de las esquinas redondeadas) */
  mascara?: 'circulo' | 'arco' | 'capsula';
  /** Puede quedar encima del producto a propósito (etiquetas de precio y descuento) */
  permiteSolape?: boolean;
}

export interface Paleta {
  id: string;
  nombre: string;
  fondoA: string;
  fondoB: string;
  titulo: string;
  texto: string;
  acento: string;
  acento2: string;
  sobreAcento: string;
  /** Barras de información */
  barra: string;
  textoBarra: string;
}

export const FUENTES = {
  impacto: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
  moderna: '"Trebuchet MS", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  elegante: 'Georgia, "Times New Roman", serif',
  redonda: '"Comic Sans MS", "Chalkboard SE", "Segoe UI", sans-serif',
  limpia: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"Courier New", monospace',
  /** Letras muy gruesas y anchas para títulos de cartel */
  cartel: '"Arial Black", "Helvetica Neue", Impact, sans-serif',
} as const;

export type LayoutId = 'hero-product' | 'price-focus' | 'editorial' | 'playful' | 'minimal' | 'catalog' | 'cartel' | 'bloques' | 'arco';
export const LAYOUTS: { id: LayoutId; nombre: string }[] = [
  { id: 'hero-product', nombre: 'Producto protagonista' },
  { id: 'price-focus', nombre: 'Precio protagonista' },
  { id: 'editorial', nombre: 'Editorial' },
  { id: 'playful', nombre: 'Divertido' },
  { id: 'minimal', nombre: 'Minimalista' },
  { id: 'catalog', nombre: 'Catálogo' },
  { id: 'cartel', nombre: 'Cartel' },
  { id: 'bloques', nombre: 'Bloque de color' },
  { id: 'arco', nombre: 'Arco' },
];

export type DecorId =
  | 'confeti' | 'estrellas' | 'burbujas' | 'destellos' | 'rayos' | 'franjas' | 'colinas' | 'sol' | 'tablones'
  | 'papel-picado' | 'puntos' | 'marco' | 'brillo' | 'circulos' | 'lineas' | 'esquinas' | 'tablero' | 'rayas';

export interface Estilo {
  id: string;
  nombre: string;
  descripcion: string;
  /** Layouts que le quedan bien, en el orden en que se proponen */
  layouts: LayoutId[];
  paletas: Paleta[];
  fuenteTitulo: string;
  fuenteTexto: string;
  fuentePrecio: string;
  decor: DecorId[];
  /** Cómo se dibuja la etiqueta del precio */
  precioForma: 'chapa' | 'burst' | 'plano';
}

const pal = (id: string, nombre: string, fondoA: string, fondoB: string, titulo: string, texto: string, acento: string, acento2: string, sobreAcento: string, barra: string, textoBarra: string): Paleta => ({
  id, nombre, fondoA, fondoB, titulo, texto, acento, acento2, sobreAcento, barra, textoBarra,
});

export const ESTILOS: Estilo[] = [
  {
    id: 'fiesta', nombre: 'Fiesta infantil', descripcion: 'Colores alegres, confeti y formas divertidas',
    layouts: ['playful', 'hero-product', 'price-focus'], fuenteTitulo: FUENTES.redonda, fuenteTexto: FUENTES.redonda, fuentePrecio: FUENTES.impacto,
    decor: ['confeti', 'estrellas', 'burbujas', 'destellos'], precioForma: 'burst',
    paletas: [
      pal('fiesta-1', 'Chicle', '#ff4f9a', '#7b2ff7', '#ffffff', '#ffffff', '#ffe14d', '#2ee6c8', '#3a0a5e', 'rgba(58,10,94,0.78)', '#ffffff'),
      pal('fiesta-2', 'Cielo', '#27b7ff', '#6a5cff', '#ffffff', '#ffffff', '#ffd23f', '#ff5da2', '#1b1456', 'rgba(27,20,86,0.78)', '#ffffff'),
      pal('fiesta-3', 'Sol', '#ffb703', '#fb5607', '#ffffff', '#fff7e0', '#3a0ca3', '#ffffff', '#ffffff', 'rgba(60,20,0,0.72)', '#ffffff'),
    ],
  },
  {
    id: 'granja', nombre: 'Granja', descripcion: 'Verdes, amarillos, madera y campo',
    layouts: ['hero-product', 'price-focus', 'playful', 'catalog'], fuenteTitulo: FUENTES.impacto, fuenteTexto: FUENTES.moderna, fuentePrecio: FUENTES.impacto,
    decor: ['colinas', 'sol', 'tablones', 'rayos'], precioForma: 'chapa',
    paletas: [
      pal('granja-1', 'Pradera', '#4aa8ff', '#bfe6ff', '#ffe03a', '#ffffff', '#ffd400', '#2e8b2e', '#0f3d12', 'rgba(15,61,18,0.88)', '#ffffff'),
      pal('granja-2', 'Maizal', '#ffe9a8', '#ffc84a', '#1f5e1f', '#2b2b1a', '#2e8b2e', '#8a5a2b', '#ffffff', 'rgba(31,94,31,0.9)', '#ffffff'),
    ],
  },
  {
    id: 'premium', nombre: 'Premium', descripcion: 'Fondos oscuros, luz dramática y elegancia',
    layouts: ['editorial', 'hero-product', 'minimal'], fuenteTitulo: FUENTES.elegante, fuenteTexto: FUENTES.limpia, fuentePrecio: FUENTES.elegante,
    decor: ['brillo', 'marco', 'lineas', 'destellos'], precioForma: 'plano',
    paletas: [
      pal('premium-1', 'Oro negro', '#1b1b1f', '#000000', '#f5efe0', '#d9d2c2', '#d4af37', '#8f7420', '#1b1b1f', 'rgba(255,255,255,0.08)', '#f5efe0'),
      pal('premium-2', 'Noche plata', '#0d1b2a', '#1b263b', '#ffffff', '#cfd8e3', '#c0c9d6', '#778da9', '#0d1b2a', 'rgba(255,255,255,0.09)', '#ffffff'),
    ],
  },
  {
    id: 'oferta', nombre: 'Oferta comercial', descripcion: 'Precio grande, contraste alto y etiquetas de promoción',
    layouts: ['price-focus', 'hero-product', 'playful'], fuenteTitulo: FUENTES.impacto, fuenteTexto: FUENTES.moderna, fuentePrecio: FUENTES.impacto,
    decor: ['rayos', 'franjas', 'estrellas', 'circulos'], precioForma: 'burst',
    paletas: [
      pal('oferta-1', 'Rojo oferta', '#e01e1e', '#8e0f0f', '#ffffff', '#ffffff', '#ffe14d', '#ffffff', '#6b0b0b', 'rgba(0,0,0,0.45)', '#ffffff'),
      pal('oferta-2', 'Negro y amarillo', '#141414', '#2b2b2b', '#ffffff', '#f2f2f2', '#ffd400', '#ff3b3b', '#141414', 'rgba(255,212,0,0.16)', '#ffffff'),
    ],
  },
  {
    id: 'artesanal', nombre: 'Mexicano artesanal', descripcion: 'Papel picado, colores tradicionales y fiesta',
    layouts: ['playful', 'editorial', 'hero-product'], fuenteTitulo: FUENTES.redonda, fuenteTexto: FUENTES.moderna, fuentePrecio: FUENTES.impacto,
    decor: ['papel-picado', 'puntos', 'esquinas', 'estrellas'], precioForma: 'chapa',
    paletas: [
      pal('artesanal-1', 'Talavera', '#fff1d6', '#ffd9a0', '#c2185b', '#4a2410', '#00a99d', '#f57c00', '#ffffff', 'rgba(194,24,91,0.92)', '#ffffff'),
      pal('artesanal-2', 'Cempasúchil', '#ff8a00', '#c2185b', '#ffffff', '#fff3e0', '#ffe14d', '#00bfa5', '#5a1030', 'rgba(90,16,48,0.8)', '#ffffff'),
    ],
  },
  {
    id: 'minimalista', nombre: 'Minimalista', descripcion: 'Producto protagonista, fondo limpio y espacio',
    layouts: ['minimal', 'editorial', 'hero-product'], fuenteTitulo: FUENTES.limpia, fuenteTexto: FUENTES.limpia, fuentePrecio: FUENTES.limpia,
    decor: ['circulos', 'lineas', 'puntos'], precioForma: 'plano',
    paletas: [
      pal('minimal-1', 'Hueso', '#f6f3ee', '#ece7de', '#1d1d1d', '#4a4a4a', '#1d1d1d', '#b9a88a', '#ffffff', 'rgba(0,0,0,0.05)', '#1d1d1d'),
      pal('minimal-2', 'Gris frío', '#eef1f5', '#dfe5ec', '#12202e', '#44566a', '#12202e', '#7e9bb8', '#ffffff', 'rgba(18,32,46,0.06)', '#12202e'),
    ],
  },
  {
    id: 'catalogo', nombre: 'Catálogo', descripcion: 'Ordenado, con datos técnicos y presentación clara',
    layouts: ['catalog', 'hero-product', 'editorial'], fuenteTitulo: FUENTES.moderna, fuenteTexto: FUENTES.moderna, fuentePrecio: FUENTES.moderna,
    decor: ['lineas', 'esquinas', 'puntos'], precioForma: 'plano',
    paletas: [
      pal('catalogo-1', 'Azul técnico', '#ffffff', '#e9eef6', '#12325c', '#2b3a4f', '#1f5fbf', '#12325c', '#ffffff', 'rgba(18,50,92,0.07)', '#12325c'),
      pal('catalogo-2', 'Verde fresco', '#ffffff', '#e6f4ea', '#14532d', '#2b3f33', '#1b9e4b', '#14532d', '#ffffff', 'rgba(20,83,45,0.08)', '#14532d'),
    ],
  },
  {
    id: 'cartel-gastro', nombre: 'Cartel gastronómico', descripcion: 'Tipografía enorme, fondo de tablero y foto en círculo',
    layouts: ['cartel', 'arco', 'bloques'], fuenteTitulo: FUENTES.cartel, fuenteTexto: FUENTES.limpia, fuentePrecio: FUENTES.cartel,
    decor: ['tablero'], precioForma: 'plano',
    paletas: [
      pal('gastro-1', 'Terracota', '#fff7ee', '#fde9d9', '#c2411b', '#b13a16', '#c2411b', '#f4a261', '#fff7ee', 'rgba(194,65,27,0.10)', '#8f2f10'),
      pal('gastro-2', 'Salsa verde', '#f4f8ee', '#e3efd3', '#1f5e2e', '#1f5e2e', '#2e8b3f', '#f2c94c', '#f4f8ee', 'rgba(31,94,46,0.10)', '#174a24'),
    ],
  },
  {
    id: 'cartel-urbano', nombre: 'Cartel urbano', descripcion: 'Fondo oscuro, rayas y un color eléctrico',
    layouts: ['cartel', 'bloques', 'arco'], fuenteTitulo: FUENTES.cartel, fuenteTexto: FUENTES.limpia, fuentePrecio: FUENTES.cartel,
    decor: ['rayas', 'puntos'], precioForma: 'plano',
    paletas: [
      pal('urbano-1', 'Lima', '#121212', '#1d1d1d', '#ffffff', '#e8e8e8', '#c6f432', '#ff6b35', '#121212', 'rgba(255,255,255,0.08)', '#ffffff'),
      pal('urbano-2', 'Fucsia', '#14101f', '#201838', '#ffffff', '#e9e4f5', '#ff3d9a', '#ffd23f', '#14101f', 'rgba(255,255,255,0.08)', '#ffffff'),
    ],
  },
  {
    id: 'bloque-color', nombre: 'Bloque de color', descripcion: 'Un gran bloque de color con la foto cruzando el borde',
    layouts: ['bloques', 'arco', 'cartel'], fuenteTitulo: FUENTES.cartel, fuenteTexto: FUENTES.limpia, fuentePrecio: FUENTES.cartel,
    decor: [], precioForma: 'plano',
    paletas: [
      pal('bloque-1', 'Coral y crema', '#fff6ef', '#ffe9dc', '#1f2a44', '#1f2a44', '#ff5a36', '#ffd23f', '#ffffff', 'rgba(31,42,68,0.08)', '#1f2a44'),
      pal('bloque-2', 'Turquesa', '#fffaf0', '#fdf0d5', '#0b3c49', '#0b3c49', '#e4572e', '#2ec4b6', '#ffffff', 'rgba(11,60,73,0.08)', '#0b3c49'),
    ],
  },
  {
    id: 'personalizado', nombre: 'Personalizado', descripcion: 'Empiezas desde cero: solo tu producto y tus datos',
    layouts: ['minimal'], fuenteTitulo: FUENTES.moderna, fuenteTexto: FUENTES.moderna, fuentePrecio: FUENTES.moderna,
    decor: [], precioForma: 'plano',
    paletas: [pal('personal-1', 'Carbón', '#2a2c31', '#1c1d21', '#ffffff', '#e5e7eb', '#c6f432', '#ffd166', '#1c1d21', 'rgba(255,255,255,0.08)', '#ffffff')],
  },
];

export const estiloPorId = (id: string): Estilo => ESTILOS.find((e) => e.id === id) ?? ESTILOS[0];

/** Una propuesta lista para mostrar o abrir en el editor */
export interface Propuesta {
  id: string;
  estilo: string;
  layout: LayoutId;
  paleta: string;
  /** Paleta completa cuando no es una del estilo (p. ej. la del tema de Crustore) */
  paletaObj?: Paleta;
  semilla: number;
  formato: Formato;
  elems: Elem[];
}
