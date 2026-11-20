/**
 * Agente de WhatsApp: reglas puras (sin red, sin base, sin reloj propio) para probarlas solas.
 *
 * El agente hace dos cosas:
 *  1. Una TIENDA entra (celular + contraseña) y le manda una foto con los datos de un
 *     artículo; el agente los extrae, se los muestra y, si confirma, lo publica.
 *  2. Un CLIENTE pregunta por tiendas y productos; el agente responde con lo que hay
 *     en el catálogo.
 */

export const MINUTOS_SESION = 30;
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

export type Comando = 'entrar' | 'salir' | 'ayuda' | 'cancelar' | null;

export function comandoDe(texto: unknown): Comando {
  const t = normalizar(texto).replace(/[^a-z ]/g, '').trim();
  if (['entrar', 'login', 'iniciar sesion', 'soy tienda', 'mi tienda', 'registrar', 'publicar'].includes(t)) return 'entrar';
  if (['salir', 'cerrar sesion', 'logout'].includes(t)) return 'salir';
  if (['ayuda', 'menu', 'help', 'hola', 'inicio'].includes(t)) return 'ayuda';
  if (['cancelar', 'cancela', 'descartar'].includes(t)) return 'cancelar';
  return null;
}

export const esSi = (t: unknown) => /^(si|sí|s|ok|dale|va|guardar|confirmo|confirmar|correcto|claro)\b/.test(normalizar(t));
export const esNo = (t: unknown) => /^(no|n|nel|cancelar|descartar|nada)\b/.test(normalizar(t));

/* ---------------- sesión y límites ---------------- */

export const sesionVigente = (ultimaActividadMs: number, ahoraMs: number) =>
  ahoraMs - ultimaActividadMs <= MINUTOS_SESION * 60_000;

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

/* ---------------- catálogo para clientes ---------------- */

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'con', 'por', 'para', 'que', 'hay', 'tienen', 'venden', 'quiero', 'busco', 'buscar', 'tienda', 'tiendas', 'hola', 'me', 'se', 'del', 'al', 'a']);

export const palabrasClave = (t: unknown) =>
  normalizar(t)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !STOP.has(p));

export interface ResultadoCatalogo {
  articulos: { nombre: string; precio: number; tienda: string; descripcion: string }[];
  tiendas: { nombre: string; categoria: string; municipio: string }[];
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

  const arts = Object.values(articulos ?? {})
    .filter((a: any) => a && typeof a === 'object' && a.baja !== true && vendedoras.has(String(a.tiendaId)))
    .map((a: any) => ({ a, p: puntaje([a.nombre, a.descripcion, a.categoria]) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, limite)
    .map(({ a }) => ({
      nombre: texto(a.nombre, 80),
      precio: Number(a.precio) || 0,
      tienda: texto(a.tiendaNombre, 60),
      descripcion: texto(a.descripcion, 120),
    }));

  const tien = [...vendedoras.values()]
    .map((t) => ({ t, p: puntaje([t.nombreTienda, t.categoria, t.descripcion, t.municipio]) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, limite)
    .map(({ t }) => ({ nombre: texto(t.nombreTienda, 60), categoria: texto(t.categoria, 40), municipio: texto(t.municipio, 40) }));

  return { articulos: arts, tiendas: tien };
}
