/**
 * Servicios · módulo 2: la tienda elige qué ofrece (productos, servicios o mixto) al registrarse y al editarla,
 * y eso decide qué herramientas ve. Las tiendas anteriores (sin el campo) siguen funcionando como de productos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { flush, withSetup } from './helpers';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';

// --- Dobles para el registro (mismas dependencias pesadas que tests/storeRegister.spec.ts) ---
const { crearTienda } = vi.hoisted(() => ({ crearTienda: vi.fn() }));
vi.mock('@/composables/useTiendas', async (original) => {
  const real = await original<Record<string, any>>();
  // El registro usa un doble de crearTienda; el resto (editar, listar) usa el real contra el mock de la base
  return {
    ...real,
    useTiendas: () => ({ ...real.useTiendas(), crearTienda: (...a: any[]) => crearTienda(...a), telefonoExiste: async () => false }),
  };
});
vi.mock('@/composables/usePassword', async (original) => ({ ...(await original<Record<string, unknown>>()), hashPassword: vi.fn(async (p: string) => `hash:${p}`) }));
vi.mock('@/router', () => ({ default: { replace: vi.fn(), push: vi.fn(), back: vi.fn() } }));
vi.mock('@/composables/cuentaTienda', async (original) => ({ ...(await original<Record<string, unknown>>()), revisarTelefonoNuevaTienda: vi.fn(async () => 'libre') }));
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
    promocionesHabilitadas: { value: false },
    pagoEnLineaDisponible: { value: false },
    pagoAutomatico: { value: false },
  }),
}));
vi.mock('@/composables/useStorage', () => ({
  uploadStoreLogo: vi.fn(async () => 'https://cdn.test/logo.png'),
  uploadStoreBanner: vi.fn(async () => 'https://cdn.test/banner.png'),
  uploadStoreGallery: vi.fn(async () => []),
}));

import StoreRegister from '@/modules/store/views/StoreRegister.vue';
import StoreEditModal from '@/modules/store/components/StoreEditModal.vue';
import StoreProfile from '@/modules/store/views/StoreProfile.vue';
import MenuTienda from '@/modules/store/components/MenuTienda.vue';
import TiendaCard from '@/modules/home/components/TiendaCard.vue';
import AdminTiendas from '@/modules/admin/views/AdminTiendas.vue';
import AdminTiendaDetalle from '@/modules/admin/views/AdminTiendaDetalle.vue';
import { useArticulos } from '@/composables/useArticulos';
import { __setControlPorTienda } from '@/composables/useMembresia';

let limpiar: Array<() => void> = [];
afterEach(() => {
  limpiar.forEach((f) => f());
  limpiar = [];
  localStorage.clear();
  cerrarSesionAdmin();
  __setControlPorTienda(null);
});

/* ============================== Registro ============================== */
describe('Registro de tienda: ¿qué ofreces?', () => {
  async function montar(paso = 1) {
    const w = mount(StoreRegister, { global: { stubs: { TopBarFija: true } } });
    limpiar.push(() => w.unmount());
    await flush();
    (w.vm as any).step = paso;
    await w.vm.$nextTick();
    return w;
  }
  const vm = (w: any) => w.vm as any;
  const botonFinalizar = (w: any) => w.findAll('button').find((b: any) => /Finalizar|Registrando/.test(b.text()));

  beforeEach(() => crearTienda.mockReset());

  it('el paso 1 ofrece Productos, Servicios y Mixto; por defecto Productos', async () => {
    const w = await montar();
    expect(w.find('[data-testid="tipo-negocio"]').exists()).toBe(true);
    expect(w.findAll('.tipo-card').map((c) => c.find('strong').text())).toEqual(['Productos', 'Servicios', 'Mixto']);
    expect((w.find('[data-testid="tipo-productos"]').element as HTMLInputElement).checked).toBe(true);
    // como siempre: categoría del catálogo, sin categoría de servicios
    expect(w.find('[data-testid="categoria-servicio"]').exists()).toBe(false);
    expect(w.text()).toContain('Nombre de la tienda');
  });

  it('con Servicios pide la categoría de servicios (no la de productos) y llama al negocio "negocio o profesional"', async () => {
    const w = await montar();
    await w.find('[data-testid="tipo-servicios"]').setValue(true);
    expect(w.find('[data-testid="categoria-servicio"]').exists()).toBe(true);
    expect(w.findAll('[data-testid="categoria-servicio"] option').length).toBe(14); // la de "Selecciona" + las 13
    expect(w.text()).not.toContain('Categoría de productos');
    expect(w.text()).toContain('Nombre del negocio o profesional');
    expect(w.find('.select-with-icon').exists()).toBe(false); // el select de productos no aparece
  });

  it('con Mixto pide las dos categorías', async () => {
    const w = await montar();
    await w.find('[data-testid="tipo-mixto"]').setValue(true);
    expect(w.text()).toContain('Categoría de productos');
    expect(w.find('.select-with-icon').exists()).toBe(true);
    expect(w.find('[data-testid="categoria-servicio"]').exists()).toBe(true);
  });

  it('el paso 1 exige la categoría que corresponde al tipo', async () => {
    const w = await montar();
    Object.assign(vm(w).form, { nombreTienda: 'Barbería Lalo', descripcion: 'x', password: 'Clave-1234', confirmPassword: 'Clave-1234', logo: new File(['x'], 'l.png'), tipoNegocio: 'servicios' });
    expect(await vm(w).validateStep()).toBe(false);
    expect(vm(w).errors.categoriaServicio).toMatch(/categoría de servicios/);
    expect(vm(w).errors.categoria).toBeUndefined(); // la de productos no se exige

    vm(w).form.categoriaServicio = 'barberia';
    expect(await vm(w).validateStep()).toBe(true);

    vm(w).form.tipoNegocio = 'productos';
    expect(await vm(w).validateStep()).toBe(false);
    expect(vm(w).errors.categoria).toBeTruthy();
  });

  it('paso 4 de servicios: modalidad de atención en lugar de envíos, y título propio', async () => {
    const w = await montar(4);
    // productos: igual que siempre
    expect(w.text()).toContain('Información de venta');
    expect(w.text()).toContain('Ofrezco envíos a domicilio');
    expect(w.find('[data-testid="modalidad-atencion"]').exists()).toBe(false);

    vm(w).form.tipoNegocio = 'servicios';
    await w.vm.$nextTick();
    expect(w.text()).toContain('Atención y horario');
    expect(w.text()).not.toContain('Ofrezco envíos a domicilio');
    expect(w.findAll('[data-testid="modalidad-atencion"] input').map((i) => i.attributes('data-testid'))).toEqual(['modalidad-local', 'modalidad-domicilio', 'modalidad-ambas']);
    expect(w.find('#zona').exists()).toBe(false); // en establecimiento: sin zonas

    await w.find('[data-testid="modalidad-domicilio"]').setValue(true);
    expect(w.find('#zona').exists()).toBe(true);
    expect(w.text()).toContain('zonas de cobertura');
  });

  it('el paso 4 de servicios a domicilio exige al menos una zona de cobertura', async () => {
    const w = await montar(4);
    Object.assign(vm(w).form, { tipoNegocio: 'servicios', modalidadAtencion: 'domicilio', metodosPago: ['Efectivo'], horario: { Lunes: { inicio: '09:00', fin: '18:00' } } });
    expect(await vm(w).validateStep()).toBe(false);
    expect(vm(w).errors.zonas).toMatch(/zona de cobertura/);
    vm(w).form.zonasEntrega = ['Centro'];
    expect(await vm(w).validateStep()).toBe(true);
    // en establecimiento no hace falta
    Object.assign(vm(w).form, { modalidadAtencion: 'local', zonasEntrega: [] });
    expect(await vm(w).validateStep()).toBe(true);
  });

  it('el paso 5 pide especialidades y experiencia solo si ofrece servicios', async () => {
    const w = await montar(5);
    expect(w.find('[data-testid="especialidades"]').exists()).toBe(false);
    vm(w).form.tipoNegocio = 'mixto';
    await w.vm.$nextTick();
    expect(w.find('[data-testid="especialidades"]').exists()).toBe(true);
    expect(w.find('[data-testid="experiencia"]').exists()).toBe(true);
  });

  async function registrar(cambios: Record<string, any>) {
    crearTienda.mockResolvedValue('t-nueva');
    const w = await montar(5);
    vm(w).aceptaTerminosTienda = true;
    Object.assign(vm(w).form, cambios);
    await w.vm.$nextTick();
    await botonFinalizar(w)!.trigger('click');
    await flush();
    expect(crearTienda).toHaveBeenCalledTimes(1);
    return crearTienda.mock.calls[0][0] as any;
  }

  it('guarda una tienda de PRODUCTOS sin campos de servicios (como siempre)', async () => {
    const d = await registrar({ categoria: 'c1', envioDomicilio: true, zonasEntrega: ['Centro'] });
    expect(d.tipoNegocio).toBe('productos');
    expect(d.categoria).toBe('Comida');
    expect(d.categoriaId).toBe('c1');
    expect(d.envioDomicilio).toBe(true);
    expect(d.zonasEntrega).toEqual(['Centro']);
    for (const k of ['modalidadAtencion', 'categoriaServicio', 'especialidades', 'experiencia', 'especialidadesTexto']) expect(k in d, k).toBe(false);
  });

  it('guarda una tienda de SERVICIOS: categoría de servicios, modalidad, cobertura, especialidades y experiencia', async () => {
    const d = await registrar({
      tipoNegocio: 'servicios',
      categoriaServicio: 'barberia',
      modalidadAtencion: 'ambas',
      zonasEntrega: ['Centro', 'Ameca'],
      envioDomicilio: true, // la casilla de envíos de productos no cuenta: lo manda la modalidad
      especialidadesTexto: 'Corte clásico, Barba, corte clásico',
      experiencia: '  10 años cortando pelo  ',
    });
    expect(d).toMatchObject({
      tipoNegocio: 'servicios',
      categoria: 'Barbería y peluquería',
      categoriaId: '',
      categoriaServicio: 'barberia',
      modalidadAtencion: 'ambas',
      envioDomicilio: true,
      zonasEntrega: ['Centro', 'Ameca'],
      especialidades: ['Corte clásico', 'Barba'],
      experiencia: '10 años cortando pelo',
    });
    expect('especialidadesTexto' in d).toBe(false);
  });

  it('servicios en establecimiento: sin envío a domicilio ni zonas aunque quedaran capturadas', async () => {
    const d = await registrar({ tipoNegocio: 'servicios', categoriaServicio: 'unas', modalidadAtencion: 'local', envioDomicilio: true, zonasEntrega: ['Centro'] });
    expect(d.envioDomicilio).toBe(false);
    expect(d.zonasEntrega).toEqual([]);
  });

  it('guarda una tienda MIXTA con las dos categorías', async () => {
    const d = await registrar({ tipoNegocio: 'mixto', categoria: 'c1', categoriaServicio: 'maquillaje', modalidadAtencion: 'local', envioDomicilio: true, zonasEntrega: ['Centro'] });
    expect(d).toMatchObject({ tipoNegocio: 'mixto', categoria: 'Comida', categoriaId: 'c1', categoriaServicio: 'maquillaje', modalidadAtencion: 'local', envioDomicilio: true, zonasEntrega: ['Centro'] });
  });
});

/* ============================== Editar tienda ============================== */
describe('Editar tienda: cambiar lo que ofrece', () => {
  const T = 'tienda-A';
  const base = {
    nombreTienda: 'Barbería Lalo',
    categoria: 'Alimentos y Bebidas',
    descripcion: 'Cortes',
    telefono: '3751241116',
    incluyeWhatsapp: false,
    email: 'lalo@test.com',
    calle: 'Avila Camacho',
    numero: '189',
    colonia: 'El Crucero',
    cp: '46798',
    municipio: 'Ameca',
    estado: 'Jalisco',
    metodosPago: ['Efectivo'],
    envioDomicilio: false,
    zonasEntrega: [] as string[],
    horario: { Lunes: { inicio: '09:00', fin: '18:00' } },
    password: 'HASH',
    logoUrl: 'https://cdn.test/logo.png',
  };
  beforeEach(() => {
    __reset({ tiendas: { [T]: { ...base } } });
    swalMock.fire.mockReset();
    swalMock.fire.mockResolvedValue({ isConfirmed: true });
  });
  function montar(extra: Record<string, any> = {}) {
    const w = mount(StoreEditModal, { props: { visible: true, tienda: { tiendaId: T, ...base, ...extra } as any } });
    limpiar.push(() => w.unmount());
    return w;
  }
  const guardar = async (w: any) => {
    await w.find('form').trigger('submit');
    await flushPromises();
    await flushPromises();
  };

  it('una tienda anterior (sin tipoNegocio) aparece como Productos y todo sigue igual', async () => {
    const w = montar();
    await flushPromises();
    expect((w.find('[data-testid="editar-tipo-productos"]').element as HTMLInputElement).checked).toBe(true);
    expect(w.find('[data-testid="editar-categoria-servicio"]').exists()).toBe(false);
    expect(w.find('[data-testid="editar-modalidad"]').exists()).toBe(false);
    expect(w.findAll('.se-tab').map((t) => t.text())).toContain('Ventas');
    await guardar(w);
    expect(__getAt(`tiendas/${T}/tipoNegocio`)).toBe('productos'); // se deja explícito al guardar
    expect(__getAt(`tiendas/${T}/modalidadAtencion`)).toBeUndefined();
  });

  it('una tienda de servicios muestra su categoría, modalidad y especialidades; la pestaña se llama Atención', async () => {
    const w = montar({ tipoNegocio: 'servicios', categoriaServicio: 'barberia', modalidadAtencion: 'domicilio', zonasEntrega: ['Centro'], envioDomicilio: true, especialidades: ['Barba', 'Degradado'], experiencia: '10 años' });
    await flushPromises();
    expect(w.findAll('.se-tab').map((t) => t.text())).toContain('Atención');
    expect((w.find('[data-testid="editar-categoria-servicio"]').element as HTMLSelectElement).value).toBe('barberia');
    expect((w.find('[data-testid="editar-modalidad-domicilio"]').element as HTMLInputElement).checked).toBe(true);
    expect((w.find('[data-testid="editar-especialidades"]').element as HTMLInputElement).value).toBe('Barba, Degradado');
    expect(w.text()).not.toContain('Hago envíos a domicilio');
    expect(w.text()).toContain('Zonas de cobertura');
  });

  it('guarda los cambios de una tienda de servicios (categoría = la de servicios, envío derivado de la modalidad)', async () => {
    const w = montar({ tipoNegocio: 'servicios', categoriaServicio: 'barberia', modalidadAtencion: 'local' });
    await flushPromises();
    await w.find('[data-testid="editar-modalidad-ambas"]').setValue(true);
    await w.find('[data-testid="editar-especialidades"]').setValue('Barba, Corte, barba');
    await guardar(w);
    expect(__getAt(`tiendas/${T}`)).toMatchObject({
      tipoNegocio: 'servicios',
      categoria: 'Barbería y peluquería',
      categoriaServicio: 'barberia',
      modalidadAtencion: 'ambas',
      envioDomicilio: true,
      especialidades: ['Barba', 'Corte'],
    });
    expect(__getAt(`tiendas/${T}/password`)).toBe('HASH'); // la contraseña no se toca
  });

  it('pasar de Productos a Mixto exige elegir la categoría de servicios, y conserva la de productos', async () => {
    const w = montar();
    await flushPromises();
    await w.find('[data-testid="editar-tipo-mixto"]').setValue(true);
    await guardar(w);
    expect(w.find('.se-error-general').exists()).toBe(true);
    expect(w.find('.se-tab.active').text()).toBe('Datos');
    expect(__getAt(`tiendas/${T}/tipoNegocio`)).toBeUndefined(); // no se guardó

    await w.find('[data-testid="editar-categoria-servicio"]').setValue('unas');
    await guardar(w);
    expect(__getAt(`tiendas/${T}`)).toMatchObject({ tipoNegocio: 'mixto', categoria: 'Alimentos y Bebidas', categoriaServicio: 'unas', modalidadAtencion: 'local' });
  });

  it('avisa que al cambiar a Servicios los artículos dejan de mostrarse (y no se borran)', async () => {
    const w = montar();
    await flushPromises();
    expect(w.text()).not.toContain('tus artículos dejan de mostrarse');
    await w.find('[data-testid="editar-tipo-servicios"]').setValue(true);
    expect(w.text()).toContain('tus artículos dejan de mostrarse');
    expect(w.text()).toContain('no se borran');
  });
});

/* ============================== Menú de la tienda ============================== */
describe('Menú de la tienda según lo que ofrece', () => {
  const montar = (props: Record<string, any>) => {
    const w = mount(MenuTienda, { props: { abierto: true, ...props }, global: { stubs: { teleport: true, transition: false } } });
    limpiar.push(() => w.unmount());
    return w;
  };
  const opciones = (w: any) => w.findAll('.mt-opcion:not(.mt-tienda):not(.mt-salir)').map((b: any) => b.text());

  it('productos (o sin tipo): el menú de siempre', () => {
    for (const tipoNegocio of [undefined, 'productos']) {
      const o = opciones(montar({ esDueno: true, tipoNegocio, promocionesHabilitadas: true }));
      expect(o.join('|')).toMatch(/Mis artículos.*Agregar artículo.*Pedidos.*Crear promoción/);
    }
  });

  it('servicios: sin pedidos, artículos, productos ni promociones; con su panel de servicios', () => {
    const w = montar({ esDueno: true, tipoNegocio: 'servicios', promocionesHabilitadas: true });
    const o = opciones(w).join('|');
    expect(o).toContain('Editar mi tienda');
    expect(o).not.toContain('Crear publicación'); // oculta del menú
    expect(o).not.toContain('Estudio de diseño'); // oculto del menú
    for (const propia of ['Resumen', 'Mis servicios', 'Citas', 'Cotizaciones', 'Clientes', 'Horarios y equipo']) expect(o, propia).toContain(propia);
    for (const fuera of ['Pedidos', 'Agregar artículo', 'Mis artículos', 'Crear promoción']) expect(o, fuera).not.toContain(fuera);
    expect(w.find('[data-testid="menu-servicios-pronto"]').exists()).toBe(false);
  });

  it('el menú se divide en paneles: Mi tienda, Panel de artículos y Panel de servicios', () => {
    const titulos = (w: any) => w.findAll('[data-seccion]').map((x: any) => x.text());
    expect(titulos(montar({ esDueno: true, tipoNegocio: 'productos' }))).toEqual(['Mi tienda', 'Panel de artículos']);
    expect(titulos(montar({ esDueno: true, tipoNegocio: 'servicios' }))).toEqual(['Mi tienda', 'Panel de servicios']);
    expect(titulos(montar({ esDueno: true, tipoNegocio: 'mixto' }))).toEqual(['Mi tienda', 'Panel de artículos', 'Panel de servicios']);
  });

  it('mixto: todo el menú de productos y también el de servicios', () => {
    const o = opciones(montar({ esDueno: true, tipoNegocio: 'mixto' })).join('|');
    expect(o).toMatch(/Mis artículos.*Agregar artículo.*Pedidos/);
    expect(o).toMatch(/Resumen.*Mis servicios.*Citas.*Cotizaciones/);
  });

  it('el visitante de una tienda de servicios no ve Productos ni Mi carrito; el de productos sí', () => {
    const servicios = montar({ esDueno: false, tipoNegocio: 'servicios' }).text();
    expect(servicios).not.toContain('Mi carrito');
    expect(servicios).toContain('Cómo llegar');
    const productos = montar({ esDueno: false }).text();
    expect(productos).toContain('Mi carrito');
    expect(productos).toContain('Productos');
  });
});

/* ============================== Perfil público ============================== */
describe('Perfil público de la tienda', () => {
  const T = 'tienda-A';
  const montar = async (extra: Record<string, any>) => {
    __reset({ tiendas: { [T]: { nombreTienda: 'Barbería Lalo', categoria: 'Barbería y peluquería', descripcion: 'Cortes', telefono: '3751241116', metodosPago: ['Efectivo'], horario: {}, ...extra } }, articulos: {}, pedidos: {} });
    routeMock.params = { id: T };
    const w = mount(StoreProfile, { global: { stubs: { ArrowBack: true, FontAwesomeIcon: true, PageHeader: true, transition: false } } });
    limpiar.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('una tienda de servicios muestra su categoría, modalidad, especialidades y experiencia, y no una sección de productos', async () => {
    const w = await montar({ tipoNegocio: 'servicios', categoriaServicio: 'barberia', modalidadAtencion: 'ambas', especialidades: ['Barba', 'Degradado'], experiencia: '10 años de experiencia' });
    const info = w.find('[data-testid="info-servicios"]');
    expect(info.exists()).toBe(true);
    expect(info.text()).toContain('Barbería y peluquería');
    expect(info.text()).toContain('En establecimiento y a domicilio');
    expect(info.findAll('.servicios-chips li').map((l) => l.text())).toEqual(['Barba', 'Degradado']);
    expect(info.text()).toContain('10 años de experiencia');
    expect(w.find('.productos-section').exists()).toBe(false);
  });

  it('una tienda de productos (o anterior, sin tipo) sigue mostrando sus productos y nada de servicios', async () => {
    for (const extra of [{}, { tipoNegocio: 'productos' }]) {
      const w = await montar(extra);
      expect(w.find('.productos-section').exists()).toBe(true);
      expect(w.find('[data-testid="info-servicios"]').exists()).toBe(false);
    }
  });

  it('una tienda mixta muestra las dos cosas', async () => {
    const w = await montar({ tipoNegocio: 'mixto', categoriaServicio: 'unas', modalidadAtencion: 'local' });
    expect(w.find('[data-testid="info-servicios"]').exists()).toBe(true);
    expect(w.find('.productos-section').exists()).toBe(true);
  });
});

/* ============================== Catálogo público ============================== */
describe('Catálogo de artículos: una tienda de solo servicios no aparece', () => {
  it('oculta los artículos que quedaron de una tienda que pasó a Servicios; mixtas y de productos siguen', async () => {
    __reset({
      articulos: {
        a1: { nombre: 'Pan', tiendaId: 'tP' },
        a2: { nombre: 'Viejo', tiendaId: 'tS' },
        a3: { nombre: 'Crema', tiendaId: 'tM' },
        a4: { nombre: 'Sin control', tiendaId: 'tX' },
      },
    });
    __setControlPorTienda({ tP: { estatus: 'activa' }, tS: { estatus: 'activa', tipoNegocio: 'servicios' }, tM: { estatus: 'activa', tipoNegocio: 'mixto' } });
    const { result, unmount } = withSetup(() => useArticulos());
    limpiar.push(unmount);
    await flush();
    expect(result.articulos.value.map((a) => a.nombre).sort()).toEqual(['Crema', 'Pan', 'Sin control']);

    // la propia tienda ve todos sus artículos (para no perderlos si cambia de opinión)
    const propia = withSetup(() => useArticulos({ incluirTiendasInactivas: true }));
    limpiar.push(propia.unmount);
    await flush();
    expect(propia.result.articulos.value.map((a) => a.nombre)).toContain('Viejo');
  });
});

/* ============================== Tarjeta y admin ============================== */
describe('Etiquetas del tipo de negocio', () => {
  const tarjeta = (tienda: Record<string, any>) => {
    const w = mount(TiendaCard, { props: { tienda: { tiendaId: 't1', nombreTienda: 'X', categoria: 'Cat', ...tienda } as any }, global: { stubs: { RouterLink: true } } });
    limpiar.push(() => w.unmount());
    return w;
  };

  it('la tarjeta de tienda marca los servicios; las de productos quedan como siempre', () => {
    expect(tarjeta({ tipoNegocio: 'servicios' }).find('[data-testid="etiqueta-servicios"]').text()).toContain('Servicios');
    expect(tarjeta({ tipoNegocio: 'mixto' }).find('[data-testid="etiqueta-servicios"]').text()).toContain('Productos y servicios');
    expect(tarjeta({}).find('[data-testid="etiqueta-servicios"]').exists()).toBe(false);
    expect(tarjeta({ tipoNegocio: 'productos' }).find('[data-testid="etiqueta-servicios"]').exists()).toBe(false);
  });

  beforeEach(() => {
    guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
    routeMock.params = { id: 'tS' };
    routeMock.query = {};
    __reset({
      tiendas: {
        tS: { nombreTienda: 'Barbería Lalo', estatus: 'activa', telefono: '3311111111', tipoNegocio: 'servicios', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
        tL: { nombreTienda: 'Tienda Vieja', estatus: 'activa', telefono: '3322222222', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
      },
      articulos: {},
      promociones: {},
    });
  });

  it('el administrador ve el tipo en la lista de tiendas (las anteriores como Productos)', async () => {
    const w = mount(AdminTiendas, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true, PagoMembresiaModal: true } } });
    limpiar.push(() => w.unmount());
    await flushPromises();
    expect(w.find('[data-tienda="tS"] .meta').text()).toContain('Servicios');
    expect(w.find('[data-tienda="tL"] .meta').text()).toContain('Productos');
  });

  it('y en el detalle de la tienda', async () => {
    const w = mount(AdminTiendaDetalle, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true, PagoMembresiaModal: true } } });
    limpiar.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.find('[data-testid="detalle-tipo-negocio"]').text()).toBe('Servicios');
  });
});
