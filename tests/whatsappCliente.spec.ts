import { describe, it, expect } from 'vitest';
import { enlaceWhatsappCliente, mensajeParaCliente, numeroParaWhatsapp } from '@/utils/whatsappCliente';
import { LEYENDA_BAJO_PEDIDO, LEYENDA_BAJO_PEDIDO_CORTA } from '@/constants/bajoPedido';

describe('numeroParaWhatsapp: celulares de México', () => {
  it('10 dígitos → 52 + número, con cualquier formato', () => {
    for (const c of ['3751234567', '375 123 4567', '(375) 123-4567', '+52 375 123 4567', '52 3751234567', '521 375 123 4567', '5213751234567']) {
      expect(numeroParaWhatsapp(c), c).toBe('523751234567');
    }
  });
  it('lo que no sirve da vacío', () => {
    for (const c of ['', null, undefined, '-', '12345', '37512345678901', 'abc', '+1 415 555 0100']) expect(numeroParaWhatsapp(c as any), String(c)).toBe('');
  });
});

describe('mensaje y enlace para contactar al cliente', () => {
  it('saluda con el primer nombre, dice de qué tienda y pedido, y menciona lo bajo pedido', () => {
    const m = mensajeParaCliente({ cliente: 'Carlos Pérez López', tienda: 'Dulce Hogar', idPedido: '-Nabc123456789', articulosBajoPedido: ['Pastel de boda', 'Piñata'] });
    expect(m).toBe('Hola Carlos, te escribimos de Dulce Hogar por tu pedido en Crustore (pedido 456789). Es sobre tu artículo bajo pedido: Pastel de boda, Piñata. Queremos confirmar contigo los detalles.');
    expect(mensajeParaCliente({})).toBe('Hola, te escribimos por tu pedido en Crustore.');
  });

  it('el enlace usa wa.me con el número y el mensaje codificado; sin celular válido no hay enlace', () => {
    const e = enlaceWhatsappCliente('375 123 4567', { cliente: 'Ana', tienda: 'Café & Pan' });
    expect(e.startsWith('https://wa.me/523751234567?text=')).toBe(true);
    expect(decodeURIComponent(e.split('text=')[1])).toBe('Hola Ana, te escribimos de Café & Pan por tu pedido en Crustore.');
    expect(e).not.toMatch(/\s/);
    expect(enlaceWhatsappCliente('', { cliente: 'Ana' })).toBe('');
  });

  it('las leyendas dicen que la tienda se pondrá en contacto y dónde ver el estatus', () => {
    for (const l of [LEYENDA_BAJO_PEDIDO, LEYENDA_BAJO_PEDIDO_CORTA]) {
      expect(l).toMatch(/la tienda se pondrá en contacto/i);
      expect(l).toMatch(/Mis pedidos › Detalle del pedido/);
    }
  });
});
