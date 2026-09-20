/**
 * Regresar desde una pantalla abierta por un enlace compartido.
 *
 * El perfil de tienda y el detalle de producto se comparten por enlace. Quien lo
 * abre entra directo a esa pantalla, sin historial propio: ahí `router.back()`
 * no lleva a ningún lado (o saca de la app) y la persona se queda atrapada.
 */
import { describe, it, expect, vi } from 'vitest';
import { volverOInicio, hayHistorialPropio, RUTA_INICIO } from '@/utils/navegacion';

const navegador = () => ({ back: vi.fn(), replace: vi.fn() });

describe('hayHistorialPropio', () => {
  it('reconoce cuando hay una pantalla anterior dentro de la app', () => {
    expect(hayHistorialPropio({ back: '/tiendas' })).toBe(true);
  });

  it('no la reconoce si se llegó de fuera (back nulo, ausente o sin estado)', () => {
    expect(hayHistorialPropio({ back: null })).toBe(false);
    expect(hayHistorialPropio({})).toBe(false);
    expect(hayHistorialPropio(null)).toBe(false);
  });
});

describe('volverOInicio', () => {
  it('con historial propio regresa a la pantalla anterior', () => {
    const r = navegador();
    volverOInicio(r, RUTA_INICIO, { back: '/tiendas' });
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it('sin historial propio (enlace compartido) lleva a la portada', () => {
    const r = navegador();
    volverOInicio(r, RUTA_INICIO, { back: null });
    expect(r.replace).toHaveBeenCalledWith('/');
    expect(r.back).not.toHaveBeenCalled();
  });

  it('usa replace, para no dejar en el historial una entrada sin salida', () => {
    const r = navegador();
    volverOInicio(r, RUTA_INICIO, null);
    expect(r.replace).toHaveBeenCalledTimes(1);
  });

  it('admite otra pantalla de destino', () => {
    const r = navegador();
    volverOInicio(r, '/tiendas', null);
    expect(r.replace).toHaveBeenCalledWith('/tiendas');
  });
});
