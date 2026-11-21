/**
 * Agente de WhatsApp: reglas puras (sin red, sin base, sin reloj propio) para probarlas solas.
 *
 * Quien escribe elige primero si es CLIENTE o TIENDA:
 *  - CLIENTE: consulta tiendas, artículos, precios, horarios, ubicaciones y lo demás que ve en la app.
 *  - TIENDA: entra con celular + contraseña (la sesión dura hasta el fin del día, hora de México) y
 *    puede publicar artículos, ver los datos de SU tienda y cambiar su perfil, siempre con confirmación.
 */
import { normalizarEnlace } from '../../utils/enlaces.ts';

export const ZONA_HORARIA = 'America/Mexico_City';
export const MAX_INTENTOS_PASSWORD = 5;
export const MINUTOS_BLOQUEO = 15;
export const MAX_MENSAJES_POR_VENTANA = 20;
export const MINUTOS_VENTANA = 10;
export const MAX_PRECIO = 1_000_000;
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
export const MIMES_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

export const soloDigitos = (t: unknown) => String(t ?? '').replace(/\D/g, '');

/** WhatsApp entrega el número con lada de país (521… o 52…): la base guarda los 10 dígitos */
export const diezDigitos = (waId: unknown) => soloDigitos(waId).slice(-10);

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normalizar = (t: unknown) => sinAcentos(String(t ?? '').toLowerCase()).trim();

/* ---------------- comandos y respuestas cortas ---------------- */

export type Comando = 'entrar' | 'salir' | 'ayuda' | 'menu' | 'cancelar' | 'datos' | null;

export function comandoDe(texto: unknown): Comando {
  const t = normalizar(texto).replace(/[^a-z ]/g, '').trim();
  if (['entrar', 'login', 'iniciar sesion', 'soy tienda', 'administrar', 'administrador', 'admin'].includes(t)) return 'entrar';
  if (['salir', 'cerrar sesion', 'logout'].includes(t)) return 'salir';
  if (['hola', 'menu', 'inicio', 'cambiar', 'cambiar de rol', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'].includes(t)) return 'menu';
  if (['ayuda', 'help', 'que puedes hacer', 'comandos'].includes(t)) return 'ayuda';
  if (['cancelar', 'cancela', 'descartar'].includes(t)) return 'cancelar';
  if (['mi tienda', 'datos', 'mis datos', 'ver mi tienda', 'perfil', 'mi perfil', 'datos de mi tienda'].includes(t)) return 'datos';
  return null;
}

/** Respuesta a "¿eres cliente o tienda?" (botón o texto) */
export function rolDe(texto: unknown): 'cliente' | 'tienda' | null {
  const t = normalizar(texto).replace(/[^a-z0-9 _]/g, '').trim();
  if (['rol_cliente', 'cliente', 'soy cliente', 'comprar', '1'].includes(t)) return 'cliente';
  if (['rol_tienda', 'tienda', 'soy tienda', 'administrar', 'administrador', 'admin', '2'].includes(t)) return 'tienda';
  return null;
}

export const esSi = (t: unknown) => /^(si|s|ok|dale|va|guardar|confirmo|confirmar|correcto|claro|publicar|publica|publicalo)\b/.test(normalizar(t));
export const esNo = (t: unknown) => /^(no|n|nel|cancelar|descartar|nada)\b/.test(normalizar(t));

/* ---------------- sesión y límites ---------------- */

/* ---------------- tiempo (siempre en hora de México, no la del servidor) ---------------- */

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

/** "2026-11-20": el día en México. La sesión de una tienda vale hasta que este valor cambie */
export const diaMx = (ms: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

/** { dia: 'Viernes', hora: '14:35' } en México */
export function momentoMx(ms: number): { dia: string; hora: string } {
  const partes = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_HORARIA, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dia = DIAS_SEMANA.find((d) => normalizar(d) === normalizar(v('weekday'))) ?? '';
  return { dia, hora: `${String(Number(v('hour')) % 24).padStart(2, '0')}:${v('minute')}` };
}

/** Ventana deslizante por número, para no gastar la cuota gratuita de la IA */
export function permitirMensaje(marcas: number[], ahoraMs: number): { permitido: boolean; marcas: number[] } {
  const desde = ahoraMs - MINUTOS_VENTANA * 60_000;
  const recientes = marcas.filter((m) => m > desde);
  if (recientes.length >= MAX_MENSAJES_POR_VENTANA) return { permitido: false, marcas: recientes };
  return { permitido: true, marcas: [...recientes, ahoraMs] };
}

/* ---------------- membresía (misma regla que useMembresia.membresiaVigente) ---------------- */

/**
 * Para PUBLICAR hace falta tienda activa y membresía con fecha de vigencia que no haya pasado.
 * Es la misma regla que `membresiaVigente` de la app, repetida aquí porque el servidor no puede
 * importar composables de Vue/Firebase. Si cambia allá, cambia aquí (hay prueba que las compara).
 */
export function tienePermisoPublicar(
  tienda: { estatus?: string; membresia?: { vigenteHasta?: string; plan?: string } } | null | undefined,
  hoy: Date,
  diasGracia = 0,
): boolean {
  if ((tienda?.estatus ?? 'activa') !== 'activa') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tienda?.membresia?.vigenteHasta ?? '');
  if (!m) return false;
  const limite = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999);
  const esPrueba = tienda?.membresia?.plan === 'prueba';
  limite.setDate(limite.getDate() + (esPrueba ? 0 : Math.max(0, diasGracia)));
  return hoy.getTime() <= limite.getTime();
}

/* ---------------- borrador de artículo (lo que extrae la IA) ---------------- */

export interface Borrador {
  nombre: string;
  descripcion: string;
  precio: number;
  /** -1 = sin control de existencias */
  stock: number;
  unidadMedida: string;
  marca: string;
  color: string;
  tamano: string;
  material: string;
  categoriaId: string;
  categoria: string;
  porPedido: boolean;
}

const texto = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** "$1,250.50", "120 pesos", 99 → número; null si no hay un precio utilizable */
export function leerPrecio(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export interface CategoriaLite {
  id: string;
  nombre: string;
  padreId?: string;
}

/**
 * Valida lo que devolvió la IA. NUNCA se publica nada que no pase por aquí: el modelo es una
 * fuente no confiable (la foto o el texto pueden traer instrucciones), así que se acota todo.
 */
export function validarBorrador(
  crudo: any,
  categorias: CategoriaLite[],
): { ok: true; borrador: Borrador } | { ok: false; falta: string[] } {
  const falta: string[] = [];
  const nombre = texto(crudo?.nombre, 80);
  if (nombre.length < 2) falta.push('el nombre del artículo');

  const precio = leerPrecio(crudo?.precio);
  if (precio === null || precio <= 0 || precio > MAX_PRECIO) falta.push('el precio');

  if (falta.length) return { ok: false, falta };

  const porPedido = crudo?.porPedido === true;
  const stockNum = Number(crudo?.stock);
  const stock = porPedido || !Number.isFinite(stockNum) || stockNum < 1 ? -1 : Math.min(Math.trunc(stockNum), 100_000);

  // La categoría solo vale si existe en la base (la IA recibe la lista, pero se comprueba)
  const wanted = normalizar(crudo?.categoria);
  const cat =
    categorias.find((c) => c.id === crudo?.categoriaId) ?? (wanted ? categorias.find((c) => normalizar(c.nombre) === wanted) : undefined);

  return {
    ok: true,
    borrador: {
      nombre,
      descripcion: texto(crudo?.descripcion, 500),
      precio: Math.round((precio as number) * 100) / 100,
      stock,
      unidadMedida: texto(crudo?.unidadMedida, 12) || 'pz',
      marca: texto(crudo?.marca, 40),
      color: texto(crudo?.color, 30),
      tamano: texto(crudo?.tamano, 30),
      material: texto(crudo?.material, 40),
      categoriaId: cat?.id ?? '',
      categoria: cat?.nombre ?? '',
      porPedido,
    },
  };
}

const pesos = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function resumenBorrador(b: Borrador, nombreTienda: string): string {
  const l = [`🛍️ *${b.nombre}*`, `💲 ${pesos(b.precio)}`];
  if (b.descripcion) l.push(`📝 ${b.descripcion}`);
  const det = [b.marca && `Marca: ${b.marca}`, b.color && `Color: ${b.color}`, b.tamano && `Tamaño: ${b.tamano}`, b.material && `Material: ${b.material}`].filter(Boolean);
  if (det.length) l.push(det.join(' · '));
  l.push(b.porPedido ? '📦 Bajo pedido' : b.stock === -1 ? '📦 Sin control de existencias' : `📦 Existencias: ${b.stock}`);
  l.push(`🏷️ Categoría: ${b.categoria || 'sin categoría'}`);
  l.push(`🏪 Tienda: ${nombreTienda}`);
  return l.join('\n');
}

/** Variante base, con la misma forma que crea el formulario de la app */
export function construirArticulo(
  b: Borrador,
  tienda: { id: string; nombreTienda: string },
  urlImagen: string,
  ahora: Date,
  sku: string,
) {
  const tieneStock = !b.porPedido && b.stock !== -1;
  return {
    nombre: b.nombre,
    descripcion: b.descripcion,
    categoria: b.categoria,
    categoriaId: b.categoriaId,
    subcategoria: '',
    url: urlImagen,
    precio: b.precio,
    anticipo: 0,
    descuentoCupon: 0,
    metodo_pago: '',
    unidadMedida: b.unidadMedida,
    almacen: '',
    tiendaId: tienda.id,
    tiendaNombre: tienda.nombreTienda,
    icono: '',
    fecha_hora: ahora.toISOString(),
    porPedido: b.porPedido,
    variantes: [
      {
        sku,
        color: b.color,
        colorCodigo: '',
        tamano: b.tamano,
        material: b.material,
        marca: b.marca,
        precio: b.precio,
        stock: tieneStock ? b.stock : -1,
        tieneStock,
        estatus: true,
        url: urlImagen,
        detalle: '',
        isDefault: true,
      },
    ],
  };
}

/* ---------------- lo que ve un cliente (tiendas y artículos) ---------------- */

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'con', 'por', 'para', 'que', 'hay', 'tienen', 'venden', 'quiero', 'busco', 'buscar', 'tienda', 'tiendas', 'hola', 'me', 'se', 'del', 'al', 'a', 'cual', 'cuales', 'cuanto', 'cuesta', 'precio', 'precios', 'horario', 'abre', 'abren', 'cierra', 'cierran', 'esta', 'estan', 'donde', 'ubicacion', 'direccion']);

export const palabrasClave = (t: unknown) =>
  normalizar(t)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !STOP.has(p));

const horaCorta = (d: any) => (d?.inicio && d?.fin ? `${d.inicio}-${d.fin}` : 'cerrado');

/** Horario como lo lee una persona: { Lunes: '09:00-18:00', Domingo: 'cerrado' } */
export function horarioLegible(horario: any): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const d of DIAS_SEMANA) salida[d] = horaCorta(horario?.[d]);
  return salida;
}

export interface TiendaPublica {
  nombre: string;
  categoria: string;
  descripcion: string;
  direccion: string;
  municipio: string;
  telefono: string;
  whatsapp: boolean;
  email: string;
  facebook: string;
  instagram: string;
  facebookUrl: string;
  instagramUrl: string;
  metodosPago: string[];
  envioDomicilio: boolean;
  zonasEntrega: string[];
  horario: Record<string, string>;
  faq: string;
  certificaciones: string;
  blog: string;
}

/** Solo lo que el perfil público de la app ya muestra a cualquier cliente (nunca contraseña ni control interno) */
export function tiendaPublica(t: any): TiendaPublica {
  const dir = [t?.calle && `${texto(t.calle, 80)} ${texto(t?.numero, 15)}`.trim(), t?.colonia && `Col. ${texto(t.colonia, 60)}`, t?.cp && `C.P. ${texto(t.cp, 5)}`, t?.municipio, t?.estado]
    .filter(Boolean)
    .map((x) => texto(x, 100))
    .join(', ');
  return {
    nombre: texto(t?.nombreTienda, 60),
    categoria: texto(t?.categoria, 40),
    descripcion: texto(t?.descripcion, 300),
    direccion: dir,
    municipio: texto(t?.municipio, 40),
    telefono: soloDigitos(t?.telefono),
    whatsapp: t?.incluyeWhatsapp === true,
    email: texto(t?.email, 80),
    facebook: texto(t?.facebook, 60),
    instagram: texto(t?.instagram, 60),
    facebookUrl: texto(t?.facebookUrl, 150),
    instagramUrl: texto(t?.instagramUrl, 150),
    metodosPago: Array.isArray(t?.metodosPago) ? t.metodosPago.map((x: unknown) => texto(x, 30)) : [],
    envioDomicilio: t?.envioDomicilio === true,
    zonasEntrega: Array.isArray(t?.zonasEntrega) ? t.zonasEntrega.slice(0, 20).map((x: unknown) => texto(x, 60)) : [],
    horario: horarioLegible(t?.horario),
    faq: texto(t?.faq, 400),
    certificaciones: texto(t?.certificaciones, 200),
    blog: texto(t?.blog, 150),
  };
}

export interface ArticuloPublico {
  nombre: string;
  precio: number;
  tienda: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  porPedido: boolean;
  ventaPausada: boolean;
  disponible: boolean;
  colores: string[];
  tamanos: string[];
  marcas: string[];
}

function articuloPublico(a: any): ArticuloPublico {
  const vars: any[] = Array.isArray(a?.variantes) ? a.variantes : Object.values(a?.variantes ?? {});
  const unicos = (campo: string) => [...new Set(vars.map((v) => texto(v?.[campo], 30)).filter(Boolean))].slice(0, 8);
  const porPedido = a?.porPedido === true;
  const hayExistencia = vars.length === 0 || vars.some((v) => v?.tieneStock === false || Number(v?.stock) === -1 || Number(v?.stock) > 0);
  return {
    nombre: texto(a?.nombre, 80),
    precio: Number(a?.precio) || 0,
    tienda: texto(a?.tiendaNombre, 60),
    descripcion: texto(a?.descripcion, 150),
    categoria: texto(a?.categoria, 40),
    unidad: texto(a?.unidadMedida, 12),
    porPedido,
    ventaPausada: a?.ventaPausada === true,
    disponible: porPedido || hayExistencia,
    colores: unicos('color'),
    tamanos: unicos('tamano'),
    marcas: unicos('marca'),
  };
}

export interface ResultadoCatalogo {
  articulos: ArticuloPublico[];
  tiendas: TiendaPublica[];
}

/** Busca en el catálogo público: tiendas que pueden vender y artículos sin dar de baja */
export function buscarCatalogo(
  tiendas: Record<string, any> | null,
  articulos: Record<string, any> | null,
  consulta: string,
  hoy: Date,
  limite = 5,
): ResultadoCatalogo {
  const claves = palabrasClave(consulta);
  const vendedoras = new Map<string, any>();
  for (const [id, t] of Object.entries(tiendas ?? {})) {
    if (t && typeof t === 'object' && tienePermisoPublicar(t, hoy, 0)) vendedoras.set(id, t);
  }
  const puntaje = (campos: unknown[]) => {
    const pajar = normalizar(campos.join(' '));
    return claves.reduce((n, k) => n + (pajar.includes(k) ? 1 : 0), 0);
  };
  const visibles = Object.entries(articulos ?? {}).filter(([, a]: [string, any]) => a && typeof a === 'object' && a.baja !== true && vendedoras.has(String(a.tiendaId)));

  const tiendasOrdenadas = [...vendedoras.entries()]
    .map(([id, t]) => ({ id, t, p: puntaje([t.nombreTienda, t.categoria, t.descripcion, t.municipio, t.colonia, t.estado]) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, limite);

  const arts = new Map<string, ArticuloPublico>();
  const guardar = (a: any) => {
    const pub = articuloPublico(a);
    arts.set(`${pub.tienda}|${pub.nombre}`, pub);
  };
  visibles
    .map(([, a]: [string, any]) => ({ a, p: puntaje([a.nombre, a.descripcion, a.categoria, a.tiendaNombre]) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, limite)
    .forEach(({ a }) => guardar(a));

  // Si preguntan por una tienda ("¿qué venden en Dulce?"), se agregan algunos de sus artículos
  for (const { id } of tiendasOrdenadas.slice(0, 2)) {
    visibles.filter(([, a]: [string, any]) => String(a.tiendaId) === id).slice(0, 4).forEach(([, a]) => guardar(a));
  }

  // Preguntas generales sin filtro ("¿qué tiendas hay?", "lista de tiendas", "¿qué venden?"): se muestra un listado
  const texto0 = normalizar(consulta);
  const pideTiendas = /\b(tiendas?|negocios?|comercios?)\b/.test(texto0);
  const pideArticulos = /\b(productos?|articulos?|catalogo|venden|ofrecen)\b/.test(texto0);
  if ((pideTiendas || pideArticulos) && claves.every((k) => PALABRAS_DE_LISTADO.has(k))) {
    const listaTiendas = [...vendedoras.values()].sort((a, b) => String(a.nombreTienda).localeCompare(String(b.nombreTienda), 'es')).slice(0, 10).map(tiendaPublica);
    const listaArticulos = [...visibles]
      .sort(([, a]: any, [, b]: any) => String(b.fecha_hora ?? '').localeCompare(String(a.fecha_hora ?? '')))
      .slice(0, 8)
      .map(([, a]) => articuloPublico(a));
    return { articulos: pideArticulos ? listaArticulos : [], tiendas: pideTiendas ? listaTiendas : [] };
  }

  return { articulos: [...arts.values()].slice(0, 8), tiendas: tiendasOrdenadas.map(({ t }) => tiendaPublica(t)) };
}

/** Palabras que, solas, significan "muéstrame todo" y no un filtro */
const PALABRAS_DE_LISTADO = new Set([
  'lista', 'listado', 'todas', 'todos', 'disponibles', 'registradas', 'existen', 'nuevas', 'nuevos', 'recientes', 'ultimos', 'ultimas',
  // el sustantivo mismo ("productos", "negocios"…) tampoco es un filtro
  'productos', 'producto', 'articulos', 'articulo', 'catalogo', 'venden', 'ofrecen', 'negocios', 'negocio', 'comercios', 'comercio',
]);

/**
 * Respuesta de emergencia SIN inteligencia artificial, para cuando Gemini no está disponible (cuota o saturación):
 * lo mismo que se le habría dado a la IA, pero en una lista simple.
 */
export function respuestaSinIA(c: ResultadoCatalogo, urlApp: string): string {
  const l = ['Ahora mismo mi asistente de IA no está disponible 😕, pero esto es lo que encontré:'];
  if (c.tiendas.length === 1) {
    const t = c.tiendas[0];
    l.push(`🏪 *${t.nombre}*${t.categoria ? ` (${t.categoria})` : ''}`);
    if (t.direccion) l.push(`📍 ${t.direccion}`);
    if (t.telefono) l.push(`📞 ${t.telefono}${t.whatsapp ? ' · WhatsApp' : ''}`);
    l.push('🕘 ' + DIAS_SEMANA.map((d) => `${d.slice(0, 3)} ${t.horario[d]}`).join(' · '));
    if (t.metodosPago.length) l.push(`💳 ${t.metodosPago.join(', ')}`);
    l.push(`🚚 Envío a domicilio: ${t.envioDomicilio ? 'sí' : 'no'}`);
  } else if (c.tiendas.length) {
    l.push('🏪 *Tiendas*');
    for (const t of c.tiendas) l.push(`• *${t.nombre}*${t.categoria ? ` — ${t.categoria}` : ''}${t.municipio ? `, ${t.municipio}` : ''}`);
  }
  if (c.articulos.length) {
    l.push('🛍️ *Artículos*');
    for (const a of c.articulos) l.push(`• *${a.nombre}* — $${a.precio.toLocaleString('es-MX')}${a.tienda ? ` en ${a.tienda}` : ''}${a.disponible ? '' : ' (agotado)'}`);
  }
  l.push(`Más detalle en ${urlApp}`);
  return l.join('\n');
}

/* ---------------- cambios al perfil de la tienda (lo que se puede pedir por chat) ---------------- */

export const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];

/**
 * ÚNICOS campos que el agente puede escribir en `tiendas/{id}`. Quedan fuera a propósito:
 * contraseña, celular (es la identidad del login), nombre (viaja copiado en cada artículo y lo
 * sincroniza la app), categoría, estado y membresía (control del administrador).
 */
export const CAMPOS_EDITABLES = [
  'descripcion', 'blog', 'faq', 'certificaciones', 'calle', 'numero', 'colonia', 'cp', 'municipio', 'estado',
  'email', 'facebook', 'instagram', 'facebookUrl', 'instagramUrl', 'incluyeWhatsapp', 'metodosPago',
  'envioDomicilio', 'zonasEntrega', 'horario', 'logoUrl', 'bannerUrl',
] as const;

export interface CambiosPerfil {
  cambios: Record<string, any>;
  /** Cada cambio en una línea, para mostrarlo antes de confirmar */
  lineas: string[];
  /** Lo que se pidió pero no se pudo aplicar, y por qué */
  ignorados: string[];
}

const TEXTOS: Record<string, [etiqueta: string, max: number, obligatorio: boolean]> = {
  descripcion: ['Descripción', 500, false], blog: ['Blog', 200, false], faq: ['Preguntas frecuentes', 600, false],
  certificaciones: ['Certificaciones', 300, false], calle: ['Calle', 80, true], numero: ['Número', 15, true],
  colonia: ['Colonia', 60, true], municipio: ['Municipio', 60, true], estado: ['Estado', 40, true],
  facebook: ['Facebook', 60, false], instagram: ['Instagram', 60, false],
};

export const normalizarDia = (v: unknown): string | null => {
  const t = normalizar(v);
  if (t.length < 3) return null;
  return DIAS_SEMANA.find((d) => normalizar(d) === t) ?? DIAS_SEMANA.find((d) => normalizar(d).startsWith(t.slice(0, 3))) ?? null;
};

export function horaValida(v: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Valida lo que propuso la IA. Un valor vacío (o la casilla "sin cambio") significa NO tocar ese dato:
 * el modelo puede devolver campos vacíos por no haberlos mencionado, y no deben borrar nada. Para
 * borrar un dato se usa la app.
 */
export function validarCambiosPerfil(crudo: any, actual: { horario?: any; envioDomicilio?: boolean } = {}): CambiosPerfil {
  const cambios: Record<string, any> = {};
  const lineas: string[] = [];
  const ignorados: string[] = [];
  const c = crudo && typeof crudo === 'object' ? crudo : {};

  for (const [campo, [etiqueta, max]] of Object.entries(TEXTOS)) {
    const v = texto(c[campo], max);
    if (!v) continue;
    cambios[campo] = v;
    lineas.push(`${etiqueta}: ${v}`);
  }

  const cp = soloDigitos(c.cp);
  if (c.cp !== undefined && String(c.cp).trim() !== '') {
    if (/^\d{5}$/.test(cp)) { cambios.cp = cp; lineas.push(`C.P.: ${cp}`); } else ignorados.push('el código postal (debe tener 5 dígitos)');
  }

  const email = texto(c.email, 80);
  if (email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { cambios.email = email; lineas.push(`Correo: ${email}`); } else ignorados.push('el correo (no es válido)');
  }

  for (const [campo, etiqueta] of [['facebookUrl', 'Enlace de Facebook'], ['instagramUrl', 'Enlace de Instagram']] as const) {
    const bruto = texto(c[campo], 150);
    if (!bruto) continue;
    const url = normalizarEnlace(bruto);
    if (url) { cambios[campo] = url; lineas.push(`${etiqueta}: ${url}`); } else ignorados.push(`${etiqueta.toLowerCase()} (no es una dirección válida)`);
  }

  const siNo = (v: unknown) => (normalizar(v) === 'si' ? true : normalizar(v) === 'no' ? false : null);
  const wa = siNo(c.incluyeWhatsapp);
  if (wa !== null) { cambios.incluyeWhatsapp = wa; lineas.push(`Atiende por WhatsApp: ${wa ? 'sí' : 'no'}`); }

  if (Array.isArray(c.metodosPago) && c.metodosPago.length) {
    const lista = [...new Set(c.metodosPago.map((x: unknown) => METODOS_PAGO.find((m) => normalizar(x).includes(normalizar(m).slice(0, 5)))).filter(Boolean))] as string[];
    if (lista.length) { cambios.metodosPago = lista; lineas.push(`Formas de pago: ${lista.join(', ')}`); } else ignorados.push(`las formas de pago (solo ${METODOS_PAGO.join(', ')})`);
  }

  const envio = siNo(c.envioDomicilio);
  const zonas = Array.isArray(c.zonasEntrega) ? [...new Set<string>(c.zonasEntrega.map((x: unknown) => texto(x, 60)).filter(Boolean))].slice(0, 20) : [];
  if (envio !== null) {
    cambios.envioDomicilio = envio;
    lineas.push(`Envío a domicilio: ${envio ? 'sí' : 'no'}`);
    if (!envio) cambios.zonasEntrega = [];
  }
  if (zonas.length && envio !== false) {
    cambios.zonasEntrega = zonas;
    lineas.push(`Zonas de entrega: ${zonas.join(', ')}`);
    if (envio === null && actual.envioDomicilio !== true) { cambios.envioDomicilio = true; lineas.push('Envío a domicilio: sí'); }
  }

  if (Array.isArray(c.horario) && c.horario.length) {
    const horario: Record<string, { inicio: string; fin: string }> = {};
    for (const d of DIAS_SEMANA) horario[d] = { inicio: String(actual.horario?.[d]?.inicio ?? ''), fin: String(actual.horario?.[d]?.fin ?? '') };
    const tocados: string[] = [];
    for (const h of c.horario) {
      const dia = normalizarDia(h?.dia);
      if (!dia) { ignorados.push(`un día del horario (“${texto(h?.dia, 20)}”)`); continue; }
      if (h?.cerrado === true) { horario[dia] = { inicio: '', fin: '' }; tocados.push(`${dia}: cerrado`); continue; }
      const ini = horaValida(h?.inicio);
      const fin = horaValida(h?.fin);
      if (!ini || !fin || ini >= fin) { ignorados.push(`el horario del ${dia.toLowerCase()} (abre y cierra con horas válidas, y abre antes de cerrar)`); continue; }
      horario[dia] = { inicio: ini, fin };
      tocados.push(`${dia}: ${ini}-${fin}`);
    }
    if (tocados.length) { cambios.horario = horario; lineas.push(`Horario → ${tocados.join('; ')}`); }
  }

  return { cambios, lineas, ignorados };
}

/** Los datos de SU tienda, para el administrador (incluye lo interno que el cliente no ve) */
export function resumenTienda(t: any, totalArticulos: number, hoy: Date): string {
  const p = tiendaPublica(t);
  const abierta = tienePermisoPublicar(t, hoy, 0);
  const hasta = String(t?.membresia?.vigenteHasta ?? '');
  const l = [`🏪 *${p.nombre || 'Tu tienda'}* (${p.categoria || 'sin categoría'})`];
  if (p.descripcion) l.push(`📝 ${p.descripcion}`);
  l.push(`📍 ${p.direccion || 'sin dirección'}`);
  l.push(`📞 ${p.telefono || '—'}${p.whatsapp ? ' · atiende por WhatsApp' : ''}${p.email ? ` · ${p.email}` : ''}`);
  if (p.facebook || p.instagram) l.push(`🔗 ${[p.facebook && `Facebook: ${p.facebook}`, p.instagram && `Instagram: ${p.instagram}`].filter(Boolean).join(' · ')}`);
  l.push(`💳 Pagos: ${p.metodosPago.join(', ') || '—'}`);
  l.push(`🚚 Envío a domicilio: ${p.envioDomicilio ? `sí${p.zonasEntrega.length ? ` (${p.zonasEntrega.join(', ')})` : ''}` : 'no'}`);
  l.push('🕘 Horario:\n' + DIAS_SEMANA.map((d) => `   ${d}: ${p.horario[d]}`).join('\n'));
  if (p.faq) l.push(`❓ ${p.faq}`);
  if (p.certificaciones) l.push(`🏅 ${p.certificaciones}`);
  l.push(`📦 Artículos publicados: ${totalArticulos}`);
  l.push(`🔖 Membresía: ${abierta ? '✅ vigente' : '⚠️ no vigente'}${hasta ? ` (hasta ${hasta})` : ''}`);
  return l.join('\n');
}

/** Perfil actual en formato compacto para la IA (sin contraseña ni control interno) */
export function perfilParaIA(t: any) {
  const p = tiendaPublica(t);
  return { descripcion: p.descripcion, direccion: p.direccion, email: p.email, facebook: p.facebook, instagram: p.instagram, whatsapp: p.whatsapp, metodosPago: p.metodosPago, envioDomicilio: p.envioDomicilio, zonasEntrega: p.zonasEntrega, horario: p.horario };
}
