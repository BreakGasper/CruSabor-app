import {
  TIPOS_NEGOCIO,
  MODALIDADES_ATENCION,
  type TipoNegocio,
  type ModalidadAtencion,
} from './tipos';

/**
 * Qué tipo de negocio es una tienda y qué herramientas le tocan.
 * Regla de compatibilidad: sin `tipoNegocio` (tiendas anteriores) o con un valor raro, es una tienda de PRODUCTOS.
 */

export interface InfoTipoNegocio {
  id: TipoNegocio;
  icono: string;
  titulo: string;
  descripcion: string;
}

export const INFO_TIPOS_NEGOCIO: readonly InfoTipoNegocio[] = [
  { id: 'productos', icono: '🛍️', titulo: 'Productos', descripcion: 'Vendo artículos físicos: comida, ropa, accesorios…' },
  { id: 'servicios', icono: '💈', titulo: 'Servicios', descripcion: 'Ofrezco servicios: barbería, uñas, maquillaje, fotografía… Mis clientes agendan citas o piden cotización.' },
  { id: 'mixto', icono: '🧩', titulo: 'Mixto', descripcion: 'Vendo productos y también ofrezco servicios.' },
];

export const etiquetaTipoNegocio = (t: TipoNegocio): string => INFO_TIPOS_NEGOCIO.find((x) => x.id === t)!.titulo;

export const esTipoNegocio = (v: unknown): v is TipoNegocio => typeof v === 'string' && (TIPOS_NEGOCIO as readonly string[]).includes(v);

export const esModalidad = (v: unknown): v is ModalidadAtencion =>
  typeof v === 'string' && (MODALIDADES_ATENCION as readonly string[]).includes(v);

type ConTipo = { tipoNegocio?: unknown } | null | undefined;

/** Tipo de la tienda; las que no lo tienen son de productos */
export const tipoDeTienda = (t: ConTipo): TipoNegocio => (esTipoNegocio(t?.tipoNegocio) ? t!.tipoNegocio as TipoNegocio : 'productos');

/** ¿Tiene artículos, carrito y pedidos? (productos o mixto) */
export const vendeProductos = (t: ConTipo): boolean => tipoDeTienda(t) !== 'servicios';

/** ¿Tiene servicios, citas y cotizaciones? (servicios o mixto) */
export const ofreceServicios = (t: ConTipo): boolean => tipoDeTienda(t) !== 'productos';

/** Modalidad válida; si no hay, "en establecimiento" */
export const modalidadDe = (t: { modalidadAtencion?: unknown } | null | undefined): ModalidadAtencion =>
  esModalidad(t?.modalidadAtencion) ? (t!.modalidadAtencion as ModalidadAtencion) : 'local';

export const atiendeADomicilio = (m: ModalidadAtencion): boolean => m === 'domicilio' || m === 'ambas';
export const atiendeEnLocal = (m: ModalidadAtencion): boolean => m === 'local' || m === 'ambas';

export const ETIQUETA_MODALIDAD: Record<ModalidadAtencion, string> = {
  local: 'En establecimiento',
  domicilio: 'A domicilio',
  ambas: 'En establecimiento y a domicilio',
};

/**
 * `envioDomicilio` es el campo que ya usa toda la app para las zonas de entrega. Para una tienda de servicios
 * se deriva de la modalidad (las zonas de cobertura se guardan en `zonasEntrega`, igual que las de entrega);
 * en una mixta se respeta la casilla de envíos de productos o la modalidad de servicios, lo que aplique.
 */
export function envioDomicilioDe(tipo: TipoNegocio, modalidad: ModalidadAtencion, envioProductos: boolean): boolean {
  if (tipo === 'productos') return envioProductos;
  if (tipo === 'servicios') return atiendeADomicilio(modalidad);
  return envioProductos || atiendeADomicilio(modalidad);
}

/** Texto separado por comas -> lista limpia, sin repetidos (especialidades) */
export function listaDeTexto(texto: string, max = 12): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const p of String(texto ?? '').split(',')) {
    const v = p.trim().replace(/\s+/g, ' ');
    if (!v || vistos.has(v.toLowerCase())) continue;
    vistos.add(v.toLowerCase());
    salida.push(v.slice(0, 40));
    if (salida.length >= max) break;
  }
  return salida;
}
