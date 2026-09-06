/**
 * Autorización y membresía de tiendas: una tienda solo vende si está 'activa' y su
 * membresía no venció. Se prueba la regla pura, el mapa compartido, el catálogo
 * público, el carrito rápido y el último candado al guardar el pedido.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { withSetup } from './helpers';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import {
  estadoEfectivo,
  tiendaPuedeVender,
  avisoEstadoTienda,
  diasParaVencer,
  useEstadoTiendas,
  tiendasQueNoPuedenVender,
  tiendasSinMembresiaVigente,
  membresiaVigente,
  TiendaNoDisponibleError,
  MENSAJE_TIENDA_NO_DISPONIBLE,
  __setControlPorTienda,
} from '@/composables/useMembresia';
import { __setEnvioPorTienda } from '@/composables/useEnvioTienda';
import { useArticulos } from '@/composables/useArticulos';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { useTiendas } from '@/composables/useTiendas';
import { guardarPedidos } from '@/composables/usePedidos';
import type { Producto } from '@/types/Producto';

const ACTIVA = 'tienda-activa';
const LEGACY = 'tienda-sin-estado';
const PENDIENTE = 'tienda-pendiente';
const BLOQUEADA = 'tienda-bloqueada';
const VENCIDA = 'tienda-vencida';

const HOY = new Date(2026, 8, 6, 12, 0, 0); // 6 sep 2026

const base = { telefono: '1', envioDomicilio: true, metodosPago: ['Efectivo'], horario: {} };
const tiendas = () => ({
  [ACTIVA]: { ...base, nombreTienda: 'Activa', estatus: 'activa', membresia: { vigenteHasta: '2026-12-31' } },
  [LEGACY]: { ...base, nombreTienda: 'Legacy', estado: 'Jalisco' }, // `estado` geográfico, sin `estatus`
  [PENDIENTE]: { ...base, nombreTienda: 'Pendiente', estatus: 'pendiente' },
  [BLOQUEADA]: { ...base, nombreTienda: 'Bloqueada', estatus: 'bloqueada', motivoBloqueo: 'Pago no recibido.' },
  [VENCIDA]: { ...base, nombreTienda: 'Vencida', estatus: 'activa', membresia: { vigenteHasta: '2026-01-31' } },
});

const producto = (id: string, tiendaId: string): Producto =>
  ({
    articuloId: id, nombre: `Prod ${id}`, url: '', precio: 10, descripcion: 'x', tiendaId, tiendaNombre: 'T',
    variantes: [{ sku: `S-${id}`, stock: 5, precio: 10, url: '', detalle: 'd', color: 'Rojo', colorCodigo: '#f00' } as any],
  }) as Producto;

const articulos = () =>
  Object.fromEntries(
    [
      ['a-activa', ACTIVA],
      ['a-legacy', LEGACY],
      ['a-pendiente', PENDIENTE],
      ['a-bloqueada', BLOQUEADA],
      ['a-vencida', VENCIDA],
    ].map(([id, t]) => [id, { ...producto(id, t), articuloId: undefined }]),
  );

let cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
  __setControlPorTienda(null);
  __setEnvioPorTienda(null);
  localStorage.clear();
});

beforeEach(async () => {
  __reset({ tiendas: tiendas(), articulos: articulos(), pedidos: {} });
  __setControlPorTienda(null);
  __setEnvioPorTienda(null);
  sessionUser.value = { id: 'cliente-1', nombre: 'Cliente' };
  await db.Carrito.clear();
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
});

describe('regla pura: estadoEfectivo / tiendaPuedeVender', () => {
  it('sin registro de control o sin campo estatus (tienda anterior a la regla) sigue activa', () => {
    expect(estadoEfectivo(null, HOY)).toBe('activa');
    expect(tiendaPuedeVender(undefined, HOY)).toBe(true);
    expect(estadoEfectivo({}, HOY)).toBe('activa');
    expect(tiendaPuedeVender({}, HOY)).toBe(true);
  });

  it('pendiente y bloqueada no venden aunque tengan membresía vigente', () => {
    expect(tiendaPuedeVender({ estatus: 'pendiente', membresia: { vigenteHasta: '2027-01-01' } }, HOY)).toBe(false);
    expect(tiendaPuedeVender({ estatus: 'bloqueada', membresia: { vigenteHasta: '2027-01-01' } }, HOY)).toBe(false);
  });

  it('activa con membresía vigente vende; el último día cuenta completo', () => {
    expect(tiendaPuedeVender({ estatus: 'activa', membresia: { vigenteHasta: '2026-12-31' } }, HOY)).toBe(true);
    const ultimoDia = new Date(2026, 8, 6, 23, 30);
    expect(tiendaPuedeVender({ estatus: 'activa', membresia: { vigenteHasta: '2026-09-06' } }, ultimoDia)).toBe(true);
  });

  it('activa con membresía vencida pasa a "vencida" y no vende', () => {
    const t = { estatus: 'activa' as const, membresia: { vigenteHasta: '2026-09-05' } };
    expect(estadoEfectivo(t, HOY)).toBe('vencida');
    expect(tiendaPuedeVender(t, HOY)).toBe(false);
  });

  it('los días de gracia extienden la venta después del vencimiento', () => {
    const t = { estatus: 'activa' as const, membresia: { vigenteHasta: '2026-09-04' } };
    expect(tiendaPuedeVender(t, HOY, 0)).toBe(false);
    expect(tiendaPuedeVender(t, HOY, 3)).toBe(true);
  });

  it('activa sin fecha de vigencia no se bloquea (aún no se le exige membresía)', () => {
    expect(tiendaPuedeVender({ estatus: 'activa' }, HOY)).toBe(true);
  });

  it('diasParaVencer cuenta días de calendario', () => {
    expect(diasParaVencer({ membresia: { vigenteHasta: '2026-09-13' } }, HOY)).toBe(7);
    expect(diasParaVencer({ membresia: { vigenteHasta: '2026-09-06' } }, HOY)).toBe(0);
    expect(diasParaVencer({ membresia: { vigenteHasta: '2026-09-01' } }, HOY)).toBe(-5);
    expect(diasParaVencer({}, HOY)).toBeNull();
  });
});

describe('membresía vigente (requisito para publicar productos)', () => {
  it('exige tienda activa y fecha de vigencia no pasada', () => {
    expect(membresiaVigente({ estatus: 'activa', membresia: { vigenteHasta: '2026-12-31' } }, HOY)).toBe(true);
    expect(membresiaVigente({ estatus: 'activa' }, HOY)).toBe(false); // aprobada pero sin membresía
    expect(membresiaVigente({}, HOY)).toBe(false); // anterior a la regla: vende, pero no publica
    expect(membresiaVigente({ estatus: 'pendiente', membresia: { vigenteHasta: '2026-12-31' } }, HOY)).toBe(false);
    expect(membresiaVigente({ estatus: 'activa', membresia: { vigenteHasta: '2026-09-01' } }, HOY)).toBe(false);
    expect(membresiaVigente({ estatus: 'activa', membresia: { vigenteHasta: '2026-09-04' } }, HOY, 3)).toBe(true); // en gracia
  });

  it('tiendasSinMembresiaVigente distingue el motivo y omite tiendas sin registro', async () => {
    const r = await tiendasSinMembresiaVigente([ACTIVA, LEGACY, PENDIENTE, VENCIDA, 'no-existe']);
    expect(r.map((x) => [x.id, x.motivo])).toEqual([
      [LEGACY, 'sin-membresia'],
      [PENDIENTE, 'pendiente'],
      [VENCIDA, 'vencida'],
    ]);
  });

  it('una tienda aprobada sin membresía recibe el aviso de activar membresía', () => {
    const aviso = avisoEstadoTienda({ estatus: 'activa' }, HOY);
    expect(aviso?.tipo).toBe('warning');
    expect(aviso?.titulo).toBe('Activa tu membresía');
  });
});

describe('aviso para la dueña o dueño', () => {
  it('sin problemas no hay aviso; con vencimiento a 7 días o menos, recordatorio', () => {
    expect(avisoEstadoTienda({ estatus: 'activa', membresia: { vigenteHasta: '2026-12-31' } }, HOY)).toBeNull();
    const aviso = avisoEstadoTienda({ estatus: 'activa', membresia: { vigenteHasta: '2026-09-09' } }, HOY);
    expect(aviso?.tipo).toBe('warning');
    expect(aviso?.titulo).toMatch(/3 días/);
  });

  it('pendiente informa, bloqueada muestra el motivo, vencida pide pagar', () => {
    expect(avisoEstadoTienda({ estatus: 'pendiente' }, HOY)?.tipo).toBe('info');
    const bloq = avisoEstadoTienda({ estatus: 'bloqueada', motivoBloqueo: 'Pago no recibido.' }, HOY);
    expect(bloq?.tipo).toBe('error');
    expect(bloq?.detalle).toMatch(/Pago no recibido/);
    const venc = avisoEstadoTienda({ estatus: 'activa', membresia: { vigenteHasta: '2026-01-31' } }, HOY);
    expect(venc?.titulo).toMatch(/venció/i);
    expect(venc?.detalle).toMatch(/2026-01-31/);
  });
});

describe('useEstadoTiendas (mapa compartido)', () => {
  it('lee el estado de cada tienda desde Firebase', async () => {
    const { result, unmount } = withSetup(() => useEstadoTiendas());
    cleanups.push(unmount);
    await flushPromises();
    expect(result.puedeVender(ACTIVA)).toBe(true);
    expect(result.puedeVender(LEGACY)).toBe(true);
    expect(result.puedeVender(PENDIENTE)).toBe(false);
    expect(result.puedeVender(BLOQUEADA)).toBe(false);
    expect(result.puedeVender(VENCIDA)).toBe(false);
    expect(result.puedeVender('no-existe')).toBeUndefined();
    expect(result.noPuedeVender('no-existe')).toBe(false);
    expect(result.estadoDe(VENCIDA)).toBe('vencida');
  });

  it('no bloquea mientras no se conocen los datos', () => {
    __setControlPorTienda({});
    const { result, unmount } = withSetup(() => useEstadoTiendas());
    cleanups.push(unmount);
    expect(result.noPuedeVender(undefined)).toBe(false);
    expect(result.noPuedeVender(BLOQUEADA)).toBe(false);
  });

  it('tiendasQueNoPuedenVender consulta directo y regresa nombre y estado', async () => {
    const r = await tiendasQueNoPuedenVender([ACTIVA, BLOQUEADA, 'no-existe', VENCIDA, ACTIVA]);
    expect(r.map((x) => x.id)).toEqual([BLOQUEADA, VENCIDA]);
    expect(r[0]).toMatchObject({ nombre: 'Bloqueada', estado: 'bloqueada' });
    expect(r[1]).toMatchObject({ nombre: 'Vencida', estado: 'vencida' });
  });
});

describe('catálogo público (useArticulos)', () => {
  it('oculta los artículos de tiendas que no pueden vender', async () => {
    const { result, unmount } = withSetup(() => useArticulos());
    cleanups.push(unmount);
    await flushPromises();
    expect(result.articulos.value.map((a) => a.articuloId).sort()).toEqual(['a-activa', 'a-legacy']);
  });

  it('la tienda ve todos los suyos con incluirTiendasInactivas', async () => {
    const { result, unmount } = withSetup(() => useArticulos({ incluirTiendasInactivas: true }));
    cleanups.push(unmount);
    await flushPromises();
    expect(result.articulos.value).toHaveLength(5);
  });

  it('cargarArticulosPorTienda no filtra (panel de la tienda)', async () => {
    const { result, unmount } = withSetup(() => useArticulos());
    cleanups.push(unmount);
    result.cargarArticulosPorTienda(BLOQUEADA);
    await flushPromises();
    expect(result.articulos.value.map((a) => a.articuloId)).toEqual(['a-bloqueada']);
  });
});

describe('carrito rápido', () => {
  it('no agrega productos de una tienda bloqueada y avisa', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);
    await flushPromises();
    await result.aumentar(producto('a-bloqueada', BLOQUEADA));
    expect(await db.Carrito.count()).toBe(0);
    expect(swalMock.fire).toHaveBeenCalledWith(expect.objectContaining({ text: MENSAJE_TIENDA_NO_DISPONIBLE }));
    expect(result.tiendaNoDisponible(producto('a-bloqueada', BLOQUEADA))).toBe(true);
  });

  it('sí agrega productos de una tienda activa', async () => {
    const { result, unmount } = withSetup(() => useCarritoRapido());
    cleanups.push(unmount);
    await flushPromises();
    await result.aumentar(producto('a-activa', ACTIVA));
    expect(await db.Carrito.count()).toBe(1);
    expect(swalMock.fire).not.toHaveBeenCalled();
  });
});

describe('guardarPedidos: último candado', () => {
  const domicilio = { calle: 'A', numero: '1', colonia: 'C', municipio: 'M', estado: 'E', cp: '45100' };
  const item = (id: string, tienda: string) => ({
    id_articulo: id, sku: `S-${id}`, nombre: id, precio: 10, cantidad: 1, id_tienda: tienda, nombre_tienda: 'T',
  });

  it('rechaza el pedido si alguna tienda no puede vender y no descuenta stock', async () => {
    const p = guardarPedidos([item('a-activa', ACTIVA), item('a-vencida', VENCIDA)], 'Efectivo', domicilio);
    await expect(p).rejects.toBeInstanceOf(TiendaNoDisponibleError);
    await expect(
      guardarPedidos([item('a-activa', ACTIVA), item('a-vencida', VENCIDA)], 'Efectivo', domicilio),
    ).rejects.toThrow(/Vencida/);
    expect(__getAt('articulos/a-activa/variantes/0/stock')).toBe(5);
    expect(__getAt('pedidos')).toEqual({});
  });

  it('acepta pedidos de tiendas activas y de tiendas sin campo estado', async () => {
    const id = await guardarPedidos([item('a-activa', ACTIVA), item('a-legacy', LEGACY)], 'Efectivo', domicilio);
    expect(__getAt(`pedidos/${id}/items`)).toHaveLength(2);
  });
});

describe('registro de tienda', () => {
  it('toda tienda nueva nace pendiente', async () => {
    const { crearTienda } = useTiendas();
    const id = await crearTienda({
      nombreTienda: 'Nueva', categoria: 'Comida', descripcion: 'd', calle: '', numero: '', colonia: '', cp: '',
      municipio: '', estado: '', email: '', telefono: '9', incluyeWhatsapp: false, metodosPago: [],
      envioDomicilio: true, zonasEntrega: [], horario: {},
    });
    expect(__getAt(`tiendas/${id}/estatus`)).toBe('pendiente');
    expect(typeof __getAt(`tiendas/${id}/creadaEn`)).toBe('string');
  });

  it('la tienda no puede cambiar su propio estado al editar el perfil', async () => {
    const { actualizarTienda } = useTiendas();
    await actualizarTienda(BLOQUEADA, { descripcion: 'nueva', estado: 'Jalisco', estatus: 'activa', membresia: { vigenteHasta: '2099-01-01' } } as any);
    expect(__getAt(`tiendas/${BLOQUEADA}/descripcion`)).toBe('nueva');
    expect(__getAt(`tiendas/${BLOQUEADA}/estado`)).toBe('Jalisco'); // el estado geográfico sí se edita
    expect(__getAt(`tiendas/${BLOQUEADA}/estatus`)).toBe('bloqueada');
    expect(__getAt(`tiendas/${BLOQUEADA}/membresia`)).toBeUndefined();
  });
});
