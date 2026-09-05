/**
 * TIENDA · Alta de artículo (ProductForm):
 *  - validaciones de los 3 pasos
 *  - stock editable en la variante base
 *  - al registrar: se guarda con la imagen subida, stock correcto y vuelve al perfil de la tienda
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routerMock, routeMock, swalMock } from './setup';

vi.mock('@/composables/useStorage', () => ({
  uploadArticuloImagen: vi.fn(async (f: File) => `https://cdn.test/${f.name}`),
}));
vi.mock('@/composables/useCategorias', () => ({
  obtenerCategorias: vi.fn(async () => [{ id: 'cat-1', nombre: 'Alimentos y Bebidas' }]),
}));
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class {} }));

import ProductForm from '@/modules/store/components/ProductForm.vue';

const TIENDA = 'tienda-A';
// Dialog de PrimeVue se sustituye por un stub que muestra su contenido para leer los mensajes
const stubs = {
  ArrowBack: true,
  Dialog: { template: '<div class="dlg" v-if="visible"><slot /></div>', props: ['visible'] },
  Button: { template: '<button class="dlg-ok" @click="$emit(\'click\')">{{ label }}</button>', props: ['label'] },
};

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; });

beforeEach(() => {
  __reset({ articulos: {}, categorias: {} });
  routerMock.replace.mockClear();
  routeMock.params = {};
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  (globalThis as any).URL.createObjectURL = () => 'blob:preview';
});

async function montar() {
  const w = mount(ProductForm, { props: { tiendaId: TIENDA, tiendaNombre: 'Postres Lola' }, global: { stubs } });
  cleanups.push(() => w.unmount());
  await flushPromises();
  return w;
}
const mensaje = (w: any) => (w.find('.dlg').exists() ? w.find('.dlg h3').text() : '');
const cerrarDialogo = async (w: any) => { if (w.find('.dlg-ok').exists()) await w.find('.dlg-ok').trigger('click'); };

async function subirImagen(w: any, selector: string, nombre = 'foto.jpg', tipo = 'image/jpeg', bytes = 1000) {
  const input = w.find(selector);
  const file = new File([new Uint8Array(bytes)], nombre, { type: tipo });
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}

async function completarPaso1(w: any) {
  await w.find('input[placeholder="Nombre del artículo"]').setValue('Chocoflan pay');
  await w.find('textarea[placeholder="Descripción breve"]').setValue('Rebanada de chocoflan artesanal');
  await subirImagen(w, 'input[type=file]');
  await w.find('.button-row .modern-button').trigger('click');
}
async function completarPaso2(w: any) {
  const precio = w.find('input[placeholder="$0.00"]');
  await precio.setValue('45');
  await precio.trigger('input');
  await w.find('select.form-input').setValue('pz');
  await w.find('.custom-select').trigger('click');
  await w.find('.dropdown-item').trigger('click');
  await w.findAll('.button-row .modern-button')[1].trigger('click'); // Siguiente
}

describe('ProductForm · validaciones', () => {
  it('paso 1: nombre, descripción e imagen', async () => {
    const w = await montar();
    const siguiente = () => w.find('.button-row .modern-button').trigger('click');

    await siguiente();
    expect(mensaje(w)).toContain('al menos 3 caracteres');
    await cerrarDialogo(w);

    await w.find('input[placeholder="Nombre del artículo"]').setValue('Pay');
    await siguiente();
    expect(mensaje(w)).toContain('descripción debe tener al menos 10');
    await cerrarDialogo(w);

    await w.find('textarea[placeholder="Descripción breve"]').setValue('Rebanada de chocoflan artesanal');
    await siguiente();
    expect(mensaje(w)).toContain('subir una imagen');
    await cerrarDialogo(w);

    // archivo que no es imagen: se rechaza
    await subirImagen(w, 'input[type=file]', 'doc.pdf', 'application/pdf');
    expect(mensaje(w)).toContain('debe ser una imagen');
    await cerrarDialogo(w);
    // imagen demasiado grande
    await subirImagen(w, 'input[type=file]', 'grande.jpg', 'image/jpeg', 6 * 1024 * 1024);
    expect(mensaje(w)).toContain('5 MB');
    await cerrarDialogo(w);

    await subirImagen(w, 'input[type=file]');
    await siguiente();
    expect(w.text()).toContain('Precio & Categoría'); // avanzó
  });

  it('paso 2: precio, unidad y categoría', async () => {
    const w = await montar();
    await completarPaso1(w);
    const siguiente = () => w.findAll('.button-row .modern-button')[1].trigger('click');

    await siguiente();
    expect(mensaje(w)).toContain('mayor a $0');
    await cerrarDialogo(w);

    const precio = w.find('input[placeholder="$0.00"]');
    await precio.setValue('45');
    await precio.trigger('input');
    await siguiente();
    expect(mensaje(w)).toContain('unidad de medida');
    await cerrarDialogo(w);

    await w.find('select.form-input').setValue('pz');
    await siguiente();
    expect(mensaje(w)).toContain('categoría');
    await cerrarDialogo(w);

    await w.find('.custom-select').trigger('click');
    await w.find('.dropdown-item').trigger('click');
    await siguiente();
    expect(w.text()).toContain('Opciones Avanzadas');
  });

  it('paso 3: el stock de la variante base es editable y se valida; SKU repetido se rechaza', async () => {
    const w = await montar();
    await completarPaso1(w);
    await completarPaso2(w);

    const check = w.find('.stock-check');
    expect(check.attributes('disabled')).toBeUndefined(); // ya no está bloqueado
    await check.setValue(true);
    const stock = w.find('.stock-input');
    expect(stock.attributes('disabled')).toBeUndefined();

    // un 0 se corrige solo a 1; un decimal no es válido
    await stock.setValue('0');
    expect((stock.element as HTMLInputElement).value).toBe('1');
    await stock.setValue('2.5');
    await w.findAll('.button-row .modern-button')[1].trigger('click'); // Registrar
    expect(mensaje(w)).toContain('mínimo 1');
    await cerrarDialogo(w);

    // segunda variante con el mismo SKU que la base
    await stock.setValue('5');
    await w.find('.small-button').trigger('click');
    const skus = w.findAll('input[placeholder="Código SKU"]');
    await skus[1].setValue(skus[0].element.value);
    await w.findAll('.button-row .modern-button')[1].trigger('click');
    expect(mensaje(w)).toContain('repetido');
    await cerrarDialogo(w);

    // variante nueva incompleta: pide color
    await skus[1].setValue('OTRO-SKU');
    await w.findAll('.button-row .modern-button')[1].trigger('click');
    expect(mensaje(w)).toContain('color para la variante 2');
  });
});

describe('ProductForm · registro', () => {
  it('guarda el artículo con imagen subida, stock de la base y vuelve al perfil de la tienda', async () => {
    const w = await montar();
    await completarPaso1(w);
    await completarPaso2(w);

    await w.find('.stock-check').setValue(true);
    await w.find('.stock-input').setValue('12');
    await w.findAll('.button-row .modern-button')[1].trigger('click'); // Registrar
    await flushPromises();
    await flushPromises();

    const articulos = Object.values(__getAt('articulos') || {}) as any[];
    expect(articulos).toHaveLength(1);
    const a = articulos[0];
    expect(a).toMatchObject({ nombre: 'Chocoflan pay', precio: 45, tiendaId: TIENDA, categoria: 'Alimentos y Bebidas', categoriaId: 'cat-1', unidadMedida: 'pz' });
    expect(a.url).toBe('https://cdn.test/foto.jpg'); // no la vista previa blob:
    expect(a.variantes).toHaveLength(1);
    expect(a.variantes[0]).toMatchObject({ isDefault: true, tieneStock: true, stock: 12, precio: 45, url: 'https://cdn.test/foto.jpg' });
    expect(a.variantes[0].sku).toMatch(/^CRU-/);
    expect(a.variantes[0]._file).toBeUndefined();

    expect(swalMock.fire).toHaveBeenCalledTimes(1);
    expect((swalMock.fire.mock.calls[0][0] as any).title).toBe('Artículo registrado');
    expect(routerMock.replace).toHaveBeenCalledWith(`/store/profile/${TIENDA}`);
  });

  it('sin stock marcado guarda stock ilimitado (-1)', async () => {
    const w = await montar();
    await completarPaso1(w);
    await completarPaso2(w);
    await w.findAll('.button-row .modern-button')[1].trigger('click');
    await flushPromises();
    await flushPromises();
    const a = (Object.values(__getAt('articulos') || {}) as any[])[0];
    expect(a.variantes[0]).toMatchObject({ tieneStock: false, stock: -1 });
  });

  it('edición: conserva la imagen guardada si no se sube otra y vuelve al perfil', async () => {
    __reset({
      articulos: {
        'art-1': {
          nombre: 'Jericalla', descripcion: 'Postre tradicional tapatío', url: 'https://cdn.test/vieja.jpg', precio: 32,
          unidadMedida: 'pz', categoria: 'Alimentos y Bebidas', categoriaId: 'cat-1', tiendaId: TIENDA, tiendaNombre: 'Postres Lola',
          variantes: [{ isDefault: true, sku: 'CRU-1', color: 'Gris', tamano: 'Otro', material: 'Otro', detalle: 'Producto Base', precio: 32, stock: -1, tieneStock: false, url: 'https://cdn.test/vieja.jpg' }],
        },
      },
      categorias: {},
    });
    routeMock.params = { articuloId: 'art-1' };
    const w = await montar();
    await flushPromises();

    await w.find('.button-row .modern-button').trigger('click'); // paso 2
    await w.findAll('.button-row .modern-button')[1].trigger('click'); // paso 3
    await w.find('.stock-check').setValue(true);
    await w.find('.stock-input').setValue('3');
    expect(w.findAll('.button-row .modern-button')[1].text()).toBe('Guardar cambios');
    await w.findAll('.button-row .modern-button')[1].trigger('click');
    await flushPromises();
    await flushPromises();

    const a = __getAt('articulos/art-1') as any;
    expect(a.url).toBe('https://cdn.test/vieja.jpg');
    expect(a.variantes[0]).toMatchObject({ stock: 3, tieneStock: true, url: 'https://cdn.test/vieja.jpg' });
    expect(routerMock.replace).toHaveBeenCalledWith(`/store/profile/${TIENDA}`);
  });
});
