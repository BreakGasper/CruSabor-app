/**
 * Diálogo "Actualizar stock": capturar piezas a mano y contarlas con la cámara.
 *
 * Al escanear, el código se compara con el SKU de cada variante; si coincide,
 * suma una pieza a esa fila. Es contar inventario pieza por pieza sin teclear.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { indicePorCodigo, variantesConStock } from '@/composables/useArticulos';

/** Cámara falsa: guarda el callback de lectura para dispararlo desde la prueba */
const camara = vi.hoisted(() => ({
  alLeer: null as null | ((texto: string) => void),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start(_c: any, _o: any, alLeer: (t: string) => void) {
      camara.alLeer = alLeer;
      camara.start();
      return Promise.resolve();
    }
    stop() {
      camara.stop();
      return Promise.resolve();
    }
  },
}));

import ModalStock from '@/modules/store/components/ModalStock.vue';

const ARTICULO = {
  articuloId: 'art-1',
  nombre: 'Pan dulce',
  tiendaId: 'tienda-A',
  precio: 10,
  variantes: [
    { sku: 'PAN-ROJO', stock: 2, color: 'Rojo', tamano: 'Ch' },
    { sku: 'PAN-AZUL', stock: 5, color: 'Azul', tamano: 'Gr' },
  ],
} as any;

let w: any = null;
beforeEach(() => {
  document.body.innerHTML = '';
  camara.alLeer = null;
  camara.start.mockClear();
  camara.stop.mockClear();
  __reset({ articulos: { 'art-1': JSON.parse(JSON.stringify(ARTICULO)) } });
});
afterEach(() => {
  w?.unmount();
  w = null;
});

const montar = async (articulo = ARTICULO) => {
  w = mount(ModalStock, { props: { articulo }, attachTo: document.body });
  await flushPromises();
  return w;
};

const campos = () => Array.from(document.querySelectorAll('.stock-input')) as HTMLInputElement[];
const escanear = async (codigo: string) => {
  camara.alLeer!(codigo);
  await flushPromises();
};

describe('indicePorCodigo (regla pura)', () => {
  const vs = variantesConStock(ARTICULO);

  it('encuentra la variante por su SKU', () => {
    expect(indicePorCodigo(vs, 'PAN-ROJO')).toBe(0);
    expect(indicePorCodigo(vs, 'PAN-AZUL')).toBe(1);
  });

  it('perdona espacios y mayúsculas', () => {
    expect(indicePorCodigo(vs, '  pan-rojo  ')).toBe(0);
  });

  it('exige el código completo: parecerse no basta', () => {
    expect(indicePorCodigo(vs, 'PAN')).toBeNull();
    expect(indicePorCodigo(vs, 'PAN-ROJO-XL')).toBeNull();
    expect(indicePorCodigo(vs, '')).toBeNull();
  });
});

describe('ModalStock · captura a mano', () => {
  it('arranca con el stock que ya tenía cada variante', async () => {
    await montar();
    expect(campos().map((c) => c.value)).toEqual(['2', '5']);
  });

  it('los botones + y − ajustan de uno en uno y nunca bajan de cero', async () => {
    await montar();
    const fila = document.querySelectorAll('.stock-fila')[0];
    const [menos, mas] = Array.from(fila.querySelectorAll('.stock-paso')) as HTMLElement[];

    mas.click();
    await flushPromises();
    expect(campos()[0].value).toBe('3');

    for (let i = 0; i < 5; i++) menos.click();
    await flushPromises();
    expect(campos()[0].value).toBe('0');
  });

  it('guardar escribe las piezas y avisa al padre', async () => {
    await montar();
    (document.querySelectorAll('.stock-fila')[0].querySelector('.stock-paso:last-child') as HTMLElement).click();
    await flushPromises();

    (document.querySelector('.stock-btn.primario') as HTMLElement).click();
    await flushPromises();

    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(3);
    expect(w.emitted('guardado')).toHaveLength(1);
  });

  it('sin cambios, el botón de guardar está deshabilitado', async () => {
    await montar();
    const guardar = document.querySelector('.stock-btn.primario') as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);
  });
});

describe('ModalStock · escanear', () => {
  const abrirCamara = async () => {
    (document.querySelector('.stock-escanear') as HTMLElement).click();
    await flushPromises();
  };

  it('un código que coincide con el SKU suma una pieza a esa variante', async () => {
    await montar();
    await abrirCamara();
    expect(camara.start).toHaveBeenCalled();

    await escanear('PAN-ROJO');
    expect(campos()[0].value).toBe('3');
    expect(campos()[1].value).toBe('5'); // la otra no se toca

    await escanear('PAN-AZUL');
    expect(campos()[1].value).toBe('6');
  });

  it('escanear la misma pieza varias veces sigue sumando: así se cuenta inventario', async () => {
    await montar();
    await abrirCamara();

    await escanear('PAN-ROJO');
    await escanear('PAN-ROJO');
    await escanear('PAN-ROJO');

    expect(campos()[0].value).toBe('5'); // 2 + 3
    expect(document.querySelector('.stock-aviso.ok')?.textContent).toContain('+1');
  });

  it('un código ajeno no suma nada y lo dice', async () => {
    await montar();
    await abrirCamara();

    await escanear('OTRO-CODIGO');

    expect(campos().map((c) => c.value)).toEqual(['2', '5']);
    const aviso = document.querySelector('.stock-aviso.error');
    expect(aviso?.textContent).toContain('no es de este artículo');
  });

  it('lo escaneado se guarda igual que lo tecleado', async () => {
    await montar();
    await abrirCamara();
    await escanear('PAN-ROJO');
    await escanear('PAN-AZUL');

    (document.querySelector('.stock-btn.primario') as HTMLElement).click();
    await flushPromises();

    expect(__getAt('articulos/art-1/variantes/0/stock')).toBe(3);
    expect(__getAt('articulos/art-1/variantes/1/stock')).toBe(6);
  });

  it('la cámara se apaga al cerrar el diálogo', async () => {
    await montar();
    await abrirCamara();

    (document.querySelector('.stock-cerrar') as HTMLElement).click();
    await flushPromises();

    expect(camara.stop).toHaveBeenCalled();
    expect(w.emitted('cerrar')).toHaveLength(1);
  });

  it('la cámara se apaga también si la pantalla se desmonta con ella abierta', async () => {
    await montar();
    await abrirCamara();

    w.unmount();
    w = null;
    await flushPromises();

    expect(camara.stop).toHaveBeenCalled();
  });
});

describe('ModalStock · artículos sin piezas que contar', () => {
  it('lo dice y no ofrece guardar', async () => {
    await montar({ ...ARTICULO, porPedido: true });
    expect(document.querySelector('.stock-vacio')?.textContent).toContain('no hay piezas que contar');
    expect(document.querySelector('.stock-btn.primario')).toBeNull();
  });
});

/**
 * El diálogo debe quedar POR ENCIMA del panel de avisos.
 *
 * Al abrirlo el panel se cierra, pero su transición de salida dura 0.18 s. Con un
 * z-index menor, durante ese rato el aviso se pintaba encima del diálogo y daba
 * la impresión de que no se había cerrado.
 */
describe('ModalStock · queda por encima del panel de avisos', () => {
  const zIndexDe = (archivo: string, selector: string): number => {
    const fs = require('node:fs') as typeof import('node:fs');
    const css = fs.readFileSync(archivo, 'utf8');
    const bloque = css.slice(css.indexOf(selector));
    const m = /z-index:\s*(\d+)/.exec(bloque.slice(0, 600));
    return m ? Number(m[1]) : NaN;
  };

  it('su z-index es mayor que el del panel de la campana', () => {
    const modal = zIndexDe('src/modules/store/components/ModalStock.vue', '.stock-fondo {');
    const panel = zIndexDe('src/modules/store/components/CampanaTienda.vue', '.panel-fondo {');

    expect(Number.isFinite(modal)).toBe(true);
    expect(Number.isFinite(panel)).toBe(true);
    expect(modal).toBeGreaterThan(panel);
  });
});
