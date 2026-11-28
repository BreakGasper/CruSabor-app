/**
 * Servicios · módulo 3: catálogo del trabajo de la tienda, detalle con botón «Cotizar» (nunca «agregar al carrito»)
 * y el ciclo completo de la cotización (solicitud del cliente → respuesta de la tienda → aceptar o rechazar).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, routerMock, swalMock, recorteMock } from './setup';
import { guardarSesion, cerrarSesion } from '@/utils/sessionUser';

const subirImagen = vi.fn(async (_f: File) => 'https://img/nueva.jpg');
const eliminarImagenes = vi.fn(async (_u: any) => {});
vi.mock('@/composables/useCloudinary', async (original) => ({
  ...(await original<any>()),
  uploadImage: (f: File) => subirImagen(f),
  eliminarImagenes: (u: any) => eliminarImagenes(u),
}));

import {
  etiquetaPrecio,
  etiquetaDuracion,
  etiquetaModalidad,
  modalidadesPermitidas,
  validarServicio,
  normalizarServicio,
  servicioVacio,
  guardarServicio,
  alternarServicio,
  eliminarServicio,
  puedeCotizar,
  sePuedeAgendar,
  ErrorServicio,
  type DatosServicio,
} from '@/modules/servicios/catalogo';
import {
  validarSolicitud,
  validarRespuesta,
  crearCotizacion,
  responderCotizacion,
  marcarEnRevision,
  rechazarComoTienda,
  rechazarComoCliente,
  aceptarCotizacion,
  completarCotizacion,
  enlaceWhatsappCotizacion,
  cotizacionesPorAtender,
  vigenciaSugerida,
} from '@/modules/servicios/cotizaciones';
import CatalogoServicios from '@/modules/servicios/components/CatalogoServicios.vue';
import ServicioDetalle from '@/modules/servicios/views/ServicioDetalle.vue';
import SolicitarCotizacion from '@/modules/servicios/views/SolicitarCotizacion.vue';
import MisServicios from '@/modules/servicios/views/MisServicios.vue';
import CotizacionesTienda from '@/modules/servicios/views/CotizacionesTienda.vue';
import MisCotizaciones from '@/modules/servicios/views/MisCotizaciones.vue';
import StoreProfile from '@/modules/store/views/StoreProfile.vue';

const T = 'tS';
const AHORA = new Date('2026-12-01T18:00:00Z'); // 1 dic 2026, 12:00 en México
const tienda = (extra: Record<string, any> = {}) => ({
  nombreTienda: 'Barbería Lalo',
  estatus: 'activa',
  telefono: '3751241116',
  tipoNegocio: 'servicios',
  categoriaServicio: 'barberia',
  modalidadAtencion: 'ambas',
  colonia: 'Centro',
  municipio: 'Ameca',
  membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' },
  ...extra,
});
const servicio = (extra: Record<string, any> = {}) => ({
  nombre: 'Corte clásico',
  descripcion: 'Corte a tijera y máquina',
  fotos: ['https://img/a.jpg', 'https://img/b.jpg'],
  categoria: 'barberia',
  tipoPrecio: 'desde',
  precio: 150,
  duracionMin: 45,
  modalidad: 'ambas',
  contratacion: 'cotizacion',
  activo: true,
  orden: 1,
  creadoEn: '2026-11-01T00:00:00Z',
  ...extra,
});
const cliente = { id: 'c1', nombre: 'Ana Pérez', telefono: '3312345678' };
const base = (): DatosServicio => ({ ...servicioVacio('ambas'), nombre: 'Peinado de novia', categoria: 'peinados', descripcion: 'Con prueba previa', contratacion: 'cotizacion', tipoPrecio: 'cotizar' });

beforeEach(() => {
  __reset({ tiendas: { [T]: tienda(), tProd: { nombreTienda: 'Tienda de pan', estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } } }, servicios: { [T]: { s1: servicio(), s2: servicio({ nombre: 'Barba', orden: 2, activo: false, tipoPrecio: 'fijo', precio: 80, duracionMin: 30 }) } } });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  subirImagen.mockClear();
  eliminarImagenes.mockClear();
  routeMock.params = { id: T, tiendaId: T, servicioId: 's1' };
  routeMock.query = {};
});
let limpiar: Array<() => void> = [];
afterEach(() => {
  limpiar.forEach((f) => f());
  limpiar = [];
  cerrarSesion();
  localStorage.clear();
});
const duenio = () => localStorage.setItem('tiendas', JSON.stringify({ id: T }));
const sesionCliente = () => guardarSesion({ id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono, domicilio: 'Calle 5 #10', colonia: 'Centro', municipio: 'Ameca' });
const stubs = { PageHeader: true };
function montar(comp: any, props: Record<string, any> = {}) {
  const w = mount(comp, { props, global: { stubs } });
  limpiar.push(() => w.unmount());
  return w;
}
const listo = async () => { await flushPromises(); await flushPromises(); };

/* ============================== Datos del catálogo ============================== */
describe('presentación', () => {
  it('etiquetaPrecio: fijo, desde y a cotizar', () => {
    expect(etiquetaPrecio({ tipoPrecio: 'fijo', precio: 350 })).toBe('$350');
    expect(etiquetaPrecio({ tipoPrecio: 'fijo', precio: 1500 })).toBe('$1,500');
    expect(etiquetaPrecio({ tipoPrecio: 'desde', precio: 350.5 })).toBe('Desde $350.5');
    expect(etiquetaPrecio({ tipoPrecio: 'cotizar', precio: 0 })).toBe('A cotizar');
    expect(etiquetaPrecio({ tipoPrecio: 'fijo', precio: 0 })).toBe('A cotizar');
  });
  it('etiquetaDuracion', () => {
    expect([45, 60, 90, 120].map(etiquetaDuracion)).toEqual(['45 min', '1 h', '1 h 30 min', '2 h']);
    expect(etiquetaDuracion(0)).toBe('');
    expect(etiquetaDuracion(undefined)).toBe('');
  });
  it('modalidades y formas de contratar', () => {
    expect(etiquetaModalidad('ambas')).toBe('En establecimiento y a domicilio');
    expect(etiquetaModalidad('domicilio')).toBe('A domicilio');
    expect(etiquetaModalidad('local')).toBe('En establecimiento');
    expect(puedeCotizar({ contratacion: 'cotizacion' }) && puedeCotizar({ contratacion: 'ambas' }) && !puedeCotizar({ contratacion: 'cita' })).toBe(true);
    expect(sePuedeAgendar({ contratacion: 'cita' }) && sePuedeAgendar({ contratacion: 'ambas' }) && !sePuedeAgendar({ contratacion: 'cotizacion' })).toBe(true);
  });
});

describe('validarServicio', () => {
  it('un servicio completo es válido', () => {
    expect(validarServicio(base())).toEqual({});
  });
  it('exige nombre, categoría y precio cuando no es a cotizar', () => {
    const e = validarServicio({ ...base(), nombre: ' ', categoria: '', tipoPrecio: 'fijo', precio: 0 });
    expect(Object.keys(e).sort()).toEqual(['categoria', 'nombre', 'precio']);
  });
  it('si se puede agendar, la duración es obligatoria y múltiplo de 15', () => {
    expect(validarServicio({ ...base(), tipoPrecio: 'fijo', precio: 100, contratacion: 'ambas', duracionMin: 0 }).duracionMin).toBeTruthy();
    expect(validarServicio({ ...base(), tipoPrecio: 'fijo', precio: 100, contratacion: 'cita', duracionMin: 50 }).duracionMin).toBeTruthy();
    expect(validarServicio({ ...base(), tipoPrecio: 'fijo', precio: 100, contratacion: 'cita', duracionMin: 45 })).toEqual({});
    expect(validarServicio({ ...base(), duracionMin: 20 }).duracionMin).toBeTruthy(); // solo cotización: opcional, pero si hay debe ser válida
  });
  it('un servicio a cotizar no puede ser "solo cita"', () => {
    expect(validarServicio({ ...base(), contratacion: 'cita', duracionMin: 60 }).contratacion).toMatch(/cotización/);
  });
  it('un servicio no puede ir más allá de dónde atiende la tienda', () => {
    expect(modalidadesPermitidas('local')).toEqual(['local']);
    expect(modalidadesPermitidas('ambas')).toEqual(['local', 'domicilio', 'ambas']);
    expect(validarServicio({ ...base(), modalidad: 'domicilio' }, 'local').modalidad).toBeTruthy();
    expect(validarServicio({ ...base(), modalidad: 'local' }, 'local')).toEqual({});
  });
  it('máximo de fotos', () => {
    expect(validarServicio({ ...base(), fotos: Array.from({ length: 7 }, (_, i) => `https://i/${i}`) }).fotos).toBeTruthy();
  });
  it('normalizarServicio: sin undefined, precio 0 si es a cotizar, sin duración si no hay', () => {
    const n = normalizarServicio({ ...base(), precio: 99, nombre: '  Peinado  ' });
    expect(n).toMatchObject({ nombre: 'Peinado', precio: 0, tipoPrecio: 'cotizar', activo: true });
    expect('duracionMin' in n).toBe(false);
    expect(Object.values(n).includes(undefined)).toBe(false);
  });
});

describe('guardar, ocultar y eliminar servicios', () => {
  it('crea un servicio con fecha y orden, y lo deja visible', async () => {
    const id = await guardarServicio(T, null, base(), 'ambas');
    expect(__getAt(`servicios/${T}/${id}`)).toMatchObject({ nombre: 'Peinado de novia', tipoPrecio: 'cotizar', contratacion: 'cotizacion', activo: true });
    expect(typeof __getAt(`servicios/${T}/${id}/creadoEn`)).toBe('string');
    expect(typeof __getAt(`servicios/${T}/${id}/orden`)).toBe('number');
  });

  it('con datos inválidos no guarda y explica por qué', async () => {
    await expect(guardarServicio(T, null, { ...base(), nombre: '' })).rejects.toThrow(/nombre/);
    expect(Object.keys(__getAt(`servicios/${T}`))).toHaveLength(2);
  });

  it('sin membresía vigente no se publica (igual que los productos)', async () => {
    __reset({ tiendas: { [T]: tienda({ membresia: { plan: 'mensual', vigenteHasta: '2020-01-01' } }) }, servicios: {} });
    await expect(guardarServicio(T, null, base())).rejects.toThrow(/membresía vigente/);
  });

  it('al editar conserva fecha y orden, y borra las fotos que se quitaron', async () => {
    const datos: DatosServicio = { nombre: 'Corte clásico', descripcion: 'x', fotos: ['https://img/a.jpg'], categoria: 'barberia', tipoPrecio: 'fijo', precio: 200, duracionMin: 45, modalidad: 'ambas', contratacion: 'cotizacion', activo: true };
    await guardarServicio(T, 's1', datos);
    expect(__getAt(`servicios/${T}/s1`)).toMatchObject({ precio: 200, tipoPrecio: 'fijo', orden: 1, creadoEn: '2026-11-01T00:00:00Z' });
    expect(eliminarImagenes).toHaveBeenCalledWith(['https://img/b.jpg']);
  });

  it('quitar la duración al editar la borra del servicio', async () => {
    await guardarServicio(T, 's1', { nombre: 'Corte', descripcion: '', fotos: [], categoria: 'barberia', tipoPrecio: 'cotizar', precio: 0, duracionMin: 0, modalidad: 'ambas', contratacion: 'cotizacion', activo: true });
    expect(__getAt(`servicios/${T}/s1/duracionMin`)).toBeUndefined();
  });

  it('ocultar / mostrar y eliminar (con sus fotos)', async () => {
    await alternarServicio(T, 's1', false);
    expect(__getAt(`servicios/${T}/s1/activo`)).toBe(false);
    await eliminarServicio(T, 's1');
    expect(__getAt(`servicios/${T}/s1`)).toBeUndefined();
    expect(eliminarImagenes).toHaveBeenCalledWith(['https://img/a.jpg', 'https://img/b.jpg']);
  });
});

/* ============================== Cotizaciones: lógica ============================== */
describe('validarSolicitud / validarRespuesta', () => {
  const sol = (extra: Record<string, any> = {}) => ({ servicio: { id: 's1', nombre: 'Corte', modalidad: 'ambas' }, cliente, descripcion: 'Quiero un corte degradado con barba', imagenes: [], adomicilio: false, ...extra });
  it('válida con lo mínimo', () => expect(validarSolicitud(sol(), '2026-12-01')).toEqual({}));
  it('descripción corta o sin sesión', () => {
    expect(validarSolicitud(sol({ descripcion: 'hola' }), '2026-12-01').descripcion).toBeTruthy();
    expect(validarSolicitud(sol({ cliente: { id: '' } }), '2026-12-01').cliente).toBeTruthy();
  });
  it('fecha tentativa válida y no pasada', () => {
    expect(validarSolicitud(sol({ fechaTentativa: '2026-12-05' }), '2026-12-01')).toEqual({});
    expect(validarSolicitud(sol({ fechaTentativa: '2026-11-30' }), '2026-12-01').fechaTentativa).toBeTruthy();
    expect(validarSolicitud(sol({ fechaTentativa: 'mañana' }), '2026-12-01').fechaTentativa).toBeTruthy();
  });
  it('a domicilio pide dirección; un servicio solo local no lo admite', () => {
    expect(validarSolicitud(sol({ adomicilio: true }), '2026-12-01').direccion).toBeTruthy();
    expect(validarSolicitud(sol({ adomicilio: true, direccion: 'Calle 5 #10, Centro' }), '2026-12-01')).toEqual({});
    expect(validarSolicitud(sol({ adomicilio: true, direccion: 'Calle 5 #10', servicio: { id: 's1', nombre: 'x', modalidad: 'local' } }), '2026-12-01').adomicilio).toBeTruthy();
  });
  it('máximo de imágenes', () => {
    expect(validarSolicitud(sol({ imagenes: ['1', '2', '3', '4', '5'] }), '2026-12-01').imagenes).toBeTruthy();
  });
  it('respuesta: precio positivo y vigencia no pasada', () => {
    expect(validarRespuesta({ precio: 450, venceEl: '2026-12-08' }, '2026-12-01')).toEqual({});
    expect(validarRespuesta({ precio: 0, venceEl: '2026-12-08' }, '2026-12-01').precio).toBeTruthy();
    expect(validarRespuesta({ precio: 450, venceEl: '2026-11-30' }, '2026-12-01').venceEl).toBeTruthy();
    expect(vigenciaSugerida(AHORA)).toBe('2026-12-08');
  });
});

describe('ciclo de la cotización', () => {
  const pedir = (extra: Record<string, any> = {}) =>
    crearCotizacion(T, { servicio: { id: 's1', nombre: 'Corte clásico', modalidad: 'ambas' }, cliente, descripcion: 'Quiero un corte degradado y barba', imagenes: ['https://img/ref.jpg'], adomicilio: false, ...extra }, AHORA);
  const doc = (id: string) => __getAt(`cotizaciones/${T}/${id}`);

  it('crear: queda pendiente, con copias de la tienda, índice del cliente y resumen del cliente', async () => {
    const id = await pedir({ fechaTentativa: '2026-12-10', adomicilio: true, direccion: 'Calle 5 #10, Centro' });
    expect(doc(id)).toMatchObject({
      estado: 'pendiente',
      tiendaNombre: 'Barbería Lalo',
      tiendaTelefono: '3751241116',
      servicioId: 's1',
      clienteId: 'c1',
      clienteNombre: 'Ana Pérez',
      adomicilio: true,
      direccion: 'Calle 5 #10, Centro',
      fechaTentativa: '2026-12-10',
      imagenes: ['https://img/ref.jpg'],
    });
    expect(Object.values(doc(id).historial)).toMatchObject([{ estado: 'pendiente', por: 'cliente' }]);
    expect(__getAt(`cotizacionesPorCliente/c1/${id}`)).toEqual({ tiendaId: T });
    expect(__getAt(`clientesServicio/${T}/c1`)).toMatchObject({ nombre: 'Ana Pérez', cotizaciones: 1, citas: 0 });
    expect(Object.values(doc(id)).includes(undefined)).toBe(false);
  });

  it('el resumen del cliente cuenta cada cotización', async () => {
    await pedir();
    await pedir();
    expect(__getAt(`clientesServicio/${T}/c1/cotizaciones`)).toBe(2);
  });

  it('no se puede pedir a una tienda que no ofrece servicios, que no existe o que no está disponible', async () => {
    await expect(crearCotizacion('tProd', { servicio: { id: 's1', nombre: 'x' }, cliente, descripcion: 'Quiero algo muy especial', imagenes: [], adomicilio: false }, AHORA)).rejects.toThrow(/no ofrece servicios/);
    await expect(crearCotizacion('nada', { servicio: { id: 's1', nombre: 'x' }, cliente, descripcion: 'Quiero algo muy especial', imagenes: [], adomicilio: false }, AHORA)).rejects.toThrow(/ya no existe/);
    __reset({ tiendas: { [T]: tienda({ estatus: 'bloqueada' }) } });
    await expect(pedir()).rejects.toThrow(/no está disponible/);
  });

  it('tope de solicitudes abiertas por cliente y tienda', async () => {
    for (let i = 0; i < 5; i++) await pedir();
    await expect(pedir()).rejects.toThrow(/varias cotizaciones abiertas/);
    // otro cliente sí puede
    await expect(crearCotizacion(T, { servicio: { id: 's1', nombre: 'x' }, cliente: { id: 'c2', nombre: 'Beto', telefono: '3300000000' }, descripcion: 'Quiero algo muy especial', imagenes: [], adomicilio: false }, AHORA)).resolves.toBeTruthy();
  });

  it('flujo completo: en revisión → cotizada → aceptada → completada, con historial', async () => {
    const id = await pedir();
    await marcarEnRevision(T, id, AHORA);
    expect(doc(id).estado).toBe('en_revision');
    await responderCotizacion(T, id, { precio: 450.456, descripcion: 'Incluye lavado', condiciones: '50% de anticipo', venceEl: '2026-12-08' }, AHORA);
    expect(doc(id)).toMatchObject({ estado: 'cotizada', respuesta: { precio: 450.46, descripcion: 'Incluye lavado', condiciones: '50% de anticipo', venceEl: '2026-12-08' } });
    await aceptarCotizacion(T, id, AHORA);
    expect(doc(id).estado).toBe('aceptada');
    await completarCotizacion(T, id, AHORA);
    expect(doc(id).estado).toBe('completada');
    const historial = Object.values(doc(id).historial) as any[];
    expect(historial.map((h) => `${h.estado}:${h.por}`).sort()).toEqual(['aceptada:cliente', 'completada:tienda', 'cotizada:tienda', 'en_revision:tienda', 'pendiente:cliente'].sort());
  });

  it('responder directo desde pendiente también vale', async () => {
    const id = await pedir();
    await responderCotizacion(T, id, { precio: 300, venceEl: '2026-12-08' }, AHORA);
    expect(doc(id).estado).toBe('cotizada');
    expect(doc(id).respuesta.descripcion).toBeUndefined();
  });

  it('el cliente no puede aceptar lo que aún no tiene precio, ni la tienda aceptar por él', async () => {
    const id = await pedir();
    await expect(aceptarCotizacion(T, id, AHORA)).rejects.toThrow(/no se puede pasar a «aceptada»/);
    await responderCotizacion(T, id, { precio: 300, venceEl: '2026-12-08' }, AHORA);
    expect(doc(id).estado).toBe('cotizada');
  });

  it('si una parte ya cerró la cotización, la otra recibe un aviso y no la pisa (transacción)', async () => {
    const id = await pedir();
    await responderCotizacion(T, id, { precio: 300, venceEl: '2026-12-08' }, AHORA);
    await rechazarComoCliente(T, id, AHORA);
    await expect(responderCotizacion(T, id, { precio: 500, venceEl: '2026-12-08' }, AHORA)).rejects.toBeInstanceOf(ErrorServicio);
    await expect(aceptarCotizacion(T, id, AHORA)).rejects.toThrow(/ya está «rechazada»/);
    expect(doc(id).estado).toBe('rechazada');
    expect(doc(id).respuesta.precio).toBe(300);
  });

  it('la tienda puede rechazar con motivo; queda en el historial', async () => {
    const id = await pedir();
    await rechazarComoTienda(T, id, 'No trabajo ese estilo', AHORA);
    expect(doc(id).estado).toBe('rechazada');
    expect((Object.values(doc(id).historial) as any[]).some((h) => h.nota === 'No trabajo ese estilo')).toBe(true);
  });

  it('una cotización vencida ya no se puede aceptar', async () => {
    const id = await pedir();
    await responderCotizacion(T, id, { precio: 300, venceEl: '2026-12-02' }, AHORA);
    const despues = new Date('2026-12-05T18:00:00Z');
    await expect(aceptarCotizacion(T, id, despues)).rejects.toThrow(/venció/);
    expect(doc(id).estado).toBe('cotizada'); // el dato no cambia; "vencida" se calcula
  });

  it('cambiar el estado de una cotización que ya no existe avisa', async () => {
    await expect(marcarEnRevision(T, 'fantasma', AHORA)).rejects.toThrow(/ya no existe/);
    expect(__getAt(`cotizaciones/${T}/fantasma`)).toBeUndefined();
  });

  it('WhatsApp: enlace con el celular normalizado, del lado de la tienda o del cliente', () => {
    const c = { servicioNombre: 'Corte', clienteNombre: 'Ana Pérez', tiendaNombre: 'Barbería Lalo' };
    expect(enlaceWhatsappCotizacion('375 124 1116', c, 'tienda')).toMatch(/^https:\/\/wa\.me\/523751241116\?text=/);
    expect(decodeURIComponent(enlaceWhatsappCotizacion('3751241116', c, 'tienda'))).toContain('Hola Ana');
    expect(decodeURIComponent(enlaceWhatsappCotizacion('3751241116', c, 'cliente'))).toContain('Barbería Lalo');
    expect(enlaceWhatsappCotizacion('123', c, 'tienda')).toBe('');
  });

  it('cotizacionesPorAtender cuenta pendientes y en revisión', () => {
    expect(cotizacionesPorAtender([{ estado: 'pendiente' }, { estado: 'en_revision' }, { estado: 'cotizada' }, { estado: 'aceptada' }] as any)).toBe(2);
  });
});

/* ============================== Catálogo en pantalla ============================== */
describe('CatalogoServicios', () => {
  it('el cliente ve solo los servicios activos, con precio y duración; los abre con un toque', async () => {
    const w = montar(CatalogoServicios, { tiendaId: T });
    await listo();
    expect(w.findAll('.tarjeta').length).toBe(1);
    const t = w.find('[data-servicio="s1"]');
    expect(t.text()).toContain('Corte clásico');
    expect(t.text()).toContain('Desde $150');
    expect(t.text()).toContain('45 min');
    expect(t.text()).toContain('Ver y cotizar');
    expect(t.text()).toContain('+1'); // segunda foto
    await t.trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/servicio/${T}/s1`);
  });

  it('la dueña o dueño también ve los ocultos, marcados', async () => {
    const w = montar(CatalogoServicios, { tiendaId: T, esDueno: true });
    await listo();
    expect(w.findAll('.tarjeta').length).toBe(2);
    expect(w.find('[data-servicio="s2"]').text()).toContain('Oculto');
  });

  it('sin servicios: el visitante lo ve claro; la dueña o dueño recibe el botón para agregar el primero', async () => {
    __reset({ tiendas: { [T]: tienda() }, servicios: {} });
    const visitante = montar(CatalogoServicios, { tiendaId: T });
    await listo();
    expect(visitante.find('[data-testid="catalogo-vacio"]').text()).toContain('todavía no publica servicios');
    const dueno = montar(CatalogoServicios, { tiendaId: T, esDueno: true });
    await listo();
    await dueno.find('[data-testid="agregar-primer-servicio"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/servicios/${T}`);
  });

  it('aparece en el perfil de una tienda de servicios y no en una de productos', async () => {
    const perfil = async (id: string, datos: any) => {
      __reset({ tiendas: { [id]: datos, [T]: tienda() }, servicios: { [T]: { s1: servicio() } }, articulos: {}, pedidos: {} });
      routeMock.params = { id };
      const w = mount(StoreProfile, { global: { stubs: { ArrowBack: true, FontAwesomeIcon: true, PageHeader: true } } });
      limpiar.push(() => w.unmount());
      await listo();
      return w;
    };
    const conServicios = await perfil(T, tienda());
    expect(conServicios.find('[data-testid="catalogo-servicios"]').exists()).toBe(true);
    expect(conServicios.text()).toContain('Catálogo de servicios');
    expect(conServicios.text()).toContain('Corte clásico');
    const deProductos = await perfil('tProd', { nombreTienda: 'Tienda de pan', estatus: 'activa', telefono: '3300000000', metodosPago: [], horario: {} });
    expect(deProductos.find('[data-testid="catalogo-servicios"]').exists()).toBe(false);
  });
});

/* ============================== Detalle del servicio ============================== */
describe('ServicioDetalle: «Cotizar» en lugar de «Agregar al carrito»', () => {
  it('muestra el servicio con su galería, precio, datos y la tienda; el botón es «Cotizar» y no hay carrito', async () => {
    const w = montar(ServicioDetalle);
    await listo();
    expect(w.find('[data-testid="detalle-servicio"]').exists()).toBe(true);
    expect(w.findAll('.galeria .foto').length).toBe(2);
    expect(w.find('[data-testid="precio-servicio"]').text()).toBe('Desde $150');
    expect(w.text()).toContain('Corte a tijera y máquina');
    expect(w.text()).toContain('45 min');
    expect(w.find('[data-testid="tarjeta-tienda"]').text()).toContain('Barbería Lalo');
    const boton = w.find('[data-testid="cotizar"]');
    expect(boton.text()).toContain('Cotizar');
    expect(w.text().toLowerCase()).not.toContain('carrito');
    await boton.trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/cotizar/${T}/s1`);
    await w.find('[data-testid="tarjeta-tienda"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/profile/${T}`);
  });

  it('si también se agenda, muestra «Agendar cita» (que lleva a reservar) además de «Cotizar»', async () => {
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ contratacion: 'ambas' }) } } });
    const w = montar(ServicioDetalle);
    await listo();
    expect(w.find('[data-testid="cotizar"]').exists()).toBe(true);
    const cita = w.find('[data-testid="agendar"]');
    expect(cita.attributes('disabled')).toBeUndefined();
    await cita.trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/reservar/${T}/s1`);
  });

  it('un servicio solo de cita no tiene botón de cotizar', async () => {
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ contratacion: 'cita', tipoPrecio: 'fijo' }) } } });
    const w = montar(ServicioDetalle);
    await listo();
    expect(w.find('[data-testid="cotizar"]').exists()).toBe(false);
    expect(w.find('[data-testid="agendar"]').exists()).toBe(true);
  });

  it('un servicio oculto no está disponible para los clientes, pero la dueña o dueño lo ve y no puede cotizarse a sí misma', async () => {
    routeMock.params = { id: T, tiendaId: T, servicioId: 's2' };
    const visitante = montar(ServicioDetalle);
    await listo();
    expect(visitante.find('[data-testid="no-disponible"]').exists()).toBe(true);

    duenio();
    const dueno = montar(ServicioDetalle);
    await listo();
    expect(dueno.find('[data-testid="detalle-servicio"]').exists()).toBe(true);
    expect(dueno.find('[data-testid="vista-dueno"]').exists()).toBe(true);
    expect(dueno.find('[data-testid="cotizar"]').exists()).toBe(false);
    await dueno.find('[data-testid="editar"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/servicios/${T}`);
  });

  it('una tienda que no está disponible no recibe cotizaciones; un servicio de una tienda de solo productos no existe para el cliente', async () => {
    __reset({ tiendas: { [T]: tienda({ estatus: 'bloqueada' }) }, servicios: { [T]: { s1: servicio() } } });
    const w = montar(ServicioDetalle);
    await listo();
    expect(w.find('[data-testid="tienda-no-disponible"]').exists()).toBe(true);
    expect(w.find('[data-testid="cotizar"]').exists()).toBe(false);

    __reset({ tiendas: { [T]: tienda({ tipoNegocio: 'productos' }) }, servicios: { [T]: { s1: servicio() } } });
    const otro = montar(ServicioDetalle);
    await listo();
    expect(otro.find('[data-testid="no-disponible"]').exists()).toBe(true);
  });
});

/* ============================== Solicitud de cotización ============================== */
describe('SolicitarCotizacion', () => {
  it('sin sesión pide iniciar sesión y vuelve aquí después', async () => {
    const w = montar(SolicitarCotizacion);
    await listo();
    expect(w.find('[data-testid="pide-sesion"]').exists()).toBe(true);
    expect(w.find('[data-testid="descripcion"]').exists()).toBe(false);
    await w.find('[data-testid="iniciar-sesion"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: `/cotizar/${T}/s1` } });
  });

  it('con sesión: describe, sube una imagen, elige fecha y envía; queda en «Mis cotizaciones»', async () => {
    sesionCliente();
    const w = montar(SolicitarCotizacion);
    await listo();
    expect(w.find('[data-testid="resumen-servicio"]').text()).toContain('Corte clásico');

    await w.find('[data-testid="descripcion"]').setValue('Quiero un degradado con barba perfilada');
    const input = w.find('[data-testid="archivo-imagenes"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })], configurable: true });
    await input.trigger('change');
    await listo();
    expect(subirImagen).toHaveBeenCalledTimes(1);
    await w.find('[data-testid="fecha"]').setValue('2099-01-15');
    await w.find('form').trigger('submit');
    await listo();

    const [id, c] = Object.entries(__getAt(`cotizaciones/${T}`))[0] as [string, any];
    expect(c).toMatchObject({ estado: 'pendiente', clienteId: 'c1', servicioId: 's1', descripcion: 'Quiero un degradado con barba perfilada', imagenes: ['https://img/nueva.jpg'], fechaTentativa: '2099-01-15' });
    expect(__getAt(`cotizacionesPorCliente/c1/${id}`)).toEqual({ tiendaId: T });
    expect(swalMock.fire.mock.calls[0][0]).toMatchObject({ icon: 'success', title: '¡Solicitud enviada!' });
    expect(routerMock.replace).toHaveBeenCalledWith('/mis-cotizaciones');
  });

  it('con una descripción muy corta no envía y marca el error', async () => {
    sesionCliente();
    const w = montar(SolicitarCotizacion);
    await listo();
    await w.find('[data-testid="descripcion"]').setValue('hola');
    await w.find('form').trigger('submit');
    await listo();
    expect(w.text()).toContain('al menos 10 caracteres');
    expect(__getAt(`cotizaciones/${T}`)).toBeUndefined();
  });

  it('varios toques seguidos en enviar crean UNA sola solicitud', async () => {
    sesionCliente();
    const w = montar(SolicitarCotizacion);
    await listo();
    await w.find('[data-testid="descripcion"]').setValue('Quiero un degradado con barba perfilada');
    w.find('form').trigger('submit');
    w.find('form').trigger('submit');
    w.find('form').trigger('submit');
    await listo();
    expect(Object.keys(__getAt(`cotizaciones/${T}`))).toHaveLength(1);
  });

  it('servicio a domicilio: pide la dirección (propone la del perfil); en "ambas" es opcional', async () => {
    sesionCliente();
    // ambas: casilla
    const w = montar(SolicitarCotizacion);
    await listo();
    expect(w.find('[data-testid="direccion"]').exists()).toBe(false);
    await w.find('[data-testid="domicilio"]').setValue(true);
    expect((w.find('[data-testid="direccion"]').element as HTMLTextAreaElement).value).toBe('Calle 5 #10, Centro, Ameca');
    await w.find('[data-testid="direccion"]').setValue('');
    await w.find('[data-testid="descripcion"]').setValue('Quiero un degradado con barba perfilada');
    await w.find('form').trigger('submit');
    await listo();
    expect(w.text()).toContain('dirección donde se haría');
    expect(__getAt(`cotizaciones/${T}`)).toBeUndefined();

    // solo domicilio: sin casilla, ya viene marcado
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ modalidad: 'domicilio' }) } } });
    const d = montar(SolicitarCotizacion);
    await listo();
    expect(d.find('[data-testid="domicilio"]').exists()).toBe(false);
    expect(d.find('[data-testid="direccion"]').exists()).toBe(true);
  });

  it('un servicio que no admite cotización no muestra el formulario', async () => {
    sesionCliente();
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ contratacion: 'cita', tipoPrecio: 'fijo' }) } } });
    const w = montar(SolicitarCotizacion);
    await listo();
    expect(w.find('[data-testid="no-disponible"]').exists()).toBe(true);
  });
});

/* ============================== Administrar servicios (tienda) ============================== */
describe('MisServicios', () => {
  it('quien no es la tienda no administra: se le pide iniciar sesión', async () => {
    const w = montar(MisServicios);
    await listo();
    expect(w.find('[data-testid="no-es-dueno"]').exists()).toBe(true);
    expect(w.find('[data-testid="form-servicio"]').exists()).toBe(false);
  });

  it('publica un servicio con foto: aparece en la lista y en la base', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await w.find('[data-testid="servicio-nombre"]').setValue('Manicura en gel');
    await w.find('[data-testid="servicio-categoria"]').setValue('unas');
    await w.find('[data-testid="servicio-descripcion"]').setValue('Con diseño incluido');
    await w.find('[data-testid="precio-fijo"]').setValue(true);
    await w.find('[data-testid="servicio-precio"]').setValue('350');
    await w.find('[data-testid="servicio-duracion"]').setValue('60');
    const input = w.find('[data-testid="archivo-fotos"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })], configurable: true });
    await input.trigger('change');
    await listo();
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();

    const nuevo = Object.values(__getAt(`servicios/${T}`)).find((s: any) => s.nombre === 'Manicura en gel') as any;
    expect(nuevo).toMatchObject({ categoria: 'unas', tipoPrecio: 'fijo', precio: 350, duracionMin: 60, fotos: ['https://img/nueva.jpg'], contratacion: 'cotizacion', activo: true });
    expect(w.findAll('.fila').map((f) => f.text()).join('|')).toContain('Manicura en gel');
  });

  it('sin nombre ni categoría no guarda y marca los campos', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();
    expect(w.text()).toContain('Escribe el nombre del servicio');
    expect(w.text()).toContain('Elige una categoría');
    expect(Object.keys(__getAt(`servicios/${T}`))).toHaveLength(2);
  });

  it('edita, oculta y elimina', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-servicio="s1"] [data-testid="editar-servicio"]').trigger('click');
    expect((w.find('[data-testid="servicio-nombre"]').element as HTMLInputElement).value).toBe('Corte clásico');
    await w.find('[data-testid="servicio-nombre"]').setValue('Corte clásico premium');
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();
    expect(__getAt(`servicios/${T}/s1/nombre`)).toBe('Corte clásico premium');

    await w.find('[data-servicio="s1"] [data-testid="alternar-servicio"]').trigger('click');
    await listo();
    expect(__getAt(`servicios/${T}/s1/activo`)).toBe(false);

    await w.find('[data-servicio="s2"] [data-testid="eliminar-servicio"]').trigger('click');
    await listo();
    expect(__getAt(`servicios/${T}/s2`)).toBeUndefined();
  });

  it('una tienda sin membresía vigente recibe el aviso al publicar', async () => {
    duenio();
    __reset({ tiendas: { [T]: tienda({ membresia: { plan: 'mensual', vigenteHasta: '2020-01-01' } }) }, servicios: {} });
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await w.find('[data-testid="servicio-nombre"]').setValue('Peinado');
    await w.find('[data-testid="servicio-categoria"]').setValue('peinados');
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();
    expect(swalMock.fire.mock.calls.at(-1)![0]).toMatchObject({ icon: 'warning', title: 'No se pudo guardar' });
    expect(__getAt(`servicios/${T}`)).toBeUndefined();
  });

  it('una tienda que solo atiende en su local no ofrece modalidad a domicilio', async () => {
    duenio();
    __reset({ tiendas: { [T]: tienda({ modalidadAtencion: 'local' }) }, servicios: {} });
    const w = montar(MisServicios);
    await listo();
    expect(w.find('[data-testid="modalidad-domicilio"]').exists()).toBe(false);
  });
});

/* ============================== Bandeja de la tienda ============================== */
describe('CotizacionesTienda', () => {
  const cot = (extra: Record<string, any> = {}) => ({
    tiendaNombre: 'Barbería Lalo',
    tiendaTelefono: '3751241116',
    servicioId: 's1',
    servicioNombre: 'Corte clásico',
    clienteId: 'c1',
    clienteNombre: 'Ana Pérez',
    clienteTelefono: '3312345678',
    descripcion: 'Quiero un degradado',
    imagenes: ['https://img/ref.jpg'],
    adomicilio: true,
    direccion: 'Calle 5 #10',
    fechaTentativa: '2099-01-15',
    estado: 'pendiente',
    creadaEn: '2026-12-01T12:00:00Z',
    ...extra,
  });
  beforeEach(() => {
    duenio();
    __reset({
      tiendas: { [T]: tienda() },
      cotizaciones: {
        [T]: {
          k1: cot(),
          k2: cot({ servicioNombre: 'Barba', estado: 'cotizada', creadaEn: '2026-11-30T12:00:00Z', respuesta: { precio: 450, venceEl: '2099-12-31', respondidaEn: '' } }),
          k3: cot({ servicioNombre: 'Tinte', estado: 'aceptada', creadaEn: '2026-11-29T12:00:00Z', respuesta: { precio: 600, venceEl: '2099-12-31', respondidaEn: '' } }),
          k4: cot({ servicioNombre: 'Viejo', estado: 'cotizada', creadaEn: '2026-11-01T12:00:00Z', respuesta: { precio: 100, venceEl: '2020-01-01', respondidaEn: '' } }),
        },
      },
    });
  });

  it('quien no es la tienda no ve nada', async () => {
    localStorage.clear();
    const w = montar(CotizacionesTienda);
    await listo();
    expect(w.find('[data-testid="no-es-dueno"]').exists()).toBe(true);
    expect(w.find('[data-cotizacion]').exists()).toBe(false);
  });

  it('lista las solicitudes (más nuevas primero) con cliente, imágenes, domicilio y su estado real (la vencida se marca sola)', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    expect(w.findAll('[data-cotizacion]').map((c) => c.attributes('data-cotizacion'))).toEqual(['k1', 'k2', 'k3', 'k4']);
    const k1 = w.find('[data-cotizacion="k1"]');
    expect(k1.text()).toContain('Ana Pérez');
    expect(k1.text()).toContain('A domicilio: Calle 5 #10');
    expect(k1.find('.imagenes img').attributes('src')).toBe('https://img/ref.jpg');
    expect(k1.find('[data-testid="insignia-estado"]').text()).toBe('Pendiente');
    expect(w.find('[data-cotizacion="k4"] [data-testid="insignia-estado"]').text()).toBe('Vencida');
  });

  it('filtros con su cuenta', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    expect(w.findAll('.filtro').map((f) => f.text().replace(/\s+/g, ' '))).toEqual(['Todas4', 'Por atender1', 'Cotizadas1', 'Aceptadas1', 'Cerradas1']);
    await w.find('[data-filtro="cerradas"]').trigger('click');
    expect(w.findAll('[data-cotizacion]').map((c) => c.attributes('data-cotizacion'))).toEqual(['k4']);
    await w.find('[data-filtro="atender"]').trigger('click');
    expect(w.findAll('[data-cotizacion]').map((c) => c.attributes('data-cotizacion'))).toEqual(['k1']);
  });

  it('cada estado muestra solo las acciones que corresponden', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    const acciones = (id: string) => w.findAll(`[data-cotizacion="${id}"] [data-accion]`).map((a) => a.attributes('data-accion'));
    expect(acciones('k1')).toEqual(['en_revision', 'cotizada', 'rechazada']); // pendiente
    expect(acciones('k2')).toEqual(['rechazada']); // ya cotizada: solo retirarla
    expect(acciones('k3')).toEqual(['completada']); // aceptada
    expect(acciones('k4')).toEqual([]); // vencida
  });

  it('marca en revisión', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    await w.find('[data-cotizacion="k1"] [data-accion="en_revision"]').trigger('click');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k1/estado`)).toBe('en_revision');
    expect(w.find('[data-cotizacion="k1"] [data-testid="insignia-estado"]').text()).toBe('En revisión');
  });

  it('responde con precio, descripción, condiciones y vigencia desde el formulario', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    await w.find('[data-cotizacion="k1"] [data-accion="cotizada"]').trigger('click');
    await w.find('[data-testid="resp-precio"]').setValue('450');
    await w.find('[data-testid="resp-descripcion"]').setValue('Incluye lavado y estilizado');
    await w.find('[data-testid="resp-condiciones"]').setValue('50% de anticipo');
    await w.find('[data-testid="resp-vence"]').setValue('2099-02-01');
    await w.find('form').trigger('submit');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k1`)).toMatchObject({ estado: 'cotizada', respuesta: { precio: 450, descripcion: 'Incluye lavado y estilizado', condiciones: '50% de anticipo', venceEl: '2099-02-01' } });
    expect(w.find('[data-testid="resp-precio"]').exists()).toBe(false); // el formulario se cerró
  });

  it('el formulario de respuesta no envía sin precio', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    await w.find('[data-cotizacion="k1"] [data-accion="cotizada"]').trigger('click');
    await w.find('form').trigger('submit');
    await listo();
    expect(w.text()).toContain('precio mayor a cero');
    expect(__getAt(`cotizaciones/${T}/k1/estado`)).toBe('pendiente');
  });

  it('rechaza con motivo y completa una aceptada', async () => {
    swalMock.fire.mockResolvedValue({ isConfirmed: true, value: 'No trabajo ese estilo' });
    const w = montar(CotizacionesTienda);
    await listo();
    await w.find('[data-cotizacion="k1"] [data-accion="rechazada"]').trigger('click');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k1/estado`)).toBe('rechazada');
    await w.find('[data-cotizacion="k3"] [data-accion="completada"]').trigger('click');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k3/estado`)).toBe('completada');
  });

  it('si el cliente ya cambió la cotización, la tienda recibe el aviso y no se pisa', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    // el cliente la rechaza justo antes de que la tienda actúe
    await rechazarComoCliente(T, 'k2');
    await w.find('[data-cotizacion="k1"] [data-accion="en_revision"]').trigger('click'); // otra distinta: sigue funcionando
    await listo();
    expect(__getAt(`cotizaciones/${T}/k1/estado`)).toBe('en_revision');
    expect(__getAt(`cotizaciones/${T}/k2/estado`)).toBe('rechazada');
  });

  it('botón de WhatsApp al cliente', async () => {
    const w = montar(CotizacionesTienda);
    await listo();
    expect(w.find('[data-cotizacion="k1"] [data-testid="whatsapp"]').attributes('href')).toMatch(/^https:\/\/wa\.me\/523312345678\?text=/);
  });
});

/* ============================== Mis cotizaciones (cliente) ============================== */
describe('MisCotizaciones', () => {
  const cot = (extra: Record<string, any> = {}) => ({
    tiendaNombre: 'Barbería Lalo',
    tiendaTelefono: '3751241116',
    servicioId: 's1',
    servicioNombre: 'Corte clásico',
    clienteId: 'c1',
    clienteNombre: 'Ana Pérez',
    clienteTelefono: '3312345678',
    descripcion: 'Quiero un degradado',
    adomicilio: false,
    estado: 'pendiente',
    creadaEn: '2026-12-01T12:00:00Z',
    ...extra,
  });
  beforeEach(() => {
    sesionCliente();
    __reset({
      tiendas: { [T]: tienda() },
      cotizaciones: {
        [T]: {
          k1: cot(),
          k2: cot({ servicioNombre: 'Barba', estado: 'cotizada', creadaEn: '2026-11-30T12:00:00Z', respuesta: { precio: 450, descripcion: 'Incluye lavado', condiciones: '50% de anticipo', venceEl: '2099-12-31', respondidaEn: '' } }),
          k3: cot({ servicioNombre: 'Viejo', estado: 'cotizada', creadaEn: '2026-11-01T12:00:00Z', respuesta: { precio: 100, venceEl: '2020-01-01', respondidaEn: '' } }),
          otro: cot({ clienteId: 'c9', servicioNombre: 'De otra persona' }),
        },
      },
      cotizacionesPorCliente: { c1: { k1: { tiendaId: T }, k2: { tiendaId: T }, k3: { tiendaId: T } }, c9: { otro: { tiendaId: T } } },
    });
  });

  it('sin sesión pide iniciar sesión', async () => {
    cerrarSesion();
    const w = montar(MisCotizaciones);
    await listo();
    expect(w.find('[data-testid="pide-sesion"]').exists()).toBe(true);
  });

  it('sin cotizaciones lo explica', async () => {
    __reset({ cotizacionesPorCliente: {} });
    const w = montar(MisCotizaciones);
    await listo();
    expect(w.find('[data-testid="sin-cotizaciones"]').exists()).toBe(true);
  });

  it('muestra SOLO las del cliente, con su estado, y la respuesta con precio y condiciones', async () => {
    const w = montar(MisCotizaciones);
    await listo();
    expect(w.findAll('[data-cotizacion]').map((c) => c.attributes('data-cotizacion'))).toEqual(['k1', 'k2', 'k3']);
    expect(w.find('[data-cotizacion="k1"] [data-testid="insignia-estado"]').text()).toBe('Pendiente');
    expect(w.find('[data-cotizacion="k1"]').text()).toContain('está revisando');
    const k2 = w.find('[data-cotizacion="k2"]');
    expect(k2.find('[data-testid="insignia-estado"]').text()).toBe('Cotizada');
    expect(k2.find('[data-testid="respuesta"]').text()).toContain('$450');
    expect(k2.text()).toContain('50% de anticipo');
    expect(w.find('[data-cotizacion="k3"] [data-testid="insignia-estado"]').text()).toBe('Vencida');
    expect(w.text()).not.toContain('De otra persona');
  });

  it('solo se puede aceptar o rechazar una cotizada y vigente', async () => {
    const w = montar(MisCotizaciones);
    await listo();
    expect(w.findAll('[data-cotizacion="k2"] [data-accion]').map((a) => a.attributes('data-accion'))).toEqual(['aceptar', 'rechazar']);
    expect(w.find('[data-cotizacion="k1"] [data-accion]').exists()).toBe(false);
    expect(w.find('[data-cotizacion="k3"] [data-accion]').exists()).toBe(false); // vencida
  });

  it('acepta una cotización: queda aceptada y se ofrece contactar a la tienda', async () => {
    const w = montar(MisCotizaciones);
    await listo();
    await w.find('[data-cotizacion="k2"] [data-accion="aceptar"]').trigger('click');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k2/estado`)).toBe('aceptada');
    const k2 = w.find('[data-cotizacion="k2"]');
    expect(k2.find('[data-testid="insignia-estado"]').text()).toBe('Aceptada');
    expect(k2.text()).toContain('se pondrá en contacto');
    expect(k2.find('[data-testid="whatsapp"]').attributes('href')).toMatch(/^https:\/\/wa\.me\/523751241116/);
  });

  it('rechaza una cotización', async () => {
    const w = montar(MisCotizaciones);
    await listo();
    await w.find('[data-cotizacion="k2"] [data-accion="rechazar"]').trigger('click');
    await listo();
    expect(__getAt(`cotizaciones/${T}/k2/estado`)).toBe('rechazada');
  });

  it('si la tienda la retiró mientras tanto, avisa y muestra el estado real', async () => {
    const w = montar(MisCotizaciones);
    await listo();
    await rechazarComoTienda(T, 'k2'); // la tienda la retira antes de que el cliente toque «Aceptar»
    await w.find('[data-cotizacion="k2"] [data-accion="aceptar"]').trigger('click');
    await listo();
    expect(swalMock.fire.mock.calls.at(-1)![0]).toMatchObject({ icon: 'warning', title: 'No se pudo actualizar' });
    expect(__getAt(`cotizaciones/${T}/k2/estado`)).toBe('rechazada');
    expect(w.find('[data-cotizacion="k2"] [data-testid="insignia-estado"]').text()).toBe('Rechazada');
  });
});

describe('MisServicios: diálogo para agregar y editar', () => {
  it('muestra primero la lista con el botón «＋ Agregar servicio»; el formulario no ocupa la pantalla', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    expect(w.find('[data-testid="agregar-servicio"]').text()).toContain('Agregar servicio');
    expect(w.findAll('.fila').length).toBeGreaterThan(0);
    expect(w.find('[data-testid="dialogo-servicio"]').exists()).toBe(false);
    expect(w.find('[data-testid="form-servicio"]').exists()).toBe(false);
  });

  it('el botón abre el diálogo vacío; Cancelar, ✕ y tocar fuera lo cierran sin guardar', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    const dlg = () => w.find('[data-testid="dialogo-servicio"]');
    expect(dlg().exists()).toBe(true);
    expect(dlg().text()).toContain('Nuevo servicio');
    expect(w.find('[aria-modal="true"]').exists()).toBe(true); // activa el bloqueo del scroll de fondo
    await w.find('[data-testid="servicio-nombre"]').setValue('Borrador');
    await w.find('[data-testid="cancelar-servicio"]').trigger('click');
    expect(dlg().exists()).toBe(false);
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    expect((w.find('[data-testid="servicio-nombre"]').element as HTMLInputElement).value).toBe(''); // no conserva el borrador
    await w.find('[data-testid="cerrar-dialogo"]').trigger('click');
    expect(dlg().exists()).toBe(false);
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await dlg().trigger('click'); // el fondo
    expect(dlg().exists()).toBe(false);
  });

  it('al guardar un servicio nuevo el diálogo se cierra y queda en la lista', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await w.find('[data-testid="servicio-nombre"]').setValue('Tinte completo');
    await w.find('[data-testid="servicio-categoria"]').setValue('unas');
    await w.find('[data-testid="precio-cotizar"]').setValue(true);
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();
    expect(w.find('[data-testid="dialogo-servicio"]').exists()).toBe(false);
    expect(w.findAll('.fila').map((f) => f.text()).join('|')).toContain('Tinte completo');
  });

  it('un servicio incompleto no cierra el diálogo y marca los campos', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    await w.find('[data-testid="guardar-servicio"]').trigger('click');
    await listo();
    expect(w.find('[data-testid="dialogo-servicio"]').exists()).toBe(true);
    expect(w.findAll('.error').length).toBeGreaterThan(0);
  });

  it('«Editar» abre el mismo diálogo con los datos del servicio', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-servicio="s1"] [data-testid="editar-servicio"]').trigger('click');
    expect(w.find('[data-testid="dialogo-servicio"]').text()).toContain('Editar servicio');
    expect((w.find('[data-testid="servicio-nombre"]').element as HTMLInputElement).value).toBe('Corte clásico');
  });
});

describe('Fotos: recorte básico al elegirlas', () => {
  const elegir = async (w: any, archivos: File[]) => {
    const input = w.find('[data-testid="archivo-fotos"]');
    Object.defineProperty(input.element, 'files', { value: archivos, configurable: true });
    await input.trigger('change');
    await listo();
  };
  const jpg = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
  beforeEach(() => {
    recorteMock.recortarFotos.mockClear();
    recorteMock.recortarFotos.mockImplementation(async (fs: File[]) => fs);
  });

  it('cada foto pasa por el recorte (4:3) antes de subirse, y se sube la recortada', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    const recortada = jpg('recortada.jpg');
    recorteMock.recortarFotos.mockImplementation(async () => [recortada]);
    await elegir(w, [jpg('a.jpg'), jpg('b.jpg')]);
    expect(recorteMock.recortarFotos).toHaveBeenCalledWith(expect.any(Array), '4:3');
    expect(subirImagen).toHaveBeenCalledTimes(1);
    expect(subirImagen).toHaveBeenCalledWith(recortada);
  });

  it('si se cancela el recorte no se sube nada', async () => {
    duenio();
    const w = montar(MisServicios);
    await listo();
    await w.find('[data-testid="agregar-servicio"]').trigger('click');
    recorteMock.recortarFotos.mockImplementation(async () => []);
    await elegir(w, [jpg('a.jpg')]);
    expect(subirImagen).not.toHaveBeenCalled();
  });
});
