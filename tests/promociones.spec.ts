/**
 * Promociones: un descuento con caducidad sobre un artículo que la tienda ya publicó.
 *
 *  - reglas de vigencia (un mes, pausar, renovar)
 *  - "Destacados" en la portada: qué se muestra y en qué orden
 *  - el precio de la promoción es el que se cobra
 *  - el administrador puede apagarlas para todas las tiendas
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises as fp } from '@vue/test-utils';
// Dexie (fake-indexeddb) resuelve en timers: se espera un tick real además de las microtareas
const flushPromises = async () => { await fp(); await new Promise((r) => setTimeout(r, 25)); await fp(); };
vi.mock('@/composables/useCategorias', () => ({
  obtenerCategorias: vi.fn(async () => [{ id: 'c1', nombre: 'Alimentos y Bebidas' }]),
}));
vi.mock('@/composables/useStorage', () => ({
  uploadStoreLogo: vi.fn(async () => ''),
  uploadStoreBanner: vi.fn(async () => ''),
  uploadStoreGallery: vi.fn(async () => []),
  uploadArticuloImagen: vi.fn(async () => 'https://cdn.test/banner-nuevo.jpg'),
}));

import { __reset, __getAt } from './mocks/firebaseDb';
import { routerMock, routeMock } from './setup';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { __setEnvioPorTienda } from '@/composables/useEnvioTienda';
import { __setConfiguracion } from '@/composables/useConfiguracion';
import { __setVotos } from '@/composables/useCalificaciones';
import {
  vencimientoDesde,
  promocionVigente,
  promocionCaducada,
  estadoPromocion,
  descuentoPorcentaje,
  fechaPublicacion,
  crearPromocion,
  renovarPromocion,
  pausarPromocion,
  __setPromociones,
  type Promocion,
} from '@/composables/usePromociones';
import Destacados from '@/modules/home/components/Destacados.vue';
import ProductCard from '@/modules/home/components/ProductCard.vue';
import type { Producto } from '@/types/Producto';

const TIENDA = 'tienda-A';

const promo = (extra: Partial<Promocion> = {}): Promocion => ({
  id: 'p1',
  tiendaId: TIENDA,
  tiendaNombre: 'Postres Lola',
  articuloId: 'a1',
  titulo: '2x1 en jericallas',
  bannerUrl: 'https://cdn.test/banner.jpg',
  precioPromo: 30,
  precioOriginal: 45,
  activa: true,
  creadaEn: new Date().toISOString(),
  venceEn: vencimientoDesde(new Date()),
  ...extra,
});

const articulo = (id = 'a1', extra: Partial<Producto> = {}): any => ({
  nombre: 'Chocoflán', url: 'https://cdn.test/a.jpg', precio: 45, descripcion: '', categoria: 'Postres',
  tiendaId: TIENDA, tiendaNombre: 'Postres Lola', fecha_hora: new Date().toISOString(),
  variantes: [{ sku: `S-${id}`, stock: 5, precio: 45, url: '', detalle: '' }], ...extra,
});

let cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
  __setPromociones(null);
  __setConfiguracion(null);
  __setVotos('articulos', null);
  __setEnvioPorTienda(null);
  localStorage.clear();
});

beforeEach(async () => {
  __reset({ tiendas: { [TIENDA]: { envioDomicilio: true, nombreTienda: 'Postres Lola' } }, articulos: {}, promociones: {} });
  __setEnvioPorTienda(null);
  __setVotos('articulos', {});
  await db.Carrito.clear();
  sessionUser.value = { id: 'cliente-1' };
  routerMock.push.mockClear();
});

describe('Vigencia: una promoción dura un mes', () => {
  it('vence un mes natural después, y recorta cuando el mes destino es más corto', () => {
    expect(vencimientoDesde(new Date(2026, 8, 20, 10, 0)).slice(0, 10)).toBe('2026-10-20');
    // 31 de enero + 1 mes no es el 3 de marzo: se recorta al último día de febrero
    expect(vencimientoDesde(new Date(2026, 0, 31, 10, 0)).slice(0, 10)).toBe('2026-02-28');
  });

  it('vigente mientras no caduque y la tienda no la pause', () => {
    const ahora = new Date(2026, 8, 20);
    const viva = promo({ creadaEn: ahora.toISOString(), venceEn: vencimientoDesde(ahora) });

    expect(promocionVigente(viva, ahora)).toBe(true);
    expect(promocionCaducada(viva, ahora)).toBe(false);
    expect(estadoPromocion(viva, ahora)).toBe('vigente');

    expect(estadoPromocion({ ...viva, activa: false }, ahora)).toBe('pausada');
    expect(promocionVigente({ ...viva, activa: false }, ahora)).toBe(false);

    const unMesYUnDia = new Date(2026, 9, 21);
    expect(promocionCaducada(viva, unMesYUnDia)).toBe(true);
    expect(estadoPromocion(viva, unMesYUnDia)).toBe('caducada');
    // una caducada sigue caducada aunque esté activa: la fecha manda
    expect(promocionVigente(viva, unMesYUnDia)).toBe(false);
  });

  it('el descuento se calcula solo, y no inventa nada si los precios no cuadran', () => {
    expect(descuentoPorcentaje({ precioPromo: 30, precioOriginal: 45 })).toBe(33);
    expect(descuentoPorcentaje({ precioPromo: 50, precioOriginal: 45 })).toBe(0); // "promo" más cara
    expect(descuentoPorcentaje({ precioPromo: 30, precioOriginal: 0 })).toBe(0);
  });

  it('la fecha de publicación se muestra con día y hora', () => {
    expect(fechaPublicacion(new Date(2026, 8, 18, 14, 30).toISOString())).toMatch(/18 de septiembre/);
    expect(fechaPublicacion('no es fecha')).toBe('');
  });
});

describe('Escrituras de la tienda', () => {
  it('al crear queda activa y con un mes de vigencia', async () => {
    const id = await crearPromocion({
      tiendaId: TIENDA, tiendaNombre: 'Postres Lola', articuloId: 'a1',
      titulo: '2x1 en jericallas', bannerUrl: 'https://cdn.test/b.jpg',
      precioPromo: 30, precioOriginal: 45,
    });

    const guardada = __getAt(`promociones/${id}`) as any;
    expect(guardada).toMatchObject({ articuloId: 'a1', precioPromo: 30, activa: true });
    expect(new Date(guardada.venceEn).getTime()).toBeGreaterThan(Date.now());
    expect(promocionVigente(guardada)).toBe(true);
  });

  it('pausar y renovar: renovar le da otro mes y la reactiva', async () => {
    const vieja = { ...promo(), creadaEn: new Date(2026, 0, 1).toISOString(), venceEn: new Date(2026, 1, 1).toISOString(), activa: false };
    __reset({ promociones: { p1: vieja } });

    await pausarPromocion('p1', false);
    expect((__getAt('promociones/p1') as any).activa).toBe(false);

    await renovarPromocion('p1');
    const renovada = __getAt('promociones/p1') as any;
    expect(renovada.activa).toBe(true);
    expect(promocionCaducada(renovada)).toBe(false);
  });
});

describe('Destacados en la portada', () => {
  const stubs = { StarRating: true };

  async function montar(articulos: Record<string, any>, promos: Promocion[]) {
    __reset({ tiendas: { [TIENDA]: { envioDomicilio: true } }, articulos, promociones: {} });
    __setPromociones(promos);
    const w = mount(Destacados, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    return w;
  }

  const titulos = (w: any) => w.findAll('.nombre').map((n: any) => n.text());

  it('muestra las promociones vigentes con su banner, precio y fecha', async () => {
    const w = await montar({ a1: articulo() }, [promo()]);

    expect(w.find('.destacados-promos').exists()).toBe(true);
    expect(titulos(w)).toEqual(['2x1 en jericallas']);
    expect(w.find('.precio').text()).toBe('$30.00');
    expect(w.find('.antes').text()).toBe('$45.00'); // el normal, tachado
    expect(w.find('.descuento').text()).toBe('-33%');
    expect(w.find('.publicada').text()).not.toBe('');
    expect(w.find('.banner img').attributes('src')).toContain('banner.jpg');
  });

  it('deja fuera las pausadas, las caducadas y las de artículos que ya no están', async () => {
    const w = await montar({ a1: articulo() }, [
      promo(),
      promo({ id: 'p2', titulo: 'Pausada', activa: false }),
      promo({ id: 'p3', titulo: 'Caducada', venceEn: new Date(2020, 0, 1).toISOString() }),
      promo({ id: 'p4', titulo: 'De artículo borrado', articuloId: 'no-existe' }),
    ]);

    expect(titulos(w)).toEqual(['2x1 en jericallas']);
  });

  it('las más recientes primero y, dentro del mismo día, las mejor calificadas', async () => {
    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 24 * 3600 * 1000);
    __setVotos('articulos', {
      a1: { u1: { estrellas: 3, fecha: '' } },
      a2: { u1: { estrellas: 5, fecha: '' }, u2: { estrellas: 5, fecha: '' } },
    });

    const w = await montar(
      { a1: articulo('a1'), a2: articulo('a2'), a3: articulo('a3') },
      [
        promo({ id: 'p1', articuloId: 'a1', titulo: 'Hoy 3 estrellas', creadaEn: hoy.toISOString() }),
        promo({ id: 'p2', articuloId: 'a2', titulo: 'Hoy 5 estrellas', creadaEn: hoy.toISOString() }),
        promo({ id: 'p3', articuloId: 'a3', titulo: 'De ayer', creadaEn: ayer.toISOString() }),
      ],
    );

    expect(titulos(w)).toEqual(['Hoy 5 estrellas', 'Hoy 3 estrellas', 'De ayer']);
  });

  it('tocar una tarjeta abre el detalle de la promoción, no el del artículo', async () => {
    const w = await montar({ a1: articulo() }, [promo()]);
    await w.find('.promo-card').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/promocion/p1');
  });

  it('sin promociones vigentes la sección no se dibuja', async () => {
    const w = await montar({ a1: articulo() }, []);
    expect(w.find('.destacados-promos').exists()).toBe(false);
  });

  it('si el administrador apaga las promociones, la sección desaparece', async () => {
    __setConfiguracion({ promociones: { habilitadas: false } });
    const w = await montar({ a1: articulo() }, [promo()]);
    expect(w.find('.destacados-promos').exists()).toBe(false);
  });
});

describe('El precio de la promoción es el que se cobra', () => {
  const producto = (): Producto =>
    ({
      articuloId: 'a1', nombre: 'Chocoflán', url: 'https://cdn.test/a.jpg', precio: 45, descripcion: '', categoria: 'Postres',
      tiendaId: TIENDA, variantes: [{ sku: 'S1', stock: 5, precio: 45, url: '', detalle: '' } as any],
    }) as Producto;

  async function montarTarjeta() {
    const w = mount(ProductCard, { props: { producto: producto() }, global: { stubs: { FontAwesomeIcon: true, StarRating: true } } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    return w;
  }

  it('la tarjeta muestra el precio con descuento y el normal tachado', async () => {
    __setPromociones([promo()]);
    const w = await montarTarjeta();

    expect(w.find('.precio').text()).toBe('$30.00');
    expect(w.find('.antes').text()).toBe('$45.00');
  });

  it('al agregar al carrito se guarda el precio de la promoción', async () => {
    __setPromociones([promo()]);
    const w = await montarTarjeta();

    await w.find('.btn-agregar').trigger('click');
    await flushPromises();

    const items = await db.Carrito.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].precio).toBe(30);
  });

  it('sin promoción vigente se cobra el precio normal', async () => {
    __setPromociones([promo({ activa: false })]);
    const w = await montarTarjeta();
    expect(w.find('.precio').text()).toBe('$45.00');
    expect(w.find('.antes').exists()).toBe(false);

    await w.find('.btn-agregar').trigger('click');
    await flushPromises();
    expect((await db.Carrito.toArray())[0].precio).toBe(45);
  });
});

/**
 * El menú del perfil de tienda. "Crear promoción" es de la dueña o el dueño, y el
 * administrador del sistema puede apagarlo para todas las tiendas de un tirón.
 */
describe('"Crear promoción" en el menú de la tienda', () => {
  const stubs = { ArrowBack: true, FontAwesomeIcon: true, PageHeader: true, transition: false, StarRating: true };

  async function montarPerfil({ dueno = true, promosOn = true } = {}) {
    __reset({
      tiendas: {
        [TIENDA]: {
          nombreTienda: 'Postres Lola', telefono: '3751241116', estatus: 'aprobada',
          membresia: { vigenteHasta: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) },
        },
      },
      articulos: {}, pedidos: {},
    });
    __setConfiguracion({ promociones: { habilitadas: promosOn } });
    routeMock.params = { id: TIENDA };
    localStorage.setItem('tiendas', JSON.stringify({ id: dueno ? TIENDA : 'otra-tienda', nombreTienda: 'Postres Lola' }));

    const StoreProfile = (await import('@/modules/store/views/StoreProfile.vue')).default;
    const w = mount(StoreProfile, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    return w;
  }

  const etiquetas = (w: any) => w.findAll('.menu-label').map((e: any) => e.text());

  it('la dueña de la tienda la ve, junto a "Agregar articulo"', async () => {
    const w = await montarPerfil();
    expect(etiquetas(w)).toContain('Crear promoción');
  });

  it('si el administrador apaga las promociones, desaparece del menú', async () => {
    const w = await montarPerfil({ promosOn: false });
    expect(etiquetas(w)).not.toContain('Crear promoción');
    expect(etiquetas(w)).toContain('Productos'); // el resto del menú sigue igual
  });

  it('un visitante no la ve aunque estén encendidas', async () => {
    const w = await montarPerfil({ dueno: false });
    expect(etiquetas(w)).not.toContain('Crear promoción');
  });
});

/**
 * Pantalla propia de la promoción (`/promocion/:id`): manda el banner de la
 * promoción y el artículo va debajo, como lo que se está vendiendo.
 */
describe('Detalle de una promoción', () => {
  const stubs = {
    FontAwesomeIcon: true,
    StarRating: true,
    CartButton: true,
    PageHeader: { template: '<div><slot /></div>' },
  };

  async function montarDetalle(promos: Promocion[], articulos: Record<string, any> = { a1: articulo() }) {
    __reset({ tiendas: { [TIENDA]: { envioDomicilio: true } }, articulos, promociones: {} });
    __setPromociones(promos);
    routeMock.params = { id: 'p1' };
    const PromocionDetalle = (await import('@/modules/home/views/PromocionDetalle.vue')).default;
    const w = mount(PromocionDetalle, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    return w;
  }

  it('muestra el banner y los datos de la promoción, con el artículo debajo', async () => {
    const w = await montarDetalle([promo()]);

    expect(w.find('.banner img').attributes('src')).toContain('banner.jpg');
    expect(w.find('.titulo').text()).toBe('2x1 en jericallas');
    expect(w.find('.descuento').text()).toBe('-33%');
    expect(w.find('.precio').text()).toBe('$30.00');
    expect(w.find('.antes').text()).toBe('$45.00');
    expect(w.find('.ahorro').text()).toBe('Ahorras $15.00');
    expect(w.find('.vigencia').text()).toContain('Publicada el');

    // el artículo al que se le aplicó
    expect(w.find('.articulo .nombre').text()).toBe('Chocoflán');
  });

  it('desde el artículo se puede abrir su pantalla completa', async () => {
    const w = await montarDetalle([promo()]);
    await w.find('.articulo').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/producto/a1');
  });

  it('se compra desde aquí, y al carrito va el precio de la promoción', async () => {
    const w = await montarDetalle([promo()]);

    await w.find('.btn-agregar').trigger('click');
    await flushPromises();

    const items = await db.Carrito.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].precio).toBe(30);
    expect(w.find('.cantidad').text()).toBe('1');
  });

  it('si ya caducó lo dice, y el artículo se sigue vendiendo', async () => {
    const w = await montarDetalle([promo({ venceEn: new Date(2020, 0, 1).toISOString() })]);

    expect(w.find('.aviso').text()).toContain('ya terminó');
    expect(w.find('.btn-agregar').attributes('disabled')).toBeUndefined();
  });

  it('una promoción que no existe no deja la pantalla en blanco', async () => {
    const w = await montarDetalle([]);
    expect(w.find('.estado').text()).toContain('ya no está disponible');
  });

  it('si el artículo ya no está publicado, lo avisa en vez de fallar', async () => {
    const w = await montarDetalle([promo()], {});
    expect(w.find('.articulo-bloque .aviso').text()).toContain('ya no está publicado');
    expect(w.find('.btn-agregar').exists()).toBe(false);
  });
});
