/**
 * Deslizar hacia abajo para actualizar (como un F5), desde la CABECERA de cualquier pantalla: se arma solo si
 * el dedo empieza en una cabecera (o en la franja de arriba, en pantallas sin cabecera conocida), la página está
 * arriba del todo y el arrastre es vertical. En el resto de la pantalla, deslizar solo desplaza el contenido.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PullToRefresh, { UMBRAL, ALTO_FRANJA_CABECERA, SELECTOR_CABECERA, puedeIniciarGesto } from '@/components/PullToRefresh.vue';
import { instalarSinZoom } from '@/utils/sinZoom';
import { hayFormularioAbierto } from '@/utils/actualizacion';

function toque(tipo: string, y: number, target: EventTarget = document.body, x = 0) {
  const e = new Event(tipo, { bubbles: true, cancelable: true }) as any;
  Object.defineProperty(e, 'touches', { value: [{ clientY: y, clientX: x }] });
  target.dispatchEvent(e);
  return e as Event;
}

/** Arrastre hacia abajo de `px` píxeles en el dedo (el indicador avanza a la mitad) */
function arrastrar(px: number, target: EventTarget = document.body, desviacionX = 0, y0 = 400) {
  toque('touchstart', y0, target, 0);
  toque('touchmove', y0 + 20, target, desviacionX / 2); // supera los 10 px de tolerancia
  const movimiento = toque('touchmove', y0 + px, target, desviacionX);
  toque('touchend', y0 + px, target, desviacionX);
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

describe('PullToRefresh: solo desde la cabecera', () => {
  it('emite refresh al arrastrar desde la cabecera (a media pantalla de altura) y pasar el umbral', async () => {
    montar('<div><header class="page-header"><h2 class="t">Título</h2></header><main class="contenido"><p>mucho texto</p></main></div>');
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(1);
  });

  it('funciona con las cabeceras de TODAS las pantallas (cliente, tienda y administrador)', async () => {
    const clases = SELECTOR_CABECERA.split(',').filter((c) => c.startsWith('.')).map((c) => c.slice(1));
    expect(clases).toEqual(expect.arrayContaining(['page-header', 'top-bar-fija', 'top-bar-top', 'admin-topbar', 'store-banner', 'detalle-header', 'login-header', 'register-header', 'profile-header', 'checkout-header', 'cart-header']));
    montar(clases.map((c) => `<div class="${c}"><span class="${c}-hijo">x</span></div>`).join(''));
    for (const c of clases) arrastrar(GRANDE, $(`.${c}-hijo`));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(clases.length);
  });

  it('A MEDIA PANTALLA (en el contenido) NO recarga ni bloquea el desplazamiento', async () => {
    montar('<div><header class="page-header">Título</header><main class="contenido"><p class="p">mucho texto</p></main></div>');
    const m = arrastrar(GRANDE, $('.p'), 0, 400);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(m.defaultPrevented).toBe(false); // el contenido se desplaza con total libertad
  });

  it('en una pantalla sin cabecera conocida, la franja de arriba cuenta como cabecera', async () => {
    montar('<main class="contenido"><p class="p">sin cabecera</p></main>');
    arrastrar(GRANDE, $('.p'), 0, ALTO_FRANJA_CABECERA - 20);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(1);
  });

  it('pero pasada esa franja, o con el contenido ya desplazado (el que hace scroll es el <body>), no', async () => {
    montar('<main class="contenido"><p class="p">x</p></main>');
    arrastrar(GRANDE, $('.p'), 0, ALTO_FRANJA_CABECERA + 30);
    Object.defineProperty(document.body, 'scrollTop', { value: 200, configurable: true });
    arrastrar(GRANDE, $('.p'), 0, 40);
    Object.defineProperty(document.body, 'scrollTop', { value: 0, configurable: true });
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('desde la cabecera toma el gesto (preventDefault)', () => {
    montar('<header class="page-header"><h2 class="t">T</h2></header>');
    expect(arrastrar(GRANDE, $('.t')).defaultPrevented).toBe(true);
  });

  it('un arrastre corto no recarga', async () => {
    montar('<header class="page-header"><h2 class="t">T</h2></header>');
    arrastrar(UMBRAL, $('.t')); // el dedo avanza UMBRAL pero el indicador solo la mitad
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('deslizar hacia arriba (scroll normal) nunca recarga ni bloquea el desplazamiento', async () => {
    montar('<header class="page-header"><h2 class="t">T</h2></header>');
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
    montar('<header class="page-header"><h2 class="t">hola</h2></header>');
    setScrollY(30);
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('si un contenedor con scroll bajo el dedo ya se desplazó', async () => {
    montar('<div class="lista page-header"><p class="item">x</p></div>');
    Object.defineProperty($('.lista'), 'scrollTop', { value: 40, configurable: true });
    const m = arrastrar(GRANDE, $('.item'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(m.defaultPrevented).toBe(false);
  });

  it('en campos de texto del contenido, y con el teclado abierto (campo enfocado) en cualquier lado', async () => {
    montar('<form><input class="campo"><textarea class="area"></textarea></form><header class="page-header"><p class="t">x</p></header>');
    arrastrar(GRANDE, $('.campo'), 0, 40); // dentro de la franja de arriba, pero es un campo de texto
    arrastrar(GRANDE, $('.area'), 0, 40);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    $('.campo').focus();
    arrastrar(GRANDE, $('.t')); // aunque sea la cabecera, con el teclado abierto no
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('en el contenido de un formulario a medias (data-sin-recarga); solo desde su cabecera, y la app pide confirmar', async () => {
    montar('<div data-sin-recarga><header class="register-header"><span class="cab">Registro</span></header><label class="l">Nombre</label></div>');
    arrastrar(GRANDE, $('.l'), 0, 40); // contenido del formulario, aun en la franja de arriba
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    arrastrar(GRANDE, $('.cab')); // su cabecera sí emite (App.vue pregunta antes de recargar)
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toHaveLength(1);
    expect(hayFormularioAbierto()).toBe(true);
  });

  it('en diálogos, el editor de fotos y los lienzos', async () => {
    montar('<div role="dialog" class="page-header"><p class="d">x</p></div><div class="rec-overlay page-header"><p class="r">x</p></div><div class="swal2-container"><p class="s">x</p></div><canvas class="c"></canvas>');
    for (const sel of ['.d', '.r', '.s', '.c']) arrastrar(GRANDE, $(sel));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
  });

  it('un arrastre más horizontal que vertical (carruseles) no es este gesto', async () => {
    montar('<div class="carrusel page-header">x</div>');
    const m = arrastrar(GRANDE, $('.carrusel'), GRANDE * 2);
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(m.defaultPrevented).toBe(false);
  });

  it('mientras ya está refrescando no vuelve a disparar y lo dice', async () => {
    montar('<header class="page-header"><p class="t">x</p></header>', { refrescando: true });
    arrastrar(GRANDE, $('.t'));
    await w!.vm.$nextTick();
    expect(w!.emitted('refresh')).toBeUndefined();
    expect(w!.find('.ptr-indicador').text()).toContain('Actualizando');
  });

  it('puedeIniciarGesto: regla pura', () => {
    document.body.innerHTML = '<header class="page-header"><h2 id="h">x</h2></header><p id="b">x</p><input id="i">';
    const h = document.getElementById('h'), b = document.getElementById('b'), i = document.getElementById('i');
    expect(puedeIniciarGesto(h, 400, 0)).toBe(true); // cabecera, a cualquier altura
    expect(puedeIniciarGesto(h, 400, 5)).toBe(false); // página desplazada
    expect(puedeIniciarGesto(b, 400, 0)).toBe(false); // contenido a media pantalla
    expect(puedeIniciarGesto(b, 40, 0)).toBe(true); // franja de arriba
    expect(puedeIniciarGesto(i, 40, 0)).toBe(false); // campo de texto
    // el buscador dentro de una cabecera sí deja empezar el gesto, mientras no esté enfocado
    document.body.innerHTML = '<header class="top-bar-top"><input id="q"></header>';
    const q = document.getElementById('q') as HTMLInputElement;
    expect(puedeIniciarGesto(q, 40, 0)).toBe(true);
    q.focus();
    expect(puedeIniciarGesto(q, 40, 0)).toBe(false); // ya enfocado (teclado abierto): no
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
