import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AvisoProteccion from '@/components/AvisoProteccion.vue';
import {
  AVISOS_ENTREGA, AVISOS_PEDIDO, AVISOS_TIENDA, FECHA_TERMINOS, TEXTO_ACEPTO_PEDIDO, URL_PRIVACIDAD, URL_TERMINOS, VERSION_TERMINOS, aceptacionActual,
} from '@/legal/avisos';

const html = (f: string) => readFileSync(resolve(__dirname, '../public', f), 'utf8');

describe('avisos de protección', () => {
  it('al hacer un pedido: trato directo, pago a la tienda, nada de pedir dinero y límite de responsabilidad', () => {
    const t = AVISOS_PEDIDO.map((a) => `${a.titulo} ${a.texto}`).join(' ');
    expect(AVISOS_PEDIDO.map((a) => a.id)).toEqual(['trato-directo', 'pago', 'fraude', 'responsabilidad']);
    expect(t).toMatch(/trato (directo )?entre tú y la tienda|directo con la tienda/i);
    expect(t).toMatch(/no cobra, no recibe ni procesa el pago/i);
    expect(t).toMatch(/nunca te pediremos pagos, depósitos, claves, códigos ni datos bancarios/i);
    expect(t).toMatch(/no se hace responsable/i);
  });

  it('al recibir: revisar, pagar solo a la tienda y a quién reclamar', () => {
    expect(AVISOS_ENTREGA.map((a) => a.id)).toEqual(['revisar', 'pago-entrega', 'reclamos']);
    expect(AVISOS_ENTREGA.map((a) => a.texto).join(' ')).toMatch(/no cobra ni pide pagos por separado/i);
  });

  it('las tiendas aceptan información veraz y trato directo', () => {
    expect(AVISOS_TIENDA.length).toBeGreaterThanOrEqual(2);
    expect(AVISOS_TIENDA.map((a) => a.texto).join(' ')).toMatch(/no cobra por ti ni responde por tus ventas/i);
  });

  it('la casilla de aceptar menciona los Términos, el trato directo y que Crustore no es responsable', () => {
    expect(TEXTO_ACEPTO_PEDIDO).toMatch(/Términos y condiciones/);
    expect(TEXTO_ACEPTO_PEDIDO).toMatch(/trato directo con la tienda/);
    expect(TEXTO_ACEPTO_PEDIDO).toMatch(/no es responsable/);
  });

  it('cada aceptación guarda la versión y la fecha', () => {
    const a = aceptacionActual(new Date('2026-12-01T10:00:00Z'));
    expect(a).toEqual({ version: VERSION_TERMINOS, fecha: '2026-12-01T10:00:00.000Z' });
  });

  it('el componente muestra todos los avisos y los enlaces a los Términos y a la Privacidad', () => {
    const w = mount(AvisoProteccion, { props: { avisos: AVISOS_PEDIDO } });
    for (const a of AVISOS_PEDIDO) expect(w.find(`[data-testid="aviso-${a.id}"]`).text()).toContain(a.titulo);
    const enlaces = w.findAll('a').map((x) => x.attributes('href'));
    expect(enlaces).toEqual([URL_TERMINOS, URL_PRIVACIDAD]);
    expect(mount(AvisoProteccion, { props: { avisos: AVISOS_ENTREGA, conEnlaces: false } }).findAll('a')).toHaveLength(0);
  });
});

describe('página de Términos y condiciones (public/terminos.html)', () => {
  const t = html('terminos.html');

  it('tiene la misma versión y fecha que usa la app para registrar las aceptaciones', () => {
    expect(t).toContain(`Versión ${VERSION_TERMINOS}`);
    expect(t).toContain(FECHA_TERMINOS);
  });

  it('dice lo importante: intermediario, trato directo, no cobra ni pide dinero, y límite de responsabilidad', () => {
    const plano = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(plano).toMatch(/intermediario tecnológico/);
    expect(plano).toMatch(/no vendemos/i);
    expect(plano).toMatch(/trato directo/);
    expect(plano).toMatch(/Crustore no cobra, no recibe ni procesa el pago/);
    expect(plano).toMatch(/Crustore nunca te solicitará/);
    expect(plano).toMatch(/no es responsable/);
    expect(plano).toMatch(/PROFECO/);
  });

  it('cubre las secciones que debe tener y enlaza con la privacidad', () => {
    for (const id of ['que-es', 'aceptacion', 'cuentas', 'pedidos', 'pagos', 'entrega', 'cancelaciones', 'tiendas', 'clientes', 'prohibido', 'contenido', 'whatsapp', 'responsabilidad', 'suspension', 'privacidad', 'cambios', 'ley', 'contacto']) {
      expect(t, id).toContain(`id="${id}"`);
    }
    expect(t).toContain('href="/privacidad.html"');
    expect(html('privacidad.html')).toContain('href="/terminos.html"');
  });

  it('el plazo de cancelación que dice coincide con el de la app', async () => {
    const { MINUTOS_LIMITE_CANCELACION_CLIENTE } = await import('@/composables/usePedidos');
    expect(t).toContain(`primeros ${MINUTOS_LIMITE_CANCELACION_CLIENTE} minutos`);
  });
});
