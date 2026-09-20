/**
 * Registro de tienda: candado de envío y aviso de éxito.
 *
 * El bug que cubre: "Finalizar" no se bloqueaba y crearTienda tarda (hash de
 * contraseña + subida de logo, banner y galería). Cada toque extra entraba de
 * nuevo a submitStore y, como crearTienda hace push(), generaba OTRA tienda con
 * un id distinto. De ahí salían 3 o 4 tiendas con el mismo nombre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { flush } from './helpers';
import { coloniasDeMunicipio } from '@/composables/coloniasLocales';
import { coloniasPorMunicipioConOrigen } from '@/composables/useCodigoPostal';

// --- Dobles de las dependencias pesadas de la pantalla ---
// vi.hoisted porque vi.mock se eleva por encima de las declaraciones normales.
const { crearTienda, telefonoExiste, replace } = vi.hoisted(() => ({
  crearTienda: vi.fn(),
  telefonoExiste: vi.fn(async () => false),
  replace: vi.fn(),
}));

vi.mock('@/composables/useTiendas', () => ({
  useTiendas: () => ({ crearTienda, telefonoExiste }),
}));
vi.mock('@/composables/usePassword', async (original) => ({
  // se conservan los límites reales; solo se sustituye el hash, que es lento
  ...(await original<Record<string, unknown>>()),
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
}));
vi.mock('@/router', () => ({ default: { replace, push: vi.fn(), back: vi.fn() } }));
vi.mock('@/composables/useCodigoPostal', () => ({
  buscarPorCP: vi.fn(async () => null),
  coloniasPorMunicipioConOrigen: vi.fn(async () => ({ colonias: [], origen: 'ninguna' })),
}));
vi.mock('@/composables/useLugar', () => ({
  obtenerMunicipios: vi.fn(async () => [
    { id: 'm1', municipio: 'Guadalajara', alcance: true },
    { id: 'm2', municipio: 'San Martín de Hidalgo', estado: 'Jalisco', alcance: true },
  ]),
  obtenerPueblosPorMunicipio: vi.fn(async () => []),
  obtenerTodosPueblos: vi.fn(async () => []),
  tieneAlcance: () => true,
}));
vi.mock('@/composables/useCategorias', () => ({
  obtenerCategorias: vi.fn(async () => [{ id: 'c1', nombre: 'Comida' }]),
}));
vi.mock('@/composables/useConfiguracion', () => ({
  useConfiguracion: () => ({
    configuracion: { value: { registro: { tiendasAbierto: true, mensajeCerrado: 'cerrado' } } },
    registroTiendasAbierto: { value: true },
    contactoSoporte: { value: '' },
  }),
}));

import StoreRegister from '@/modules/store/views/StoreRegister.vue';

/** Monta la pantalla ya en el último paso, con el formulario dado por válido. */
async function montarEnPasoFinal() {
  const wrapper = mount(StoreRegister, {
    global: { stubs: { TopBarFija: true } },
  });
  await flush();
  // validateStep no valida nada en el paso 5, así que basta con situarse ahí.
  (wrapper.vm as any).step = 5;
  await wrapper.vm.$nextTick();
  return wrapper;
}

const botonFinalizar = (wrapper: any) =>
  wrapper.findAll('button').find((b: any) => /Finalizar|Registrando/.test(b.text()));

beforeEach(() => {
  vi.clearAllMocks();
  telefonoExiste.mockResolvedValue(false);
  replace.mockClear();
});

describe('StoreRegister: no duplicar la tienda', () => {
  it('varios toques seguidos en Finalizar crean UNA sola tienda', async () => {
    // crearTienda tarda, como en la vida real (subida de imágenes)
    let resolver!: () => void;
    crearTienda.mockImplementation(
      () => new Promise<void>((r) => { resolver = () => r(); })
    );

    const wrapper = await montarEnPasoFinal();
    const boton = botonFinalizar(wrapper);

    // Cuatro toques impacientes mientras el primero sigue en vuelo
    boton!.trigger('click');
    boton!.trigger('click');
    boton!.trigger('click');
    boton!.trigger('click');
    await flush();

    expect(crearTienda).toHaveBeenCalledTimes(1);

    resolver();
    await flush();
    expect(crearTienda).toHaveBeenCalledTimes(1);
  });

  it('mientras registra, el botón se deshabilita y avisa que está trabajando', async () => {
    let resolver!: () => void;
    crearTienda.mockImplementation(
      () => new Promise<void>((r) => { resolver = () => r(); })
    );

    const wrapper = await montarEnPasoFinal();
    expect(botonFinalizar(wrapper)!.text()).toContain('Finalizar');

    botonFinalizar(wrapper)!.trigger('click');
    await flush();
    await wrapper.vm.$nextTick();

    const boton = botonFinalizar(wrapper)!;
    expect(boton.attributes('disabled')).toBeDefined();
    expect(boton.text()).toContain('Registrando');

    resolver();
    await flush();
  });

  it('si el teléfono ya existe no crea nada, regresa al paso 3 y deja reintentar', async () => {
    telefonoExiste.mockResolvedValue(true);

    const wrapper = await montarEnPasoFinal();
    await botonFinalizar(wrapper)!.trigger('click');
    await flush();
    await wrapper.vm.$nextTick();

    expect(crearTienda).not.toHaveBeenCalled();
    expect((wrapper.vm as any).step).toBe(3);
    // el candado se suelta: se puede corregir el teléfono y volver a intentar
    expect((wrapper.vm as any).enviando).toBe(false);
  });
});

describe('StoreRegister: aviso de registro correcto', () => {
  it('muestra el toast de éxito y luego manda al login', async () => {
    vi.useFakeTimers();
    crearTienda.mockResolvedValue('tienda-1');

    const wrapper = mount(StoreRegister, { global: { stubs: { TopBarFija: true } } });
    await vi.advanceTimersByTimeAsync(0);
    (wrapper.vm as any).step = 5;
    await wrapper.vm.$nextTick();

    await botonFinalizar(wrapper)!.trigger('click');
    await vi.advanceTimersByTimeAsync(0);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('¡Tienda registrada con éxito!');
    // el aviso se ve un momento antes de cambiar de pantalla
    expect(replace).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1800);
    expect(replace).toHaveBeenCalledWith('/store/login');

    vi.useRealTimers();
  });

  it('si crearTienda falla, avisa del error y deja volver a intentar', async () => {
    crearTienda.mockRejectedValue(new Error('sin red'));

    const wrapper = await montarEnPasoFinal();
    await botonFinalizar(wrapper)!.trigger('click');
    await flush();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Ocurrió un error al registrar la tienda');
    expect((wrapper.vm as any).enviando).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});

/**
 * Enlace a las redes: la casilla "Agregar enlace" y su campo.
 * Lo capturado se guarda normalizado (https) y las casillas no viajan a la base.
 */
describe('StoreRegister · enlace a redes sociales', () => {
  it('sin marcar la casilla, el enlace se guarda vacío', async () => {
    crearTienda.mockResolvedValue('t1');
    const wrapper = await montarEnPasoFinal();
    (wrapper.vm as any).form.facebook = 'Pastelería Lola';
    await wrapper.vm.$nextTick();

    await botonFinalizar(wrapper)!.trigger('click');
    await flush();

    const datos = crearTienda.mock.calls[0][0] as any;
    expect(datos.facebook).toBe('Pastelería Lola');
    expect(datos.facebookUrl).toBe('');
  });

  it('con la casilla marcada, el enlace se guarda normalizado a https', async () => {
    crearTienda.mockResolvedValue('t1');
    const wrapper = await montarEnPasoFinal();
    const form = (wrapper.vm as any).form;
    form.facebook = 'Pastelería Lola';
    form.conEnlaceFacebook = true;
    form.facebookUrl = 'facebook.com/lola';
    form.instagram = 'lola.ig';
    form.conEnlaceInstagram = true;
    form.instagramUrl = 'https://instagram.com/lola';
    await wrapper.vm.$nextTick();

    await botonFinalizar(wrapper)!.trigger('click');
    await flush();

    const datos = crearTienda.mock.calls[0][0] as any;
    expect(datos.facebookUrl).toBe('https://facebook.com/lola');
    expect(datos.instagramUrl).toBe('https://instagram.com/lola');
    // las casillas son del formulario, no de la tienda
    expect(datos.conEnlaceFacebook).toBeUndefined();
    expect(datos.conEnlaceInstagram).toBeUndefined();
  });

  it('un enlace peligroso no se guarda', async () => {
    crearTienda.mockResolvedValue('t1');
    const wrapper = await montarEnPasoFinal();
    const form = (wrapper.vm as any).form;
    form.facebook = 'Lola';
    form.conEnlaceFacebook = true;
    form.facebookUrl = 'javascript:alert(1)';
    await wrapper.vm.$nextTick();

    await botonFinalizar(wrapper)!.trigger('click');
    await flush();

    const datos = crearTienda.mock.calls[0][0] as any;
    expect(datos.facebookUrl).toBe('');
  });
});

/**
 * El C.P. sigue a la colonia.
 *
 * El catálogo guardado en la app trae el código postal de cada colonia de los
 * 125 municipios de Jalisco, así que al elegirla ya no hay que buscarlo: antes
 * casi todas las tiendas terminaban con el C.P. de la cabecera. Es la dirección
 * contraria al autocompletado por C.P., que sigue apagado porque dependía de una
 * API que se cayó.
 */
describe('StoreRegister · el C.P. sigue a la colonia', () => {
  beforeEach(() => {
    // el composable entrega el catálogo del municipio (no llama a la API)
    vi.mocked(coloniasPorMunicipioConOrigen).mockImplementation(async (m: string) => ({
      colonias: await coloniasDeMunicipio(m),
      origen: 'catalogo' as const,
    }));
  });
  afterEach(() => {
    vi.mocked(coloniasPorMunicipioConOrigen).mockImplementation(async () => ({
      colonias: [],
      origen: 'ninguna' as const,
    }));
  });

  /** Deja la pantalla en el paso de dirección, con el municipio ya elegido */
  async function montarEnDireccion(municipio = 'San Martín de Hidalgo') {
    const wrapper = mount(StoreRegister, { global: { stubs: { TopBarFija: true } } });
    await flush();
    const vm = wrapper.vm as any;
    vm.step = 2;
    await vm.seleccionarMunicipio({ id: 'm2', municipio, estado: 'Jalisco', alcance: true });
    await flush();
    return { wrapper, vm };
  }

  it('al elegir la colonia de la lista, escribe su C.P.', async () => {
    const { wrapper, vm } = await montarEnDireccion();

    await wrapper.find('#pueblo').trigger('focus');
    const opcion = wrapper.findAll('.autocomplete-list li').find((li) => li.text() === 'Lagunillas');
    await opcion!.trigger('click');
    await flush();

    expect(vm.form.colonia).toBe('Lagunillas');
    expect(vm.form.cp).toBe('46794');
    expect((wrapper.find('#cp').element as HTMLInputElement).value).toBe('46794');
  });

  it('funciona en cualquier municipio, no solo en San Martín', async () => {
    const { vm } = await montarEnDireccion('Ameca');

    vm.seleccionarPueblo('Ameca Centro');
    await flush();
    expect(vm.form.cp).toBe('46600');

    // la misma colonia en otro municipio tiene otro C.P., y se respeta
    vm.seleccionarPueblo('Lagunillas');
    await flush();
    expect(vm.form.cp).toBe('46719'); // la Lagunillas de Ameca, no la de San Martín
  });

  it('si se cambia de colonia, el C.P. cambia con ella', async () => {
    const { vm } = await montarEnDireccion();

    vm.seleccionarPueblo('Lagunillas');
    await flush();
    expect(vm.form.cp).toBe('46794');

    vm.seleccionarPueblo('Venustiano Carranza'); // se equivocó y corrige
    await flush();
    expect(vm.form.cp).toBe('46777');
  });

  it('escribir el nombre completo, sin abrir la lista, también llena el C.P.', async () => {
    const { wrapper, vm } = await montarEnDireccion();

    await wrapper.find('#pueblo').setValue('trapiche de abra'); // como lo teclee, sin acentos ni mayúsculas
    await flush();

    expect(vm.form.cp).toBe('46776');
  });

  it('si el padrón le da varios C.P. a esa colonia, no toca el que capturó la tienda', async () => {
    const { vm } = await montarEnDireccion('Guadalajara');
    vm.form.cp = '44100';

    vm.seleccionarPueblo('San Antonio'); // está en 44170, 44257 y 44800
    await flush();

    expect(vm.form.colonia).toBe('San Antonio');
    expect(vm.form.cp).toBe('44100'); // lo suyo se respeta: adivinar sería peor
  });
});
