/**
 * Simulación de usuario real sobre los componentes montados:
 *  - TIENDA en StorePedidos: clic en "Marcar enviado", "Marcar entregado" y "Cancelar".
 *  - CLIENTE en PedidoDetalle: seguimiento, botón "Cancelar pedido" y su bloqueo.
 * Firebase y SweetAlert están simulados; Dexie corre sobre IndexedDB en memoria.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock, routerMock } from './setup';
import { sessionUser } from '@/utils/sessionUser';
import { guardarPedidos } from '@/composables/usePedidos';

vi.mock('@/composables/useAuth', () => ({
  fetchUsuarioById: vi.fn(async (id: string) => ({
    id,
    nombre: 'Carlos Cliente',
    celular: '3751234567',
    calleNumero: 'Av. Siempre Viva #742',
    municipio: 'Ameca',
    estado: 'Jalisco',
    codigoPostal: '46600',
  })),
}));
vi.mock('@/composables/useTiendas', () => ({
  useTiendas: () => ({
    obtenerTienda: vi.fn(async (id: string) => ({ tiendaId: id, nombreTienda: `Tienda ${id}` })),
  }),
}));

import StorePedidos from '@/modules/store/views/StorePedidos.vue';
import PedidoDetalle from '@/modules/home/components/PedidoDetalle.vue';

const CLIENTE = 'cliente-1';
const TIENDA_A = 'tienda-A';
const TIENDA_B = 'tienda-B';
const domicilio = { calle: 'Av. Siempre Viva', numero: '742', colonia: 'Centro', municipio: 'Ameca', estado: 'Jalisco', cp: '46600' };

async function crearPedidoMixto() {
  sessionUser.value = { id: CLIENTE, nombre: 'Carlos Cliente' };
  return guardarPedidos(
    [
      { id_articulo: 'art-1', sku: 'CHO-1', cantidad: 2, id_tienda: TIENDA_A, precio: 45, nombre: 'Chocoflan', url: '' },
      { id_articulo: 'art-3', sku: 'CAF-1', cantidad: 1, id_tienda: TIENDA_B, precio: 30, nombre: 'Café', url: '' },
    ],
    'Efectivo',
    domicilio,
  );
}

const stubs = { FontAwesomeIcon: true, ArrowBack: true, transition: false };
const textos = (w: any, sel: string) => w.findAll(sel).map((n: any) => n.text().replace(/\s+/g, ' ').trim());

beforeEach(() => {
  __reset({
    articulos: {
      'art-1': { nombre: 'Chocoflan', tiendaId: TIENDA_A, variantes: [{ sku: 'CHO-1', stock: 5, precio: 45 }] },
      'art-3': { nombre: 'Café', tiendaId: TIENDA_B, variantes: [{ sku: 'CAF-1', stock: -1, precio: 30 }] },
    },
    pedidos: {},
  });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  routerMock.push.mockClear();
});

describe('TIENDA · StorePedidos', () => {
  async function montar(idTienda = TIENDA_A) {
    const w = mount(StorePedidos, { props: { id_tienda: idTienda }, global: { stubs } });
    await flushPromises();
    await flushPromises();
    return w;
  }

  it('lista el pedido con el estatus de SU tienda y las acciones de preparación', async () => {
    const id = await crearPedidoMixto();
    const w = await montar();

    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.status').text()).toBe('En preparación');
    expect(w.text()).toContain('Carlos Cliente');
    expect(w.text()).toContain(id);
    // solo su artículo y su total
    expect(w.find('.total').text()).toBe('$90');
    expect(textos(w, '.acciones-estatus button')).toEqual(['Cancelar', '🚚 Marcar enviado']);
    w.unmount();
  });

  it('flujo feliz: Marcar enviado → Marcar entregado, con historial visible y persistencia', async () => {
    const id = await crearPedidoMixto();
    const w = await montar();

    // 1) enviar (el diálogo confirma)
    await w.find('.acciones-estatus .primary').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(swalMock.fire).toHaveBeenCalledTimes(2); // confirmación + toast de éxito
    expect(__getAt(`pedidos/${id}/estatusPorTienda/${TIENDA_A}`)).toBe('Enviado');
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Enviado');
    expect(w.find('.status').text()).toBe('En camino');
    expect(textos(w, '.acciones-estatus button')).toEqual(['Cancelar', '✅ Marcar entregado']);

    // 2) expandir y ver historial
    await w.find('.card-header').trigger('click');
    await flushPromises();
    const historial = textos(w, '.timeline-item strong');
    expect(historial).toEqual(['En preparación', 'En camino']);
    expect(w.text()).toContain('· Tienda');

    // 3) entregar
    await w.find('.acciones-estatus .success').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(__getAt(`pedidos/${id}/estatusPorTienda/${TIENDA_A}`)).toBe('Entregado');
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Enviado'); // la tienda B sigue pendiente

    // el pedido sale de "Por entregar" y aparece en "Entregados"
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(textos(w, '.tab-count')).toEqual(['0', '1', '0']);
    await w.findAll('.tab')[1].trigger('click');
    expect(w.find('.status').text()).toBe('Entregado');
    expect(w.findAll('.acciones-estatus button')).toHaveLength(0);
    expect(w.find('.final-label').text()).toContain('Entregado');
    w.unmount();
  });

  it('si la tienda cierra el diálogo sin confirmar, no cambia nada', async () => {
    const id = await crearPedidoMixto();
    swalMock.fire.mockResolvedValue({ isConfirmed: false, value: undefined });
    const w = await montar();

    await w.find('.acciones-estatus .primary').trigger('click');
    await flushPromises();

    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Preparacion');
    expect(w.find('.status').text()).toBe('En preparación');
    w.unmount();
  });

  it('cancelar con motivo devuelve el stock de la tienda y registra quién canceló', async () => {
    const id = await crearPedidoMixto();
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(3);
    swalMock.fire.mockResolvedValue({ isConfirmed: true, value: 'Sin insumos' });
    const w = await montar();

    await w.find('.acciones-estatus .danger').trigger('click');
    await flushPromises();
    await flushPromises();

    // el diálogo fue de cancelación con campo de motivo
    const args = swalMock.fire.mock.calls[0][0] as any;
    expect(args.title).toMatch(/Cancelar/);
    expect(args.input).toBe('text');

    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5);
    expect(__getAt(`pedidos/${id}/estatusPorTienda/${TIENDA_A}`)).toBe('Cancelado');
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Preparacion'); // B sigue viva
    const hist = __getAt(`pedidos/${id}/historial`) as any[];
    expect(hist.at(-1)).toMatchObject({ estatus: 'Cancelado', por: 'tienda', tiendaId: TIENDA_A, nota: 'Sin insumos' });

    // se mueve a la pestaña "Cancelados"
    expect(textos(w, '.tab-count')).toEqual(['0', '0', '1']);
    await w.findAll('.tab')[2].trigger('click');
    expect(w.find('.status').text()).toBe('Cancelado');
    expect(w.find('.final-label').text()).toContain('Cancelado');
    w.unmount();
  });

  it('pestañas y filtros (cliente, artículo, # pedido, fechas, pago, orden) sobre el estatus de la tienda', async () => {
    await crearPedidoMixto();
    const w = await montar();

    // pestañas con conteos
    expect(textos(w, '.tab-count')).toEqual(['1', '0', '0']);
    await w.findAll('.tab')[1].trigger('click');
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(w.text()).toContain('Aún no has entregado');
    await w.findAll('.tab')[0].trigger('click');
    expect(w.findAll('.pedido-card')).toHaveLength(1);

    // buscador: cliente, artículo y número de pedido
    const buscar = w.find('input[type=search]');
    await buscar.setValue('carlos');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    await buscar.setValue('chocoflan');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    await buscar.setValue('café'); // artículo de la otra tienda: no cuenta
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(w.text()).toContain('Ningún pedido coincide');
    expect(w.find('.filter-badge').text()).toBe('1');
    await buscar.setValue('');

    // rango de fechas y método de pago
    const [desde] = w.findAll('input[type=date]');
    await desde.setValue('2999-01-01');
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    await desde.setValue('');
    const [pago, orden] = w.findAll('select');
    expect(pago.findAll('option').map((o: any) => o.text())).toEqual(['Cualquier pago', 'Efectivo']);
    await pago.setValue('Efectivo');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    await orden.setValue('mayor');
    expect(w.find('.filter-badge').text()).toBe('2');

    // limpiar
    await w.find('.icon-btn.limpiar').trigger('click');
    expect(w.find('.filter-badge').exists()).toBe(false);
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    w.unmount();
  });

  it('la otra tienda ve el mismo pedido con su propio estatus independiente', async () => {
    const id = await crearPedidoMixto();
    const wA = await montar(TIENDA_A);
    await wA.find('.acciones-estatus .primary').trigger('click'); // A envía
    await flushPromises();
    wA.unmount();

    const wB = await montar(TIENDA_B);
    expect(wB.find('.status').text()).toBe('En preparación'); // B no se ve afectada
    expect(wB.find('.total').text()).toBe('$30');
    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Enviado');
    wB.unmount();
  });

  it('se actualiza en vivo cuando el pedido cambia desde otro lado', async () => {
    const id = await crearPedidoMixto();
    const w = await montar();
    expect(w.find('.status').text()).toBe('En preparación');

    // el cliente cancela mientras la tienda tiene la pantalla abierta
    const { cancelarPedidoCliente, getPedidoById } = await import('@/composables/usePedidos');
    await cancelarPedidoCliente((await getPedidoById(id))!, 'Cambio de planes');
    await flushPromises();
    await flushPromises();

    // en vivo: desaparece de "Por entregar" y el contador de "Cancelados" sube
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(textos(w, '.tab-count')).toEqual(['0', '0', '1']);
    await w.findAll('.tab')[2].trigger('click');
    expect(w.find('.status').text()).toBe('Cancelado');
    expect(w.findAll('.acciones-estatus button')).toHaveLength(0);
    w.unmount();
  });
});

describe('CLIENTE · PedidoDetalle', () => {
  async function montar(id: string) {
    routeMock.params = { id };
    const w = mount(PedidoDetalle, { global: { stubs } });
    await flushPromises();
    await flushPromises();
    return w;
  }

  it('muestra seguimiento en preparación, estatus por tienda y permite cancelar', async () => {
    const id = await crearPedidoMixto();
    swalMock.fire.mockResolvedValue({ isConfirmed: true, value: 'Ya no lo necesito' });
    const w = await montar(id);

    expect(w.find('.badge').text()).toBe('En preparación');
    expect(textos(w, '.step-label')).toEqual(['En preparación', 'En camino', 'Entregado']);
    expect(w.findAll('.step.done')).toHaveLength(1);
    expect(w.findAll('.por-tienda li')).toHaveLength(2); // dos tiendas
    expect(w.find('.btn-cancelar').exists()).toBe(true);

    await w.find('.btn-cancelar').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(__getAt(`pedidos/${id}/estatus`)).toBe('Cancelado');
    expect(__getAt(`pedidos/${id}/canceladoPor`)).toBe('cliente');
    expect(__getAt(`pedidos/${id}/motivoCancelacion`)).toBe('Ya no lo necesito');
    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(5); // stock devuelto

    expect(w.find('.cancelado-msg').text()).toContain('cancelado');
    expect(w.find('.cancelado-msg').text()).toContain('por ti');
    expect(w.find('.btn-cancelar').exists()).toBe(false);
    w.unmount();
  });

  it('cuando una tienda ya envió, avanza el seguimiento y NO deja cancelar', async () => {
    const id = await crearPedidoMixto();
    const { actualizarEstatusTienda, getPedidoById } = await import('@/composables/usePedidos');
    await actualizarEstatusTienda((await getPedidoById(id))!, TIENDA_A, 'Enviado');

    const w = await montar(id);
    expect(w.find('.badge').text()).toBe('En camino');
    expect(w.findAll('.step.done')).toHaveLength(2);
    expect(w.find('.btn-cancelar').exists()).toBe(false);
    expect(w.find('.hint').text()).toMatch(/ya va en camino/);

    // el historial lista ambos eventos, el más reciente primero
    expect(textos(w, '.historial li strong')).toEqual(['En camino', 'En preparación']);
    w.unmount();
  });

  it('no muestra pedidos de otro usuario', async () => {
    const id = await crearPedidoMixto();
    sessionUser.value = { id: 'intruso' };
    const w = await montar(id);
    expect(w.text()).toContain('Cargando pedido');
    expect(w.find('.badge').exists()).toBe(false);
    w.unmount();
  });
});
