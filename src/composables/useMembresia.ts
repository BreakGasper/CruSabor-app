import { ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, get, onValue } from 'firebase/database';

/**
 * Autorización y membresía de tiendas.
 *
 * Cada tienda tiene un bloque de control que solo el administrador escribe:
 *   tiendas/{id}/estatus        'pendiente' | 'activa' | 'bloqueada'   (`estado` ya es el estado geográfico)
 *   tiendas/{id}/motivoBloqueo  texto que ve la dueña o dueño
 *   tiendas/{id}/membresia      { plan, vigenteHasta, ultimoPago }
 *
 * Regla de negocio: una tienda PUEDE VENDER solo si su estado es 'activa' y su
 * membresía no está vencida. Las tiendas registradas antes de esta regla no tienen
 * el campo `estatus`; se tratan como activas para no interrumpir su operación
 * (ver scripts/migrar-estado-tiendas.mjs para dejarlo explícito). Por la misma razón,
 * una tienda de la que no hay registro de control tampoco se bloquea: el bloqueo
 * siempre nace de un dato explícito escrito por el administrador.
 *
 * Todas las pantallas consultan `tiendaPuedeVender` o el mapa compartido de
 * `useEstadoTiendas`, igual que se hace con el envío en useEnvioTienda.
 */

export type EstadoTienda = 'pendiente' | 'activa' | 'bloqueada';
/** Estado real considerando el vencimiento de la membresía */
export type EstadoEfectivo = EstadoTienda | 'vencida';

export interface PagoMembresia {
  fecha: string; // ISO
  monto: number;
  metodo: string; // Efectivo, Transferencia, ...
  referencia?: string;
  registradoPor?: string;
}

export interface Membresia {
  plan?: 'mensual' | 'anual' | string;
  /** Último día de vigencia, formato YYYY-MM-DD */
  vigenteHasta?: string;
  ultimoPago?: PagoMembresia;
}

export interface ControlTienda {
  /** Nombre actual de la tienda (fuente de verdad; artículos y carrito solo guardan una copia) */
  nombreTienda?: string;
  estatus?: EstadoTienda;
  motivoBloqueo?: string;
  membresia?: Membresia;
  aprobadaEn?: string;
  aprobadaPor?: string;
  creadaEn?: string;
}

export const ESTADO_LABEL: Record<EstadoEfectivo, string> = {
  pendiente: 'Pendiente de aprobación',
  activa: 'Activa',
  bloqueada: 'Bloqueada',
  vencida: 'Membresía vencida',
};

export const MENSAJE_TIENDA_NO_DISPONIBLE =
  'Esta tienda no está disponible por el momento, por eso no se puede agregar al carrito.';

/** Días extra después de `vigenteHasta` antes de bloquear la venta (valor inicial) */
export const DIAS_GRACIA_DEFAULT = 0;

// Valor vigente: lo fija useConfiguracion cuando carga `configuracion/membresia/diasGracia`
let diasGraciaActual = DIAS_GRACIA_DEFAULT;
export function setDiasGracia(dias: number) {
  diasGraciaActual = Number.isFinite(dias) && dias > 0 ? Math.trunc(dias) : 0;
}
export const diasGraciaConfigurados = () => diasGraciaActual;

/** Convierte 'YYYY-MM-DD' al final de ese día en hora local. null si no es válida. */
function finDeDia(fecha?: string): Date | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999);
}

/**
 * Estado que realmente aplica hoy.
 * - Sin registro de control o sin campo `estatus` (tienda anterior a la regla): 'activa'.
 * - 'activa' con `vigenteHasta` pasado (+ días de gracia): 'vencida'.
 * - 'activa' sin `vigenteHasta`: 'activa' (todavía no se le exige membresía).
 */
export function estadoEfectivo(
  tienda: ControlTienda | null | undefined,
  hoy: Date = new Date(),
  diasGracia: number = diasGraciaActual,
): EstadoEfectivo {
  const estado: EstadoTienda = tienda?.estatus ?? 'activa';
  if (estado !== 'activa') return estado;

  const limite = finDeDia(tienda?.membresia?.vigenteHasta);
  if (!limite) return 'activa';
  limite.setDate(limite.getDate() + Math.max(0, diasGracia));
  return hoy.getTime() > limite.getTime() ? 'vencida' : 'activa';
}

/** true solo cuando la tienda puede aparecer al público y recibir pedidos */
export function tiendaPuedeVender(
  tienda: ControlTienda | null | undefined,
  hoy: Date = new Date(),
  diasGracia: number = diasGraciaActual,
): boolean {
  return estadoEfectivo(tienda, hoy, diasGracia) === 'activa';
}

/**
 * Membresía vigente: la tienda está activa Y tiene una fecha de vigencia registrada que
 * no ha pasado (contando los días de gracia). Es lo que se exige para PUBLICAR productos.
 * A diferencia de `tiendaPuedeVender`, una tienda activa sin membresía registrada NO cumple.
 */
export function membresiaVigente(
  tienda: ControlTienda | null | undefined,
  hoy: Date = new Date(),
  diasGracia: number = diasGraciaActual,
): boolean {
  if (estadoEfectivo(tienda, hoy, diasGracia) !== 'activa') return false;
  return finDeDia(tienda?.membresia?.vigenteHasta) !== null;
}

export const MENSAJE_SIN_MEMBRESIA =
  'Para publicar productos necesitas una membresía vigente. Actívala desde tu perfil de tienda.';

/** Días que faltan para el vencimiento (negativo si ya pasó). null si no hay membresía. */
export function diasParaVencer(tienda: ControlTienda | null | undefined, hoy: Date = new Date()): number | null {
  const limite = finDeDia(tienda?.membresia?.vigenteHasta);
  if (!limite) return null;
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioLimite = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate());
  return Math.round((inicioLimite.getTime() - inicioHoy.getTime()) / 86_400_000);
}

export interface AvisoEstado {
  tipo: 'info' | 'warning' | 'error';
  titulo: string;
  detalle: string;
}

/**
 * Aviso para la dueña o dueño de la tienda. null si todo está en orden
 * (o solo un recordatorio si la membresía vence en 7 días o menos).
 */
export function avisoEstadoTienda(tienda: ControlTienda | null | undefined, hoy: Date = new Date()): AvisoEstado | null {
  const estado = estadoEfectivo(tienda, hoy);
  switch (estado) {
    case 'pendiente':
      return {
        tipo: 'info',
        titulo: 'Tu tienda está pendiente de aprobación',
        detalle:
          'Para publicar productos necesitas que un administrador apruebe la tienda y una membresía vigente. Pagar tu membresía activa la tienda de inmediato.',
      };
    case 'bloqueada':
      return {
        tipo: 'error',
        titulo: 'Tu tienda está bloqueada',
        detalle: tienda?.motivoBloqueo
          ? `${tienda.motivoBloqueo} Contacta al administrador para reactivarla.`
          : 'No puedes vender por el momento. Contacta al administrador para reactivarla.',
      };
    case 'vencida':
      return {
        tipo: 'error',
        titulo: 'Tu membresía venció',
        detalle: `Venció el ${tienda?.membresia?.vigenteHasta}. Tus productos dejaron de mostrarse a los clientes. Paga tu membresía para reactivar la tienda.`,
      };
    default: {
      const dias = diasParaVencer(tienda, hoy);
      if (dias === null) {
        // Aprobada pero sin membresía registrada: no puede publicar productos
        return {
          tipo: 'warning',
          titulo: 'Activa tu membresía',
          detalle:
            'Tu tienda está aprobada, pero para publicar productos necesitas una membresía vigente. Paga tu membresía para empezar a vender.',
        };
      }
      if (dias < 0) {
        // vencida pero dentro de los días de gracia
        const restan = diasGraciaActual + dias;
        return {
          tipo: 'error',
          titulo: 'Tu membresía venció',
          detalle: `Venció el ${tienda?.membresia?.vigenteHasta}. Sigues vendiendo ${restan} día${restan === 1 ? '' : 's'} más por periodo de gracia. Paga tu membresía para no perder visibilidad.`,
        };
      }
      if (dias <= 7) {
        return {
          tipo: 'warning',
          titulo: dias === 0 ? 'Tu membresía vence hoy' : `Tu membresía vence en ${dias} día${dias === 1 ? '' : 's'}`,
          detalle: `Vigente hasta el ${tienda?.membresia?.vigenteHasta}. Renueva a tiempo para que tu tienda siga visible.`,
        };
      }
      return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mapa compartido tiendaId -> control, cargado una vez y en vivo       */
/* ------------------------------------------------------------------ */

const controlPorTienda = ref<Record<string, ControlTienda>>({});
const cargado = ref(false);
let suscrito = false;

function extraerControl(t: any): ControlTienda {
  return {
    nombreTienda: t?.nombreTienda,
    estatus: t?.estatus,
    motivoBloqueo: t?.motivoBloqueo,
    membresia: t?.membresia,
    aprobadaEn: t?.aprobadaEn,
    aprobadaPor: t?.aprobadaPor,
    creadaEn: t?.creadaEn,
  };
}

function asegurarSuscripcion() {
  if (suscrito) return;
  suscrito = true;
  onValue(dbRef(db, 'tiendas'), (snap) => {
    const data = snap.val() || {};
    const mapa: Record<string, ControlTienda> = {};
    for (const id of Object.keys(data)) mapa[id] = extraerControl(data[id]);
    controlPorTienda.value = mapa;
    cargado.value = true;
  });
}

/** Solo para pruebas: fija el mapa sin Firebase (null vuelve a suscribirse) */
export function __setControlPorTienda(mapa: Record<string, ControlTienda> | null) {
  suscrito = mapa !== null;
  cargado.value = mapa !== null;
  controlPorTienda.value = mapa || {};
}

export function useEstadoTiendas() {
  asegurarSuscripcion();

  /**
   * true  -> la tienda puede vender
   * false -> no puede (ocultar / bloquear carrito)
   * undefined -> aún no sabemos (datos sin cargar) o la tienda no tiene registro de control
   */
  const puedeVender = (tiendaId?: string | null): boolean | undefined => {
    if (!tiendaId) return undefined;
    const ctrl = controlPorTienda.value[tiendaId];
    if (!ctrl) return undefined;
    return tiendaPuedeVender(ctrl);
  };

  /** Bloquea solo cuando sabemos con certeza que la tienda NO puede vender */
  const noPuedeVender = (tiendaId?: string | null) => puedeVender(tiendaId) === false;

  const estadoDe = (tiendaId?: string | null): EstadoEfectivo | undefined => {
    if (!tiendaId) return undefined;
    const ctrl = controlPorTienda.value[tiendaId];
    return ctrl ? estadoEfectivo(ctrl) : undefined;
  };

  /** Nombre actual de la tienda (undefined si aún no cargó o no existe) */
  const nombreDe = (tiendaId?: string | null): string | undefined =>
    tiendaId ? controlPorTienda.value[tiendaId]?.nombreTienda || undefined : undefined;

  return { controlPorTienda, cargado, puedeVender, noPuedeVender, estadoDe, nombreDe };
}

/**
 * Consulta directa (sin suscripción) para validaciones puntuales, por ejemplo
 * antes de guardar un pedido o publicar un producto.
 * Devuelve las tiendas que NO pueden vender con su nombre para el mensaje.
 */
export async function tiendasQueNoPuedenVender(
  tiendaIds: string[],
): Promise<{ id: string; nombre: string; estado: EstadoEfectivo }[]> {
  const ids = [...new Set(tiendaIds.filter(Boolean))];
  const resultado: { id: string; nombre: string; estado: EstadoEfectivo }[] = [];
  for (const id of ids) {
    const snap = await get(dbRef(db, `tiendas/${id}`));
    if (!snap.exists()) continue; // sin registro de control no hay bloqueo
    const t = snap.val();
    const estado = estadoEfectivo(extraerControl(t));
    if (estado !== 'activa') resultado.push({ id, nombre: t?.nombreTienda || id, estado });
  }
  return resultado;
}

export type MotivoSinMembresia = EstadoEfectivo | 'sin-membresia';

export const MOTIVO_SIN_MEMBRESIA_LABEL: Record<MotivoSinMembresia, string> = {
  ...ESTADO_LABEL,
  'sin-membresia': 'Sin membresía activa',
};

/**
 * Tiendas que NO pueden publicar productos: además de estar activas deben tener
 * membresía vigente. Una tienda sin registro de control no se bloquea (igual que arriba).
 */
export async function tiendasSinMembresiaVigente(
  tiendaIds: string[],
): Promise<{ id: string; nombre: string; motivo: MotivoSinMembresia }[]> {
  const ids = [...new Set(tiendaIds.filter(Boolean))];
  const resultado: { id: string; nombre: string; motivo: MotivoSinMembresia }[] = [];
  for (const id of ids) {
    const snap = await get(dbRef(db, `tiendas/${id}`));
    if (!snap.exists()) continue;
    const t = snap.val();
    const ctrl = extraerControl(t);
    if (membresiaVigente(ctrl)) continue;
    const estado = estadoEfectivo(ctrl);
    resultado.push({ id, nombre: t?.nombreTienda || id, motivo: estado === 'activa' ? 'sin-membresia' : estado });
  }
  return resultado;
}

export async function tiendaPuedeVenderPorId(tiendaId: string): Promise<boolean> {
  if (!tiendaId) return false;
  return (await tiendasQueNoPuedenVender([tiendaId])).length === 0;
}

export class TiendaNoDisponibleError extends Error {
  tiendas: { id: string; nombre: string; estado: EstadoEfectivo }[];
  constructor(tiendas: { id: string; nombre: string; estado: EstadoEfectivo }[]) {
    const nombres = tiendas.map((t) => t.nombre).join(', ');
    super(
      tiendas.length === 1
        ? `La tienda ${nombres} no está disponible por el momento. Quita sus productos del carrito para continuar.`
        : `Las tiendas ${nombres} no están disponibles por el momento. Quita sus productos del carrito para continuar.`,
    );
    this.name = 'TiendaNoDisponibleError';
    this.tiendas = tiendas;
  }
}
