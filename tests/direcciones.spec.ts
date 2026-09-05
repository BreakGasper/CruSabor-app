/**
 * Libreta de direcciones del cliente:
 *  - composable useDirecciones (Firebase en memoria)
 *  - DireccionesList en el perfil (alta, predeterminar, eliminar)
 *  - CartCheckout: seleccionar una dirección guardada o registrar una nueva
 *    y confirmar el pedido con ese domicilio.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routerMock, swalMock } from './setup';
import { withSetup, flush } from './helpers';
import { sessionUser } from '@/utils/sessionUser';
import { db } from '@/db';
import {
  useDirecciones,
  direccionTexto,
  direccionPrincipalDeSesion,
  PRINCIPAL_ID,
} from '@/composables/useDirecciones';
import DireccionesList from '@/modules/home/components/DireccionesList.vue';
import CartCheckout from '@/modules/home/components/CartCheckout.vue';

const CLIENTE = 'cliente-1';
const sesion = {
  id: CLIENTE,
  nombre: 'Carlos',
  domicilio: 'Av. Siempre Viva #742',
  colonia: 'Centro',
  municipio: 'Ameca',
  estado: 'Jalisco',
  codigpostal: '46600',
};
const oficina = {
  alias: 'Oficina',
  calle: 'Reforma',
  numero: '10',
  colonia: 'Juárez',
  municipio: 'Guadalajara',
  estado: 'Jalisco',
  cp: '44100',
  predeterminada: false,
};

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; });

beforeEach(async () => {
  __reset({ articulos: {}, pedidos: {}, usuarios: { [CLIENTE]: { nombre: 'Carlos' } } });
  sessionUser.value = { ...sesion };
  routerMock.push.mockClear();
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  await db.Carrito.clear();
  // history.state vacío: el checkout carga el carrito desde Dexie
  window.history.replaceState(null, '', '/checkout');
});

const stubs = { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, transition: false };

describe('useDirecciones', () => {
  it('expone la dirección del registro como "principal" y la usa como predeterminada', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    cleanups.push(unmount);
    await flush();
    expect(result.direcciones.value).toHaveLength(1);
    expect(result.direcciones.value[0]).toMatchObject({ id: PRINCIPAL_ID, principal: true, calle: 'Av. Siempre Viva', numero: '742', cp: '46600' });
    expect(result.predeterminada.value?.id).toBe(PRINCIPAL_ID);
    expect(direccionTexto(result.predeterminada.value)).toBe('Av. Siempre Viva #742, Centro, Ameca, Jalisco, CP 46600');
  });

  it('agrega, marca predeterminada y elimina sin tocar la del registro', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    cleanups.push(unmount);
    await flush();

    const id = await result.agregar(oficina);
    await flush();
    expect(result.direcciones.value).toHaveLength(2);
    expect(__getAt(`usuarios/${CLIENTE}/direcciones/${id}`)).toMatchObject({ alias: 'Oficina', calle: 'Reforma', cp: '44100' });
    expect(result.predeterminada.value?.id).toBe(PRINCIPAL_ID); // sigue la del registro

    await result.marcarPredeterminada(id);
    await flush();
    expect(result.predeterminada.value?.id).toBe(id);

    // marcar la principal desmarca la guardada
    await result.marcarPredeterminada(PRINCIPAL_ID);
    await flush();
    expect(result.predeterminada.value?.id).toBe(PRINCIPAL_ID);
    expect(__getAt(`usuarios/${CLIENTE}/direcciones/${id}/predeterminada`)).toBe(false);

    await result.eliminar(PRINCIPAL_ID); // no hace nada
    await result.eliminar(id);
    await flush();
    expect(result.direcciones.value).toHaveLength(1);
    expect(sessionUser.value.domicilio).toBe('Av. Siempre Viva #742'); // intacta
  });

  it('permite máximo 3 ubicaciones (incluida la del registro) hasta que se elimina una', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    cleanups.push(unmount);
    await flush();
    expect(result.disponibles.value).toBe(2); // ya está la del registro

    await result.agregar({ ...oficina, alias: 'Oficina' });
    const idEscuela = await result.agregar({ ...oficina, alias: 'Escuela' });
    await flush();
    expect(result.direcciones.value).toHaveLength(3);
    expect(result.puedeAgregar.value).toBe(false);
    expect(result.disponibles.value).toBe(0);

    await expect(result.agregar({ ...oficina, alias: 'Cuarta' })).rejects.toThrow(/Solo puedes tener 3/);
    expect(Object.keys(__getAt(`usuarios/${CLIENTE}/direcciones`))).toHaveLength(2);

    await result.eliminar(idEscuela);
    await flush();
    expect(result.puedeAgregar.value).toBe(true);
    await result.agregar({ ...oficina, alias: 'Cuarta' });
    await flush();
    expect(result.direcciones.value.map((d) => d.alias)).toEqual(['Principal', 'Oficina', 'Cuarta']);
  });

  it('rechaza direcciones incompletas y sin sesión', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    cleanups.push(unmount);
    await expect(result.agregar({ ...oficina, cp: '' })).rejects.toThrow(/Completa/);
    sessionUser.value = null;
    await flush();
    expect(direccionPrincipalDeSesion(null)).toBeNull();
    await expect(result.agregar(oficina)).rejects.toThrow(/autenticado/);
  });
});

describe('Perfil · DireccionesList', () => {
  it('lista, agrega desde el formulario, predetermina y elimina', async () => {
    const w = mount(DireccionesList, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();

    expect(w.findAll('.dir-card')).toHaveLength(1);
    expect(w.find('.dir-card').text()).toContain('Principal');
    expect(w.find('.dir-card').text()).toContain('Predeterminada');

    // abrir formulario y guardar
    await w.find('.btn-agregar').trigger('click');
    const inputs = w.findAll('.dir-form input[type=text]');
    const valores = ['Oficina', 'Reforma', '10', 'Juárez', '44100', 'Guadalajara', 'Jalisco'];
    for (let i = 0; i < valores.length; i++) await inputs[i].setValue(valores[i]);
    await w.find('.dir-form').trigger('submit');
    await flushPromises();
    await flushPromises();

    expect(w.findAll('.dir-card')).toHaveLength(2);
    expect(w.findAll('.dir-card')[1].text()).toContain('Reforma #10, Juárez, Guadalajara, Jalisco, CP 44100');

    // predeterminar la nueva
    await w.findAll('.dir-card')[1].find('.link').trigger('click');
    await flushPromises();
    expect(w.findAll('.dir-card')[1].text()).toContain('Predeterminada');
    expect(w.findAll('.dir-card')[0].text()).not.toContain('Predeterminada');

    // eliminar (confirmado en el diálogo simulado)
    await w.findAll('.dir-card')[1].find('.link.peligro').trigger('click');
    await flushPromises();
    await flushPromises();
    expect(w.findAll('.dir-card')).toHaveLength(1);
  });

  it('al llegar al límite oculta "Agregar" y avisa; al eliminar una vuelve a permitir', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    await result.agregar({ ...oficina, alias: 'Oficina' });
    await result.agregar({ ...oficina, alias: 'Escuela' });
    unmount();

    const w = mount(DireccionesList, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();

    expect(w.find('.contador').text()).toBe('3 de 3 ubicaciones');
    expect(w.find('.btn-agregar').exists()).toBe(false);
    expect(w.find('.limite').text()).toContain('límite de 3');

    await w.findAll('.dir-card')[2].find('.link.peligro').trigger('click');
    await flushPromises();
    await flushPromises();
    expect(w.find('.contador').text()).toBe('2 de 3 ubicaciones');
    expect(w.find('.btn-agregar').exists()).toBe(true);
    expect(w.find('.limite').exists()).toBe(false);
  });

  it('el formulario valida campos obligatorios y el código postal', async () => {
    const w = mount(DireccionesList, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await w.find('.btn-agregar').trigger('click');
    await w.find('.dir-form').trigger('submit');
    expect(w.find('.error-msg').text()).toContain('Completa los campos');

    const inputs = w.findAll('.dir-form input[type=text]');
    const valores = ['Casa', 'Calle', '1', 'Col', '123', 'Mun', 'Edo'];
    for (let i = 0; i < valores.length; i++) await inputs[i].setValue(valores[i]);
    await w.find('.dir-form').trigger('submit');
    expect(w.find('.error-msg').text()).toContain('5 dígitos');
    expect(Object.keys(__getAt(`usuarios/${CLIENTE}/direcciones`) || {})).toHaveLength(0);
  });
});

describe('Checkout · domicilio de entrega', () => {
  async function montarConCarrito() {
    await db.Carrito.add({
      id_articulo: 'art-1', id_usuario: CLIENTE, sku: 's1', cantidad: 2, precio: 45, nombre: 'Chocoflan',
      url: '', detalle: '', id_tienda: 'tienda-A', almacen: '', anticipo: 0, categoria: 'Postres',
      descuentoCupon: 0, estatus: 'Preparacion', fechaEntrega: '', fecha_hora: '', id_pedido: 'p', metodo_pago: 'Efectivo',
    } as any);
    const w = mount(CartCheckout, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    return w;
  }

  it('propone la dirección del registro y permite elegir otra guardada', async () => {
    // una dirección guardada previamente
    const { result, unmount } = withSetup(() => useDirecciones());
    const idOficina = await result.agregar(oficina);
    unmount();

    const w = await montarConCarrito();
    expect(w.find('.domicilio-info').text()).toBe('Av. Siempre Viva #742, Centro, Ameca, Jalisco, CP 46600');
    expect(w.find('.selector-direcciones').exists()).toBe(false);

    await w.find('.change-link').trigger('click');
    expect(w.findAll('.dir-opcion')).toHaveLength(2);
    await w.find(`input[type=radio][value="${idOficina}"]`).setValue();
    await flushPromises();
    expect(w.find('.domicilio-info').text()).toContain('Reforma #10');
    expect(w.find('.dir-opcion.activa').text()).toContain('Oficina');
  });

  it('registra una nueva dirección desde el checkout sin sobreescribir la del registro y la usa en el pedido', async () => {
    const w = await montarConCarrito();

    await w.find('.change-link').trigger('click');
    await w.find('.btn-nueva').trigger('click');
    expect(w.find('.dir-form').exists()).toBe(true);
    expect(w.find('.button-row button').exists()).toBe(false); // sin "Continuar" mientras se captura

    const inputs = w.findAll('.dir-form input[type=text]');
    const valores = ['Casa de mamá', 'Hidalgo', '55', 'La Villa', '46601', 'Ameca', 'Jalisco'];
    for (let i = 0; i < valores.length; i++) await inputs[i].setValue(valores[i]);
    await w.find('.dir-form').trigger('submit');
    await flushPromises();
    await flushPromises();

    // guardada en la libreta y seleccionada
    const guardadas = __getAt(`usuarios/${CLIENTE}/direcciones`) as Record<string, any>;
    expect(Object.values(guardadas)).toHaveLength(1);
    expect(Object.values(guardadas)[0]).toMatchObject({ alias: 'Casa de mamá', calle: 'Hidalgo', numero: '55' });
    expect(sessionUser.value.domicilio).toBe('Av. Siempre Viva #742'); // la del registro no cambia
    expect(w.find('.domicilio-info').text()).toBe('Hidalgo #55, La Villa, Ameca, Jalisco, CP 46601');

    // continuar → pago → resumen → confirmar
    await w.find('.button-row button').trigger('click'); // paso 2
    await w.findAll('.payment-option')[0].trigger('click'); // Efectivo
    await w.find('.button-row button').trigger('click'); // paso 3
    expect(w.find('.resumen-pedido').text()).toContain('Hidalgo #55, La Villa, Ameca, Jalisco, CP 46601');

    await w.find('.button-row button').trigger('click'); // confirmar
    await flushPromises();
    await flushPromises();

    const pedidos = Object.values(__getAt('pedidos') || {}) as any[];
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].domicilio).toEqual({
      calleNumero: 'Hidalgo #55',
      lugar: 'La Villa',
      municipio: 'Ameca',
      estado: 'Jalisco',
      codigoPostal: '46601',
    });
    expect(pedidos[0].metodo_pago).toBe('Efectivo');
    expect(await db.Carrito.count()).toBe(0); // carrito vaciado
  });

  it('con el límite alcanzado, el checkout no ofrece registrar otra dirección', async () => {
    const { result, unmount } = withSetup(() => useDirecciones());
    await result.agregar({ ...oficina, alias: 'Oficina' });
    await result.agregar({ ...oficina, alias: 'Escuela' });
    unmount();

    const w = await montarConCarrito();
    await w.find('.change-link').trigger('click');
    expect(w.findAll('.dir-opcion')).toHaveLength(3);
    expect(w.find('.btn-nueva').exists()).toBe(false);
    expect(w.find('.limite').text()).toContain('máximo de 3');
  });

  it('sin ninguna dirección, obliga a registrar una antes de continuar', async () => {
    sessionUser.value = { id: CLIENTE, nombre: 'Nuevo' }; // sin domicilio en el registro
    const w = await montarConCarrito();
    expect(w.find('.sin-direcciones').exists()).toBe(true);

    await w.find('.button-row button').trigger('click'); // intenta continuar
    await flushPromises();
    const aviso = swalMock.fire.mock.calls[0][0] as any;
    expect(aviso.title).toMatch(/Falta el domicilio/);
    expect(w.find('.payment-options').exists()).toBe(false); // sigue en paso 1
  });
});
