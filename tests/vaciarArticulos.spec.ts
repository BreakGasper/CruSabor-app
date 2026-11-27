/**
 * Vaciar los artículos de una tienda (o de todas) para limpiar datos de prueba: qué se borra, qué NO se toca,
 * que pida confirmación escrita y que deje constancia.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';

const eliminarImagenes = vi.fn(async (_u: any) => {});
vi.mock('@/composables/useCloudinary', async (original) => ({ ...(await original<any>()), eliminarImagenes: (u: any) => eliminarImagenes(u) }));

import { planearVaciado, urlsDeImagenes, vaciarArticulos, leerPlanVaciado } from '@/composables/vaciarArticulos';
import AdminTiendaDetalle from '@/modules/admin/views/AdminTiendaDetalle.vue';
import AdminTiendas from '@/modules/admin/views/AdminTiendas.vue';

const datos = () => ({
  tiendas: {
    tA: { nombreTienda: 'Postres Lola', estatus: 'activa', telefono: '3311111111', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
    tB: { nombreTienda: 'Café Sol', estatus: 'activa', telefono: '3322222222', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
  },
  articulos: {
    a1: { nombre: 'Prueba 1', tiendaId: 'tA', url: 'https://img/a1.jpg', variantes: [{ sku: 's1', url: 'https://img/a1.jpg' }, { sku: 's2', url: 'https://img/a1-v.jpg' }] },
    a2: { nombre: 'Prueba 2', tiendaId: 'tA', url: 'https://img/a2.jpg', variantes: [{ sku: 's3', url: 'blob:local' }] },
    b1: { nombre: 'Café', tiendaId: 'tB', url: 'https://img/b1.jpg', variantes: [] },
  },
  promociones: {
    p1: { articuloId: 'a1', tiendaId: 'tA', titulo: 'Oferta' },
    p2: { articuloId: 'b1', tiendaId: 'tB', titulo: 'Otra tienda' },
  },
  pedidos: { ped1: { id_pedido: 'ped1', items: [{ id_articulo: 'a1', nombreProducto: 'Prueba 1', precio: 10, cantidad: 1 }], total_compra: 10 } },
  auditoria: {},
});

beforeEach(() => {
  __reset(datos());
  eliminarImagenes.mockClear();
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: 'VACIAR' });
  routeMock.params = { id: 'tA' };
  routeMock.query = {};
});
afterEach(() => {
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('planearVaciado (qué se borraría, sin borrar nada)', () => {
  it('de una tienda: solo sus artículos, las promociones de esos artículos y sus fotos', () => {
    const d = datos();
    const p = planearVaciado(d.articulos, d.promociones, 'tA');
    expect(p.articulos.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(p.promociones).toEqual(['p1']);
    expect(p.imagenes.sort()).toEqual(['https://img/a1-v.jpg', 'https://img/a1.jpg', 'https://img/a2.jpg']); // sin repetir y sin vistas previas blob:
  });

  it('de todas las tiendas', () => {
    const d = datos();
    const p = planearVaciado(d.articulos, d.promociones, null);
    expect(p.articulos).toHaveLength(3);
    expect(p.promociones.sort()).toEqual(['p1', 'p2']);
  });

  it('una tienda sin artículos, o una base vacía o con basura, da un plan vacío', () => {
    const d = datos();
    expect(planearVaciado(d.articulos, d.promociones, 'otra').articulos).toEqual([]);
    expect(planearVaciado(null, null, null)).toEqual({ articulos: [], promociones: [], imagenes: [] });
    expect(planearVaciado({ x: null, y: 5 as any }, { z: 'no' as any }, null).articulos).toEqual([]);
  });

  it('urlsDeImagenes: acepta variantes como arreglo o como objeto', () => {
    expect(urlsDeImagenes('https://a', { 0: { url: 'https://b' }, 1: { url: '' } })).toEqual(['https://a', 'https://b']);
    expect(urlsDeImagenes(undefined, undefined)).toEqual([]);
  });
});

describe('vaciarArticulos', () => {
  it('borra los artículos y promociones de la tienda, deja las demás y los pedidos, y pide borrar las fotos', async () => {
    const r = await vaciarArticulos('tA');
    expect(r).toEqual({ articulos: 2, promociones: 1, imagenes: 3 });
    expect(__getAt('articulos/a1')).toBeUndefined();
    expect(__getAt('articulos/a2')).toBeUndefined();
    expect(__getAt('articulos/b1')).toBeDefined(); // otra tienda: intacta
    expect(__getAt('promociones/p1')).toBeUndefined();
    expect(__getAt('promociones/p2')).toBeDefined();
    expect(__getAt('pedidos/ped1/items/0/nombreProducto')).toBe('Prueba 1'); // el historial no se toca
    expect(__getAt('tiendas/tA/nombreTienda')).toBe('Postres Lola'); // la tienda tampoco
    expect(eliminarImagenes).toHaveBeenCalledTimes(1);
    expect((eliminarImagenes.mock.calls[0][0] as string[]).sort()).toEqual(['https://img/a1-v.jpg', 'https://img/a1.jpg', 'https://img/a2.jpg']);
  });

  it('deja constancia: quién, cuándo y cuántos', async () => {
    await vaciarArticulos('tA');
    const regs = Object.values(__getAt('auditoria') || {}) as any[];
    expect(regs).toHaveLength(1);
    expect(regs[0]).toMatchObject({ accion: 'vaciar-articulos', tiendaId: 'tA', articulos: 2, promociones: 1, por: 'adm-1', porNombre: 'Ana Admin' });
    expect(new Date(regs[0].fecha).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('de todas las tiendas', async () => {
    const r = await vaciarArticulos(null);
    expect(r.articulos).toBe(3);
    expect(Object.keys(__getAt('articulos') ?? {})).toHaveLength(0);
    expect(Object.keys(__getAt('promociones') ?? {})).toHaveLength(0);
    expect((Object.values(__getAt('auditoria')) as any[])[0].tiendaId).toBe('todas');
  });

  it('borra SOLO lo del plan que se mostró: lo publicado después no se pierde', async () => {
    const plan = await leerPlanVaciado('tA');
    __getAt; // (lectura)
    // alguien publica otro artículo entre que se mostró el aviso y se confirmó
    const { __getTree } = await import('./mocks/firebaseDb');
    __reset({ ...__getTree(), articulos: { ...__getTree().articulos, a3: { nombre: 'Nuevo real', tiendaId: 'tA' } } });
    await vaciarArticulos('tA', plan);
    expect(__getAt('articulos/a3')).toBeDefined();
    expect(__getAt('articulos/a1')).toBeUndefined();
  });

  it('sin nada que borrar no falla y no pide borrar fotos', async () => {
    __reset({ articulos: {}, promociones: {} });
    expect(await vaciarArticulos('tA')).toEqual({ articulos: 0, promociones: 0, imagenes: 0 });
    expect(eliminarImagenes).not.toHaveBeenCalled();
  });
});

describe('pantalla de una tienda (admin)', () => {
  const montar = async () => {
    const w = mount(AdminTiendaDetalle, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true, PagoMembresiaModal: true, teleport: true } } });
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('muestra cuántos artículos tiene y el aviso de que no se puede deshacer', async () => {
    const w = await montar();
    expect(w.find('[data-testid="cuenta-articulos"]').text()).toContain('2');
    expect(w.text()).toContain('No se puede deshacer');
  });

  it('con la confirmación escrita borra solo los de esa tienda y vuelve a contar', async () => {
    const w = await montar();
    await w.find('[data-testid="vaciar-articulos"]').trigger('click');
    await flushPromises();
    await flushPromises();
    const aviso = swalMock.fire.mock.calls[0][0] as any;
    expect(aviso.title).toContain('Postres Lola');
    expect(aviso.input).toBe('text');
    expect(__getAt('articulos/a1')).toBeUndefined();
    expect(__getAt('articulos/b1')).toBeDefined();
    expect(w.find('[data-testid="sin-articulos"]').exists()).toBe(true);
  });

  it('si no escribe VACIAR, o cancela, no se borra nada', async () => {
    const w = await montar();
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'borrar' });
    await w.find('[data-testid="vaciar-articulos"]').trigger('click');
    await flushPromises();
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false, value: '' } as any);
    await w.find('[data-testid="vaciar-articulos"]').trigger('click');
    await flushPromises();
    expect(Object.keys(__getAt('articulos'))).toHaveLength(3);
    expect(eliminarImagenes).not.toHaveBeenCalled();
  });
});

describe('lista de tiendas (admin): vaciar las de todas', () => {
  const montar = async () => {
    const w = mount(AdminTiendas, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true, PagoMembresiaModal: true, teleport: true } } });
    await flushPromises();
    return w;
  };

  it('pide escribir VACIAR TODO y entonces borra los artículos de todas las tiendas', async () => {
    const w = await montar();
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'VACIAR TODO' });
    await w.find('[data-testid="vaciar-todas"]').trigger('click');
    await flushPromises();
    await flushPromises();
    const aviso = swalMock.fire.mock.calls[0][0] as any;
    expect(aviso.title).toContain('TODAS');
    expect(aviso.html).toContain('3 artículo(s)');
    expect(aviso.html).toContain('2 tienda(s)');
    expect(Object.keys(__getAt('articulos') ?? {})).toHaveLength(0);
    expect(__getAt('tiendas/tA/nombreTienda')).toBe('Postres Lola');
  });

  it('con "VACIAR" a secas (no "VACIAR TODO") no borra', async () => {
    const w = await montar();
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'VACIAR' });
    await w.find('[data-testid="vaciar-todas"]').trigger('click');
    await flushPromises();
    expect(Object.keys(__getAt('articulos'))).toHaveLength(3);
  });

  it('si no hay artículos, lo avisa y no pide confirmar', async () => {
    __reset({ ...datos(), articulos: {}, promociones: {} });
    const w = await montar();
    await w.find('[data-testid="vaciar-todas"]').trigger('click');
    await flushPromises();
    expect((swalMock.fire.mock.calls[0][0] as any).title).toBe('No hay artículos');
    expect(swalMock.fire).toHaveBeenCalledTimes(1);
  });
});
