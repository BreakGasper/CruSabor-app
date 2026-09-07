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
import { tiendasCerradas, TiendaCerradaError } from '@/composables/useHorarioTienda';
import { ventaBloqueada } from '@/composables/useArticulos';
import { sessionUser } from '@/utils/sessionUser';

/* =========================================================================
 *  MODELO
 * ========================================================================= */

/**
 * Ciclo de vida de un pedido.
 *
 *   Preparacion ──► Atendiendo ──► Enviado ──► Entregado
 *        │              │            │
 *        └──────────► Cancelado ◄────┘
 *
 * - El cliente solo puede cancelar mientras NINGUNA tienda haya empezado a
 *   atender (Atendiendo) ni enviado.
 * - La tienda "atiende" el pedido (Atendiendo: lo confirma y lo está
 *   preparando/elaborando; útil para productos bajo pedido), luego lo envía y
 *   lo entrega. Puede saltar directo de Preparacion a Enviado. Puede cancelar
 *   mientras no esté Entregado.
 * - Un pedido puede tener items de varias tiendas: cada tienda lleva su
 *   propio estatus en `estatusPorTienda` y el `estatus` global se deriva.
 * - Cada transición queda registrada en `historial` (quién, cuándo, qué).
 * - El stock se descuenta al crear el pedido (transacción atómica por
 *   variante) y se devuelve al cancelar.
 * - Solo se puede comprar a tiendas ABIERTAS según su horario (useHorarioTienda);
 *   los artículos de tiendas cerradas se quedan en el carrito.
 * - Si una tienda no atiende su parte del pedido (sigue en Preparacion) en
 *   HORAS_LIMITE_ATENCION, el sistema la cancela y devuelve el stock
 *   (ver expirarPedidosSinAtender). Pasar a Atendiendo detiene ese reloj.
 * - Los artículos marcados `porPedido` (bajo pedido) no controlan stock: la
 *   tienda los elabora cuando el cliente los pide.
 */
export type EstatusPedido =
  | 'Preparacion'
  | 'Atendiendo'
  | 'Enviado'
  | 'Entregado'
  | 'Cancelado';

export type ActorPedido = 'cliente' | 'tienda' | 'sistema';

export const ESTATUS_LABEL: Record<EstatusPedido, string> = {
  Preparacion: 'En preparación',
  Atendiendo: 'Atendiendo tu pedido',
  Enviado: 'En camino',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
};

/** Etiqueta pensada para la tienda (el cliente ve ESTATUS_LABEL) */
export const ESTATUS_LABEL_TIENDA: Record<EstatusPedido, string> = {
  ...ESTATUS_LABEL,
  Preparacion: 'Nuevo · sin atender',
  Atendiendo: 'Atendiendo',
};

export const ACTOR_LABEL: Record<ActorPedido, string> = {
  cliente: 'Cliente',
  tienda: 'Tienda',
  sistema: 'Sistema',
};

/** Transiciones permitidas por rol */
const TRANSICIONES: Record<ActorPedido, Record<EstatusPedido, EstatusPedido[]>> = {
  tienda: {
    Preparacion: ['Atendiendo', 'Enviado', 'Cancelado'],
    Atendiendo: ['Enviado', 'Cancelado'],
    Enviado: ['Entregado', 'Cancelado'],
    Entregado: [],
    Cancelado: [],
  },
  cliente: {
    Preparacion: ['Cancelado'],
    Atendiendo: [],
    Enviado: [],
    Entregado: [],
    Cancelado: [],
  },
  sistema: {
    Preparacion: ['Atendiendo', 'Enviado', 'Entregado', 'Cancelado'],
    Atendiendo: ['Enviado', 'Entregado', 'Cancelado'],
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
  /** true si el artículo se elabora bajo pedido (sin control de stock) */
  porPedido?: boolean;
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

/** Artículos cuya venta la tienda pausó o dio de baja después de que el cliente los agregó */
export class ArticuloNoDisponibleError extends Error {
  constructor(public articulos: { id: string; nombre: string }[]) {
    super(
      (articulos.length === 1 ? 'La tienda pausó la venta de: ' : 'La tienda pausó la venta de: ') +
        articulos.map((a) => a.nombre).join(', ') +
        '. Quítalo del carrito para continuar.',
    );
    this.name = 'ArticuloNoDisponibleError';
  }
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
 *  - alguna Atendiendo         -> Atendiendo
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
  if (valores.some((v) => v === 'Atendiendo')) return 'Atendiendo';
  return 'Preparacion';
}

/** ¿El pedido tiene artículos que se elaboran bajo pedido? (de una tienda o de todo el pedido) */
export function tieneArticulosPorPedido(p: Pedido, tiendaId?: string): boolean {
  return (p.items || []).some((i) => i.porPedido === true && (!tiendaId || String(i.proveedor) === String(tiendaId)));
}

/* =========================================================================
 *  MOTIVO DE CANCELACIÓN (para mostrarlo a cliente y tienda)
 * ========================================================================= */

export interface MotivoCancelacion {
  por: ActorPedido;
  nota: string;
  fecha?: string;
}

/**
 * Quién canceló la parte de una tienda (o el pedido completo si no se indica tienda)
 * y con qué nota. Se toma del historial: la última entrada 'Cancelado' de esa tienda,
 * o la global (sin tiendaId, la del cliente). Para pedidos viejos sin historial se
 * usa `canceladoPor` / `motivoCancelacion`.
 */
export function motivoCancelacion(p: Pedido, tiendaId?: string): MotivoCancelacion | null {
  const cancelada = tiendaId ? estatusDeTienda(p, tiendaId) === 'Cancelado' : p.estatus === 'Cancelado';
  if (!cancelada) return null;
  const hist = [...(p.historial || [])].reverse().filter((h) => h.estatus === 'Cancelado');
  const propia = tiendaId ? hist.find((h) => String(h.tiendaId) === String(tiendaId)) : undefined;
  const global = hist.find((h) => !h.tiendaId);
  const h = propia || global || hist[0];
  if (h) return { por: h.por, nota: h.nota || '', fecha: h.fecha };
  if (p.canceladoPor) return { por: p.canceladoPor, nota: p.motivoCancelacion || '' };
  return null;
}

/**
 * Texto listo para mostrar, según quién lo lea:
 *  - cliente: "Cancelado por la tienda: se acabó la harina" / "Cancelaste este pedido" /
 *             "Cancelado automáticamente: la tienda no atendió el pedido en 2 horas"
 *  - tienda:  "Cancelado por el cliente: ya no lo quiero" / "Cancelaste este pedido: …" / automático
 */
export function textoCancelacion(m: MotivoCancelacion | null, lector: 'cliente' | 'tienda'): string | null {
  if (!m) return null;
  const nota = m.nota.trim();
  const conNota = (base: string) => (nota ? `${base}: ${nota}` : base);
  switch (m.por) {
    case 'sistema':
      return nota || NOTA_CANCELACION_SIN_ATENDER;
    case 'cliente':
      return lector === 'cliente' ? conNota('Cancelaste este pedido') : conNota('Cancelado por el cliente');
    case 'tienda':
      return lector === 'tienda' ? conNota('Cancelaste este pedido') : nota ? `Cancelado por la tienda: ${nota}` : 'Cancelado por la tienda (sin motivo indicado)';
    default:
      return conNota('Cancelado');
  }
}

/** Tiendas del pedido con su parte cancelada y el texto del motivo, para listarlas */
export function cancelacionesPorTienda(p: Pedido, lector: 'cliente' | 'tienda'): { tiendaId: string; nombre: string; texto: string }[] {
  const nombres = nombresTiendasDelPedido(p);
  return tiendasDelPedido(p)
    .filter((t) => estatusDeTienda(p, t) === 'Cancelado')
    .map((t) => ({ tiendaId: t, nombre: nombres[t] || 'Tienda', texto: textoCancelacion(motivoCancelacion(p, t), lector) || 'Cancelado' }));
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
    porPedido: item.porPedido === true,
  }));

  // 0) Ninguna tienda del pedido puede estar pendiente, bloqueada o vencida…
  const noDisponibles = await tiendasQueNoPuedenVender(items.map((i) => i.proveedor || ''));
  if (noDisponibles.length) throw new TiendaNoDisponibleError(noDisponibles);
  // …ni cerrada según su horario (sus artículos se quedan en el carrito)
  const cerradas = await tiendasCerradas(items.map((i) => i.proveedor || ''));
  if (cerradas.length) throw new TiendaCerradaError(cerradas);

  // 0b) Ningún artículo puede tener la venta pausada o estar dado de baja
  const noVendibles: { id: string; nombre: string }[] = [];
  for (const it of items) {
    const snap = await get(dbRef(db, `articulos/${it.id_articulo}`));
    if (snap.exists() && ventaBloqueada(snap.val())) noVendibles.push({ id: it.id_articulo, nombre: it.nombreProducto });
  }
  if (noVendibles.length) throw new ArticuloNoDisponibleError(noVendibles);

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
    throw new Error('La tienda ya está atendiendo tu pedido; contáctala para cancelarlo.');
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
 *  CANCELACIÓN AUTOMÁTICA POR FALTA DE ATENCIÓN
 * ========================================================================= */

/** Horas que tiene una tienda para atender su parte del pedido (sacarlo de Preparacion: Atendiendo o Enviado) */
export const HORAS_LIMITE_ATENCION = 2;
export const MS_LIMITE_ATENCION = HORAS_LIMITE_ATENCION * 60 * 60_000;

export const NOTA_CANCELACION_SIN_ATENDER = `Cancelado automáticamente: la tienda no atendió el pedido en ${HORAS_LIMITE_ATENCION} horas`;

/**
 * Milisegundos que le quedan a la tienda para atender el pedido (negativo si ya venció).
 * null si no aplica: la tienda ya lo atendió, o es un pedido anterior a esta regla
 * (sin `fecha_creacion` ISO; su fecha en texto no es confiable para cancelar solo).
 */
export function tiempoRestanteAtencion(p: Pedido, tiendaId: string, ahora: Date = new Date()): number | null {
  if (estatusDeTienda(p, tiendaId) !== 'Preparacion') return null;
  if (!p.fecha_creacion) return null;
  const creado = fechaPedido(p);
  if (!creado) return null;
  return creado + MS_LIMITE_ATENCION - ahora.getTime();
}

/** "1 h 20 min" / "35 min" para mostrar el tiempo que queda */
export function formatoTiempoRestante(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Tiendas del pedido que siguen en Preparacion y ya agotaron su tiempo para atenderlo */
export function tiendasSinAtender(p: Pedido, ahora: Date = new Date()): string[] {
  return tiendasDelPedido(p).filter((t) => {
    const restante = tiempoRestanteAtencion(p, t, ahora);
    return restante !== null && restante <= 0;
  });
}

/**
 * Cancela, en nombre del sistema, la parte del pedido de las tiendas que no lo atendieron.
 * La escritura es una transacción sobre el pedido completo para que dos clientes que
 * detecten el vencimiento al mismo tiempo no lo cancelen dos veces (ni devuelvan el
 * stock dos veces). Devuelve las tiendas canceladas en esta llamada.
 */
export async function cancelarTiendasSinAtender(pedido: Pedido, ahora: Date = new Date()): Promise<string[]> {
  if (!pedido.id_pedido) return [];
  if (!tiendasSinAtender(pedido, ahora).length) return [];

  let canceladas: string[] = [];
  const res = await runTransaction(dbRef(db, `pedidos/${pedido.id_pedido}`), (actual: any) => {
    canceladas = [];
    if (!actual) return actual;
    const p = { id_pedido: pedido.id_pedido, ...actual } as Pedido;
    const vencidas = tiendasSinAtender(p, ahora).filter((t) => puedeTransicionar(estatusDeTienda(p, t), 'Cancelado', 'sistema'));
    if (!vencidas.length) return; // otro cliente ya lo hizo: abortar sin cambios

    const porTienda: Record<string, EstatusPedido> = { ...(p.estatusPorTienda || {}) };
    tiendasDelPedido(p).forEach((t) => {
      if (!porTienda[t]) porTienda[t] = p.estatus || 'Preparacion';
    });
    const fecha = ahora.toISOString();
    const historial: HistorialPedido[] = [...(p.historial || [])];
    for (const t of vencidas) {
      porTienda[t] = 'Cancelado';
      historial.push({ estatus: 'Cancelado', fecha, por: 'sistema', tiendaId: t, nota: NOTA_CANCELACION_SIN_ATENDER });
    }
    const global = derivarEstatusGlobal(porTienda);
    const cambios: Partial<Pedido> = { estatusPorTienda: porTienda, estatus: global, historial };
    if (global === 'Cancelado') {
      cambios.canceladoPor = 'sistema';
      cambios.motivoCancelacion = NOTA_CANCELACION_SIN_ATENDER;
    }
    canceladas = vencidas;
    return { ...actual, ...cambios };
  });

  if (!res.committed || !canceladas.length) return [];
  await Promise.all(
    pedido.items.filter((i) => canceladas.includes(String(i.proveedor))).map(devolverStock),
  );
  return canceladas;
}

// Pedidos cuya expiración ya está en curso, para no repetirla con cada snapshot en vivo
const expirando = new Set<string>();

/**
 * Revisa una lista de pedidos y cancela las partes vencidas. Se llama al cargar los
 * pedidos del cliente y de la tienda; la suscripción en vivo refleja el cambio después.
 * Devuelve los ids de los pedidos tocados.
 */
export async function expirarPedidosSinAtender(lista: Pedido[], ahora: Date = new Date()): Promise<string[]> {
  const tocados: string[] = [];
  for (const p of lista) {
    if (!p.id_pedido || expirando.has(p.id_pedido) || !tiendasSinAtender(p, ahora).length) continue;
    expirando.add(p.id_pedido);
    try {
      if ((await cancelarTiendasSinAtender(p, ahora)).length) tocados.push(p.id_pedido);
    } catch (e) {
      console.error('No se pudo cancelar el pedido sin atender:', p.id_pedido, e);
    } finally {
      expirando.delete(p.id_pedido);
    }
  }
  return tocados;
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
    let snap = await get(q);
    let lista = snapshotToLista(snap.exists() ? snap.val() : null);
    if ((await expirarPedidosSinAtender(lista)).length) {
      snap = await get(q);
      lista = snapshotToLista(snap.exists() ? snap.val() : null);
    }
    return ordenarRecientes(lista);
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
  return onValue(q, (snap) => {
    const lista = snapshotToLista(snap.exists() ? snap.val() : null);
    cb(ordenarRecientes(lista));
    void expirarPedidosSinAtender(lista); // si cancela algo, la suscripción vuelve a avisar
  });
}

/** Todos los pedidos que incluyen items de la tienda (cualquier estatus) */
export async function getPedidosByProveedor(idTienda: string): Promise<Pedido[]> {
  try {
    let snap = await get(child(dbRef(db), 'pedidos'));
    let lista = filtrarPorTienda(snapshotToLista(snap.exists() ? snap.val() : null), idTienda);
    if ((await expirarPedidosSinAtender(lista)).length) {
      snap = await get(child(dbRef(db), 'pedidos'));
      lista = filtrarPorTienda(snapshotToLista(snap.exists() ? snap.val() : null), idTienda);
    }
    return lista;
  } catch (error) {
    console.error('Error al traer pedidos por proveedor:', error);
    return [];
  }
}

/** Suscripción en vivo a los pedidos de una tienda (sustituye al polling) */
export function suscribirPedidosProveedor(idTienda: string, cb: (pedidos: Pedido[]) => void): Unsubscribe {
  return onValue(dbRef(db, 'pedidos'), (snap) => {
    const lista = filtrarPorTienda(snapshotToLista(snap.exists() ? snap.val() : null), idTienda);
    cb(lista);
    void expirarPedidosSinAtender(lista); // si cancela algo, la suscripción vuelve a avisar
  });
}

function filtrarPorTienda(lista: Pedido[], idTienda: string) {
  return ordenarRecientes(
    lista.filter((p) => (p.items || []).some((i) => String(i.proveedor) === String(idTienda))),
  );
}
