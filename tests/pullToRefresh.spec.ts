/**
 * Deslizar hacia abajo para actualizar (como un F5), desde CUALQUIER parte de la pantalla:
 * se arma solo si la página está arriba del todo, el arrastre es vertical y no empieza en un campo de texto,
 * un diálogo, un lienzo o una zona marcada con `data-sin-recarga` (formularios a medias).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PullToRefresh, { UMBRAL, puedeIniciarGesto } from '@/components/PullToRefresh.vue';
import { instalarSinZoom } from '@/utils/sinZoom';

function toque(tipo: string, y: number, target: EventTarget = document.body, x = 0) {
  const e = new Event(tipo, { bubbles: true, cancelable: true }) as any;
  Object.defineProperty(e, 'touches', { value: [{ clientY: y, clientX: x }] });
  target.dispatchEvent(e);
  return e as Event;
}

/** Arrastre hacia abajo de `px` píxeles en el dedo (el indicador avanza a la mitad) */
function arrastrar(px: number, target: EventTarget = document.body, desviacionX = 0) {
  toque('touchstart', 100, target, 0);
  toque('touchmove', 100 + 20, target, desviacionX / 2); // supera los 10 px de tolerancia
  const movimiento = toque('touchmove', 100 + px, target, desviacionX);
  toque('touchend', 100 + px, target, desviacionX);
  return movimiento;
}

const GRANDE = (UMBRAL + 10) * 2;
const setScrollY = (v: number) => Object.defineProperty(window, 'scrollY', { value: v, configurable: true });

let w: ReturnType<typeof mount> | null = null;
const montar = (html: string, props: Record<string, any> = {}) => {
  w = mount(PullToRefresh, { attachTo: document.body, props, slots: { default: html } });
  return w;
};
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

afterEach(() => {
  w?.unmount();
  w = null;
  setScrollY(0);
  (document.activeElement as HTMLElement | null)?.blur?.();
  document.body.innerHTML = '';
});

describe('PullToRefresh: desde cualquier parte', () => {
  it('emite refresh al arrastrar desde el contenido (no solo desde la cabecera)', async () => {
    montar('<div><header class="page-header">Título</header><main class="contenido"><p>mucho texto</p></main></div>');
    arrastrar(GRANDE, $('.contenido p'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(1);
  });

  it('también desde la cabecera, una tarjeta o la pantalla vacía', async () => {
    montar('<div><header class="admin-topbar">x</header><section class="tarjeta">y</section></div>');
    for (const sel of ['.admin-topbar', '.tarjeta']) arrastrar(GRANDE, $(sel));
    arrastrar(GRANDE, document.body);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(3);
  });

  it('al arrastrar toma el gesto (preventDefault) para que el navegador no haga otra cosa', () => {
    montar('<p class="t">hola</p>');
    expect(arrastrar(GRANDE, $('.t')).defaultPrevented).toBe(true);
  });

  it('un arrastre corto no recarga', async () => {
    montar('<p class="t">hola</p>');
    arrastrar(UMBRAL, $('.t')); // el dedo avanza UMBRAL pero el indicador solo la mitad
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('deslizar hacia arriba (scroll normal) nunca recarga ni bloquea el desplazamiento', async () => {
    montar('<p class="t">hola</p>');
    toque('touchstart', 300, $('.t'));
    const m = toque('touchmove', 200, $('.t'));
    toque('touchend', 200, $('.t'));
    await w!.vm.$nextTick();
    expect(m.defaultPrevented).toBe(false);
    expect(w!.emitted('refresh')).toBeUndefined();
  });
});

describe('PullToRefresh: dónde NO se arma', () => {
  it('con la página ya desplazada', async () => {
    montar('<p class="t">hola</p>');
    setScrollY(30);
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('si un contenedor con scroll bajo el dedo ya se desplazó', async () => {
    montar('<div class="lista"><p class="item">x</p></div>');
    Object.defineProperty($('.lista'), 'scrollTop', { value: 40, configurable: true });
    const m = arrastrar(GRANDE, $('.item'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(m.defaultPrevented).toBe(false);
  });

  it('en campos de texto, y con el teclado abierto (campo enfocado) en cualquier lado', async () => {
    montar('<form><input class="campo"><textarea class="area"></textarea><p class="t">x</p></form>');
    arrastrar(GRANDE, $('.campo'));
    arrastrar(GRANDE, $('.area'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    $('.campo').focus();
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('en formularios a medias marcados con data-sin-recarga', async () => {
    montar('<div data-sin-recarga><label class="l">Nombre</label></div>');
    arrastrar(GRANDE, $('.l'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('en diálogos, el editor de fotos y los lienzos', async () => {
    montar('<div role="dialog"><p class="d">x</p></div><div class="rec-overlay"><p class="r">x</p></div><div class="swal2-container"><p class="s">x</p></div><canvas class="c"></canvas>');
    for (const sel of ['.d', '.r', '.s', '.c']) arrastrar(GRANDE, $(sel));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('un arrastre más horizontal que vertical (carruseles) no es este gesto', async () => {
    montar('<div class="carrusel">x</div>');
    const m = arrastrar(GRANDE, $('.carrusel'), GRANDE * 2);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(m.defaultPrevented).toBe(false);
  });

  it('mientras ya está refrescando no vuelve a disparar y lo dice', async () => {
    montar('<p class="t">x</p>', { refrescando: true });
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(w!.find('.ptr-indicador').text()).toContain('Actualizando');
  });

  it('puedeIniciarGesto: regla pura', () => {
    document.body.innerHTML = '<div id="a"><p id="b">x</p></div><input id="i">';
    expect(puedeIniciarGesto(document.getElementById('b'), 0)).toBe(true);
    expect(puedeIniciarGesto(document.getElementById('b'), 5)).toBe(false);
    expect(puedeIniciarGesto(document.getElementById('i'), 0)).toBe(false);
    expect(puedeIniciarGesto(null, 0)).toBe(true);
  });
});

describe('sin zoom con el pellizco', () => {
  let quitar: () => void;
  beforeEach(() => { quitar = instalarSinZoom(); });
  afterEach(() => quitar());

  const evento = (tipo: string, extra: Record<string, any> = {}) => {
    const e = new Event(tipo, { bubbles: true, cancelable: true }) as any;
    Object.assign(e, extra);
    document.dispatchEvent(e);
    return e as Event;
  };

  it('cancela los gestos de pellizco de Safari (gesturestart / gesturechange / gestureend)', () => {
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) expect(evento(t).defaultPrevented, t).toBe(true);
  });

  it('cancela touchmove con escala distinta de 1 o con dos dedos, pero no el desplazamiento normal', () => {
    expect(evento('touchmove', { scale: 1.4, touches: [{}] }).defaultPrevented).toBe(true);
    expect(evento('touchmove', { touches: [{}, {}] }).defaultPrevented).toBe(true);
    expect(evento('touchmove', { scale: 1, touches: [{}] }).defaultPrevented).toBe(false);
    expect(evento('touchmove', { touches: [{}] }).defaultPrevented).toBe(false);
  });

  it('al desinstalar deja de cancelar', () => {
    quitar();
    expect(evento('gesturestart').defaultPrevented).toBe(false);
    quitar = instalarSinZoom();
  });
});
