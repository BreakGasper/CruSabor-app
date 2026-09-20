/**
 * Deslizar hacia abajo para actualizar: dispara `refresh` solo si el gesto empieza
 * en la cabecera, la página está arriba y el arrastre supera el umbral.
 *
 * La regla de la cabecera existe porque escuchando en toda la página el
 * `preventDefault` de onMove entorpecía el desplazamiento normal en cada pantalla.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PullToRefresh, { UMBRAL } from '@/components/PullToRefresh.vue';

function toque(tipo: string, y: number, target: EventTarget = document.body) {
  const e = new Event(tipo, { bubbles: true, cancelable: true }) as any;
  Object.defineProperty(e, 'touches', { value: [{ clientY: y, clientX: 0 }] });
  target.dispatchEvent(e);
  return e as Event;
}

/** Arrastre hacia abajo de `px` píxeles en el dedo (el indicador avanza a la mitad) */
function arrastrar(px: number, target: EventTarget = document.body) {
  toque('touchstart', 100, target);
  toque('touchmove', 100 + 20, target); // supera los 10 px de tolerancia
  const movimiento = toque('touchmove', 100 + px, target);
  toque('touchend', 100 + px, target);
  return movimiento;
}

const setScrollY = (v: number) => Object.defineProperty(window, 'scrollY', { value: v, configurable: true });

/** Monta el componente con una cabecera y un cuerpo, como cualquier pantalla real */
function montarPantalla() {
  const w = mount(PullToRefresh, {
    attachTo: document.body,
    slots: {
      default: `
        <div>
          <header class="page-header"><h2>Título</h2></header>
          <div class="contenido"><p>mucho texto</p></div>
        </div>`,
    },
  });
  return {
    w,
    cabecera: document.querySelector('.page-header h2') as HTMLElement,
    contenido: document.querySelector('.contenido p') as HTMLElement,
  };
}

let w: ReturnType<typeof mount> | null = null;
afterEach(() => {
  w?.unmount();
  w = null;
  setScrollY(0);
});

describe('PullToRefresh: solo desde la cabecera', () => {
  it('emite refresh al arrastrar desde la cabecera y pasar el umbral', async () => {
    const p = montarPantalla();
    w = p.w;
    arrastrar((UMBRAL + 10) * 2, p.cabecera);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toHaveLength(1);
  });

  it('NO emite si el arrastre empieza en el contenido', async () => {
    const p = montarPantalla();
    w = p.w;
    arrastrar((UMBRAL + 10) * 2, p.contenido);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('arrastrar en el contenido no bloquea el desplazamiento (sin preventDefault)', async () => {
    const p = montarPantalla();
    w = p.w;
    const movimiento = arrastrar((UMBRAL + 10) * 2, p.contenido);
    expect(movimiento.defaultPrevented).toBe(false);
  });

  it('desde la cabecera sí toma el gesto (con preventDefault)', async () => {
    const p = montarPantalla();
    w = p.w;
    const movimiento = arrastrar((UMBRAL + 10) * 2, p.cabecera);
    expect(movimiento.defaultPrevented).toBe(true);
  });

  it('también funciona desde una zona marcada con data-pull-refresh', async () => {
    w = mount(PullToRefresh, {
      attachTo: document.body,
      slots: { default: '<div data-pull-refresh><span class="zona">portada</span></div>' },
    });
    arrastrar((UMBRAL + 10) * 2, document.querySelector('.zona') as HTMLElement);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toHaveLength(1);
  });
});

describe('PullToRefresh: condiciones del gesto', () => {
  it('no emite si el arrastre es corto', async () => {
    const p = montarPantalla();
    w = p.w;
    arrastrar(UMBRAL, p.cabecera); // el dedo avanza UMBRAL pero el indicador solo la mitad
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('no emite si la ventana ya tiene scroll, aunque se arrastre desde la cabecera', async () => {
    const p = montarPantalla();
    w = p.w;
    setScrollY(30);
    arrastrar((UMBRAL + 10) * 2, p.cabecera);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('no emite si un contenedor bajo el dedo tiene scroll', async () => {
    w = mount(PullToRefresh, {
      attachTo: document.body,
      slots: { default: '<header class="page-header"><div class="lista">x</div></header>' },
    });
    const lista = document.querySelector('.lista') as HTMLElement;
    Object.defineProperty(lista, 'scrollTop', { value: 40, configurable: true });
    arrastrar((UMBRAL + 10) * 2, lista);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
  });

  it('mientras está refrescando no vuelve a disparar', async () => {
    w = mount(PullToRefresh, {
      attachTo: document.body,
      props: { refrescando: true },
      slots: { default: '<header class="page-header">t</header>' },
    });
    arrastrar((UMBRAL + 10) * 2, document.querySelector('.page-header') as HTMLElement);
    await w.vm.$nextTick();
    expect(w.emitted('refresh')).toBeUndefined();
    expect(w.find('.ptr-indicador').text()).toContain('Actualizando');
  });
});
