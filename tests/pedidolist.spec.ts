/**
 * CLIENTE · "Mis Pedidos": pestañas Por entregar / Entregados / Cancelados
 * con los artículos de cada pedido, filtros y modo compacto para el perfil.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { sessionUser } from '@/utils/sessionUser';
import PedidoList from '@/modules/home/components/PedidoList.vue';

const CLIENTE = '1773682851615';
const item = (nombre: string, precio: number, cantidad = 1) => ({
  id_articulo: 'art-' + nombre,
  nombreProducto: nombre,
  precio,
  cantidad,
  categoria: 'Alimentos y Bebidas',
  proveedor: 'tienda-A',
  url_image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
});
const base = {
  id_usuario: CLIENTE,
  metodo_pago: 'Efectivo',
  domicilio: { calleNumero: 'x', lugar: 'x', municipio: 'x', estado: 'x', codigoPostal: 'x' },
};

beforeEach(() => {
  sessionUser.value = { id: CLIENTE };
  routerMock.push.mockClear();
  __reset({
    pedidos: {
      // pedido viejo (formato original de Firebase) en preparación
      '-OqSw9n-uhtVZ0D08fpz': {
        ...base,
        estatus: 'Preparacion',
        fecha_hora: '17/4/2026, 6:14:20 p.m.',
        total_compra: 24,
        items: [item('Mini Chesscake', 24)],
      },
      p2: {
        ...base,
        estatus: 'Enviado',
        fecha_creacion: '2026-05-07T13:16:44.000Z',
        fecha_hora: '7/5/2026, 8:16:44 a.m.',
        total_compra: 589,
        items: [item('Chocoflan', 45, 2), item('Jericalla', 32), item('Mojaditos', 38), item('Varios', 220, 2)],
      },
      p3: {
        ...base,
        estatus: 'Entregado',
        fecha_creacion: '2026-05-01T10:00:00.000Z',
        fecha_hora: '1/5/2026, 5:00:00 a.m.',
        fechaEntrega: '2/5/2026, 3:10:00 p.m.',
        total_compra: 45,
        items: [item('Chocoflan', 45)],
      },
      p4: {
        ...base,
        estatus: 'Cancelado',
        fecha_creacion: '2026-04-20T10:00:00.000Z',
        fecha_hora: '20/4/2026, 5:00:00 a.m.',
        total_compra: 30,
        items: [item('Café', 30)],
      },
      ajeno: { ...base, id_usuario: 'otro', estatus: 'Preparacion', fecha_hora: '1/1/2026, 1:00:00 a.m.', total_compra: 1, items: [item('Ajeno', 1)] },
    },
  });
});

const stubs = { ArrowBack: true, transition: false };
const textos = (w: any, sel: string) => w.findAll(sel).map((n: any) => n.text().replace(/\s+/g, ' ').trim());

async function montar(props: Record<string, any> = {}) {
  const w = mount(PedidoList, { props, global: { stubs } });
  await flushPromises();
  await flushPromises();
  return w;
}

describe('Mis Pedidos', () => {
  it('abre en "Por entregar" con los conteos por pestaña y solo pedidos del usuario', async () => {
    const w = await montar();
    expect(textos(w, '.tab > span:first-child')).toEqual(['Por entregar', 'Entregados', 'Cancelados']);
    expect(textos(w, '.tab-count')).toEqual(['2', '1', '1']);
    expect(w.findAll('.pedido-card')).toHaveLength(2);
    expect(textos(w, '.estatus')).toEqual(['En camino', 'En preparación']); // más reciente primero
    expect(w.text()).not.toContain('Ajeno');
    w.unmount();
  });

  it('muestra los artículos de cada pedido con cantidad, precio, imagen y total', async () => {
    const w = await montar();
    const viejo = w.findAll('.pedido-card')[1];
    expect(viejo.find('.item-nombre').text()).toBe('Mini Chesscake');
    expect(viejo.find('.item-detalle').text()).toContain('1 × $24.00');
    expect(viejo.find('.item-img').attributes('src')).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg');
    expect(viejo.find('.pedido-footer .total').text()).toBe('Total $24.00');
    expect(viejo.find('.resumen').text()).toContain('1 artículo · Efectivo');
    expect(viejo.find('.fecha').text()).toContain('17 abr 2026');
    w.unmount();
  });

  it('colapsa pedidos largos a 3 artículos y permite ver el resto', async () => {
    const w = await montar();
    const largo = w.findAll('.pedido-card')[0];
    expect(largo.findAll('.item')).toHaveLength(3);
    expect(largo.find('.item-more').text()).toContain('1 artículo(s) más');
    expect(largo.find('.resumen').text()).toContain('6 artículos');

    await largo.find('.link-btn').trigger('click');
    expect(largo.findAll('.item')).toHaveLength(4);
    expect(largo.find('.item-more').exists()).toBe(false);
    expect(routerMock.push).not.toHaveBeenCalled(); // el clic no abrió el detalle
    w.unmount();
  });

  it('cambia de pestaña: entregados muestra la fecha de entrega, cancelados el cancelado', async () => {
    const w = await montar();
    await w.findAll('.tab')[1].trigger('click');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.estatus').text()).toBe('Entregado');
    expect(w.find('.entregado-en').text()).toContain('Entregado el 2/5/2026');

    await w.findAll('.tab')[2].trigger('click');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.estatus').text()).toBe('Cancelado');
    expect(w.find('.pedido-card').classes()).toContain('estado-cancelado');
    w.unmount();
  });

  it('filtra por artículo, número de pedido, rango de fechas y pago; ordena por total', async () => {
    const w = await montar();
    const buscar = w.find('input[type=search]');
    const [desde, hasta] = w.findAll('input[type=date]');
    const [pago, orden] = w.findAll('select');

    // por artículo
    await buscar.setValue('jerica');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.estatus').text()).toBe('En camino');
    expect(w.find('.filter-badge').text()).toBe('1');

    // por número de pedido (con o sin #)
    await buscar.setValue('#D08fpz');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.item-nombre').text()).toBe('Mini Chesscake');
    await buscar.setValue('');

    // rango de fechas (solo el 17/4)
    await desde.setValue('2026-04-17');
    await hasta.setValue('2026-04-17');
    expect(w.findAll('.pedido-card')).toHaveLength(1);
    expect(w.find('.item-nombre').text()).toBe('Mini Chesscake');

    await desde.setValue('2030-01-01');
    await hasta.setValue('');
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(w.text()).toContain('Ningún pedido coincide');
    await desde.setValue('');

    // método de pago (opciones derivadas de los datos)
    expect(pago.findAll('option').map((o: any) => o.text())).toEqual(['Cualquier pago', 'Efectivo']);
    await pago.setValue('Efectivo');
    expect(w.findAll('.pedido-card')).toHaveLength(2);

    // orden por total
    await orden.setValue('mayor');
    expect(textos(w, '.pedido-footer .total')).toEqual(['Total $589.00', 'Total $24.00']);
    await orden.setValue('menor');
    expect(textos(w, '.pedido-footer .total')).toEqual(['Total $24.00', 'Total $589.00']);
    expect(w.find('.filter-badge').text()).toBe('2'); // pago + orden

    // limpiar
    await w.find('.icon-btn.limpiar').trigger('click');
    expect(w.find('.filter-badge').exists()).toBe(false);
    expect(w.findAll('.pedido-card')).toHaveLength(2);
    w.unmount();
  });

  it('al tocar un pedido abre su detalle', async () => {
    const w = await montar();
    await w.find('.pedido-card').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith({ name: 'PedidoDetallePage', params: { id: 'p2' } });
    w.unmount();
  });

  it('modo perfil: sin header ni pestañas, los 3 más recientes en fila horizontal', async () => {
    const w = await montar({ showHeader: false, limit: 3, horizontal: true });
    expect(w.find('.header-bar').exists()).toBe(false);
    expect(w.find('.tabs').exists()).toBe(false);
    expect(w.find('.lista').classes()).toContain('horizontal');
    expect(w.findAll('.pedido-card')).toHaveLength(3);
    // orden por fecha, sin importar estatus: 7/5 (En camino), 1/5 (Entregado), 20/4 (Cancelado)
    expect(textos(w, '.estatus')).toEqual(['En camino', 'Entregado', 'Cancelado']);
    w.unmount();
  });

  it('sin sesión no muestra nada y avisa', async () => {
    sessionUser.value = null;
    const w = await montar();
    expect(w.findAll('.pedido-card')).toHaveLength(0);
    expect(w.text()).toContain('No tienes pedidos por entregar');
    w.unmount();
  });
});
