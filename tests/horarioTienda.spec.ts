/**
 * Horario de atención: los productos de una tienda cerrada se guardan en el carrito
 * pero solo se compran dentro de su horario. Se prueba la regla pura, el mapa
 * compartido y el candado al guardar el pedido.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { sessionUser } from '@/utils/sessionUser';
import {
  tiendaAbierta,
  proximaApertura,
  momentoLocal,
  tieneHorario,
  tiendasCerradas,
  TiendaCerradaError,
  useHorarioTiendas,
  __setHorarioPorTienda,
} from '@/composables/useHorarioTienda';
import { guardarPedidos } from '@/composables/usePedidos';

// Se evalúa en UTC para que las pruebas no dependan del reloj de la máquina
const TZ = 'UTC';
const lunes = (hh: number, mm = 0) => new Date(Date.UTC(2026, 8, 7, hh, mm)); // 7 sep 2026 es lunes
const domingo = (hh: number, mm = 0) => new Date(Date.UTC(2026, 8, 6, hh, mm));

const HORARIO = {
  Lunes: { inicio: '10:00', fin: '18:00' },
  Martes: { inicio: '09:30', fin: '17:00' },
  Miércoles: { inicio: '', fin: '' },
  Jueves: { inicio: '', fin: '' },
  Viernes: { inicio: '', fin: '' },
  Sábado: { inicio: '', fin: '' },
  Domingo: { inicio: '', fin: '' },
};

describe('tiendaAbierta (regla pura)', () => {
  it('detecta el día y la hora en la zona horaria indicada', () => {
    expect(momentoLocal(lunes(10, 5), TZ)).toEqual({ dia: 'Lunes', minutos: 605 });
    expect(momentoLocal(domingo(0, 0), TZ)).toEqual({ dia: 'Domingo', minutos: 0 });
  });

  it('abre dentro del rango y cierra fuera (el cierre es exclusivo)', () => {
    expect(tiendaAbierta(HORARIO, lunes(10, 0), TZ)).toBe(true);
    expect(tiendaAbierta(HORARIO, lunes(17, 59), TZ)).toBe(true);
    expect(tiendaAbierta(HORARIO, lunes(18, 0), TZ)).toBe(false);
    expect(tiendaAbierta(HORARIO, lunes(9, 59), TZ)).toBe(false);
  });

  it('un día sin horas cuenta como cerrado', () => {
    expect(tiendaAbierta(HORARIO, domingo(12), TZ)).toBe(false);
  });

  it('sin horario registrado la tienda se considera abierta (tiendas anteriores a la regla)', () => {
    expect(tieneHorario(undefined)).toBe(false);
    expect(tiendaAbierta(undefined, domingo(3), TZ)).toBe(true);
    expect(tiendaAbierta({}, domingo(3), TZ)).toBe(true);
    expect(tiendaAbierta({ Lunes: { inicio: '', fin: '' } }, domingo(3), TZ)).toBe(true);
  });

  it('acepta nombres de día sin acento o en minúsculas', () => {
    const h = { miercoles: { inicio: '08:00', fin: '12:00' }, sabado: { inicio: '08:00', fin: '12:00' } };
    const miercoles = new Date(Date.UTC(2026, 8, 9, 9));
    const sabado = new Date(Date.UTC(2026, 8, 12, 9));
    expect(tiendaAbierta(h, miercoles, TZ)).toBe(true);
    expect(tiendaAbierta(h, sabado, TZ)).toBe(true);
    expect(tiendaAbierta(h, lunes(9), TZ)).toBe(false);
  });

  it('un horario que cruza la medianoche sigue abierto de madrugada', () => {
    const nocturno = { Domingo: { inicio: '20:00', fin: '02:00' } };
    expect(tiendaAbierta(nocturno, domingo(23), TZ)).toBe(true);
    expect(tiendaAbierta(nocturno, lunes(1, 30), TZ)).toBe(true); // madrugada del lunes, horario del domingo
    expect(tiendaAbierta(nocturno, lunes(2, 0), TZ)).toBe(false);
  });

  it('describe la próxima apertura', () => {
    expect(proximaApertura(HORARIO, lunes(8), TZ)).toBe('Abre hoy a las 10:00 a.m.');
    expect(proximaApertura(HORARIO, lunes(19), TZ)).toBe('Abre mañana a las 9:30 a.m.');
    expect(proximaApertura(HORARIO, domingo(12), TZ)).toBe('Abre mañana a las 10:00 a.m.');
    expect(proximaApertura(HORARIO, new Date(Date.UTC(2026, 8, 9, 12)), TZ)).toBe('Abre el Lunes a las 10:00 a.m.');
    expect(proximaApertura(HORARIO, lunes(12), TZ)).toBeNull(); // abierta
    expect(proximaApertura(undefined, lunes(12), TZ)).toBeNull(); // sin horario
  });
});

describe('useHorarioTiendas (mapa compartido)', () => {
  afterEach(() => __setHorarioPorTienda(null));

  it('responde abierta / cerrada / desconocida', () => {
    __setHorarioPorTienda({ abierta: null, conHorario: HORARIO });
    const { estaAbierta, estaCerrada, aperturaDe } = useHorarioTiendas();
    // Sin horario: abierta siempre
    expect(estaAbierta('abierta', domingo(3))).toBe(true);
    // Con horario: depende de la hora (aquí usamos la zona de la app, así que comparamos con la regla pura)
    const ahora = new Date();
    expect(estaAbierta('conHorario', ahora)).toBe(tiendaAbierta(HORARIO, ahora));
    expect(estaCerrada('conHorario', ahora)).toBe(!tiendaAbierta(HORARIO, ahora));
    expect(typeof aperturaDe('conHorario', ahora) === 'string' || aperturaDe('conHorario', ahora) === null).toBe(true);
    // Tienda desconocida
    expect(estaAbierta('nadie')).toBeUndefined();
    expect(estaCerrada('nadie')).toBe(false);
  });
});

describe('Candado al guardar el pedido', () => {
  // Horario "siempre abierto" y "siempre cerrado" independientes de la hora actual
  const SIEMPRE = Object.fromEntries(
    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d) => [d, { inicio: '00:00', fin: '23:59' }]),
  );
  const CERRADA_HOY = (() => {
    const { dia } = momentoLocal(new Date());
    const h: Record<string, { inicio: string; fin: string }> = { ...SIEMPRE };
    h[dia] = { inicio: '', fin: '' };
    // que no la abra el horario nocturno del día anterior
    return h;
  })();

  const carrito = (tienda: string) => [
    { id_articulo: 'art-1', sku: 'S1', cantidad: 1, id_tienda: tienda, precio: 10, nombre: 'Pan', url: '', categoria: 'x', nombre_tienda: 'T' },
  ];
  const domicilio = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '00000' };

  beforeEach(() => {
    __reset({
      articulos: { 'art-1': { variantes: [{ sku: 'S1', stock: 5 }] } },
      pedidos: {},
      tiendas: {
        abierta: { nombreTienda: 'Abierta', horario: SIEMPRE },
        cerrada: { nombreTienda: 'Cerrada', horario: CERRADA_HOY },
        legacy: { nombreTienda: 'Legacy' },
      },
    });
    sessionUser.value = { id: 'cli', nombre: 'Cliente' };
  });

  it('tiendasCerradas devuelve solo las cerradas con su nombre', async () => {
    const r = await tiendasCerradas(['abierta', 'cerrada', 'legacy', 'inexistente']);
    expect(r.map((t) => t.id)).toEqual(['cerrada']);
    expect(r[0].nombre).toBe('Cerrada');
  });

  it('no deja comprar a una tienda cerrada y conserva el stock', async () => {
    await expect(guardarPedidos(carrito('cerrada'), 'Efectivo', domicilio)).rejects.toBeInstanceOf(TiendaCerradaError);
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5);
    expect(Object.keys(__getAt('pedidos') || {})).toHaveLength(0);
  });

  it('deja comprar a una tienda abierta y a una sin horario', async () => {
    await expect(guardarPedidos(carrito('abierta'), 'Efectivo', domicilio)).resolves.toBeTruthy();
    await expect(guardarPedidos(carrito('legacy'), 'Efectivo', domicilio)).resolves.toBeTruthy();
  });
});
