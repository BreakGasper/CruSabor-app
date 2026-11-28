/**
 * «Agregar otra tienda» con el mismo teléfono: desde una tienda con sesión ya no se vuelve a pedir la contraseña
 * (la tienda nueva usa la de su cuenta), el número queda fijo y solo se revisa que haya lugar.
 * Además, la confirmación de la contraseña nunca se guarda en la base.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { flush } from './helpers';
import { __reset } from './mocks/firebaseDb';

const { crearTienda, replace } = vi.hoisted(() => ({ crearTienda: vi.fn(), replace: vi.fn() }));
vi.mock('@/composables/useTiendas', async (original) => {
  const real = await original<Record<string, any>>();
  return { ...real, useTiendas: () => ({ ...real.useTiendas(), crearTienda: (...a: any[]) => crearTienda(...a), telefonoExiste: async () => false }) };
});
vi.mock('@/composables/usePassword', async (original) => ({ ...(await original<Record<string, unknown>>()), hashPassword: vi.fn(async (p: string) => `hash:${p}`) }));
vi.mock('@/router', () => ({ default: { replace, push: vi.fn(), back: vi.fn() } }));
vi.mock('@/composables/useCodigoPostal', () => ({ buscarPorCP: vi.fn(async () => null), coloniasPorMunicipioConOrigen: vi.fn(async () => ({ colonias: [], origen: 'ninguna' })), coloniasPorMunicipio: vi.fn(async () => []) }));
vi.mock('@/composables/useLugar', () => ({
  obtenerMunicipios: vi.fn(async () => [{ id: 'm1', municipio: 'Guadalajara', alcance: true }]),
  obtenerPueblosPorMunicipio: vi.fn(async () => []),
  obtenerTodosPueblos: vi.fn(async () => []),
  tieneAlcance: () => true,
}));
vi.mock('@/composables/useCategorias', () => ({ obtenerCategorias: vi.fn(async () => [{ id: 'c1', nombre: 'Comida' }]) }));
vi.mock('@/composables/useConfiguracion', () => ({
  useConfiguracion: () => ({
    configuracion: { value: { registro: { tiendasAbierto: true, mensajeCerrado: 'cerrado' } } },
    registroTiendasAbierto: { value: true },
    contactoSoporte: { value: '' },
  }),
}));
vi.mock('@/composables/useStorage', () => ({
  uploadStoreLogo: vi.fn(async () => 'https://cdn.test/logo.png'),
  uploadStoreBanner: vi.fn(async () => 'https://cdn.test/banner.png'),
  uploadStoreGallery: vi.fn(async () => []),
}));

import StoreRegister from '@/modules/store/views/StoreRegister.vue';
import { MENSAJE_LIMITE_TIENDAS, MENSAJE_PASSWORD_CUENTA, revisarAgregarACuenta, hashDeCuenta } from '@/composables/cuentaTienda';

const TEL = '3751241114';
const tiendaDe = (nombre: string, extra: Record<string, any> = {}) => ({ nombreTienda: nombre, telefono: TEL, password: 'HASH-DE-LA-CUENTA', estatus: 'activa', ...extra });
let limpiar: Array<() => void> = [];

beforeEach(() => {
  crearTienda.mockReset();
  crearTienda.mockResolvedValue('t-nueva');
  replace.mockReset();
  __reset({ tiendas: { t1: tiendaDe('Mi primera tienda') } });
});
afterEach(() => {
  limpiar.forEach((f) => f());
  limpiar = [];
  localStorage.clear();
});

const conSesion = () =>
  localStorage.setItem('tiendas', JSON.stringify({ id: 't1', nombre: 'Mi primera tienda', nombreTienda: 'Mi primera tienda', telefono: TEL, email: 'dueno@test.com', cuenta: [{ id: 't1', nombreTienda: 'Mi primera tienda' }] }));

async function montar(paso = 1) {
  const w = mount(StoreRegister, { global: { stubs: { TopBarFija: true } } });
  limpiar.push(() => w.unmount());
  await flush();
  (w.vm as any).step = paso;
  await w.vm.$nextTick();
  return w;
}
const vm = (w: any) => w.vm as any;

describe('reglas de la cuenta', () => {
  it('revisarAgregarACuenta: hay lugar, límite o la cuenta ya no existe', async () => {
    expect(await revisarAgregarACuenta(TEL)).toBe('agregar');
    __reset({ tiendas: { a: tiendaDe('A'), b: tiendaDe('B'), c: tiendaDe('C') } });
    expect(await revisarAgregarACuenta(TEL)).toBe('limite');
    __reset({ tiendas: { a: { nombreTienda: 'Sin contraseña', telefono: TEL } } });
    expect(await revisarAgregarACuenta(TEL)).toBe('sin-cuenta');
    __reset({ tiendas: {} });
    expect(await revisarAgregarACuenta(TEL)).toBe('sin-cuenta');
  });

  it('hashDeCuenta devuelve la contraseña (hash) de la cuenta, o null', async () => {
    expect(await hashDeCuenta(TEL)).toBe('HASH-DE-LA-CUENTA');
    expect(await hashDeCuenta('3300000000')).toBeNull();
  });

  it('el aviso para quien no inició sesión explica las dos salidas', () => {
    expect(MENSAJE_PASSWORD_CUENTA).toContain('Agregar otra tienda');
    expect(MENSAJE_PASSWORD_CUENTA).toContain('misma contraseña');
  });
});

describe('«Agregar otra tienda» desde una tienda con sesión', () => {
  it('no pide contraseña: explica que usa la de la cuenta', async () => {
    conSesion();
    const w = await montar();
    expect(w.find('[data-testid="nota-cuenta"]').text()).toContain(TEL);
    expect(w.text()).not.toContain('Confirmar contraseña');
    expect(w.find('input[autocomplete="new-password"]').exists()).toBe(false);
  });

  it('el paso 1 se valida sin contraseña', async () => {
    conSesion();
    const w = await montar();
    Object.assign(vm(w).form, { nombreTienda: 'Mi segunda tienda', categoria: 'c1', descripcion: 'x', logo: new File(['x'], 'l.png') });
    expect(await vm(w).validateStep()).toBe(true);
    expect(vm(w).errors.password).toBeUndefined();
  });

  it('el celular viene de la sesión y no se puede cambiar', async () => {
    conSesion();
    const w = await montar(3);
    const tel = w.find('[data-testid="telefono"]');
    expect((tel.element as HTMLInputElement).value).toBe(TEL);
    expect(tel.attributes('readonly')).toBeDefined();
  });

  it('el paso 3 pasa sin contraseña (antes fallaba con «usa la misma contraseña»)', async () => {
    conSesion();
    const w = await montar(3);
    expect(await vm(w).validateStep()).toBe(true);
    expect(vm(w).errors.telefono).toBeUndefined();
  });

  it('si el número ya llegó al máximo de tiendas, no deja avanzar', async () => {
    conSesion();
    __reset({ tiendas: { t1: tiendaDe('A'), t2: tiendaDe('B'), t3: tiendaDe('C') } });
    const w = await montar(3);
    expect(await vm(w).validateStep()).toBe(false);
    expect(vm(w).errors.telefono).toBe(MENSAJE_LIMITE_TIENDAS);
  });

  it('al registrar usa la contraseña (hash) de la cuenta, sin rehacerla ni pedirla', async () => {
    conSesion();
    const w = await montar(5);
    vm(w).aceptaTerminosTienda = true;
    Object.assign(vm(w).form, { nombreTienda: 'Mi segunda tienda', categoria: 'c1' });
    await w.vm.$nextTick();
    await w.findAll('button').find((b) => /Finalizar/.test(b.text()))!.trigger('click');
    await flush();
    expect(crearTienda).toHaveBeenCalledTimes(1);
    const d = crearTienda.mock.calls[0][0];
    expect(d.password).toBe('HASH-DE-LA-CUENTA');
    expect(d.telefono).toBe(TEL);
    expect('confirmPassword' in d).toBe(false);
    // y se agrega a la cuenta de la sesión
    const sesion = JSON.parse(localStorage.getItem('tiendas') || '{}');
    expect(sesion.cuenta.map((c: any) => c.id)).toEqual(['t1', 't-nueva']);
  });

  it('si la cuenta ya no existe, avisa que vuelva a entrar y no crea nada', async () => {
    conSesion();
    const w = await montar(5);
    vm(w).aceptaTerminosTienda = true;
    __reset({ tiendas: {} }); // la tienda original se borró mientras tanto
    await w.findAll('button').find((b) => /Finalizar/.test(b.text()))!.trigger('click');
    await flush();
    expect(crearTienda).not.toHaveBeenCalled();
  });
});

describe('registro SIN sesión (como siempre)', () => {
  it('sigue pidiendo y confirmando la contraseña', async () => {
    const w = await montar();
    expect(w.find('[data-testid="nota-cuenta"]').exists()).toBe(false);
    expect(w.text()).toContain('Confirmar contraseña');
    expect(w.findAll('input[autocomplete="new-password"]').length).toBeGreaterThan(0);
  });

  it('con un número que ya tiene tienda y otra contraseña, le explica cómo agregarla', async () => {
    const w = await montar(3);
    Object.assign(vm(w).form, { telefono: TEL, password: 'Otra-clave-99', email: 'a@b.com' });
    expect(await vm(w).validateStep()).toBe(false);
    expect(vm(w).errors.telefono).toBe(MENSAJE_PASSWORD_CUENTA);
  });

  it('la confirmación de la contraseña nunca viaja a crearTienda', async () => {
    __reset({ tiendas: {} });
    const w = await montar(5);
    vm(w).aceptaTerminosTienda = true;
    Object.assign(vm(w).form, { categoria: 'c1', password: 'Clave-secreta-1', confirmPassword: 'Clave-secreta-1', telefono: '3300000000' });
    await w.vm.$nextTick();
    await w.findAll('button').find((b) => /Finalizar/.test(b.text()))!.trigger('click');
    await flush();
    const d = crearTienda.mock.calls[0][0];
    // el doble de hashPassword de esta prueba devuelve "hash:<texto>", así que se revisa todo MENOS el campo de la contraseña
    const { password, ...resto } = d;
    expect('confirmPassword' in d).toBe(false);
    expect(JSON.stringify(resto)).not.toContain('Clave-secreta-1');
    expect(d.password).toBe('hash:Clave-secreta-1');
  });
});
