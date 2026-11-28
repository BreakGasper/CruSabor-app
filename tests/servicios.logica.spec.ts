/**
 * Servicios · módulo 1 (base): lógica pura de la agenda, estados de citas y cotizaciones, tipo de negocio
 * y las reglas de la base. Nada de esto toca Firebase: se prueba el cálculo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aMinutos,
  aHora,
  claveBloque,
  esFechaISO,
  sumarDias,
  diaClaveDe,
  ahoraEnZona,
  duracionValida,
  bloquesDeCita,
  rutasOcupacion,
  semanaDesdeHorarioTienda,
  validarSemana,
  estaDeVacaciones,
  intervalosNoDisponibles,
  horariosDelDia,
  puedeReservar,
  fechasConHorario,
  horaFin,
} from '@/modules/servicios/disponibilidad';
import {
  puedeCambiarCita,
  accionesDeCita,
  citaOcupaHorario,
  citaTerminada,
  puedeCambiarCotizacion,
  accionesDeCotizacion,
  estadoEfectivoCotizacion,
  ETIQUETA_CITA,
  ETIQUETA_COTIZACION,
  TONO_CITA,
} from '@/modules/servicios/estados';
import {
  tipoDeTienda,
  vendeProductos,
  ofreceServicios,
  modalidadDe,
  atiendeADomicilio,
  atiendeEnLocal,
  envioDomicilioDe,
  listaDeTexto,
  etiquetaTipoNegocio,
} from '@/modules/servicios/negocio';
import { CATEGORIAS_SERVICIO, ESTADOS_CITA, ESTADOS_COTIZACION, nombreCategoriaServicio, type Disponibilidad } from '@/modules/servicios/tipos';

// 2026-11-30 es lunes
const LUNES = '2026-11-30';
const AHORA_LEJOS = { fecha: '2026-11-01', minutos: 600 }; // mucho antes: no estorba la anticipación
const semanaBase: Disponibilidad['semana'] = {
  lun: { abre: '09:00', cierra: '18:00', descansos: [{ desde: '14:00', hasta: '15:00' }] },
  mar: { abre: '09:00', cierra: '12:00' },
  sab: { abre: '10:00', cierra: '14:00' },
};
const disp = (extra: Partial<Disponibilidad> = {}): Disponibilidad => ({ semana: semanaBase, ...extra });

describe('fechas y horas', () => {
  it('esFechaISO valida fechas reales', () => {
    expect(esFechaISO('2026-11-30')).toBe(true);
    expect(esFechaISO('2026-02-29')).toBe(false); // 2026 no es bisiesto
    expect(esFechaISO('2028-02-29')).toBe(true);
    expect(esFechaISO('2026-13-01')).toBe(false);
    expect(esFechaISO('30/11/2026')).toBe(false);
    expect(esFechaISO(null)).toBe(false);
  });

  it('aMinutos / aHora / claveBloque', () => {
    expect(aMinutos('09:30')).toBe(570);
    expect(aMinutos('9:05')).toBe(545);
    expect(aMinutos('24:00')).toBeNull();
    expect(aMinutos('12:60')).toBeNull();
    expect(aMinutos('abc')).toBeNull();
    expect(aHora(570)).toBe('09:30');
    expect(aHora(1440)).toBe('24:00');
    expect(claveBloque(570)).toBe('0930');
  });

  it('sumarDias cruza meses y años; diaClaveDe arranca en lunes', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diaClaveDe('2026-11-30')).toBe('lun');
    expect(diaClaveDe('2026-12-06')).toBe('dom');
    expect(diaClaveDe('2026-11-28')).toBe('sab');
  });

  it('ahoraEnZona usa la hora de México, no la del dispositivo', () => {
    // 02:30 UTC del 28 nov = 20:30 del 27 nov en la Ciudad de México (UTC-6)
    expect(ahoraEnZona(new Date('2026-11-28T02:30:00Z'))).toEqual({ fecha: '2026-11-27', minutos: 20 * 60 + 30 });
    expect(ahoraEnZona(new Date('2026-11-28T18:05:00Z'))).toEqual({ fecha: '2026-11-28', minutos: 12 * 60 + 5 });
  });

  it('horaFin', () => {
    expect(horaFin('09:30', 60)).toBe('10:30');
    expect(horaFin('x', 60)).toBe('');
  });
});

describe('bloques y rutas de ocupación (anti reservas dobles)', () => {
  it('una cita ocupa un bloque por cada 15 minutos', () => {
    expect(bloquesDeCita('09:30', 60)).toEqual(['0930', '0945', '1000', '1015']);
    expect(bloquesDeCita('09:00', 15)).toEqual(['0900']);
  });

  it('entradas inválidas no generan bloques', () => {
    expect(bloquesDeCita('09:10', 60)).toEqual([]); // no alineada a 15
    expect(bloquesDeCita('09:00', 20)).toEqual([]);
    expect(bloquesDeCita('23:45', 60)).toEqual([]); // se pasa de medianoche
    expect(bloquesDeCita('xx', 60)).toEqual([]);
  });

  it('duracionValida: múltiplo de 15, entre 15 min y 12 h', () => {
    expect([15, 30, 45, 60, 720].every(duracionValida)).toBe(true);
    expect([0, 10, 50, 735, 1000, -15, 1.5, '60', null].some((d) => duracionValida(d))).toBe(false);
  });

  it('rutasOcupacion: una ruta por bloque, para ocupar (id) o liberar (null) en una sola escritura', () => {
    const ocupar = rutasOcupacion('t1', 'principal', '2026-12-01', '10:00', 30, 'cita9');
    expect(ocupar).toEqual({
      'ocupacion/t1/principal/2026-12-01/1000': 'cita9',
      'ocupacion/t1/principal/2026-12-01/1015': 'cita9',
    });
    const liberar = rutasOcupacion('t1', 'principal', '2026-12-01', '10:00', 30, null);
    expect(Object.values(liberar)).toEqual([null, null]);
    expect(Object.keys(liberar)).toEqual(Object.keys(ocupar));
  });
});

describe('horario semanal', () => {
  it('semanaDesdeHorarioTienda toma el horario que la tienda ya capturó; sin horas = cerrado', () => {
    const s = semanaDesdeHorarioTienda({
      Lunes: { inicio: '09:00', fin: '18:00' },
      Martes: { inicio: '09:00', fin: '' },
      Sábado: { inicio: '10:00', fin: '14:00' },
      Domingo: { inicio: '14:00', fin: '09:00' }, // incoherente: cerrado
    });
    expect(s.lun).toEqual({ abre: '09:00', cierra: '18:00' });
    expect(s.mar).toBeNull();
    expect(s.sab).toEqual({ abre: '10:00', cierra: '14:00' });
    expect(s.dom).toBeNull();
    expect(s.mie).toBeNull();
    expect(semanaDesdeHorarioTienda(null).lun).toBeNull();
  });

  it('validarSemana avisa de horas inválidas y descansos fuera del horario', () => {
    expect(validarSemana(semanaBase)).toEqual([]);
    expect(validarSemana({ lun: { abre: '18:00', cierra: '09:00' } })[0]).toMatch(/cierre debe ser después/);
    expect(validarSemana({ lun: { abre: 'x', cierra: '09:00' } })[0]).toMatch(/horas válidas/);
    expect(validarSemana({ lun: { abre: '09:00', cierra: '18:00', descansos: [{ desde: '08:00', hasta: '10:00' }] } })[0]).toMatch(/dentro del horario/);
    expect(validarSemana({ lun: { abre: '09:00', cierra: '18:00', descansos: [{ desde: '15:00', hasta: '14:00' }] } })[0]).toMatch(/descanso/);
  });
});

describe('horariosDelDia', () => {
  const hs = (extra: Partial<Parameters<typeof horariosDelDia>[0]> = {}) =>
    horariosDelDia({ disp: disp(), fecha: LUNES, duracionMin: 60, ahora: AHORA_LEJOS, ...extra });

  it('genera inicios cada 30 min dentro del horario y salta el descanso', () => {
    expect(hs()).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '15:00', '15:30', '16:00', '16:30', '17:00']);
  });

  it('una cita de 60 min no puede cruzar el descanso (13:30 chocaría con las 14:00)', () => {
    expect(hs()).not.toContain('13:30');
    expect(hs()).toContain('13:00'); // termina justo cuando empieza el descanso
    expect(hs()).toContain('15:00'); // empieza justo cuando termina
  });

  it('la última hora posible deja que la cita termine al cierre', () => {
    expect(hs().at(-1)).toBe('17:00');
    expect(hs({ duracionMin: 120 }).at(-1)).toBe('16:00');
    expect(hs({ duracionMin: 15, paso: 15 }).at(-1)).toBe('17:45');
  });

  it('con paso de 15 min ofrece más horas', () => {
    expect(hs({ paso: 15 })).toContain('09:15');
    expect(hs({ paso: 20 })).not.toContain('09:15'); // paso inválido: vuelve a 30
  });

  it('los bloques ocupados quitan toda hora que choque con ellos', () => {
    // 10:00-11:00 ocupado (4 bloques): no se puede empezar a 09:30 (termina 10:30) ni a 10:30
    const ocupados = new Set(['1000', '1015', '1030', '1045']);
    const h = hs({ ocupados });
    expect(h).toContain('09:00'); // 09:00-10:00 cabe
    expect(h).not.toContain('09:30');
    expect(h).not.toContain('10:00');
    expect(h).not.toContain('10:30');
    expect(h).toContain('11:00');
  });

  it('un bloqueo parcial quita sus horas; un bloqueo de todo el día cierra la fecha', () => {
    expect(hs({ disp: disp({ bloqueos: [{ fecha: LUNES, desde: '09:00', hasta: '11:00' }] }) })[0]).toBe('11:00');
    expect(hs({ disp: disp({ bloqueos: [{ fecha: LUNES }] }) })).toEqual([]);
    expect(hs({ disp: disp({ bloqueos: [{ fecha: '2026-12-01' }] }) })).not.toEqual([]); // otro día no afecta
  });

  it('vacaciones (rango incluido) cierran los días', () => {
    const d = disp({ vacaciones: [{ desde: '2026-11-29', hasta: '2026-11-30' }] });
    expect(estaDeVacaciones(d, '2026-11-30')).toBe(true);
    expect(estaDeVacaciones(d, '2026-12-01')).toBe(false);
    expect(hs({ disp: d })).toEqual([]);
  });

  it('día sin horario (miércoles) o inválido no tiene horas', () => {
    expect(hs({ fecha: '2026-12-02' })).toEqual([]);
    expect(hs({ fecha: 'mañana' })).toEqual([]);
    expect(hs({ duracionMin: 20 })).toEqual([]);
  });

  it('fechas pasadas no tienen horas; hoy respeta la anticipación mínima (60 min por defecto)', () => {
    expect(hs({ ahora: { fecha: '2026-12-05', minutos: 0 } })).toEqual([]);
    const hoy = { fecha: LUNES, minutos: 10 * 60 }; // son las 10:00
    expect(hs({ ahora: hoy })[0]).toBe('11:00'); // 10:00 + 60 min
    expect(hs({ ahora: hoy, disp: disp({ anticipacionMin: 0 }) })[0]).toBe('10:00');
    expect(hs({ ahora: { fecha: LUNES, minutos: 17 * 60 + 30 } })).toEqual([]); // ya no cabe nada
  });

  it('no se puede reservar más allá del máximo de días hacia adelante', () => {
    const d = disp({ maxDiasAdelante: 7 });
    expect(hs({ disp: d, ahora: { fecha: '2026-11-23', minutos: 0 } })).not.toEqual([]); // 7 días justos
    expect(hs({ disp: d, ahora: { fecha: '2026-11-22', minutos: 0 } })).toEqual([]); // 8 días
  });

  it('puedeReservar usa la misma regla (para validar antes de escribir)', () => {
    const base = { disp: disp(), fecha: LUNES, duracionMin: 60, ahora: AHORA_LEJOS };
    expect(puedeReservar({ ...base, inicio: '09:00' })).toBe(true);
    expect(puedeReservar({ ...base, inicio: '13:30' })).toBe(false);
    expect(puedeReservar({ ...base, inicio: '09:00', ocupados: new Set(['0900']) })).toBe(false);
  });

  it('intervalosNoDisponibles junta descansos y bloqueos', () => {
    const d = disp({ bloqueos: [{ fecha: LUNES, desde: '10:00', hasta: '11:00' }] });
    expect(intervalosNoDisponibles(d, LUNES)).toEqual([[840, 900], [600, 660]]);
    expect(intervalosNoDisponibles(disp({ bloqueos: [{ fecha: LUNES }] }), LUNES)).toEqual([[840, 900], [0, 1440]]);
  });

  it('fechasConHorario marca solo los días con lugar', () => {
    const ocupadosDe = (f: string) => (f === LUNES ? new Set(['0900', '0915', '0930', '0945', '1000', '1015', '1030', '1045', '1100', '1115', '1130', '1145', '1200', '1215', '1230', '1245', '1300', '1315', '1330', '1345', '1500', '1515', '1530', '1545', '1600', '1615', '1630', '1645', '1700', '1715', '1730', '1745']) : undefined);
    const f = fechasConHorario({ disp: disp(), desde: '2026-11-30', hasta: '2026-12-06', duracionMin: 60, ocupadosDe, ahora: AHORA_LEJOS });
    expect(f).toEqual(['2026-12-01', '2026-12-05']); // martes y sábado; el lunes está lleno; el resto cerrado
  });
});

describe('estados de citas', () => {
  it('etiquetas y tonos cubren todos los estados', () => {
    for (const e of ESTADOS_CITA) {
      expect(ETIQUETA_CITA[e]).toBeTruthy();
      expect(TONO_CITA[e]).toBeTruthy();
    }
  });

  it('la tienda confirma o rechaza lo pendiente; el cliente solo puede cancelar', () => {
    expect(accionesDeCita('pendiente', 'tienda')).toEqual(['confirmada', 'rechazada', 'cancelada']);
    expect(accionesDeCita('pendiente', 'cliente')).toEqual(['cancelada']);
    expect(puedeCambiarCita('pendiente', 'confirmada', 'cliente')).toBe(false);
    expect(puedeCambiarCita('confirmada', 'completada', 'tienda')).toBe(true);
    expect(puedeCambiarCita('confirmada', 'completada', 'cliente')).toBe(false);
  });

  it('los estados finales ya no cambian', () => {
    for (const fin of ['completada', 'cancelada', 'rechazada'] as const) {
      expect(citaTerminada(fin)).toBe(true);
      expect(accionesDeCita(fin, 'tienda')).toEqual([]);
      expect(accionesDeCita(fin, 'cliente')).toEqual([]);
    }
    expect(citaTerminada('pendiente')).toBe(false);
  });

  it('cancelar o rechazar libera el horario; el resto lo retiene', () => {
    expect(citaOcupaHorario('pendiente')).toBe(true);
    expect(citaOcupaHorario('confirmada')).toBe(true);
    expect(citaOcupaHorario('completada')).toBe(true);
    expect(citaOcupaHorario('cancelada')).toBe(false);
    expect(citaOcupaHorario('rechazada')).toBe(false);
  });
});

describe('estados de cotizaciones', () => {
  it('todas tienen etiqueta', () => {
    for (const e of ESTADOS_COTIZACION) expect(ETIQUETA_COTIZACION[e]).toBeTruthy();
  });

  it('flujo: pendiente → en revisión → cotizada → aceptada → completada', () => {
    expect(puedeCambiarCotizacion('pendiente', 'en_revision', 'tienda')).toBe(true);
    expect(puedeCambiarCotizacion('pendiente', 'cotizada', 'tienda')).toBe(true);
    expect(puedeCambiarCotizacion('en_revision', 'cotizada', 'tienda')).toBe(true);
    expect(puedeCambiarCotizacion('cotizada', 'aceptada', 'cliente')).toBe(true);
    expect(puedeCambiarCotizacion('aceptada', 'completada', 'tienda')).toBe(true);
  });

  it('el cliente solo responde a una cotización ya enviada; no puede aceptarse sola ni saltarse pasos', () => {
    expect(accionesDeCotizacion('cotizada', 'cliente')).toEqual(['aceptada', 'rechazada']);
    expect(accionesDeCotizacion('pendiente', 'cliente')).toEqual([]);
    expect(puedeCambiarCotizacion('pendiente', 'aceptada', 'cliente')).toBe(false);
    expect(puedeCambiarCotizacion('pendiente', 'completada', 'tienda')).toBe(false);
    expect(puedeCambiarCotizacion('cotizada', 'aceptada', 'tienda')).toBe(false);
  });

  it('rechazada, vencida y completada son finales', () => {
    for (const fin of ['rechazada', 'vencida', 'completada'] as const) {
      expect(accionesDeCotizacion(fin, 'tienda')).toEqual([]);
      expect(accionesDeCotizacion(fin, 'cliente')).toEqual([]);
    }
  });

  it('una cotización cuya vigencia pasó está vencida (el último día aún cuenta)', () => {
    const c = (venceEl: string, estado: any = 'cotizada') => ({ estado, respuesta: { precio: 500, venceEl, respondidaEn: '' } });
    expect(estadoEfectivoCotizacion(c('2026-11-30'), '2026-11-30')).toBe('cotizada');
    expect(estadoEfectivoCotizacion(c('2026-11-29'), '2026-11-30')).toBe('vencida');
    expect(estadoEfectivoCotizacion(c('2026-11-01', 'aceptada'), '2026-11-30')).toBe('aceptada'); // ya aceptada no vence
    expect(estadoEfectivoCotizacion({ estado: 'pendiente' }, '2026-11-30')).toBe('pendiente');
  });
});

describe('tipo de negocio', () => {
  it('sin tipoNegocio (tiendas anteriores) o con un valor raro es de PRODUCTOS', () => {
    expect(tipoDeTienda({})).toBe('productos');
    expect(tipoDeTienda(null)).toBe('productos');
    expect(tipoDeTienda({ tipoNegocio: 'barbero' })).toBe('productos');
    expect(vendeProductos({})).toBe(true);
    expect(ofreceServicios({})).toBe(false);
  });

  it('servicios no vende productos; mixto hace las dos cosas', () => {
    expect(vendeProductos({ tipoNegocio: 'servicios' })).toBe(false);
    expect(ofreceServicios({ tipoNegocio: 'servicios' })).toBe(true);
    expect(vendeProductos({ tipoNegocio: 'mixto' })).toBe(true);
    expect(ofreceServicios({ tipoNegocio: 'mixto' })).toBe(true);
  });

  it('modalidad: por defecto en establecimiento', () => {
    expect(modalidadDe({})).toBe('local');
    expect(modalidadDe({ modalidadAtencion: 'ambas' })).toBe('ambas');
    expect(modalidadDe({ modalidadAtencion: 'volando' })).toBe('local');
    expect(atiendeADomicilio('ambas') && atiendeADomicilio('domicilio') && !atiendeADomicilio('local')).toBe(true);
    expect(atiendeEnLocal('ambas') && atiendeEnLocal('local') && !atiendeEnLocal('domicilio')).toBe(true);
  });

  it('envioDomicilioDe: lo que ya usa toda la app (zonas) sale del tipo y la modalidad', () => {
    expect(envioDomicilioDe('productos', 'ambas', true)).toBe(true);
    expect(envioDomicilioDe('productos', 'ambas', false)).toBe(false); // la modalidad no cuenta en productos
    expect(envioDomicilioDe('servicios', 'domicilio', false)).toBe(true);
    expect(envioDomicilioDe('servicios', 'local', true)).toBe(false); // la casilla de envíos no cuenta en servicios
    expect(envioDomicilioDe('mixto', 'local', true)).toBe(true);
    expect(envioDomicilioDe('mixto', 'ambas', false)).toBe(true);
    expect(envioDomicilioDe('mixto', 'local', false)).toBe(false);
  });

  it('listaDeTexto limpia, sin repetidos y con tope', () => {
    expect(listaDeTexto(' Corte clásico, barba ,, corte CLÁSICO, Degradado ')).toEqual(['Corte clásico', 'barba', 'corte CLÁSICO', 'Degradado'].filter((x) => x !== 'corte CLÁSICO'));
    expect(listaDeTexto('')).toEqual([]);
    expect(listaDeTexto(Array.from({ length: 30 }, (_, i) => 'x' + i).join(','))).toHaveLength(12);
    expect(etiquetaTipoNegocio('mixto')).toBe('Mixto');
  });

  it('catálogo de categorías de servicio: ids únicos y las del plan', () => {
    const ids = CATEGORIAS_SERVICIO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['barberia', 'unas', 'maquillaje', 'pestanas', 'peinados', 'enfermeria', 'fotografia', 'otros']));
    expect(nombreCategoriaServicio('unas')).toBe('Uñas y manicura');
    expect(nombreCategoriaServicio('nada')).toBe('');
  });
});

describe('reglas de la base (database.rules.json)', () => {
  const raw = readFileSync(join(__dirname, '..', 'database.rules.json'), 'utf8');
  const reglas = JSON.parse(raw).rules;

  it('es JSON válido y NO restringe el resto de la base (sigue abierta como hoy)', () => {
    expect(reglas['.read']).toBe(true);
    expect(reglas['.write']).toBe(true);
  });

  it('cada bloque de 15 min solo se puede ocupar una vez (!data.exists()) y con formato válido', () => {
    const bloque = reglas.ocupacion.$tiendaId.$profesionalId.$fecha.$bloque['.validate'] as string;
    expect(bloque).toContain('!data.exists()');
    const regex = (src: string) => new RegExp(src.replace(/^\^?/, '^'));
    const hh = /\$bloque\.matches\(\/(.+?)\/\)/.exec(bloque)![1];
    for (const ok of ['0900', '0915', '1230', '2345']) expect(regex(hh).test(ok), ok).toBe(true);
    for (const mal of ['0910', '2400', '9', '09:00', '0960']) expect(regex(hh).test(mal), mal).toBe(false);
    const ff = /\$fecha\.matches\(\/(.+?)\/\)/.exec(bloque)![1];
    expect(new RegExp(ff).test('2026-12-01')).toBe(true);
    expect(new RegExp(ff).test('01/12/2026')).toBe(false);
  });

  it('las claves de bloque que genera la lógica pasan la regla de formato', () => {
    const bloque = reglas.ocupacion.$tiendaId.$profesionalId.$fecha.$bloque['.validate'] as string;
    const hh = new RegExp(/\$bloque\.matches\(\/(.+?)\/\)/.exec(bloque)![1]);
    for (const clave of bloquesDeCita('08:00', 720)) expect(hh.test(clave), clave).toBe(true);
  });

  it('citas y cotizaciones traen índices y validan sus estados', () => {
    expect(reglas.citas.$tiendaId['.indexOn']).toEqual(expect.arrayContaining(['fecha', 'estado', 'clienteId']));
    expect(reglas.cotizaciones.$tiendaId['.indexOn']).toEqual(expect.arrayContaining(['estado', 'clienteId']));
    const estadoCita = reglas.citas.$tiendaId.$citaId.estado['.validate'] as string;
    for (const e of ESTADOS_CITA) expect(estadoCita).toContain(`'${e}'`);
    const estadoCot = reglas.cotizaciones.$tiendaId.$cotizacionId.estado['.validate'] as string;
    for (const e of ESTADOS_COTIZACION) expect(estadoCot).toContain(`'${e}'`);
  });

  it('el tipo de negocio y la modalidad de la tienda se validan', () => {
    const t = reglas.tiendas.$tiendaId;
    for (const v of ['productos', 'servicios', 'mixto']) expect(t.tipoNegocio['.validate']).toContain(`'${v}'`);
    for (const v of ['local', 'domicilio', 'ambas']) expect(t.modalidadAtencion['.validate']).toContain(`'${v}'`);
    expect(reglas.tiendas['.indexOn']).toContain('tipoNegocio');
  });

  it('la duración de un servicio debe ser múltiplo de 15 min', () => {
    expect(reglas.servicios.$tiendaId.$servicioId.duracionMin['.validate']).toContain('% 15 === 0');
  });
});
