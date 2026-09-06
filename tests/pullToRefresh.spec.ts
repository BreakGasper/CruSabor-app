/**
 * Deslizar hacia abajo para actualizar: dispara `refresh` solo si la página está arriba
 * y el arrastre supera el umbral; no dispara si el contenedor bajo el dedo tiene scroll.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PullToRefresh, { UMBRAL } from '@/components/PullToRefresh.vue';

function toque(tipo: string, y: number, target: EventTarget = document.body) {
  const e = new Event(tipo, { bubbles: true, cancelable: true }) as any;
  Object.defineProperty(e, 'touches', { value: [{ clientY: y, clientX: 0 }] });
  target.dispatchEvent(e);
}

/** Arrastre hacia abajo de `px` píxeles en el dedo (el indicador avanza a la mitad) */
function arrastrar(px: number, target: EventTarget = document.body) {
  toque('touchstart', 100, target);
  toque('touchmove', 100 + 20, target); // supera los 10 px de tolerancia
  toque('touchmove', 100 + px, target);
  toque('touchend', 100 + px, target);
}

const setScrollY = (v: number) => Object.defineProperty(window, 'scrollY', { value: v, configurable: true });

let w: ReturnType<typeof mount> | null = null;
afterEach(() => {
  w?.unmount();
  w = null;
  setScrollY(0);
});

describe('PullToRefresh', () => {
  it('emite refresh al soltar después de pasar el umbral', async () => {
    w = mount(PullToRefresh, { attachTo: document.body, slots: { default: '<p>contenido</p>' } });
    arrastrar((UMBRAL + 10) * 2);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toHaveLength(1);
  });

  it('no emite si el arrastre es corto', async () => {
    w = mount(PullToRefresh, { attachTo: document.body });
    arrastrar(UMBRAL); // el dedo avanza UMBRAL pero el indicador solo la mitad
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('no emite si la ventana o el contenedor bajo el dedo ya tienen scroll', async () => {
    w = mount(PullToRefresh, { attachTo: document.body, slots: { default: '<div class="lista">x</div>' } });
    const lista = document.querySelector('.lista') as HTMLElement;
    Object.defineProperty(lista, 'scrollTop', { value: 40, configurable: true });
    arrastrar((UMBRAL + 10) * 2, lista);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();

    Object.defineProperty(lista, 'scrollTop', { value: 0, configurable: true });
    setScrollY(30);
    arrastrar((UMBRAL + 10) * 2, lista);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('mientras está refrescando no vuelve a disparar', async () => {
    w = mount(PullToRefresh, { attachTo: document.body, props: { refrescando: true } });
    arrastrar((UMBRAL + 10) * 2);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
    expect(w.find('.ptr-indicador').text()).toContain('Actualizando');
  });
});
