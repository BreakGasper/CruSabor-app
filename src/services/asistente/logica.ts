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

/**
 * ¿El mensaje dice que el artículo es BAJO PEDIDO ("bajo pedido", "sobre pedido", "por encargo", "a pedido")?
 * true = sí lo dice; false = dice que ya NO lo es; null = no dice nada (se respeta lo que ya había).
 * Es una regla fija y no depende de que la IA lo adivine: de esto depende que la tienda no controle existencias.
 */
export function detectaBajoPedido(texto: unknown): boolean | null {
  const t = normalizar(texto);
  if (!t) return null;
  if (/\b(no|ya no|sin)\s+(es\s+|va a ser\s+|sera\s+)?((bajo|sobre)\s+pedido|por\s+(pedido|encargo)|a\s+pedido)\b/.test(t)) return false;
  if (/\b(bajo|sobre)\s+pedido\b|\bpor\s+(pedido|encargo)\b|\ba\s+pedido\b|\bencargo\b|\bse (hace|elabora|prepara)n?\s+(cuando|al)\s+(lo|los|la|las)?\s*(piden|piden|encargan|ordenan)\b/.test(t)) return true;
  return null;
}

const texto = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Precio escrito por la tienda en su mensaje ("$350", "350 pesos", "precio 350", "Pastel 350").
 * Es la red de seguridad cuando la IA no devuelve el precio aunque venga escrito: se lee con reglas fijas.
 * null si no se encuentra uno confiable (nunca se inventa).
 */
export function precioDelTexto(texto: unknown): number | null {
  const t = String(texto ?? '');
  const num = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
  const valor = (m: RegExpExecArray | null) => (m ? Number(m[1].replace(/,/g, '')) : null);
  // 1) con signo de pesos; 2) con "pesos/mxn"; 3) "precio ... N"
  const claro = valor(new RegExp(`\\$\\s*${num}`).exec(t)) ?? valor(new RegExp(`${num}\\s*(?:pesos|mxn|mx|m\\.n\\.)\\b`, 'i').exec(t)) ?? valor(new RegExp(`precio\\s*(?:de|es|:)?\\s*\\$?\\s*${num}`, 'i').exec(t));
  if (claro !== null) return claro > 0 && claro <= MAX_PRECIO ? claro : null;
  // 4) un único número suelto que no sea cantidad, medida ni talla ("Pastel de chocolate 350")
  const sueltos: number[] = [];
  const re = new RegExp(`(?<![\\w.])${num}(?![\\w.])(\\s*[a-záéíóúñ.]+)?`, 'gi');
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const unidad = normalizar(m[2] ?? '').replace(/\.$/, '');
    const antes = normalizar(t.slice(Math.max(0, m.index - 12), m.index));
    if (/^(pz|pza|pzas|pieza|piezas|unidad|unidades|kg|kilo|kilos|g|gr|gramo|gramos|ml|l|lt|litro|litros|cm|mm|m|mts|metro|metros|ano|anos|dia|dias|hora|horas|personas|porciones|colores|tamanos)$/.test(unidad)) continue;
    if (/(talla|tamano|numero|no|num|medida|cantidad|existencia|existencias|stock|hay|tengo|tenemos)\s*$/.test(antes)) continue;
    sueltos.push(Number(m[1].replace(/,/g, '')));
  }
  return sueltos.length === 1 && sueltos[0] > 0 && sueltos[0] <= MAX_PRECIO ? sueltos[0] : null;
}

/** Nombre probable al inicio del mensaje: lo que va antes de la primera coma, salto de línea, "$" o número ("Pastel de chocolate, $350…") */
export function nombreDelTexto(texto: unknown): string {
  const primero = String(texto ?? '').split(/[\n,;]|\$|\d/)[0] ?? '';
  const limpio = primero.replace(/\b(precio|cuesta|vale|a)\b\s*$/i, '').replace(/\s+/g, ' ').trim();
  return /\p{L}{2,}/u.test(limpio) ? limpio.slice(0, 80) : '';
}

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

/** Categoría donde cae todo artículo publicado sin categoría. Se crea en el catálogo la primera vez que hace falta */
export const CATEGORIA_SIN = { id: 'sin-categoria', nombre: 'Sin categoría', descripcion: 'Artículos publicados sin categoría' } as const;
export const esCategoriaSin = (nombre: unknown) => normalizar(nombre) === normalizar(CATEGORIA_SIN.nombre);

export function resumenBorrador(b: Borrador, nombreTienda: string): string {
  const l = [`🛍️ *${b.nombre}*`, `💲 ${pesos(b.precio)}`];
  if (b.descripcion) l.push(`📝 ${b.descripcion}`);
  const det = [b.marca && `Marca: ${b.marca}`, b.color && `Color: ${b.color}`, b.tamano && `Tamaño: ${b.tamano}`, b.material && `Material: ${b.material}`].filter(Boolean);
  if (det.length) l.push(det.join(' · '));
  l.push(
    b.porPedido
      ? '📦 Bajo pedido (no controla cantidad)'
      : b.stock === -1
        ? '📦 Cantidad: sin definir (toca ✏️ Editar para ponerla)'
        : `📦 Cantidad: ${b.stock} ${b.unidadMedida || 'pz'}`,
  );
  l.push(`🏷️ Categoría: ${b.categoria || CATEGORIA_SIN.nombre}`);
  l.push(`🏪 Tienda: ${nombreTienda}`);
  return l.join('\n');
}

/** "5 piezas", "10 unidades", "cantidad 12", "tengo 8": la cantidad que la tienda escribió (red de seguridad si la IA no la devuelve) */
export function cantidadDelTexto(texto: unknown): number | null {
  const t = normalizar(texto);
  const m = /(?<![\w.$])(\d{1,6})\s*(?:piezas?|pzas?|pz|unidades|unidad|existencias|disponibles)\b/.exec(t) ?? /\b(?:cantidad|existencias?|stock|inventario|tengo|tenemos|hay)\s*(?:de|es|:)?\s*(\d{1,6})\b/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 100_000 ? n : null;
}

/* ---------------- edición del borrador desde el chat ---------------- */

const CAMPOS_EDICION: [RegExp, string][] = [
  [/^(?:bajo pedido|sobre pedido|por pedido|por encargo|a pedido)/, 'bajoPedido'],
  [/^(?:unidad de medida|unidad|medida)/, 'unidad'],
  [/^(?:nombre|titulo)/, 'nombre'],
  [/^(?:precio|costo|vale|cuesta)/, 'precio'],
  [/^(?:descripcion|detalles?)/, 'descripcion'],
  [/^(?:cantidad|existencias?|stock|inventario|piezas|disponibles)/, 'cantidad'],
  [/^(?:categoria|rubro)/, 'categoria'],
  [/^marca/, 'marca'],
  [/^color/, 'color'],
  [/^(?:tamano|talla)/, 'tamano'],
  [/^material/, 'material'],
];

export const AYUDA_EDICION = [
  '✏️ *¿Qué quieres cambiar?* Escribe el campo y su valor (puedes mandar varios, uno por línea):',
  '• nombre Pastel grande',
  '• precio 400',
  '• cantidad 12',
  '• unidad kg',
  '• categoría Postres',
  '• bajo pedido sí  (o no)',
  '• descripción Hecho a mano',
  '• marca / color / tamaño / material',
  'Para vaciar un dato escribe "ninguno" (ej. color ninguno).',
].join('\n');

export interface ResultadoEdicion {
  borrador: Borrador;
  /** Cambios aplicados, ya redactados para mostrarlos */
  cambios: string[];
  /** Líneas que se reconocieron pero no se pudieron aplicar, con el motivo */
  errores: string[];
  /** Cuántas líneas hablaban de un campo (aplicadas o no): 0 = no era una edición */
  reconocidos: number;
}

const VACIO = /^(ninguno|ninguna|nada|vacio|quitar|borrar|-|—)$/;

/**
 * Aplica "campo valor" (una por línea o separadas por ;) sobre una COPIA del borrador, con las mismas reglas de
 * validación que la publicación. Lo que no cumple se rechaza con su motivo y el resto sí se aplica.
 */
export function editarBorrador(actual: Borrador, entrada: unknown, categorias: CategoriaLite[]): ResultadoEdicion {
  const b: Borrador = { ...actual };
  const cambios: string[] = [];
  const errores: string[] = [];
  let reconocidos = 0;
  const lineas = String(entrada ?? '')
    .split(/[\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const linea of lineas) {
    const n = normalizar(linea);
    // El nombre del campo debe ser una palabra completa ("marca" sí, "marcador" no)
    const hallado = CAMPOS_EDICION.map(([re, c]): [RegExp, string] => [new RegExp(`${re.source}(?![a-z])`), c]).find(([re]) => re.test(n));
    if (!hallado) continue;
    const campo = hallado[1];
    const largo = (hallado[0].exec(n) as RegExpExecArray)[0].length;
    // El valor se toma de la línea original (con mayúsculas y acentos); quitar acentos no cambia el largo
    let valor = linea.slice(largo).replace(/^\s*[:=]?\s*/, '').trim();
    // En campos de número o sí/no se admite "precio es 400", "cantidad de 12"; en los de texto libre no ("descripción a mano")
    if (['precio', 'cantidad', 'bajoPedido'].includes(campo)) valor = valor.replace(/^(?:es|de|a)\b\s*/i, '');
    reconocidos++;
    const v = normalizar(valor);

    switch (campo) {
      case 'nombre': {
        const x = texto(valor, 80);
        if (x.length < 2) errores.push('nombre: escribe el nombre, ej. "nombre Pastel grande"');
        else {
          b.nombre = x;
          cambios.push(`Nombre: ${x}`);
        }
        break;
      }
      case 'precio': {
        const p = leerPrecio(valor);
        if (p === null || p <= 0 || p > MAX_PRECIO) errores.push(`precio: "${valor}" no es un precio válido (entre $0.01 y $${MAX_PRECIO.toLocaleString('es-MX')})`);
        else {
          b.precio = Math.round(p * 100) / 100;
          cambios.push(`Precio: ${pesos(b.precio)}`);
        }
        break;
      }
      case 'cantidad': {
        if (/^(sin control|sin limite|ilimitad[oa]s?|no (?:controlo|llevo))/.test(v)) {
          b.stock = -1;
          cambios.push('Cantidad: sin definir');
          break;
        }
        // Solo un entero, con unidad opcional ("12", "12 piezas"): "2.5" o "muchas" se rechazan en vez de adivinar
        const num = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\s+[a-záéíóúñ.]+)?$/i.exec(valor);
        const q = num ? Number(num[1].replace(/,/g, '')) : NaN;
        if (!Number.isInteger(q) || q < 1 || q > 100_000) errores.push('cantidad: escribe un número entero de 1 a 100,000');
        else if (b.porPedido) errores.push('cantidad: este artículo es *bajo pedido* y no controla cantidad. Escribe primero "bajo pedido no"');
        else {
          b.stock = q;
          cambios.push(`Cantidad: ${q} ${b.unidadMedida || 'pz'}`);
        }
        break;
      }
      case 'unidad': {
        const x = texto(valor, 12);
        if (!x) errores.push('unidad: escribe la unidad, ej. "unidad kg"');
        else {
          b.unidadMedida = x;
          cambios.push(`Unidad: ${x}`);
        }
        break;
      }
      case 'bajoPedido': {
        if (esSi(valor) || /^(true|verdadero|activado|activa)$/.test(v)) {
          b.porPedido = true;
          b.stock = -1;
          cambios.push('Bajo pedido: sí');
        } else if (esNo(valor) || /^(false|falso|desactivado|desactiva)$/.test(v)) {
          b.porPedido = false;
          cambios.push('Bajo pedido: no');
        } else errores.push('bajo pedido: responde "sí" o "no"');
        break;
      }
      case 'categoria': {
        if (!v || VACIO.test(v) || esCategoriaSin(v)) {
          b.categoriaId = '';
          b.categoria = '';
          cambios.push(`Categoría: ${CATEGORIA_SIN.nombre}`);
          break;
        }
        const exacta = categorias.find((c) => normalizar(c.nombre) === v);
        const parecidas = exacta ? [exacta] : categorias.filter((c) => normalizar(c.nombre).includes(v) || (v.length >= 4 && v.includes(normalizar(c.nombre))));
        if (parecidas.length === 1) {
          b.categoriaId = parecidas[0].id;
          b.categoria = parecidas[0].nombre;
          cambios.push(`Categoría: ${parecidas[0].nombre}`);
        } else if (parecidas.length > 1) {
          errores.push(`categoría: "${valor}" coincide con varias (${parecidas.slice(0, 5).map((c) => c.nombre).join(', ')}). Escríbela completa`);
        } else {
          errores.push(`categoría: no existe "${valor}". Escribe "categoría ninguna" para dejarla en ${CATEGORIA_SIN.nombre}`);
        }
        break;
      }
      case 'descripcion': {
        b.descripcion = VACIO.test(v) ? '' : texto(valor, 500);
        cambios.push(b.descripcion ? 'Descripción actualizada' : 'Descripción quitada');
        break;
      }
      default: {
        // marca, color, tamano, material
        const max = campo === 'marca' || campo === 'material' ? 40 : 30;
        const x = VACIO.test(v) ? '' : texto(valor, max);
        if (!x && !VACIO.test(v)) {
          errores.push(`${campo === 'tamano' ? 'tamaño' : campo}: escribe el valor, ej. "${campo === 'tamano' ? 'tamaño' : campo} ..."`);
          break;
        }
        (b as any)[campo] = x;
        cambios.push(`${{ marca: 'Marca', color: 'Color', tamano: 'Tamaño', material: 'Material' }[campo as 'marca']}: ${x || 'quitado'}`);
      }
    }
  }
  return { borrador: b, cambios, errores, reconocidos };
}

/** ¿Pide editar el artículo pendiente? ("editar", "corregir", "modificar") */
export const pideEditar = (t: unknown) => /^(editar|edito|edita|corregir|corrige|modificar|modifica|cambiar algo|editar articulo)\s*$/.test(normalizar(t).replace(/[^a-z ]/g, '').trim());

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

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'con', 'por', 'para', 'que', 'hay', 'tienen', 'venden', 'quiero', 'busco', 'buscar', 'tienda', 'tiendas', 'hola', 'me', 'se', 'del', 'al', 'a', 'cual', 'cuales', 'cuanto', 'cuesta', 'precio', 'precios', 'horario', 'abre', 'abren', 'cierra', 'cierran', 'esta', 'estan', 'donde', 'ubicacion', 'direccion', 'tienes', 'tiene', 'tengo', 'tenemos', 'vendes', 'manejan', 'manejas', 'maneja', 'muestrame', 'muestra', 'muestren', 'dame', 'dime', 'ver', 'algun', 'alguna', 'algunos', 'algunas', 'unos', 'unas', 'como', 'son', 'quisiera', 'necesito', 'ocupo', 'puedes', 'podrias', 'favor', 'gracias']);

/**
 * Raíz en singular para que "piñatas" encuentre "Piñata de tractor" y "pasteles" encuentre "Pastel".
 * Es solo para buscar: quita la "s" o "es" final de palabras de 4 letras o más.
 */
export function raizDePalabra(p: string): string {
  if (p.length >= 6 && p.endsWith('es') && !/[aeiou]es$/.test(p)) return p.slice(0, -2); // pasteles, flores, mujeres
  if (p.length >= 4 && p.endsWith('s')) return p.slice(0, -1); // piñatas, zapatos, camisetas
  return p;
}

export const palabrasClave = (t: unknown) =>
  normalizar(t)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !STOP.has(p))
    .map(raizDePalabra);

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
  id: string;
  /** Foto principal (enlace público) */
  foto: string;
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

function articuloPublico(a: any, id = ''): ArticuloPublico {
  const vars: any[] = Array.isArray(a?.variantes) ? a.variantes : Object.values(a?.variantes ?? {});
  const unicos = (campo: string) => [...new Set(vars.map((v) => texto(v?.[campo], 30)).filter(Boolean))].slice(0, 8);
  const porPedido = a?.porPedido === true;
  const hayExistencia = vars.length === 0 || vars.some((v) => v?.tieneStock === false || Number(v?.stock) === -1 || Number(v?.stock) > 0);
  const foto = [a?.url, ...vars.map((v) => v?.url)].map((u) => String(u ?? '').trim()).find((u) => /^https:\/\//i.test(u)) ?? '';
  return {
    id: String(id || a?.articuloId || a?.id || ''),
    foto,
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
  const guardar = (a: any, id = '') => {
    const pub = articuloPublico(a, id);
    arts.set(`${pub.tienda}|${pub.nombre}`, pub);
  };
  visibles
    .map(([id, a]: [string, any]) => ({ id, a, p: puntaje([a.nombre, a.descripcion, a.categoria, a.tiendaNombre]) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, Math.max(limite, 8))
    .forEach(({ a, id }) => guardar(a, id));

  // Si preguntan por una tienda ("¿qué venden en Dulce?"), se agregan algunos de sus artículos
  for (const { id } of tiendasOrdenadas.slice(0, 2)) {
    visibles.filter(([, a]: [string, any]) => String(a.tiendaId) === id).slice(0, 4).forEach(([aid, a]) => guardar(a, aid));
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
      .map(([aid, a]) => articuloPublico(a, aid));
    return { articulos: pideArticulos ? listaArticulos : [], tiendas: pideTiendas ? listaTiendas : [] };
  }

  return { articulos: [...arts.values()].slice(0, 8), tiendas: tiendasOrdenadas.map(({ t }) => tiendaPublica(t)) };
}

/** Máximo de artículos que se muestran de una vez, con foto y detalles */
export const MAX_ARTICULOS_MOSTRADOS = 3;

/** ¿Pregunta por datos de la tienda (horario, ubicación, contacto) y no por artículos? */
export const pideDatosDeTienda = (t: unknown) =>
  /\b(horarios?|abre|abren|abierto|abiertos|cierra|cierran|donde|ubicacion|ubicados|direccion|telefono|contacto|como llegar|redes|facebook|instagram)\b/.test(normalizar(t));

/** Texto que acompaña la foto de un artículo (cabe en el pie de una imagen de WhatsApp) */
export function fichaArticulo(a: ArticuloPublico, urlApp: string): string {
  const pesos = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const l = [`🛍️ *${a.nombre}*`, `💲 ${pesos(a.precio)}${a.unidad && a.unidad !== 'pz' ? ` por ${a.unidad}` : ''}`];
  if (a.descripcion) l.push(`📝 ${a.descripcion}`);
  if (a.tienda) l.push(`🏪 ${a.tienda}`);
  l.push(a.ventaPausada ? '⏸️ Venta pausada por ahora' : a.porPedido ? '📦 Bajo pedido' : a.disponible ? '✅ Disponible' : '❌ Agotado');
  const det = [a.marcas.length && `Marca: ${a.marcas.join(', ')}`, a.colores.length && `Color: ${a.colores.join(', ')}`, a.tamanos.length && `Tamaño: ${a.tamanos.join(', ')}`].filter(Boolean);
  if (det.length) l.push(det.join(' · '));
  if (a.categoria) l.push(`🏷️ ${a.categoria}`);
  if (a.id && urlApp) l.push(`👉 ${urlApp.replace(/\/$/, '')}/producto/${a.id}`);
  return l.join('\n').slice(0, 1000);
}

/** Palabras que, solas, significan "muéstrame todo" y no un filtro */
const PALABRAS_DE_LISTADO = new Set(
  [
  'lista', 'listado', 'todas', 'todos', 'disponibles', 'registradas', 'existen', 'nuevas', 'nuevos', 'recientes', 'ultimos', 'ultimas',
  // el sustantivo mismo ("productos", "negocios"…) tampoco es un filtro
  'productos', 'producto', 'articulos', 'articulo', 'catalogo', 'venden', 'ofrecen', 'negocios', 'negocio', 'comercios', 'comercio',
].flatMap((p) => [p, raizDePalabra(p)]),
);

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
