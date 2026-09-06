/**
 * Panel de administración · categorías: alta, edición con propagación del nombre,
 * eliminación protegida cuando está en uso, y la pantalla de lista.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { withSetup } from './helpers';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';

vi.mock('@/composables/useStorage', () => ({
  uploadCategoriaIcon: vi.fn(async (_f: File, id: string) => `https://cdn.test/cat-${id}.png`),
}));

import { uploadCategoriaIcon } from '@/composables/useStorage';
import {
  crearCategoria,
  editarCategoria,
  eliminarCategoriaAdmin,
  useCategoriasEnVivo,
  useUsoCategorias,
} from '@/composables/useAdminCategorias';
import AdminCategorias from '@/modules/admin/views/AdminCategorias.vue';

const datos = () => ({
  categorias: {
    c1: { id: 'c1', nombre: 'Panadería', descripcion: 'Pan y repostería', icono: '' },
    c2: { id: 'c2', nombre: 'Abarrotes', descripcion: '', icono: 'https://cdn.test/abarrotes.png' },
    c3: { id: 'c3', nombre: 'Flores', descripcion: '', icono: '' },
  },
  tiendas: {
    t1: { nombreTienda: 'Pan Lupita', categoria: 'Panadería', categoriaId: 'c1' },
    t2: { nombreTienda: 'Pan Viejo', categoria: 'Panaderia' }, // sin categoriaId, solo por nombre (sin acento)
    t3: { nombreTienda: 'Tienda', categoria: 'Abarrotes', categoriaId: 'c2' },
  },
  articulos: {
    a1: { nombre: 'Concha', categoria: 'Panadería', categoriaId: 'c1' },
    a2: { nombre: 'Arroz', categoria: 'Abarrotes', categoriaId: 'c2' },
  },
});

let cleanups: Array<() => void> = [];
beforeEach(() => {
  __reset(datos());
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  (uploadCategoriaIcon as any).mockClear();
});
afterEach(() => {
  cleanups.forEach((c) => c());
  cleanups = [];
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('composable', () => {
  it('lista en vivo ordenada por nombre y cuenta el uso por id o por nombre', async () => {
    const { result, unmount } = withSetup(() => {
      const vivo = useCategoriasEnVivo();
      const { uso } = useUsoCategorias(() => vivo.categorias.value);
      return { ...vivo, uso };
    });
    cleanups.push(unmount);
    await flushPromises();
    expect(result.categorias.value.map((c) => c.nombre)).toEqual(['Abarrotes', 'Flores', 'Panadería']);
    expect(result.uso.value.c1).toEqual({ tiendas: 2, articulos: 1 }); // t1 por id, t2 por nombre sin acento
    expect(result.uso.value.c2).toEqual({ tiendas: 1, articulos: 1 });
    expect(result.uso.value.c3).toEqual({ tiendas: 0, articulos: 0 });
  });

  it('crear valida nombre y duplicados, sube el ícono y guarda', async () => {
    await expect(crearCategoria({ nombre: 'A' })).rejects.toThrow(/2 caracteres/);
    await expect(crearCategoria({ nombre: ' panaderia ' })).rejects.toThrow(/Ya existe la categoría "Panadería"/);

    const id = await crearCategoria({ nombre: '  Lácteos ', descripcion: ' Leche y queso ', iconoFile: new File(['x'], 'i.png') });
    expect(__getAt(`categorias/${id}`)).toEqual({ id, nombre: 'Lácteos', descripcion: 'Leche y queso', icono: `https://cdn.test/cat-${id}.png` });
    expect(uploadCategoriaIcon).toHaveBeenCalledTimes(1);
  });

  it('editar renombra y propaga el nombre a tiendas y artículos que la usan, completando categoriaId', async () => {
    const r = await editarCategoria('c1', { nombre: 'Panadería y Repostería', descripcion: 'Pan' });
    expect(r).toEqual({ tiendas: 2, articulos: 1 });
    expect(__getAt('categorias/c1/nombre')).toBe('Panadería y Repostería');
    expect(__getAt('tiendas/t1/categoria')).toBe('Panadería y Repostería');
    expect(__getAt('tiendas/t2')).toMatchObject({ categoria: 'Panadería y Repostería', categoriaId: 'c1' });
    expect(__getAt('articulos/a1/categoria')).toBe('Panadería y Repostería');
    expect(__getAt('tiendas/t3/categoria')).toBe('Abarrotes'); // otras no se tocan
  });

  it('editar sin cambiar el nombre no propaga; conserva el ícono si no se sube otro', async () => {
    const r = await editarCategoria('c2', { nombre: 'Abarrotes', descripcion: 'Todo' });
    expect(r).toEqual({ tiendas: 0, articulos: 0 });
    expect(__getAt('categorias/c2')).toMatchObject({ descripcion: 'Todo', icono: 'https://cdn.test/abarrotes.png' });
    await expect(editarCategoria('c2', { nombre: 'Flores' })).rejects.toThrow(/Ya existe/);
  });

  it('eliminar se bloquea si está en uso y borra si no', async () => {
    await expect(eliminarCategoriaAdmin('c1', { tiendas: 2, articulos: 1 })).rejects.toThrow(/2 tiendas y 1 artículo/);
    expect(__getAt('categorias/c1')).toBeDefined();
    await eliminarCategoriaAdmin('c3', { tiendas: 0, articulos: 0 });
    expect(__getAt('categorias/c3')).toBeUndefined();
  });
});

describe('pantalla AdminCategorias', () => {
  const stubs = { AdminTopbar: true };

  it('lista categorías con su uso y deshabilita eliminar cuando están en uso', async () => {
    const w = mount(AdminCategorias, { global: { stubs } });
    await flushPromises();
    expect(w.findAll('.fila')).toHaveLength(3);
    const pan = w.find('.fila[data-categoria="c1"]');
    expect(pan.find('.nombre').text()).toBe('Panadería');
    expect(pan.find('.uso').text()).toMatch(/2 tiendas.*1 artículo/);
    expect(pan.find('.btn-eliminar').attributes('disabled')).toBeDefined();
    expect(w.find('.fila[data-categoria="c3"] .btn-eliminar').attributes('disabled')).toBeUndefined();
  });

  it('busca por nombre', async () => {
    const w = mount(AdminCategorias, { global: { stubs } });
    await flushPromises();
    await w.find('#buscar-categoria').setValue('flor');
    expect(w.findAll('.fila').map((f) => f.attributes('data-categoria'))).toEqual(['c3']);
  });

  it('crea una categoría desde el modal y aparece en la lista', async () => {
    const w = mount(AdminCategorias, { global: { stubs } });
    await flushPromises();
    await w.find('.head .btn-primary').trigger('click');
    await flushPromises();
    expect(w.find('.modal-title').text()).toBe('Nueva categoría');
    await w.find('#cat-nombre').setValue('Carnicería');
    await w.find('form.modal').trigger('submit');
    await flushPromises();
    expect(w.find('.modal').exists()).toBe(false);
    expect(w.findAll('.fila').map((f) => f.find('.nombre').text())).toEqual(['Abarrotes', 'Carnicería', 'Flores', 'Panadería']);
  });

  it('el modal muestra el error de nombre duplicado y no cierra', async () => {
    const w = mount(AdminCategorias, { global: { stubs } });
    await flushPromises();
    await w.find('.head .btn-primary').trigger('click');
    await w.find('#cat-nombre').setValue('abarrotes');
    await w.find('form.modal').trigger('submit');
    await flushPromises();
    expect(w.find('.modal .error-text').text()).toMatch(/Ya existe/);
    expect(w.find('.modal').exists()).toBe(true);
  });

  it('editar precarga los datos y guarda; eliminar pide confirmación', async () => {
    const w = mount(AdminCategorias, { global: { stubs } });
    await flushPromises();
    await w.find('.fila[data-categoria="c3"] .btn-editar').trigger('click');
    await flushPromises();
    expect((w.find('#cat-nombre').element as HTMLInputElement).value).toBe('Flores');
    await w.find('#cat-nombre').setValue('Florería');
    await w.find('form.modal').trigger('submit');
    await flushPromises();
    expect(__getAt('categorias/c3/nombre')).toBe('Florería');

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false });
    await w.find('.fila[data-categoria="c3"] .btn-eliminar').trigger('click');
    await flushPromises();
    expect(__getAt('categorias/c3')).toBeDefined();

    swalMock.fire.mockResolvedValueOnce({ isConfirmed: true });
    await w.find('.fila[data-categoria="c3"] .btn-eliminar').trigger('click');
    await flushPromises();
    expect(__getAt('categorias/c3')).toBeUndefined();
    expect(w.findAll('.fila')).toHaveLength(2);
  });
});
