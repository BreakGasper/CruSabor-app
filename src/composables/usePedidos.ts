import { db } from '@/firebase';
import {
  ref as dbRef,
  push,
  set,
  get,
  update,
  child,
  query,
  orderByChild,
  equalTo,
  onValue,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { tiendasQueNoPuedenVender, TiendaNoDisponibleError } from '@/composables/useMembresia';
import { sessionUser } from '@/utils/sessionUser';

/* =========================================================================
 *  MODELO
 * ========================================================================= */

/**
 * Ciclo de vida de un pedido.
 *
 *   Preparacion ──► Enviado ──► Entregado
 *        │             │
 *        └──► Cancelado ◄┘
 *
 * - El cliente solo puede cancelar mientras NINGUNA tienda haya enviado.
 * - La tienda puede avanzar (Preparacion→Enviado→Entregado) y cancelar
 *   mientras no esté Entregado.
 * - Un pedido puede tener items de varias tiendas: cada tienda lleva su
 *   propio estatus en `estatusPorTienda` y el `estatus` global se deriva.
 * - Cada transición queda registrada en `historial` (quién, cuándo, qué).
 * - El stock se descuenta al crear el pedido (transacción atómica por
 *   variante) y se devuelve al cancelar.
 */
export type EstatusPedido =
  | 'Preparacion'
  | 'Enviado'
  | 'Entregado'
  | 'Cancelado';

export type ActorPedido = 'cliente' | 'tienda' | 'sistema';

export const ESTATUS_LABEL: Record<EstatusPedido, string> = {
  Preparacion: 'En preparación',
  Enviado: 'En camino',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
};

/** Transiciones permitidas por rol */
const TRANSICIONES: Record<ActorPedido, Record<EstatusPedido, EstatusPedido[]>> = {
  tienda: {
    Preparacion: ['Enviado', 'Cancelado'],
    Enviado: ['Entregado', 'Cancelado'],
    Entregado: [],
    Cancelado: [],
  },
  cliente: {
    Preparacion: ['Cancelado'],
    Enviado: [],
    Entregado: [],
    Cancelado: [],
  },
  sistema: {
    Preparacion: ['Enviado', 'Entregado', 'Cancelado'],
    Enviado: ['Entregado', 'Cancelado'],
    Entregado: [],
    Cancelado: [],
  },
};

export function puedeTransicionar(
  actual: EstatusPedido,
  nuevo: EstatusPedido,
  por: ActorPedido,
): boolean {
  return TRANSICIONES[por]?.[actual]?.includes(nuevo) ?? false;
}

export interface HistorialPedido {
  estatus: EstatusPedido;
  fecha: string; // ISO
  por: ActorPedido;
  tiendaId?: string;
  nota?: string;
}

export interface PedidoItem {
  id_articulo: string;
  nombreProducto: string;
  precio: number;
  cantidad: number;
  categoria?: string;
  /** id de la tienda dueña del artículo */
  proveedor?: string;
  /** nombre de la tienda al momento del pedido (para mostrar y filtrar) */
  nombreTienda?: string;
  sku_code?: string;
  url_image?: string;
  almacen?: string;
  anticipo?: number | null;
  descuentoCupon?: number | null;
}

export interface Pedido {
  id_pedido?: string;
  id_usuario: string;
  metodo_pago: string;
  total_compra: number;
  /** Estatus global derivado del de cada tienda */
  estatus: EstatusPedido;
  /** Estatus por tienda participante */
  estatusPorTienda?: Record<string, EstatusPedido>;
  historial?: HistorialPedido[];
  /** Texto local legible (compatibilidad con pedidos viejos) */
  fecha_hora: string;
  /** ISO, para ordenar y calcular tiempos */
  fecha_creacion?: string;
  fechaEntrega?: string;
  canceladoPor?: ActorPedido;
  motivoCancelacion?: string;

  domicilio: {
    calleNumero: string;
    lugar: string;
    municipio: string;
    estado: string;
    codigoPostal: string;
  };

  items: PedidoItem[];
}

export class StockInsuficienteError extends Error {
  constructor(public faltantes: { nombre: string; disponible: number }[]) {
    super(
      'Sin stock suficiente: ' +
        faltantes.map((f) => `${f.nombre} (quedan ${f.disponible})`).join(', '),
    );
    this.name = 'StockInsuficienteError';
  }
}

/* =========================================================================
 *  HELPERS
 * ========================================================================= */

const ahoraISO = () => new Date().toISOString();

const snapshotToLista = (data: Record<string, any> | null): Pedido[] =>
  data
    ? Object.keys(data).map((key) => ({ id_pedido: key, ...data[key] }) as Pedido)
    : [];

/** Fecha efectiva de un pedido (ISO nuevo o texto local viejo) */
export function fechaPedido(p: Pedido): number {
  if (p.fecha_creacion) return new Date(p.fecha_creacion).getTime();
  // "15/5/2025, 14:32:10" -> Date
  const [d, h] = (p.fecha_hora || '').split(',').map((s) => s.trim());
  const [dia, mes, anio] = (d || '').split('/').map(Number);
  if (!anio) return 0;
  const m = (h || '').match(/(\d+):(\d+)(?::(\d+))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i);
  let hh = m ? +m[1] : 0;
  const mm = m ? +m[2] : 0;
  const ss = m && m[3] ? +m[3] : 0;
  const ampm = m?.[4]?.toLowerCase().replace(/[.\s]/g, '');
  if (ampm === 'pm' && hh < 12) hh += 12;
  if (ampm === 'am' && hh === 12) hh = 0;
  return new Date(anio, mes - 1, dia, hh, mm, ss).getTime();
}

const ordenarRecientes = (lista: Pedido[]) =>
  [...lista].sort((a, b) => fechaPedido(b) - fechaPedido(a));

/** Nombres de tienda presentes en un pedido: id -> nombre (vacío si el pedido es viejo) */
export function nombresTiendasDelPedido(p: Pedido): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of p.items || []) if (i.proveedor) r[i.proveedor] = i.nombreTienda || r[i.proveedor] || '';
  return r;
}

/** Tiendas que participan en un pedido */
export function tiendasDelPedido(p: Pedido): string[] {
  return [...new Set((p.items || []).map((i) => i.proveedor).filter(Boolean))] as string[];
}

/** Estatus de una tienda dentro del pedido (fallback al global para pedidos viejos) */
export function estatusDeTienda(p: Pedido, tiendaId: string): EstatusPedido {
  return p.estatusPorTienda?.[tiendaId] ?? p.estatus ?? 'Preparacion';
}

/**
 * Deriva el estatus global a partir del de cada tienda:
 *  - todas Cancelado           -> Cancelado
 *  - todas Entregado/Cancelado -> Entregado
 *  - alguna Enviado o Entregado -> Enviado
 *  - resto                     -> Preparacion
 */
export function derivarEstatusGlobal(
  porTienda: Record<string, EstatusPedido>,
): EstatusPedido {
  const valores = Object.values(porTienda);
  if (!valores.length) return 'Preparacion';
  if (valores.every((v) => v === 'Cancelado')) return 'Cancelado';
  if (valores.every((v) => v === 'Entregado' || v === 'Cancelado')) return 'Entregado';
  if (valores.some((v) => v === 'Enviado' || v === 'Entregado')) return 'Enviado';
  return 'Preparacion';
}

/* =========================================================================
 *  STOCK (transacciones atómicas sobre articulos/{id}/variantes/{i}/stock)
 * ========================================================================= */

/** Localiza el índice de la variante por sku (o la primera si no hay sku) */
async function indiceVariante(idArticulo: string, sku?: string): Promise<number> {
  const snap = await get(dbRef(db, `articulos/${idArticulo}/variantes`));
  if (!snap.exists()) return -1;
  const variantes = snap.val();
  const lista: any[] = Array.isArray(variantes) ? variantes : Object.values(variantes);
  if (sku && sku !== 'default') {
    const i = lista.findIndex((v) => v?.sku === sku);
    if (i >= 0) return i;
  }
  return lista.length ? 0 : -1;
}

/**
 * Descuenta stock de un item. Devuelve null si ok, o el stock disponible si no alcanza.
 * stock === -1 significa ilimitado y no se toca.
 */
async function descontarStock(item: PedidoItem): Promise<number | null> {
  const idx = await indiceVariante(item.id_articulo, item.sku_code);
  if (idx < 0) return null; // artículo sin variantes: no controlamos stock

  const stockRef = dbRef(db, `articulos/${item.id_articulo}/variantes/${idx}/stock`);
  let disponible = 0;
  const res = await runTransaction(stockRef, (actual) => {
    if (actual === -1 || actual === null || actual === undefined) return actual; // ilimitado / sin dato
    disponible = Number(actual);
    if (disponible < item.cantidad) return; // abortar
    return disponible - item.cantidad;
  });
  return res.committed ? null : disponible;
}

async function devolverStock(item: PedidoItem) {
  const idx = await indiceVariante(item.id_articulo, item.sku_code);
  if (idx < 0) return;
  const stockRef = dbRef(db, `articulos/${item.id_articulo}/variantes/${idx}/stock`);
  await runTransaction(stockRef, (actual) => {
    if (actual === -1 || actual === null || actual === undefined) return actual;
    return Number(actual) + item.cantidad;
  });
}

/* =========================================================================
 *  CREAR PEDIDO
 * ========================================================================= */

/**
 * Crea el pedido en la colección global `pedidos`, descontando stock primero.
 * Si algún artículo no tiene stock suficiente, revierte lo ya descontado y
 * lanza StockInsuficienteError con la lista de faltantes.
 */
export async function guardarPedidos(
  carrito: any[],
  metodoPago: string,
  domicilioForm: any,
): Promise<string> {
  if (!sessionUser.value?.id) throw new Error('Usuario no autenticado');
  if (!carrito?.length) throw new Error('El carrito está vacío');

  // Nombre de tienda: viene en el ítem del carrito; para ítems viejos se consulta una vez por tienda
  const nombresTienda = new Map<string, string>();
  for (const item of carrito) {
    const tid = item.id_tienda || item.proveedor;
    if (item.nombre_tienda) nombresTienda.set(tid, item.nombre_tienda);
  }
  for (const item of carrito) {
    const tid = item.id_tienda || item.proveedor;
    if (!tid || nombresTienda.has(tid)) continue;
    try {
      const snap = await get(dbRef(db, `tiendas/${tid}/nombreTienda`));
      nombresTienda.set(tid, snap.exists() ? String(snap.val()) : '');
    } catch {
      nombresTienda.set(tid, '');
    }
  }

  const items: PedidoItem[] = carrito.map((item) => ({
    id_articulo: item.id_articulo,
    nombreProducto: item.nombre,
    precio: item.precio,
    cantidad: item.cantidad,
    categoria: item.categoria || '',
    proveedor: item.id_tienda || item.proveedor || '',
    nombreTienda: nombresTienda.get(item.id_tienda || item.proveedor) || '',
    sku_code: item.sku || item.sku_code || '',
    url_image: item.url || '',
    almacen: item.almacen || '',
    anticipo: item.anticipo ?? null,
    descuentoCupon: item.descuentoCupon ?? null,
  }));

  // 0) Ninguna tienda del pedido puede estar pendiente, bloqueada o vencida
  const noDisponibles = await tiendasQueNoPuedenVender(items.map((i) => i.proveedor || ''));
  if (noDisponibles.length) throw new TiendaNoDisponibleError(noDisponibles);

  // 1) Reservar stock (atómico por variante)
  const descontados: PedidoItem[] = [];
  const faltantes: { nombre: string; disponible: number }[] = [];
  for (const it of items) {
    const falta = await descontarStock(it);
    if (falta === null) descontados.push(it);
    else faltantes.push({ nombre: it.nombreProducto, disponible: falta });
  }
  if (faltantes.length) {
    await Promise.all(descontados.map(devolverStock)); // rollback
    throw new StockInsuficienteError(faltantes);
  }

  // 2) Construir pedido
  const fechaISO = ahoraISO();
  const tiendas = [...new Set(items.map((i) => i.proveedor).filter(Boolean))] as string[];
  const estatusPorTienda: Record<string, EstatusPedido> = {};
  tiendas.forEach((t) => (estatusPorTienda[t] = 'Preparacion'));

  const pedido: Pedido = {
    id_usuario: sessionUser.value.id,
    metodo_pago: metodoPago,
    estatus: 'Preparacion',
    estatusPorTienda,
    historial: [{ estatus: 'Preparacion', fecha: fechaISO, por: 'cliente', nota: 'Pedido creado' }],
    fecha_hora: new Date().toLocaleString(),
    fecha_creacion: fechaISO,
    total_compra: items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
    domicilio: {
      calleNumero: `${domicilioForm.calle} #${domicilioForm.numero}`,
      lugar: domicilioForm.colonia,
      municipio: domicilioForm.municipio,
      estado: domicilioForm.estado,
      codigoPostal: domicilioForm.cp,
    },
    items,
  };

  // 3) Guardar
  const nuevoRef = push(dbRef(db, 'pedidos'));
  await set(nuevoRef, { id_pedido: nuevoRef.key, ...pedido });
  return nuevoRef.key!;
}

/* =========================================================================
 *  CAMBIOS DE ESTATUS
 * ========================================================================= */

/**
 * La tienda cambia el estatus de SUS items dentro del pedido.
 * Recalcula el estatus global y, si cancela, devuelve el stock de sus items.
 */
export async function actualizarEstatusTienda(
  pedido: Pedido,
  tiendaId: string,
  nuevo: EstatusPedido,
  nota?: string,
): Promise<Pedido> {
  if (!pedido.id_pedido) throw new Error('Pedido sin id');

  const actual = estatusDeTienda(pedido, tiendaId);
  if (!puedeTransicionar(actual, nuevo, 'tienda')) {
    throw new Error(`No se puede pasar de "${ESTATUS_LABEL[actual]}" a "${ESTATUS_LABEL[nuevo]}".`);
  }

  // Asegura un mapa por tienda aunque el pedido sea viejo
  const porTienda: Record<string, EstatusPedido> = { ...(pedido.estatusPorTienda || {}) };
  tiendasDelPedido(pedido).forEach((t) => {
    if (!porTienda[t]) porTienda[t] = pedido.estatus || 'Preparacion';
  });
  porTienda[tiendaId] = nuevo;

  const global = derivarEstatusGlobal(porTienda);
  const entrada: HistorialPedido = { estatus: nuevo, fecha: ahoraISO(), por: 'tienda', tiendaId, nota: nota || '' };
  const historial = [...(pedido.historial || []), entrada];

  const cambios: Partial<Pedido> = { estatusPorTienda: porTienda, estatus: global, historial };
  if (nuevo === 'Entregado' && global === 'Entregado') cambios.fechaEntrega = new Date().toLocaleString();
  if (nuevo === 'Cancelado') {
    if (global === 'Cancelado') {
      cambios.canceladoPor = 'tienda';
      cambios.motivoCancelacion = nota || '';
    }
    await Promise.all(
      pedido.items.filter((i) => String(i.proveedor) === String(tiendaId)).map(devolverStock),
    );
  }

  await update(dbRef(db, `pedidos/${pedido.id_pedido}`), cambios);
  return { ...pedido, ...cambios };
}

/**
 * El cliente cancela su pedido completo. Solo si ninguna tienda lo ha enviado.
 * Devuelve el stock de todos los items.
 */
export async function cancelarPedidoCliente(pedido: Pedido, motivo?: string): Promise<Pedido> {
  if (!pedido.id_pedido) throw new Error('Pedido sin id');
  if (pedido.id_usuario !== sessionUser.value?.id) throw new Error('Este pedido no es tuyo');

  const tiendas = tiendasDelPedido(pedido);
  const porTiendaActual: Record<string, EstatusPedido> = {};
  tiendas.forEach((t) => (porTiendaActual[t] = estatusDeTienda(pedido, t)));

  const bloqueado = Object.values(porTiendaActual).some((e) => !puedeTransicionar(e, 'Cancelado', 'cliente'));
  if (bloqueado || !puedeTransicionar(pedido.estatus, 'Cancelado', 'cliente')) {
    throw new Error('El pedido ya va en camino; contacta a la tienda para cancelarlo.');
  }

  const porTienda: Record<string, EstatusPedido> = {};
  tiendas.forEach((t) => (porTienda[t] = 'Cancelado'));
  const entrada: HistorialPedido = { estatus: 'Cancelado', fecha: ahoraISO(), por: 'cliente', nota: motivo || '' };

  const cambios: Partial<Pedido> = {
    estatus: 'Cancelado',
    estatusPorTienda: porTienda,
    historial: [...(pedido.historial || []), entrada],
    canceladoPor: 'cliente',
    motivoCancelacion: motivo || '',
  };

  await Promise.all(pedido.items.map(devolverStock));
  await update(dbRef(db, `pedidos/${pedido.id_pedido}`), cambios);
  return { ...pedido, ...cambios };
}

/* =========================================================================
 *  LECTURAS (colección global `pedidos`)
 * ========================================================================= */

/** Un pedido por id; solo si pertenece al usuario en sesión */
export async function getPedidoById(idPedido: string): Promise<Pedido | null> {
  if (!sessionUser.value?.id) return null;
  try {
    const snap = await get(child(dbRef(db), `pedidos/${idPedido}`));
    if (!snap.exists()) return null;
    const p = { id_pedido: idPedido, ...snap.val() } as Pedido;
    return p.id_usuario === sessionUser.value.id ? p : null;
  } catch (error) {
    console.error('Error al traer pedido:', error);
    return null;
  }
}

/** Pedidos del usuario logueado, más recientes primero */
export async function getPedidosByUser(): Promise<Pedido[]> {
  if (!sessionUser.value?.id) return [];
  try {
    const q = query(dbRef(db, 'pedidos'), orderByChild('id_usuario'), equalTo(sessionUser.value.id));
    const snap = await get(q);
    return ordenarRecientes(snapshotToLista(snap.exists() ? snap.val() : null));
  } catch (error) {
    console.error('Error al traer pedidos:', error);
    return [];
  }
}

/** Suscripción en vivo a los pedidos del usuario (devuelve unsubscribe) */
export function suscribirPedidosUsuario(cb: (pedidos: Pedido[]) => void): Unsubscribe {
  if (!sessionUser.value?.id) {
    cb([]);
    return () => {};
  }
  const q = query(dbRef(db, 'pedidos'), orderByChild('id_usuario'), equalTo(sessionUser.value.id));
  return onValue(q, (snap) => cb(ordenarRecientes(snapshotToLista(snap.exists() ? snap.val() : null))));
}

/** Todos los pedidos que incluyen items de la tienda (cualquier estatus) */
export async function getPedidosByProveedor(idTienda: string): Promise<Pedido[]> {
  try {
    const snap = await get(child(dbRef(db), 'pedidos'));
    return filtrarPorTienda(snapshotToLista(snap.exists() ? snap.val() : null), idTienda);
  } catch (error) {
    console.error('Error al traer pedidos por proveedor:', error);
    return [];
  }
}

/** Suscripción en vivo a los pedidos de una tienda (sustituye al polling) */
export function suscribirPedidosProveedor(idTienda: string, cb: (pedidos: Pedido[]) => void): Unsubscribe {
  return onValue(dbRef(db, 'pedidos'), (snap) =>
    cb(filtrarPorTienda(snapshotToLista(snap.exists() ? snap.val() : null), idTienda)),
  );
}

function filtrarPorTienda(lista: Pedido[], idTienda: string) {
  return ordenarRecientes(
    lista.filter((p) => (p.items || []).some((i) => String(i.proveedor) === String(idTienda))),
  );
}
