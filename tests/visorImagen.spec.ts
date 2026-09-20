/**
 * Ver imagen completa.
 *
 * La portada del producto va recortada (`object-fit: cover`) para que llene su
 * marco. Este botón abre la foto entera sobre fondo oscuro, sin tocar la portada.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VisorImagen from '@/components/VisorImagen.vue';

const FOTO = 'https://cdn.test/pastel.jpg';

let w: any = null;
beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  w?.unmount();
  w = null;
  document.body.style.overflow = '';
});

function montar(props: Record<string, unknown> = {}) {
  w = mount(VisorImagen, {
    attachTo: document.body,
    props: { src: FOTO, alt: 'Pastel de chocolate', ...props },
  });
  return w;
}

const visor = () => document.querySelector('.visor-fondo');
const imagenGrande = () => document.querySelector<HTMLImageElement>('.visor-img');

describe('VisorImagen · el botón', () => {
  it('muestra la leyenda "Ver imagen completa" con su icono', () => {
    montar();
    const boton = w.get('button.visor-abrir');
    expect(boton.text()).toContain('Ver imagen completa');
    expect(boton.attributes('aria-label')).toBe('Ver imagen completa');
    expect(boton.find('svg').exists()).toBe(true); // el icono de lucide
  });

  it('puede quedarse solo con el icono', () => {
    montar({ mostrarTexto: false });
    expect(w.get('button.visor-abrir').text()).not.toContain('Ver imagen');
    // sin texto visible, la etiqueta accesible se conserva
    expect(w.get('button.visor-abrir').attributes('aria-label')).toBe('Ver imagen completa');
  });

  it('tiene un solo nodo raíz, para heredar los estilos scoped de la pantalla', () => {
    montar();
    // con dos raíces (botón + Teleport) Vue no pasa el data-v- del padre
    expect(w.element.tagName).toBe('SPAN');
    expect(w.element.classList.contains('visor')).toBe(true);
  });
});

describe('VisorImagen · abrir y cerrar', () => {
  it('al pulsar muestra la imagen completa sobre el fondo', async () => {
    montar();
    expect(visor()).toBeNull();

    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();

    expect(visor()).not.toBeNull();
    expect(imagenGrande()!.getAttribute('src')).toBe(FOTO);
    expect(imagenGrande()!.getAttribute('alt')).toBe('Pastel de chocolate');
    expect(visor()!.getAttribute('role')).toBe('dialog');
  });

  it('se monta en <body>, fuera del contenedor que lo recortaría', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();
    // lo que importa es que salga del subárbol del componente (el contenedor
    // de la imagen tiene overflow:hidden), no de qué nodo cuelga exactamente
    expect(document.body.contains(visor())).toBe(true);
    expect(w.element.contains(visor())).toBe(false);
  });

  it('cierra con la ✕', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();

    document.querySelector<HTMLButtonElement>('.visor-cerrar')!.click();
    await flushPromises();
    expect(visor()).toBeNull();
  });

  it('cierra al tocar el fondo, pero no al tocar la foto', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();

    // clic sobre la foto: sigue abierto
    imagenGrande()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(visor()).not.toBeNull();

    // clic en el fondo mismo: cierra
    visor()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(visor()).toBeNull();
  });

  it('cierra con Escape', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(visor()).toBeNull();
  });
});

describe('VisorImagen · desplazamiento del fondo', () => {
  it('bloquea el scroll mientras está abierto y lo devuelve al cerrar', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(document.body.style.overflow).toBe('');
  });

  it('si la pantalla se desmonta con el visor abierto, el fondo queda usable', async () => {
    montar();
    await w.get('button.visor-abrir').trigger('click');
    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');

    w.unmount();
    w = null;
    expect(document.body.style.overflow).toBe('');
  });
});
