import { describe, it, expect } from 'vitest';
import { quitarFondoLiso } from '@/modules/store/utils/quitarFondo';
import { FORMATOS, formatoPorId } from '@/composables/usePublicaciones';

/** Imagen de prueba: fondo de un color y un cuadrado de otro color en el centro (con un hueco opcional) */
function imagen(w: number, h: number, fondo: [number, number, number], objeto: [number, number, number], opciones: { hueco?: boolean; ruido?: boolean } = {}) {
  const d = new Uint8ClampedArray(w * h * 4);
  const dentro = (x: number, y: number) => x >= w * 0.3 && x < w * 0.7 && y >= h * 0.3 && y < h * 0.7;
  const hueco = (x: number, y: number) => opciones.hueco && x >= w * 0.45 && x < w * 0.55 && y >= h * 0.45 && y < h * 0.55;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const esObjeto = dentro(x, y) && !hueco(x, y);
      const c = esObjeto ? objeto : fondo;
      const r = opciones.ruido ? ((x * 31 + y * 17) % 255) : 0;
      d[i] = opciones.ruido && !esObjeto ? r : c[0];
      d[i + 1] = opciones.ruido && !esObjeto ? (r * 3) % 255 : c[1];
      d[i + 2] = opciones.ruido && !esObjeto ? (r * 7) % 255 : c[2];
      d[i + 3] = 255;
    }
  }
  return d;
}
const alfa = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('quitarFondoLiso', () => {
  it('borra el fondo liso y conserva el producto', () => {
    const w = 100, h = 100;
    const d = imagen(w, h, [255, 255, 255], [200, 30, 30]);
    const r = quitarFondoLiso(d, w, h);
    expect(r.ok).toBe(true);
    expect(alfa(d, w, 2, 2)).toBe(0); // esquina: fondo
    expect(alfa(d, w, 50, 50)).toBe(255); // centro: producto
    expect(r.fraccionQuitada).toBeCloseTo(0.84, 1);
    expect(r.caja).toEqual({ x: 30, y: 30, ancho: 40, alto: 40 }); // recorta lo vacío
  });

  it('funciona con fondos de color (no solo blanco)', () => {
    const w = 80, h = 80;
    const d = imagen(w, h, [230, 220, 180], [20, 60, 140]);
    expect(quitarFondoLiso(d, w, h).ok).toBe(true);
    expect(alfa(d, w, 1, 1)).toBe(0);
  });

  it('no toca lo que queda encerrado dentro del producto (un hueco del mismo color del fondo)', () => {
    const w = 100, h = 100;
    const d = imagen(w, h, [255, 255, 255], [200, 30, 30], { hueco: true });
    expect(quitarFondoLiso(d, w, h).ok).toBe(true);
    expect(alfa(d, w, 50, 50)).toBe(255); // el hueco no está conectado con el borde
  });

  it('un fondo que no es parejo no se recorta: avisa y deja la foto intacta', () => {
    const w = 100, h = 100;
    const d = imagen(w, h, [255, 255, 255], [200, 30, 30], { ruido: true });
    const antes = Array.from(d);
    const r = quitarFondoLiso(d, w, h);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/no es liso/);
    expect(Array.from(d)).toEqual(antes);
  });

  it('si el producto es del color del fondo no deja la foto vacía', () => {
    const w = 60, h = 60;
    const d = imagen(w, h, [250, 250, 250], [252, 252, 252]);
    const r = quitarFondoLiso(d, w, h);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/demasiado al fondo/);
  });

  it('una foto sin fondo que quitar (el producto llena todo) avisa', () => {
    const w = 60, h = 60;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { d[i * 4] = (i * 7) % 255; d[i * 4 + 1] = (i * 13) % 255; d[i * 4 + 2] = (i * 29) % 255; d[i * 4 + 3] = 255; }
    expect(quitarFondoLiso(d, w, h).ok).toBe(false);
  });

  it('suaviza la orilla del producto', () => {
    const w = 100, h = 100;
    const d = imagen(w, h, [255, 255, 255], [200, 30, 30]);
    // un píxel de transición pegado al borde del producto
    const i = (50 * w + 29) * 4;
    d[i] = 235; d[i + 1] = 210; d[i + 2] = 210;
    quitarFondoLiso(d, w, h);
    expect(d[i + 3]).toBeGreaterThan(0);
    expect(d[i + 3]).toBeLessThan(255);
  });

  it('rechaza imágenes diminutas', () => {
    expect(quitarFondoLiso(new Uint8ClampedArray(4 * 4 * 4), 4, 4).ok).toBe(false);
  });
});

describe('formatos de publicación', () => {
  it('incluye banner 3:1 y horizontal 16:9', () => {
    expect(FORMATOS.map((f) => f.id)).toEqual(['cuadrado', 'historia', 'banner', 'horizontal']);
    const b = formatoPorId('banner');
    expect(b.ancho / b.alto).toBe(3);
    const h = formatoPorId('horizontal');
    expect(h.ancho / h.alto).toBeCloseTo(16 / 9, 2);
  });
  it('un formato desconocido cae en el cuadrado', () => {
    expect(formatoPorId('raro').id).toBe('cuadrado');
  });
});

describe('pantalla Crear publicación', () => {
  it('ofrece los formatos banner y horizontal y la casilla para quitar el fondo', async () => {
    const { mount, flushPromises } = await import('@vue/test-utils');
    const { default: CrearPublicacion } = await import('@/modules/store/views/CrearPublicacion.vue');
    const { __reset } = await import('./mocks/firebaseDb');
    const { routeMock } = await import('./setup');
    __reset({});
    routeMock.params = { id: 'T1' };
    localStorage.setItem('tiendas', JSON.stringify({ id: 'T1', nombreTienda: 'Crustore' }));
    const w = mount(CrearPublicacion, { global: { stubs: { PageHeader: true } } });
    await flushPromises();
    expect(w.find('[data-testid="formato-banner"]').exists()).toBe(true);
    expect(w.find('[data-testid="formato-horizontal"]').exists()).toBe(true);
    expect(w.find('[data-testid="sin-fondo"]').exists()).toBe(true);
    expect(w.find('[data-testid="aviso-fondo"]').exists()).toBe(false); // sin foto no hay aviso
    await w.find('[data-testid="sin-fondo"]').setValue(true); // sin foto: no truena
    expect(w.find('[data-testid="aviso-fondo"]').exists()).toBe(false);
    w.unmount();
    localStorage.clear();
  });
});

describe('quitar el fondo con IA (toca el producto)', () => {
  it('la confianza del modelo se vuelve opacidad con una transición corta', async () => {
    const { alfaDesdeConfianza } = await import('@/modules/store/utils/recortarConIA');
    expect(alfaDesdeConfianza(0)).toBe(0);
    expect(alfaDesdeConfianza(0.35)).toBe(0);
    expect(alfaDesdeConfianza(0.5)).toBe(128);
    expect(alfaDesdeConfianza(0.65)).toBe(255);
    expect(alfaDesdeConfianza(1)).toBe(255);
  });

  it('una foto que no se pudo leer da un mensaje claro en lugar de fallar', async () => {
    const { quitarFondoConIA, ErrorRecorteIA } = await import('@/modules/store/utils/recortarConIA');
    const img = document.createElement('img'); // sin cargar: ancho 0
    await expect(quitarFondoConIA(img, { x: 0.5, y: 0.5 })).rejects.toBeInstanceOf(ErrorRecorteIA);
  });

  it('en la pantalla, la opción de IA aparece solo cuando hay una foto', async () => {
    const { mount, flushPromises } = await import('@vue/test-utils');
    const { default: CrearPublicacion } = await import('@/modules/store/views/CrearPublicacion.vue');
    const { __reset } = await import('./mocks/firebaseDb');
    const { routeMock } = await import('./setup');
    __reset({});
    routeMock.params = { id: 'T1' };
    localStorage.setItem('tiendas', JSON.stringify({ id: 'T1', nombreTienda: 'Crustore' }));
    const w = mount(CrearPublicacion, { global: { stubs: { PageHeader: true } } });
    await flushPromises();
    expect(w.find('[data-testid="quitar-fondo-ia"]').exists()).toBe(false);
    expect(w.find('[data-testid="dialogo-toque"]').exists()).toBe(false);
    w.unmount();
    localStorage.clear();
  });
});
