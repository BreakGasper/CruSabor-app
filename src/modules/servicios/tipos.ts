/**
 * Modelo de datos de las tiendas de SERVICIOS (citas y cotizaciones).
 *
 * Los servicios NO son artículos: viven en sus propios nodos de Firebase y tienen su propio flujo de contratación
 * (agendar una cita o pedir una cotización). El carrito de productos no interviene.
 *
 *   tiendas/{id}                         + tipoNegocio, modalidadAtencion, categoriaServicio, especialidades, experiencia
 *   servicios/{tiendaId}/{servicioId}    Servicio
 *   profesionales/{tiendaId}/{profId}    Profesional
 *   disponibilidad/{tiendaId}/{profId}   Disponibilidad (horario semanal, descansos, bloqueos y vacaciones)
 *   citas/{tiendaId}/{citaId}            Cita
 *   citasPorCliente/{clienteId}/{citaId} { tiendaId }   (índice para "Mis citas")
 *   ocupacion/{tiendaId}/{profId}/{AAAA-MM-DD}/{HHmm}   citaId   (un nodo por bloque de 15 min: evita reservas dobles)
 *   cotizaciones/{tiendaId}/{cotId}      Cotizacion
 *   cotizacionesPorCliente/{clienteId}/{cotId}  { tiendaId }
 *   clientesServicio/{tiendaId}/{clienteId}     ClienteServicio (resumen que se mantiene al reservar o cotizar)
 *
 * Compatibilidad: una tienda SIN `tipoNegocio` se trata como 'productos'. No hay migración obligatoria.
 */

export type TipoNegocio = 'productos' | 'servicios' | 'mixto';
export const TIPOS_NEGOCIO: readonly TipoNegocio[] = ['productos', 'servicios', 'mixto'];

/** Dónde se presta el servicio */
export type ModalidadAtencion = 'local' | 'domicilio' | 'ambas';
export const MODALIDADES_ATENCION: readonly ModalidadAtencion[] = ['local', 'domicilio', 'ambas'];

/** Cómo se contrata un servicio concreto */
export type Contratacion = 'cita' | 'cotizacion' | 'ambas';
export const CONTRATACIONES: readonly Contratacion[] = ['cita', 'cotizacion', 'ambas'];

/** Cómo se cobra */
export type TipoPrecio = 'fijo' | 'desde' | 'cotizar';
export const TIPOS_PRECIO: readonly TipoPrecio[] = ['fijo', 'desde', 'cotizar'];

export interface CategoriaServicio {
  id: string;
  nombre: string;
  icono: string;
}

/** Lista fija (el administrador podrá ampliarla más adelante). Los ids no cambian: se guardan en las tiendas. */
export const CATEGORIAS_SERVICIO: readonly CategoriaServicio[] = [
  { id: 'barberia', nombre: 'Barbería y peluquería', icono: '💈' },
  { id: 'unas', nombre: 'Uñas y manicura', icono: '💅' },
  { id: 'maquillaje', nombre: 'Maquillaje profesional', icono: '💄' },
  { id: 'pestanas', nombre: 'Pestañas y cejas', icono: '👁️' },
  { id: 'peinados', nombre: 'Peinados', icono: '💇' },
  { id: 'enfermeria', nombre: 'Enfermería y atención profesional', icono: '🩺' },
  { id: 'fotografia', nombre: 'Fotografía', icono: '📷' },
  { id: 'reparaciones', nombre: 'Reparaciones y mantenimiento', icono: '🛠️' },
  { id: 'tecnicos', nombre: 'Servicios técnicos', icono: '🔧' },
  { id: 'limpieza', nombre: 'Limpieza', icono: '🧹' },
  { id: 'asesorias', nombre: 'Asesorías y consultorías', icono: '📋' },
  { id: 'entrenadores', nombre: 'Entrenadores personales', icono: '🏋️' },
  { id: 'otros', nombre: 'Otros servicios', icono: '✨' },
];

export const nombreCategoriaServicio = (id?: string | null): string =>
  CATEGORIAS_SERVICIO.find((c) => c.id === id)?.nombre ?? '';

/* ------------------------------ Servicios y equipo ------------------------------ */

export interface Servicio {
  id: string;
  tiendaId: string;
  nombre: string;
  descripcion: string;
  fotos: string[];
  categoria: string; // id de CATEGORIAS_SERVICIO
  tipoPrecio: TipoPrecio;
  /** Precio fijo o "desde" (MXN). 0 cuando es a cotizar. */
  precio: number;
  /** Duración en minutos (múltiplo de 15). Obligatoria si se puede agendar. */
  duracionMin: number;
  modalidad: ModalidadAtencion;
  contratacion: Contratacion;
  /** Profesionales que lo ofrecen (vacío = todos) */
  profesionalIds: string[];
  activo: boolean;
  orden: number;
  creadoEn?: string;
}

export interface Profesional {
  id: string;
  tiendaId: string;
  nombre: string;
  fotoUrl?: string;
  especialidad?: string;
  activo: boolean;
}

/** Profesional que siempre existe: la persona dueña (una tienda sin equipo agenda con ella) */
export const PROFESIONAL_PRINCIPAL = 'principal';

/* ------------------------------ Disponibilidad ------------------------------ */

/** Días como los usa la disponibilidad (lunes primero, igual que DIAS_SEMANA de la tienda) */
export const DIAS_CLAVE = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const;
export type DiaClave = (typeof DIAS_CLAVE)[number];

export interface Descanso {
  desde: string; // HH:mm
  hasta: string; // HH:mm
}

export interface HorarioDiaServicio {
  abre: string; // HH:mm
  cierra: string; // HH:mm
  descansos?: Descanso[];
}

export interface Bloqueo {
  id?: string;
  fecha: string; // AAAA-MM-DD
  /** Sin horas = todo el día */
  desde?: string;
  hasta?: string;
  motivo?: string;
}

export interface Vacaciones {
  id?: string;
  desde: string; // AAAA-MM-DD
  hasta: string; // AAAA-MM-DD (incluido)
  motivo?: string;
}

export interface Disponibilidad {
  /** Día sin entrada (o null) = no se atiende */
  semana: Partial<Record<DiaClave, HorarioDiaServicio | null>>;
  /** Minutos mínimos entre "ahora" y el inicio de una cita (por defecto 60) */
  anticipacionMin?: number;
  /** Hasta cuántos días adelante se puede reservar (por defecto 60) */
  maxDiasAdelante?: number;
  bloqueos?: Bloqueo[];
  vacaciones?: Vacaciones[];
}

export const ANTICIPACION_MIN_DEFAULT = 60;
export const MAX_DIAS_ADELANTE_DEFAULT = 60;

/* ------------------------------ Citas ------------------------------ */

export type EstadoCita = 'pendiente' | 'confirmada' | 'completada' | 'cancelada' | 'rechazada';
export const ESTADOS_CITA: readonly EstadoCita[] = ['pendiente', 'confirmada', 'completada', 'cancelada', 'rechazada'];

export interface EventoHistorial {
  fecha: string; // ISO
  estado: string;
  por: 'cliente' | 'tienda' | 'sistema';
  nota?: string;
}

export interface Cita {
  id: string;
  tiendaId: string;
  /** Copias hechas al reservar, para que el cliente vea de quién es y pueda contactarla sin otra consulta */
  tiendaNombre?: string;
  tiendaTelefono?: string;
  servicioId: string;
  servicioNombre: string;
  profesionalId: string;
  profesionalNombre?: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  fecha: string; // AAAA-MM-DD
  inicio: string; // HH:mm
  fin: string; // HH:mm
  duracionMin: number;
  precio?: number;
  tipoPrecio?: TipoPrecio;
  adomicilio?: boolean;
  direccion?: string;
  comentarios?: string;
  estado: EstadoCita;
  creadaEn: string;
  historial?: Record<string, EventoHistorial>;
}

/* ------------------------------ Cotizaciones ------------------------------ */

export type EstadoCotizacion = 'pendiente' | 'en_revision' | 'cotizada' | 'aceptada' | 'rechazada' | 'vencida' | 'completada';
export const ESTADOS_COTIZACION: readonly EstadoCotizacion[] = [
  'pendiente',
  'en_revision',
  'cotizada',
  'aceptada',
  'rechazada',
  'vencida',
  'completada',
];

export interface RespuestaCotizacion {
  precio: number;
  descripcion?: string;
  condiciones?: string;
  /** Último día en que el cliente puede aceptar (AAAA-MM-DD) */
  venceEl: string;
  respondidaEn: string;
}

export interface Cotizacion {
  id: string;
  tiendaId: string;
  /** Copias hechas al solicitar, para que el cliente vea de quién es y pueda contactarla sin otra consulta */
  tiendaNombre?: string;
  tiendaTelefono?: string;
  servicioId: string;
  servicioNombre: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  descripcion: string;
  imagenes: string[];
  fechaTentativa?: string; // AAAA-MM-DD
  adomicilio: boolean;
  direccion?: string;
  estado: EstadoCotizacion;
  respuesta?: RespuestaCotizacion;
  creadaEn: string;
  historial?: Record<string, EventoHistorial>;
}

export interface ClienteServicio {
  clienteId: string;
  nombre: string;
  telefono: string;
  citas: number;
  cotizaciones: number;
  ultimaActividad: string; // ISO
  notas?: string;
}
