import { ref, computed } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { sessionAdmin } from '@/utils/sessionAdmin';
import { setDiasGracia } from '@/composables/useMembresia';
import { esPaleta, esHex, PALETA_DEFAULT, type Paleta, type PaletaPersonalizada } from '@/composables/usePaleta';
import { normalizarTematica, type Tematica } from '@/composables/useTematicas';

/**
 * Configuración del sistema, en `configuracion/`. La escribe el administrador
 * y la lee toda la app en vivo. Cualquier campo ausente toma el valor por defecto.
 *
 *   configuracion/membresia      { precioMensual, precioAnual, diasGracia }
 *   configuracion/registro       { tiendasAbierto, mensajeCerrado }
 *   configuracion/promociones    { habilitadas }
 *   configuracion/mantenimiento  { activo, mensaje }
 *   configuracion/soporte        { whatsapp, email }
 *   configuracion/apariencia     { paleta, personalizadas/{id}, tematicas/{id} }  (Admin › Apariencia)
 *   configuracion/actualizadoEn, actualizadoPor
 */

export interface Configuracion {
  membresia: {
    precioMensual: number;
    precioAnual: number;
    /** Días extra después de `vigenteHasta` antes de bloquear la venta */
    diasGracia: number;
  };
  registro: {
    /** Si es false, no se pueden registrar tiendas nuevas */
    tiendasAbierto: boolean;
    mensajeCerrado: string;
  };
  promociones: {
    /** Si es false, las tiendas no ven "Crear promoción" en su menú */
    habilitadas: boolean;
  };
  mantenimiento: {
    /** Si es true, los clientes y tiendas ven el aviso y no pueden usar la app; el admin sí */
    activo: boolean;
    mensaje: string;
  };
  soporte: {
    whatsapp: string; // 10 dígitos
    email: string;
  };
  pagos: {
    /**
     * 'links': la tienda abre un link de pago y avisa con "Ya pagué"; el admin confirma.
     * 'automatico': el servidor Express crea el pago en Mercado Pago y el webhook activa la membresía solo.
     */
    modo: 'links' | 'automatico';
    /** Links de pago creados en el panel de Mercado Pago (uno por plan). Vacío = plan sin pago en línea */
    linkMensual: string;
    linkAnual: string;
    /** Texto que ve la tienda después de pagar (a dónde mandar el comprobante, etc.) */
    instrucciones: string;
  };
  apariencia: {
    /** Paleta de colores de toda la app: una fija o el id de una personalizada (ver usePaleta.ts) */
    paleta: Paleta;
    personalizadas: Record<string, PaletaPersonalizada>;
    /** Decoraciones de temporada (ver useTematicas.ts) */
    tematicas: Record<string, Tematica>;
  };
  actualizadoEn?: string;
  actualizadoPor?: string;
  /** Lo escribe la función programada `revisarMembresias` (functions/) */
  ultimaRevisionMembresias?: {
    fecha: string;
    hoy: string;
    diasGracia: number;
    revisadas: number;
    bloqueadas: number;
    recordatorios: number;
    correosEnviados: number;
    correosFallidos: number;
    simulacion: boolean;
  };
}

export const CONFIG_DEFAULT: Configuracion = {
  membresia: { precioMensual: 0, precioAnual: 0, diasGracia: 0 },
  registro: {
    tiendasAbierto: true,
    mensajeCerrado: 'Por el momento no estamos aceptando nuevas tiendas. Vuelve a intentarlo más adelante.',
  },
  promociones: { habilitadas: true },
  mantenimiento: {
    activo: false,
    mensaje: 'Estamos haciendo mejoras. Volvemos en unos minutos.',
  },
  soporte: { whatsapp: '', email: '' },
  pagos: {
    modo: 'links',
    linkMensual: '',
    linkAnual: '',
    instrucciones:
      'Cuando termines el pago, pulsa "Ya pagué" y escribe el número de operación. El administrador confirmará el pago y activará tu membresía.',
  },
  apariencia: { paleta: PALETA_DEFAULT, personalizadas: {}, tematicas: {} },
};

const esUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

const num = (v: any, def: number) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : def);
const bool = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def);
const str = (v: any, def: string) => (typeof v === 'string' ? v : def);

function normalizarApariencia(a: any): Configuracion['apariencia'] {
  const personalizadas: Record<string, PaletaPersonalizada> = {};
  for (const [id, p] of Object.entries<any>(a?.personalizadas && typeof a.personalizadas === 'object' ? a.personalizadas : {})) {
    if (!p || !esHex(p.cabecera) || !esHex(p.boton) || !esHex(p.resaltado)) continue;
    personalizadas[id] = {
      nombre: typeof p.nombre === 'string' && p.nombre.trim() ? p.nombre.trim() : 'Mi paleta',
      cabecera: p.cabecera.toLowerCase(),
      boton: p.boton.toLowerCase(),
      resaltado: p.resaltado.toLowerCase(),
    };
  }
  const tematicas: Record<string, Tematica> = {};
  for (const [id, t] of Object.entries<any>(a?.tematicas && typeof a.tematicas === 'object' ? a.tematicas : {})) {
    const n = normalizarTematica(t);
    if (n) tematicas[id] = { ...n, paleta: n.paleta && esPaleta(n.paleta, personalizadas) ? n.paleta : '' };
  }
  return {
    paleta: esPaleta(a?.paleta, personalizadas) ? a.paleta : PALETA_DEFAULT,
    personalizadas,
    tematicas,
  };
}

/** Mezcla lo guardado con los valores por defecto, campo por campo */
export function normalizarConfiguracion(data: any): Configuracion {
  const d = CONFIG_DEFAULT;
  return {
    membresia: {
      precioMensual: Math.max(0, num(data?.membresia?.precioMensual, d.membresia.precioMensual)),
      precioAnual: Math.max(0, num(data?.membresia?.precioAnual, d.membresia.precioAnual)),
      diasGracia: Math.max(0, Math.trunc(num(data?.membresia?.diasGracia, d.membresia.diasGracia))),
    },
    registro: {
      tiendasAbierto: bool(data?.registro?.tiendasAbierto, d.registro.tiendasAbierto),
      mensajeCerrado: str(data?.registro?.mensajeCerrado, d.registro.mensajeCerrado) || d.registro.mensajeCerrado,
    },
    promociones: {
      habilitadas: bool(data?.promociones?.habilitadas, d.promociones.habilitadas),
    },
    mantenimiento: {
      activo: bool(data?.mantenimiento?.activo, d.mantenimiento.activo),
      mensaje: str(data?.mantenimiento?.mensaje, d.mantenimiento.mensaje) || d.mantenimiento.mensaje,
    },
    soporte: {
      whatsapp: str(data?.soporte?.whatsapp, '').replace(/\D/g, '').slice(0, 10),
      email: str(data?.soporte?.email, '').trim(),
    },
    pagos: {
      modo: data?.pagos?.modo === 'automatico' ? 'automatico' : 'links',
      linkMensual: esUrl(str(data?.pagos?.linkMensual, '').trim()) ? str(data?.pagos?.linkMensual, '').trim() : '',
      linkAnual: esUrl(str(data?.pagos?.linkAnual, '').trim()) ? str(data?.pagos?.linkAnual, '').trim() : '',
      instrucciones: str(data?.pagos?.instrucciones, d.pagos.instrucciones) || d.pagos.instrucciones,
    },
    apariencia: normalizarApariencia(data?.apariencia),
    actualizadoEn: data?.actualizadoEn,
    actualizadoPor: data?.actualizadoPor,
    ultimaRevisionMembresias:
      data?.ultimaRevisionMembresias && typeof data.ultimaRevisionMembresias === 'object'
        ? {
            fecha: str(data.ultimaRevisionMembresias.fecha, ''),
            hoy: str(data.ultimaRevisionMembresias.hoy, ''),
            diasGracia: num(data.ultimaRevisionMembresias.diasGracia, 0),
            revisadas: num(data.ultimaRevisionMembresias.revisadas, 0),
            bloqueadas: num(data.ultimaRevisionMembresias.bloqueadas, 0),
            recordatorios: num(data.ultimaRevisionMembresias.recordatorios, 0),
            correosEnviados: num(data.ultimaRevisionMembresias.correosEnviados, 0),
            correosFallidos: num(data.ultimaRevisionMembresias.correosFallidos, 0),
            simulacion: bool(data.ultimaRevisionMembresias.simulacion, false),
          }
        : undefined,
  };
}

/* ---------------- Estado compartido, cargado una vez y en vivo ---------------- */

const configuracion = ref<Configuracion>(normalizarConfiguracion(null));
const cargada = ref(false);
let suscrito = false;

function aplicar(data: any) {
  configuracion.value = normalizarConfiguracion(data);
  cargada.value = true;
  // La regla de membresía usa los días de gracia configurados
  setDiasGracia(configuracion.value.membresia.diasGracia);
}

/** Llamar una vez al arrancar la app (App.vue). Es seguro llamarlo varias veces. */
export function iniciarConfiguracion() {
  if (suscrito) return;
  suscrito = true;
  onValue(
    dbRef(db, 'configuracion'),
    (snap) => aplicar(snap.val()),
    (e) => console.error('❌ Error leyendo configuracion:', e),
  );
}

/** Solo para pruebas: fija la configuración sin Firebase (null vuelve a suscribirse) */
export function __setConfiguracion(data: any | null) {
  suscrito = data !== null;
  if (data === null) {
    configuracion.value = normalizarConfiguracion(null);
    cargada.value = false;
    setDiasGracia(0);
  } else {
    aplicar(data);
  }
}

/** Escribe una parte de la configuración (se mezcla con lo existente). */
export async function guardarConfiguracion(parcial: {
  membresia?: Partial<Configuracion['membresia']>;
  registro?: Partial<Configuracion['registro']>;
  promociones?: Partial<Configuracion['promociones']>;
  mantenimiento?: Partial<Configuracion['mantenimiento']>;
  soporte?: Partial<Configuracion['soporte']>;
  pagos?: Partial<Configuracion['pagos']>;
}): Promise<void> {
  const cambios: Record<string, any> = {};
  for (const [seccion, valores] of Object.entries(parcial)) {
    if (!valores) continue;
    for (const [campo, valor] of Object.entries(valores)) {
      if (valor === undefined) continue;
      cambios[`${seccion}/${campo}`] = valor;
    }
  }
  if (!Object.keys(cambios).length) return;
  cambios.actualizadoEn = new Date().toISOString();
  cambios.actualizadoPor = sessionAdmin.value?.nombre || 'admin';
  await update(dbRef(db, 'configuracion'), cambios);
}

/* ---------------- Apariencia (Admin › Apariencia) ---------------- */

/** Escribe rutas dentro de `configuracion/apariencia` (null borra) y marca quién lo cambió */
async function escribirApariencia(cambios: Record<string, unknown>): Promise<void> {
  const todo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) todo[`apariencia/${k}`] = v;
  todo.actualizadoEn = new Date().toISOString();
  todo.actualizadoPor = sessionAdmin.value?.nombre || 'admin';
  await update(dbRef(db, 'configuracion'), todo);
}

export const nuevoIdApariencia = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function usarPaleta(paleta: Paleta) {
  return escribirApariencia({ paleta });
}

export function guardarPaletaPersonalizada(id: string, p: PaletaPersonalizada) {
  return escribirApariencia({ [`personalizadas/${id}`]: p });
}

/** Borra una paleta propia. Si estaba en uso (general o en una temática), se vuelve a la de por defecto. */
export function eliminarPaletaPersonalizada(id: string) {
  const a = configuracion.value.apariencia;
  const cambios: Record<string, unknown> = { [`personalizadas/${id}`]: null };
  if (a.paleta === id) cambios.paleta = PALETA_DEFAULT;
  for (const [tid, t] of Object.entries(a.tematicas)) if (t.paleta === id) cambios[`tematicas/${tid}/paleta`] = '';
  return escribirApariencia(cambios);
}

export function guardarTematica(id: string, t: Tematica) {
  return escribirApariencia({ [`tematicas/${id}`]: t });
}

export function eliminarTematica(id: string) {
  return escribirApariencia({ [`tematicas/${id}`]: null });
}

/** Activa una temática y apaga las demás (solo se muestra una a la vez); `null` las apaga todas */
export function activarTematica(id: string | null) {
  const cambios: Record<string, unknown> = {};
  for (const tid of Object.keys(configuracion.value.apariencia.tematicas)) cambios[`tematicas/${tid}/activa`] = false;
  // Explícito: la temática puede ser recién creada y aún no estar en la configuración en vivo
  if (id) cambios[`tematicas/${id}/activa`] = true;
  return escribirApariencia(cambios);
}

/** Si la app está en mantenimiento para esta ruta (el panel de admin nunca se bloquea) */
export function enMantenimientoPara(config: Configuracion, path: string): boolean {
  return config.mantenimiento.activo && !path.startsWith('/admin');
}

/** Precio sugerido de membresía según el plan (0 si no está configurado) */
export function precioPlan(config: Configuracion, plan: 'mensual' | 'anual'): number {
  return plan === 'anual' ? config.membresia.precioAnual : config.membresia.precioMensual;
}

export function useConfiguracion() {
  iniciarConfiguracion();
  const registroTiendasAbierto = computed(() => configuracion.value.registro.tiendasAbierto);
  /** El admin puede apagar las promociones: las tiendas dejan de ver "Crear promoción" */
  const promocionesHabilitadas = computed(() => configuracion.value.promociones.habilitadas);
  const contactoSoporte = computed(() => {
    const { whatsapp, email } = configuracion.value.soporte;
    const partes: string[] = [];
    if (whatsapp.length === 10) partes.push(`WhatsApp ${whatsapp.slice(0, 3)}-${whatsapp.slice(3, 6)}-${whatsapp.slice(6)}`);
    if (email) partes.push(email);
    return partes.join(' · ');
  });
  /**
   * Hay pago en línea si: modo automático con al menos un precio configurado, o
   * modo links con al menos un link de pago.
   */
  const pagoEnLineaDisponible = computed(() => {
    const c = configuracion.value;
    if (c.pagos.modo === 'automatico') return c.membresia.precioMensual > 0 || c.membresia.precioAnual > 0;
    return !!(c.pagos.linkMensual || c.pagos.linkAnual);
  });
  const pagoAutomatico = computed(() => configuracion.value.pagos.modo === 'automatico');
  return {
    configuracion,
    cargada,
    registroTiendasAbierto,
    promocionesHabilitadas,
    contactoSoporte,
    pagoEnLineaDisponible,
    pagoAutomatico,
    guardarConfiguracion,
  };
}
