/**
 * Temáticas de festividades mexicanas, incluidas en la app. Se encienden SOLAS cada
 * año en sus fechas: no hay que crearlas ni activarlas a mano.
 *
 * Mientras una festividad está en curso:
 *  - la app usa su paleta (PALETAS_FESTIVAS en usePaleta.ts), si el admin no lo apagó;
 *  - aparece su icono, pequeño y sin recibir toques, en las cabeceras (TopBarFija,
 *    PageHeader, logo de la portada) y en una esquina de los carruseles (IconoFestivo.vue).
 *
 * Fechas:
 *  - Fijas: mismo día y mes cada año ("MM-DD"); un rango puede cruzar el año (Año Nuevo).
 *  - Móviles: se calculan para cada año (Semana Santa y Carnaval a partir de la Pascua,
 *    Día del Padre = 3er domingo de junio, Guelaguetza = los dos lunes después del 16 de julio).
 *  - Fiestas patronales: cada pueblo tiene la suya, así que el admin pone las fechas.
 *
 * Además el admin puede ACTIVAR UNA A MANO (`manual`): se muestra desde ese momento,
 * sin importar la fecha ni el interruptor general, hasta que la quite.
 *
 * Lo que el admin puede cambiar se guarda en `configuracion/apariencia/festivas`
 * (ver normalizarFestivas). Una temática creada a mano y vigente tiene prioridad.
 *
 * Este archivo es puro (sin Firebase): useConfiguracion lo importa para normalizar,
 * y useFestividad.ts lo une con la configuración en vivo.
 */
import { hoyISO, IMAGENES_TEMATICA } from '@/composables/useTematicas';

export type ReglaFecha =
  | { tipo: 'fija'; desde: string; hasta: string } // MM-DD
  | { tipo: 'pascua'; desde: number; hasta: number } // días respecto al Domingo de Pascua
  | { tipo: 'dia-padre' }
  | { tipo: 'guelaguetza' }
  | { tipo: 'manual' };

export interface Festividad {
  nombre: string;
  emoji: string;
  /** Archivo en src/assets/tematicas */
  icono: string;
  /** Id en PALETAS_FESTIVAS */
  paleta: string;
  regla: ReglaFecha;
  /** Texto para el admin */
  cuando: string;
}

const fija = (desde: string, hasta = desde): ReglaFecha => ({ tipo: 'fija', desde, hasta });

export const FESTIVIDADES: Record<string, Festividad> = {
  'fiesta-reyes': { nombre: 'Día de Reyes', emoji: '👑', icono: 'fiesta-reyes.svg', paleta: 'fiesta-reyes', regla: fija('01-06'), cuando: '6 de enero' },
  'fiesta-candelaria': { nombre: 'Día de la Candelaria', emoji: '🕯️', icono: 'fiesta-candelaria.svg', paleta: 'fiesta-candelaria', regla: fija('02-02'), cuando: '2 de febrero' },
  'fiesta-amor-amistad': { nombre: 'Día del Amor y la Amistad', emoji: '💕', icono: 'fiesta-amor-amistad.svg', paleta: 'fiesta-amor-amistad', regla: fija('02-14'), cuando: '14 de febrero' },
  'fiesta-carnaval': { nombre: 'Carnaval', emoji: '🎊', icono: 'fiesta-carnaval.svg', paleta: 'fiesta-carnaval', regla: { tipo: 'pascua', desde: -50, hasta: -47 }, cuando: 'sábado a martes antes del Miércoles de Ceniza' },
  'fiesta-semana-santa': { nombre: 'Semana Santa', emoji: '⛪', icono: 'fiesta-semana-santa.svg', paleta: 'fiesta-semana-santa', regla: { tipo: 'pascua', desde: -7, hasta: 0 }, cuando: 'Domingo de Ramos a Domingo de Pascua' },
  'fiesta-dia-nino': { nombre: 'Día del Niño', emoji: '🧒', icono: 'fiesta-dia-nino.svg', paleta: 'fiesta-dia-nino', regla: fija('04-30'), cuando: '30 de abril' },
  'fiesta-dia-madres': { nombre: 'Día de las Madres', emoji: '🌸', icono: 'fiesta-dia-madres.svg', paleta: 'fiesta-dia-madres', regla: fija('05-10'), cuando: '10 de mayo' },
  'fiesta-dia-padre': { nombre: 'Día del Padre', emoji: '👨‍👧', icono: 'fiesta-dia-padre.svg', paleta: 'fiesta-dia-padre', regla: { tipo: 'dia-padre' }, cuando: '3er domingo de junio' },
  'fiesta-guelaguetza': { nombre: 'Guelaguetza', emoji: '🏵️', icono: 'fiesta-guelaguetza.svg', paleta: 'fiesta-guelaguetza', regla: { tipo: 'guelaguetza' }, cuando: 'los dos lunes después del 16 de julio' },
  'fiesta-independencia': { nombre: 'Día de la Independencia', emoji: '🇲🇽', icono: 'fiesta-independencia.svg', paleta: 'fiesta-independencia', regla: fija('09-15', '09-16'), cuando: '15 y 16 de septiembre' },
  'fiesta-halloween': { nombre: 'Halloween', emoji: '🎃', icono: 'fiesta-halloween.svg', paleta: 'fiesta-halloween', regla: fija('10-31'), cuando: '31 de octubre' },
  'fiesta-dia-muertos': { nombre: 'Día de Muertos', emoji: '💀', icono: 'fiesta-dia-muertos.svg', paleta: 'fiesta-dia-muertos', regla: fija('11-01', '11-02'), cuando: '1 y 2 de noviembre' },
  'fiesta-revolucion': { nombre: 'Día de la Revolución Mexicana', emoji: '🇲🇽', icono: 'fiesta-revolucion.svg', paleta: 'fiesta-revolucion', regla: fija('11-20'), cuando: '20 de noviembre' },
  'fiesta-guadalupe': { nombre: 'Día de la Virgen de Guadalupe', emoji: '🌹', icono: 'fiesta-guadalupe.svg', paleta: 'fiesta-guadalupe', regla: fija('12-12'), cuando: '12 de diciembre' },
  'fiesta-posadas': { nombre: 'Las Posadas', emoji: '🪅', icono: 'fiesta-posadas.svg', paleta: 'fiesta-posadas', regla: fija('12-16', '12-24'), cuando: '16 al 24 de diciembre' },
  'fiesta-navidad': { nombre: 'Navidad', emoji: '🎄', icono: 'fiesta-navidad.svg', paleta: 'fiesta-navidad', regla: fija('12-25'), cuando: '25 de diciembre' },
  'fiesta-ano-nuevo': { nombre: 'Año Nuevo', emoji: '🎆', icono: 'fiesta-ano-nuevo.svg', paleta: 'fiesta-ano-nuevo', regla: fija('12-31', '01-01'), cuando: '31 de diciembre y 1 de enero' },
  'fiesta-patronales': { nombre: 'Fiestas patronales', emoji: '🕯️', icono: 'fiesta-patronales.svg', paleta: 'fiesta-patronales', regla: { tipo: 'manual' }, cuando: 'las fechas que tú pongas' },
};

/* ---------------- Fechas ---------------- */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const sumarDias = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher) */
export function domingoDePascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, mes, dia);
}

/**
 * Rango [desde, hasta] (AAAA-MM-DD, ambos incluidos) de una festividad que EMPIEZA en el año `y`.
 * null si no tiene fechas (patronales sin configurar).
 */
export function rangoEnAnio(f: Festividad, y: number, manual?: { desde: string; hasta: string }): [string, string] | null {
  const r = f.regla;
  switch (r.tipo) {
    case 'fija': {
      const desde = `${y}-${r.desde}`;
      // Si el fin es "antes" que el inicio, cruza al año siguiente (31 dic → 1 ene)
      const hasta = `${r.hasta < r.desde ? y + 1 : y}-${r.hasta}`;
      return [desde, hasta];
    }
    case 'pascua': {
      const p = domingoDePascua(y);
      return [ymd(sumarDias(p, r.desde)), ymd(sumarDias(p, r.hasta))];
    }
    case 'dia-padre': {
      const primero = utc(y, 6, 1);
      const primerDomingo = sumarDias(primero, (7 - primero.getUTCDay()) % 7);
      const d = ymd(sumarDias(primerDomingo, 14));
      return [d, d];
    }
    case 'guelaguetza': {
      const dia16 = utc(y, 7, 16);
      const primerLunes = sumarDias(dia16, ((8 - dia16.getUTCDay()) % 7) || 7);
      return [ymd(primerLunes), ymd(sumarDias(primerLunes, 7))];
    }
    case 'manual':
      return manual && FECHA.test(manual.desde) && FECHA.test(manual.hasta) && manual.desde <= manual.hasta
        ? [manual.desde, manual.hasta]
        : null;
  }
}

/** El rango que cubre `hoy` o el próximo que viene (para mostrarlo en el admin) */
export function rangoActualOProximo(f: Festividad, hoy: string, manual?: { desde: string; hasta: string }): [string, string] | null {
  if (f.regla.tipo === 'manual') return rangoEnAnio(f, 0, manual);
  const y = Number(hoy.slice(0, 4));
  for (const anio of [y - 1, y, y + 1]) {
    const r = rangoEnAnio(f, anio);
    if (r && r[1] >= hoy) return r;
  }
  return null;
}

export function festividadVigente(f: Festividad, hoy: string, manual?: { desde: string; hasta: string }): boolean {
  const r = rangoActualOProximo(f, hoy, manual);
  return !!r && r[0] <= hoy && hoy <= r[1];
}

/* ---------------- Configuración del admin ---------------- */

export interface ConfigFestivas {
  /** Interruptor general: false = ninguna festividad se enciende sola */
  activas: boolean;
  /** Si la festividad en curso cambia los colores de la app */
  cambiarPaleta: boolean;
  /** Festividades que el admin apagó (id → true) */
  apagadas: Record<string, true>;
  /** Fechas de las fiestas patronales (AAAA-MM-DD) */
  patronales: { desde: string; hasta: string };
  /** Festividad activada a mano ('' = ninguna): manda sobre las fechas hasta que se quite */
  manual: string;
}

export const FESTIVAS_DEFAULT: ConfigFestivas = {
  activas: true,
  cambiarPaleta: true,
  apagadas: {},
  patronales: { desde: '', hasta: '' },
  manual: '',
};

export function normalizarFestivas(d: any): ConfigFestivas {
  const apagadas: Record<string, true> = {};
  if (d?.apagadas && typeof d.apagadas === 'object') {
    for (const [id, v] of Object.entries(d.apagadas)) if (v === true && FESTIVIDADES[id]) apagadas[id] = true;
  }
  const fecha = (v: unknown) => (typeof v === 'string' && FECHA.test(v) ? v : '');
  return {
    activas: typeof d?.activas === 'boolean' ? d.activas : true,
    cambiarPaleta: typeof d?.cambiarPaleta === 'boolean' ? d.cambiarPaleta : true,
    apagadas,
    patronales: { desde: fecha(d?.patronales?.desde), hasta: fecha(d?.patronales?.hasta) },
    manual: typeof d?.manual === 'string' && FESTIVIDADES[d.manual] ? d.manual : '',
  };
}

/**
 * La festividad en curso, o null. La activada a mano gana siempre (aunque no sea su
 * fecha, esté apagada o el interruptor general esté en off). Si no hay, la del
 * calendario; si coinciden dos (no pasa con las fechas de fábrica), la primera de la lista.
 */
export function festividadEnCurso(cfg: ConfigFestivas, hoy: string): [string, Festividad] | null {
  if (cfg.manual && FESTIVIDADES[cfg.manual]) return [cfg.manual, FESTIVIDADES[cfg.manual]];
  if (!cfg.activas) return null;
  for (const [id, f] of Object.entries(FESTIVIDADES)) {
    if (cfg.apagadas[id]) continue;
    if (festividadVigente(f, hoy, id === 'fiesta-patronales' ? cfg.patronales : undefined)) return [id, f];
  }
  return null;
}

/** URL del icono de una festividad (empaquetado por Vite) */
export const iconoFestividad = (f: Festividad): string | undefined => IMAGENES_TEMATICA[f.icono];
