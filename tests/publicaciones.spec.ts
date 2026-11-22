import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('@/services/baseDatos', () => ({
  ref: (_d: any, ruta: string) => ({ ruta }),
  onValue: () => () => {},
  push: () => ({ key: 'nueva' }),
  set: async () => {},
  update: async () => {},
  remove: async () => {},
  get: async () => ({ val: () => null }),
}));

import {
  leerMonto, validarPublicacion, armarTexto, enlaceWhatsapp, enlaceFacebook, enlaceTelegram, porcentajeMenos,
  normalizarPublicacion, plantillaPorId, formatoPorId, PLANTILLAS, FORMATOS, MAX_TITULO, MAX_TEXTO,
} from '@/composables/usePublicaciones';
import { partirLineas } from '@/modules/store/utils/dibujarPublicacion';

describe('publicaciones: reglas', () => {
  it('leerMonto: acepta formas comunes y rechaza lo inválido', () => {
    expect(leerMonto('350')).toBe(350);
    expect(leerMonto('$1,250.50')).toBe(1250.5);
    expect(leerMonto('350 pesos')).toBe(350);
    expect(leerMonto(99)).toBe(99);
    for (const x of ['', 'abc', '0', 0, -5, '$0', 1_000_001, null, undefined, NaN]) expect(leerMonto(x as any), String(x)).toBeNull();
  });

  it('validarPublicacion: título obligatorio, precios coherentes y límites', () => {
    const ok = { titulo: 'Pastel', precio: '350', precioAntes: '450', texto: 'Rico' };
    expect(validarPublicacion(ok)).toEqual([]);
    expect(validarPublicacion({ ...ok, precio: '', precioAntes: '' })).toEqual([]); // el precio es opcional
    expect(validarPublicacion({ ...ok, titulo: ' ' })[0]).toMatch(/título/);
    expect(validarPublicacion({ ...ok, titulo: 'x'.repeat(MAX_TITULO + 1) })[0]).toMatch(/título/);
    expect(validarPublicacion({ ...ok, precio: 'gratis' })[0]).toMatch(/precio no es válido/);
    expect(validarPublicacion({ ...ok, precioAntes: '300' })[0]).toMatch(/anterior debe ser mayor/);
    expect(validarPublicacion({ ...ok, precioAntes: '350' })[0]).toMatch(/anterior debe ser mayor/);
    expect(validarPublicacion({ ...ok, texto: 'x'.repeat(MAX_TEXTO + 1) })[0]).toMatch(/texto/);
  });

  it('porcentajeMenos', () => {
    expect(porcentajeMenos(350, 500)).toBe(30);
    expect(porcentajeMenos(350, 350)).toBe(0);
    expect(porcentajeMenos(null, 500)).toBe(0);
    expect(porcentajeMenos(400, 300)).toBe(0);
  });

  it('armarTexto: arma el texto con lo que haya', () => {
    expect(armarTexto({ titulo: 'Pastel' })).toBe('🛍️ *Pastel*');
    const t = armarTexto({ titulo: ' Pastel ', precio: 350, precioAntes: 500, texto: 'Hecho a mano', tienda: 'Dulce', enlace: 'https://app.test/store/profile/t1' });
    expect(t).toContain('💲 Ahora $350 (antes $500, -30%)');
    expect(t).toContain('Hecho a mano');
    expect(t).toContain('🏪 Dulce');
    expect(t).toContain('👉 https://app.test/store/profile/t1');
    expect(armarTexto({ titulo: 'P', precio: 350 })).toContain('💲 $350');
  });

  it('enlaces para compartir: el texto va codificado', () => {
    expect(enlaceWhatsapp('Hola & adiós\n350')).toBe('https://wa.me/?text=Hola%20%26%20adi%C3%B3s%0A350');
    expect(enlaceFacebook('https://a.b/c?d=1')).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fa.b%2Fc%3Fd%3D1');
    expect(enlaceFacebook('https://a.b', 'hola')).toContain('&quote=hola');
    expect(enlaceTelegram('https://a.b', 'hola')).toBe('https://t.me/share/url?url=https%3A%2F%2Fa.b&text=hola');
  });

  it('normalizarPublicacion: valores seguros y descarta filas inválidas', () => {
    expect(normalizarPublicacion('1', 't1', null)).toBeNull();
    expect(normalizarPublicacion('1', 't1', { titulo: '  ' })).toBeNull();
    const p = normalizarPublicacion('1', 't1', { titulo: 'Pastel', precio: '350', precioAntes: 'x', plantilla: 'inventada', formato: 'raro', imagenUrl: 'https://i/x.jpg' })!;
    expect(p).toMatchObject({ id: '1', tiendaId: 't1', titulo: 'Pastel', precio: 350, precioAntes: null, plantilla: PLANTILLAS[0].id, formato: FORMATOS[0].id, imagenUrl: 'https://i/x.jpg' });
    expect(plantillaPorId('oferta').id).toBe('oferta');
    expect(formatoPorId('historia').alto).toBe(1920);
  });
});

describe('partirLineas (texto de la imagen)', () => {
  const medir = (t: string) => t.length * 10; // 10 px por letra
  it('parte por palabras y respeta el ancho', () => {
    expect(partirLineas(medir, 'Pastel de chocolate con fresas', 150, 5)).toEqual(['Pastel de', 'chocolate con', 'fresas']);
  });
  it('si no cabe en el máximo de renglones, termina en "…"', () => {
    const r = partirLineas(medir, 'uno dos tres cuatro cinco seis siete ocho', 80, 2);
    expect(r).toHaveLength(2);
    expect(r[1].endsWith('…')).toBe(true);
    for (const l of r) expect(medir(l)).toBeLessThanOrEqual(80);
  });
  it('una palabra más ancha que el renglón se corta; vacío da []', () => {
    expect(partirLineas(medir, 'Supercalifragilistico', 100, 2)[0].length).toBeLessThanOrEqual(10);
    expect(partirLineas(medir, '   ', 100, 2)).toEqual([]);
  });
});

describe('menú de la tienda: "Crear publicación"', () => {
  async function montar(esDueno: boolean) {
    const MenuTienda = (await import('@/modules/store/components/MenuTienda.vue')).default;
    const w = mount(MenuTienda, { props: { abierto: true, esDueno, nombreTienda: 'Dulce', cuenta: [], actualId: 't1' } as any, global: { stubs: { Teleport: true, Transition: false } } });
    return w;
  }
  it('la dueña la ve y, al tocarla, avisa la acción', async () => {
    const w = await montar(true);
    const op = w.findAll('.mt-opcion').find((b) => b.text().includes('Crear publicación'));
    expect(op).toBeTruthy();
    await op!.trigger('click');
    expect(w.emitted('accion')?.[0]).toEqual(['crear-publicacion']);
  });
  it('un visitante no la ve', async () => {
    const w = await montar(false);
    expect(w.text()).not.toContain('Crear publicación');
  });
});
