/**
 * Servicios · módulo 4 (datos): agenda de citas. Lo importante: NO se puede ocupar dos veces el mismo horario.
 * La garantía real está en las reglas de la base (cada bloque de 15 min solo se puede crear si no existe); aquí
 * esas reglas se SIMULAN sobre la base en memoria para probar que la app las respeta y reacciona bien.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fb from './mocks/firebaseDb';
import { __reset, __getAt, __getTree } from './mocks/firebaseDb';
import {
  reservarCita,
  validarSolicitudCita,
  cambiarEstadoCita,
  reprogramarCita,
  citaYaEmpezo,
  leerDisponibilidad,
  guardarDisponibilidad,
  leerOcupacion,
  listarProfesionales,
  guardarProfesional,
  enlaceWhatsappCita,
  citasPorConfirmar,
  citasProximas,
  MAX_CITAS_ABIERTAS,
} from '@/modules/servicios/agenda';
import { ErrorServicio } from '@/modules/servicios/catalogo';
import { bloquesDeCita } from '@/modules/servicios/disponibilidad';
import { registrarActividadCliente } from '@/modules/servicios/clientes';
import type { Cita } from '@/modules/servicios/tipos';

const T = 'tS';
const AHORA = new Date('2026-12-01T18:00:00Z'); // martes 1 dic 2026, 12:00 en México
const LUNES = '2026-12-07';
const MARTES = '2026-12-08';
const servicio = (extra: Record<string, any> = {}) => ({ id: 's1', nombre: 'Corte clásico', duracionMin: 60, precio: 150, tipoPrecio: 'fijo' as const, modalidad: 'ambas' as const, contratacion: 'cita' as const, profesionalIds: [] as string[], ...extra });
const cliente = (id = 'c1', nombre = 'Ana Pérez') => ({ id, nombre, telefono: '33' + (id.replace(/\D/g, '') || '0').padStart(8, '0') });
const pedir = (extra: Record<string, any> = {}, fecha = LUNES, inicio = '10:00') => ({ servicio: servicio(), profesionalId: 'principal', fecha, inicio, cliente: cliente(), adomicilio: false, ...extra });
const tienda = (extra: Record<string, any> = {}) => ({
  nombreTienda: 'Barbería Lalo',
  estatus: 'activa',
  telefono: '3751241116',
  tipoNegocio: 'servicios',
  membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' },
  horario: { Lunes: { inicio: '09:00', fin: '18:00' }, Martes: { inicio: '09:00', fin: '14:00' } },
  ...extra,
});

/* Simula las reglas de la base: un bloque de ocupación solo se puede crear si NO existe (y borrarlo siempre se puede) */
let original: any;
beforeEach(() => {
  __reset({ tiendas: { [T]: tienda() } });
  original = fb.update.getMockImplementation();
  fb.update.mockImplementation(async (r: any, partial: Record<string, any>) => {
    for (const [ruta, valor] of Object.entries(partial)) {
      if (ruta.startsWith('ocupacion/') && valor !== null && __getAt(ruta) !== undefined) {
        throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
      }
    }
    return original(r, partial);
  });
});
afterEach(() => fb.update.mockImplementation(original));

const citas = () => Object.values(__getAt(`citas/${T}`) ?? {}) as any[];
const ocupados = (fecha = LUNES) => Object.keys(__getAt(`ocupacion/${T}/principal/${fecha}`) ?? {}).sort();

describe('reservar una cita', () => {
  it('guarda la cita (pendiente), su índice del cliente y TODOS sus bloques de 15 min, en una sola escritura', async () => {
    const id = await reservarCita(T, pedir({ comentarios: ' Sin máquina ' }), AHORA);
    expect(__getAt(`citas/${T}/${id}`)).toMatchObject({
      estado: 'pendiente',
      servicioId: 's1',
      servicioNombre: 'Corte clásico',
      profesionalId: 'principal',
      profesionalNombre: 'Barbería Lalo',
      clienteId: 'c1',
      clienteNombre: 'Ana Pérez',
      fecha: LUNES,
      inicio: '10:00',
      fin: '11:00',
      duracionMin: 60,
      precio: 150,
      comentarios: 'Sin máquina',
      tiendaNombre: 'Barbería Lalo',
      tiendaTelefono: '3751241116',
    });
    expect(__getAt(`citasPorCliente/c1/${id}`)).toEqual({ tiendaId: T });
    expect(ocupados()).toEqual(['1000', '1015', '1030', '1045']);
    for (const b of ocupados()) expect(__getAt(`ocupacion/${T}/principal/${LUNES}/${b}`)).toBe(id);
    expect(Object.values(__getAt(`citas/${T}/${id}/historial`))).toMatchObject([{ estado: 'pendiente', por: 'cliente' }]);
    expect(Object.values(__getAt(`citas/${T}/${id}`)).includes(undefined)).toBe(false);
  });

  it('suma una cita al resumen del cliente para la tienda', async () => {
    await reservarCita(T, pedir(), AHORA);
    expect(__getAt(`clientesServicio/${T}/c1`)).toMatchObject({ nombre: 'Ana Pérez', citas: 1, cotizaciones: 0 });
    await registrarActividadCliente(T, cliente(), 'cotizacion', AHORA);
    expect(__getAt(`clientesServicio/${T}/c1`)).toMatchObject({ citas: 1, cotizaciones: 1 });
  });

  it('validaciones: datos, servicio, profesional, fecha, hora, domicilio y comentarios', () => {
    const e = (extra: Record<string, any>) => validarSolicitudCita(pedir(extra) as any);
    expect(e({})).toEqual({});
    expect(e({ cliente: { id: '', nombre: 'x', telefono: '3312345678' } }).cliente).toBeTruthy();
    expect(e({ cliente: { id: 'c1', nombre: ' ', telefono: '3312345678' } }).nombre).toBeTruthy();
    expect(e({ cliente: { id: 'c1', nombre: 'Ana', telefono: '123' } }).telefono).toBeTruthy();
    expect(e({ servicio: servicio({ contratacion: 'cotizacion' }) }).servicio).toMatch(/cotización/);
    expect(e({ servicio: servicio({ duracionMin: 0 }) }).servicio).toMatch(/duración/);
    expect(e({ servicio: servicio({ profesionalIds: ['otro'] }) }).profesional).toBeTruthy();
    expect(e({ fecha: 'mañana' }).fecha).toBeTruthy();
    expect(e({ inicio: '' }).inicio).toBeTruthy();
    expect(e({ comentarios: 'x'.repeat(501) }).comentarios).toBeTruthy();
    expect(e({ adomicilio: true }).direccion).toBeTruthy();
    expect(e({ adomicilio: true, direccion: 'Calle 5 #10' })).toEqual({});
    expect(e({ adomicilio: true, direccion: 'Calle 5 #10', servicio: servicio({ modalidad: 'local' }) }).adomicilio).toBeTruthy();
  });

  it('rechaza fuera del horario, en el descanso, en un día cerrado o pasado, y con la tienda no disponible', async () => {
    await guardarDisponibilidad(T, 'principal', { semana: { lun: { abre: '09:00', cierra: '18:00', descansos: [{ desde: '14:00', hasta: '15:00' }] } } });
    await expect(reservarCita(T, pedir({}, LUNES, '08:00'), AHORA)).rejects.toThrow(/ya no está disponible|acaba de ocuparse/);
    await expect(reservarCita(T, pedir({}, LUNES, '17:30'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // terminaría 18:30
    await expect(reservarCita(T, pedir({}, LUNES, '13:30'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // cruza el descanso
    await expect(reservarCita(T, pedir({}, '2026-12-09', '10:00'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // miércoles cerrado
    await expect(reservarCita(T, pedir({}, '2026-11-30', '10:00'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // ya pasó
    expect(citas()).toHaveLength(0);
    __reset({ tiendas: { [T]: tienda({ estatus: 'bloqueada' }) } });
    await expect(reservarCita(T, pedir(), AHORA)).rejects.toThrow(/no está disponible/);
    __reset({ tiendas: { [T]: tienda({ tipoNegocio: 'productos' }) } });
    await expect(reservarCita(T, pedir(), AHORA)).rejects.toThrow(/no ofrece servicios/);
  });

  it('respeta la anticipación mínima, bloqueos, vacaciones y el máximo de días', async () => {
    await guardarDisponibilidad(T, 'principal', {
      semana: { lun: { abre: '09:00', cierra: '18:00' }, mar: { abre: '09:00', cierra: '14:00' } },
      anticipacionMin: 60,
      maxDiasAdelante: 10,
      bloqueos: [{ fecha: LUNES, desde: '10:00', hasta: '11:00' }],
      vacaciones: [{ desde: MARTES, hasta: MARTES }],
    });
    await expect(reservarCita(T, pedir({}, LUNES, '10:00'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // bloqueado
    await expect(reservarCita(T, pedir({}, MARTES, '10:00'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // vacaciones
    await expect(reservarCita(T, pedir({}, '2026-12-14', '10:00'), AHORA)).rejects.toBeInstanceOf(ErrorServicio); // pasa de 10 días
    await expect(reservarCita(T, pedir({}, LUNES, '11:00'), AHORA)).resolves.toBeTruthy(); // justo después del bloqueo
    // el mismo día, con menos de 60 min de anticipación
    const casiLaHora = new Date('2026-12-07T15:30:00Z'); // lunes 09:30 en México
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }, LUNES, '10:00'), casiLaHora)).rejects.toBeInstanceOf(ErrorServicio);
  });

  it('tope de citas abiertas por cliente y tienda', async () => {
    for (let i = 0; i < MAX_CITAS_ABIERTAS; i++) await reservarCita(T, pedir({}, LUNES, `${9 + i}:00`.padStart(5, '0')), AHORA);
    await expect(reservarCita(T, pedir({}, LUNES, '15:00'), AHORA)).rejects.toThrow(/varias citas pendientes/);
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }, LUNES, '15:00'), AHORA)).resolves.toBeTruthy();
  });

  it('un profesional desactivado no recibe citas', async () => {
    const pid = await guardarProfesional(T, null, { nombre: 'Marco' });
    await guardarDisponibilidad(T, pid, { semana: { lun: { abre: '09:00', cierra: '18:00' } } });
    await expect(reservarCita(T, pedir({ profesionalId: pid }), AHORA)).resolves.toBeTruthy();
    await guardarProfesional(T, pid, { nombre: 'Marco', activo: false });
    await expect(reservarCita(T, pedir({ profesionalId: pid, cliente: cliente('c2', 'Beto') }, LUNES, '12:00'), AHORA)).rejects.toThrow(/no está disponible/);
  });
});

describe('anti reservas dobles', () => {
  it('el mismo horario no se puede reservar dos veces', async () => {
    await reservarCita(T, pedir(), AHORA);
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }), AHORA)).rejects.toThrow(/acaba de ocuparse|ya no está disponible/);
    expect(citas()).toHaveLength(1);
  });

  it('un horario que se encima a medias tampoco (09:30 con otra de 09:00–10:00)', async () => {
    await reservarCita(T, pedir({}, LUNES, '09:00'), AHORA);
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }, LUNES, '09:30'), AHORA)).rejects.toBeInstanceOf(ErrorServicio);
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }, LUNES, '10:00'), AHORA)).resolves.toBeTruthy(); // justo pegada: sí
    expect(ocupados()).toHaveLength(8);
  });

  it('dos clientes a la vez por el MISMO horario: gana uno, el otro recibe aviso y no queda nada a medias', async () => {
    const [a, b] = await Promise.allSettled([reservarCita(T, pedir({ cliente: cliente('c1', 'Ana') }), AHORA), reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }), AHORA)]);
    const resultados = [a, b];
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const perdedor = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(perdedor.reason).toBeInstanceOf(ErrorServicio);
    expect(perdedor.reason.message).toMatch(/acaba de ocuparse/);
    expect(citas()).toHaveLength(1); // una sola cita
    const ganadora = (a as any).value ?? (b as any).value;
    expect(ocupados()).toEqual(['1000', '1015', '1030', '1045']);
    for (const bloque of ocupados()) expect(__getAt(`ocupacion/${T}/principal/${LUNES}/${bloque}`)).toBe(ganadora); // todos los bloques son de la ganadora
    const perdedorId = ['c1', 'c2'].find((c) => !!__getAt(`citasPorCliente/${c}`) === false)!;
    expect(__getAt(`citasPorCliente/${perdedorId}`)).toBeUndefined(); // sin índice huérfano
  });

  it('dos clientes a la vez con horarios que SE ENCIMAN: solo uno entra (la regla rechaza el bloque repetido)', async () => {
    const [a, b] = await Promise.allSettled([reservarCita(T, pedir({ cliente: cliente('c1', 'Ana') }, LUNES, '10:00'), AHORA), reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }, LUNES, '10:30'), AHORA)]);
    expect([a, b].filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(citas()).toHaveLength(1);
  });

  it('cada profesional tiene su propia agenda: el mismo horario con otro profesional sí se puede', async () => {
    const marco = await guardarProfesional(T, null, { nombre: 'Marco' });
    await guardarDisponibilidad(T, marco, { semana: { lun: { abre: '09:00', cierra: '18:00' } } });
    await reservarCita(T, pedir(), AHORA);
    await expect(reservarCita(T, pedir({ profesionalId: marco, cliente: cliente('c2', 'Beto') }), AHORA)).resolves.toBeTruthy();
    expect(Object.keys(__getAt(`ocupacion/${T}`)).sort()).toEqual(['principal', marco].sort());
  });

  it('el dato que escribe la app respeta el formato que exigen las reglas (bloques HHmm de 15 min)', async () => {
    await reservarCita(T, pedir({}, LUNES, '09:30'), AHORA);
    for (const b of ocupados()) expect(b).toMatch(/^([01][0-9]|2[0-3])(00|15|30|45)$/);
    expect(__getAt(`citas/${T}`)).toBeDefined();
  });
});

describe('estados de la cita', () => {
  async function conCita(extra: Record<string, any> = {}, fecha = LUNES, inicio = '10:00') {
    const id = await reservarCita(T, pedir(extra, fecha, inicio), AHORA);
    return id;
  }
  const estado = (id: string) => __getAt(`citas/${T}/${id}/estado`);

  it('la tienda confirma, y luego marca completada cuando ya empezó', async () => {
    const id = await conCita();
    await cambiarEstadoCita(T, id, 'confirmada', 'tienda', undefined, AHORA);
    expect(estado(id)).toBe('confirmada');
    await expect(cambiarEstadoCita(T, id, 'completada', 'tienda', undefined, AHORA)).rejects.toThrow(/ya empezó/);
    await cambiarEstadoCita(T, id, 'completada', 'tienda', undefined, new Date('2026-12-07T17:00:00Z')); // lunes 11:00 en México: ya empezó
    expect(estado(id)).toBe('completada');
    expect(ocupados()).toHaveLength(4); // una cita completada conserva su historia
    expect(Object.values(__getAt(`citas/${T}/${id}/historial`)).map((h: any) => h.estado)).toEqual(expect.arrayContaining(['pendiente', 'confirmada', 'completada']));
  });

  it('cancelar libera TODOS los bloques y otro cliente puede tomar ese horario', async () => {
    const id = await conCita();
    await cambiarEstadoCita(T, id, 'cancelada', 'cliente', undefined, AHORA);
    expect(estado(id)).toBe('cancelada');
    expect(ocupados()).toEqual([]);
    await expect(reservarCita(T, pedir({ cliente: cliente('c2', 'Beto') }), AHORA)).resolves.toBeTruthy();
  });

  it('rechazar (tienda) también libera el horario y guarda el motivo', async () => {
    const id = await conCita();
    await cambiarEstadoCita(T, id, 'rechazada', 'tienda', 'Ese día no atiendo', AHORA);
    expect(estado(id)).toBe('rechazada');
    expect(ocupados()).toEqual([]);
    expect((Object.values(__getAt(`citas/${T}/${id}/historial`)) as any[]).some((h) => h.nota === 'Ese día no atiendo')).toBe(true);
  });

  it('liberar no toca los bloques de otra cita (solo los suyos)', async () => {
    const a = await conCita({}, LUNES, '10:00');
    const b = await conCita({ cliente: cliente('c2', 'Beto') }, LUNES, '11:00');
    await cambiarEstadoCita(T, a, 'cancelada', 'cliente', undefined, AHORA);
    expect(ocupados()).toEqual(['1100', '1115', '1130', '1145']);
    expect(__getAt(`ocupacion/${T}/principal/${LUNES}/1100`)).toBe(b);
  });

  it('el cliente solo puede cancelar y solo antes de que empiece; no puede confirmarse a sí mismo', async () => {
    const id = await conCita();
    await expect(cambiarEstadoCita(T, id, 'confirmada', 'cliente', undefined, AHORA)).rejects.toThrow(/no se puede pasar/);
    await expect(cambiarEstadoCita(T, id, 'cancelada', 'cliente', undefined, new Date('2026-12-07T16:30:00Z'))).rejects.toThrow(/ya empezó/); // 10:30 > 10:00
    expect(estado(id)).toBe('pendiente');
  });

  it('un estado final ya no cambia, y si una parte ya lo cambió la otra recibe aviso', async () => {
    const id = await conCita();
    await cambiarEstadoCita(T, id, 'cancelada', 'cliente', undefined, AHORA);
    await expect(cambiarEstadoCita(T, id, 'confirmada', 'tienda', undefined, AHORA)).rejects.toThrow(/ya está «cancelada»/);
    await expect(cambiarEstadoCita(T, 'fantasma', 'confirmada', 'tienda', undefined, AHORA)).rejects.toThrow(/ya no existe/);
  });

  it('citaYaEmpezo compara fecha y hora de inicio en la zona de la agenda', () => {
    const c = { fecha: LUNES, inicio: '10:00' };
    expect(citaYaEmpezo(c, { fecha: LUNES, minutos: 599 })).toBe(false);
    expect(citaYaEmpezo(c, { fecha: LUNES, minutos: 600 })).toBe(true);
    expect(citaYaEmpezo(c, { fecha: '2026-12-06', minutos: 1400 })).toBe(false);
    expect(citaYaEmpezo(c, { fecha: '2026-12-08', minutos: 0 })).toBe(true);
  });
});

describe('reprogramar', () => {
  const nueva = (fecha: string, inicio: string) => ({ fecha, inicio });
  async function conCita(inicio = '10:00', extra: Record<string, any> = {}) {
    return reservarCita(T, pedir(extra, LUNES, inicio), AHORA);
  }

  it('mueve la cita a otro día y hora: libera los bloques viejos y ocupa los nuevos', async () => {
    const id = await conCita('10:00');
    await reprogramarCita(T, id, nueva(MARTES, '11:00'), AHORA);
    expect(__getAt(`citas/${T}/${id}`)).toMatchObject({ fecha: MARTES, inicio: '11:00', fin: '12:00' });
    expect(ocupados(LUNES)).toEqual([]);
    expect(ocupados(MARTES)).toEqual(['1100', '1115', '1130', '1145']);
    expect((Object.values(__getAt(`citas/${T}/${id}/historial`)) as any[]).some((h) => /Reprogramada/.test(h.nota ?? ''))).toBe(true);
  });

  it('corrimiento que se encima con la propia cita (10:00 → 10:30): conserva los bloques compartidos', async () => {
    const id = await conCita('10:00');
    await reprogramarCita(T, id, nueva(LUNES, '10:30'), AHORA);
    expect(ocupados()).toEqual(['1030', '1045', '1100', '1115']);
    for (const b of ocupados()) expect(__getAt(`ocupacion/${T}/principal/${LUNES}/${b}`)).toBe(id);
  });

  it('si el nuevo horario está ocupado, avisa y la cita queda donde estaba, sin bloques de más', async () => {
    const id = await conCita('10:00');
    await conCita('13:00', { cliente: cliente('c2', 'Beto') });
    await expect(reprogramarCita(T, id, nueva(LUNES, '13:30'), AHORA)).rejects.toBeInstanceOf(ErrorServicio);
    expect(__getAt(`citas/${T}/${id}/inicio`)).toBe('10:00');
    expect(ocupados()).toHaveLength(8);
  });

  it('no deja reprogramar a la misma hora, ni una cita ya cancelada', async () => {
    const id = await conCita('10:00');
    await expect(reprogramarCita(T, id, nueva(LUNES, '10:00'), AHORA)).rejects.toThrow(/distinta/);
    await cambiarEstadoCita(T, id, 'cancelada', 'tienda', undefined, AHORA);
    await expect(reprogramarCita(T, id, nueva(MARTES, '10:00'), AHORA)).rejects.toThrow(/cancelada/);
  });

  it('si la cita cambia mientras se reprograma (alguien la cancela), se devuelven los bloques nuevos', async () => {
    const id = await conCita('10:00');
    const base = fb.update.getMockImplementation()!;
    fb.update.mockImplementation(async (r: any, partial: Record<string, any>) => {
      const res = await base(r, partial);
      if (Object.keys(partial).some((k) => k.startsWith(`ocupacion/${T}/principal/${MARTES}`))) await original(r, { [`citas/${T}/${id}/estado`]: 'cancelada' }); // cancelación "simultánea"
      return res;
    });
    await expect(reprogramarCita(T, id, nueva(MARTES, '10:00'), AHORA)).rejects.toThrow(/cambió a «cancelada»/);
    expect(ocupados(MARTES)).toEqual([]); // los bloques nuevos se devolvieron
    expect(__getAt(`citas/${T}/${id}/fecha`)).toBe(LUNES);
  });
});

describe('profesionales y disponibilidad', () => {
  it('la persona dueña siempre existe como «principal», con el nombre de la tienda', async () => {
    const l = await listarProfesionales(T);
    expect(l).toMatchObject([{ id: 'principal', nombre: 'Barbería Lalo', activo: true }]);
  });

  it('agregar profesionales: valida, no se puede desactivar a la dueña, y aparecen en orden', async () => {
    await expect(guardarProfesional(T, null, { nombre: '  ' })).rejects.toThrow(/nombre/);
    await expect(guardarProfesional(T, 'principal', { nombre: 'Lalo', activo: false })).rejects.toThrow(/no se puede desactivar/);
    await guardarProfesional(T, null, { nombre: 'Zoe', especialidad: 'Color' });
    await guardarProfesional(T, null, { nombre: 'Ana' });
    expect((await listarProfesionales(T)).map((p) => p.nombre)).toEqual(['Barbería Lalo', 'Ana', 'Zoe']);
  });

  it('sin configurar, la disponibilidad parte del horario que la tienda capturó al registrarse', async () => {
    const d = await leerDisponibilidad(T, 'principal');
    expect(d.semana.lun).toEqual({ abre: '09:00', cierra: '18:00' });
    expect(d.semana.mar).toEqual({ abre: '09:00', cierra: '14:00' });
    expect(d.semana.mie).toBeNull();
  });

  it('guardar y leer: horario, descansos, bloqueos y vacaciones; valida horas y fechas', async () => {
    await guardarDisponibilidad(T, 'principal', {
      semana: { lun: { abre: '10:00', cierra: '19:00', descansos: [{ desde: '14:00', hasta: '15:00' }] }, mar: null },
      anticipacionMin: 120,
      maxDiasAdelante: 30,
      bloqueos: [{ fecha: LUNES, motivo: 'Trámite' }, { fecha: MARTES, desde: '10:00', hasta: '11:00' }],
      vacaciones: [{ desde: '2026-12-24', hasta: '2026-12-26', motivo: 'Navidad' }],
    });
    const d = await leerDisponibilidad(T, 'principal');
    expect(d.semana.lun).toEqual({ abre: '10:00', cierra: '19:00', descansos: [{ desde: '14:00', hasta: '15:00' }] });
    expect(d).toMatchObject({ anticipacionMin: 120, maxDiasAdelante: 30 });
    expect(d.bloqueos).toEqual([{ fecha: LUNES, motivo: 'Trámite' }, { fecha: MARTES, desde: '10:00', hasta: '11:00' }]);
    expect(d.vacaciones).toEqual([{ desde: '2026-12-24', hasta: '2026-12-26', motivo: 'Navidad' }]);

    await expect(guardarDisponibilidad(T, 'principal', { semana: { lun: { abre: '18:00', cierra: '09:00' } } })).rejects.toThrow(/cierre/);
    await expect(guardarDisponibilidad(T, 'principal', { semana: {}, vacaciones: [{ desde: '2026-12-26', hasta: '2026-12-24' }] })).rejects.toThrow(/vacaciones/);
    await expect(guardarDisponibilidad(T, 'principal', { semana: {}, bloqueos: [{ fecha: 'x' }] })).rejects.toThrow(/bloqueo/);
  });

  it('leerOcupacion devuelve los bloques por fecha', async () => {
    await reservarCita(T, pedir({}, LUNES, '09:00'), AHORA);
    const o = await leerOcupacion(T, 'principal');
    expect([...o[LUNES]].sort()).toEqual(bloquesDeCita('09:00', 60).sort());
  });
});

describe('contacto y conteos', () => {
  const cita = (extra: Partial<Cita> = {}): Cita => ({ id: 'x', tiendaId: T, servicioId: 's1', servicioNombre: 'Corte', profesionalId: 'principal', clienteId: 'c1', clienteNombre: 'Ana Pérez', clienteTelefono: '3312345678', fecha: LUNES, inicio: '10:00', fin: '11:00', duracionMin: 60, estado: 'pendiente', creadaEn: '', tiendaNombre: 'Barbería Lalo', ...extra });

  it('WhatsApp de la tienda al cliente y del cliente a la tienda', () => {
    expect(enlaceWhatsappCita('375 124 1116', cita(), 'cliente')).toMatch(/^https:\/\/wa\.me\/523751241116\?text=/);
    expect(decodeURIComponent(enlaceWhatsappCita('3312345678', cita(), 'tienda'))).toContain('Hola Ana');
    expect(decodeURIComponent(enlaceWhatsappCita('3312345678', cita(), 'tienda'))).toContain('2026-12-07 a las 10:00');
    expect(enlaceWhatsappCita('1', cita(), 'tienda')).toBe('');
  });

  it('citasPorConfirmar y citasProximas', () => {
    const l = [
      cita({ id: 'a', estado: 'pendiente', fecha: '2026-12-02' }),
      cita({ id: 'b', estado: 'confirmada', fecha: '2026-12-05' }),
      cita({ id: 'c', estado: 'cancelada', fecha: '2026-12-03' }),
      cita({ id: 'd', estado: 'confirmada', fecha: '2026-12-20' }),
      cita({ id: 'e', estado: 'confirmada', fecha: '2026-11-20' }),
      cita({ id: 'f', estado: 'confirmada', fecha: '2026-12-01', inicio: '08:00', fin: '09:00' }), // hoy, ya terminó
    ];
    expect(citasPorConfirmar(l)).toBe(1);
    expect(citasProximas(l, { fecha: '2026-12-01', minutos: 600 }, 7).map((c) => c.id)).toEqual(['a', 'b']);
  });
});
