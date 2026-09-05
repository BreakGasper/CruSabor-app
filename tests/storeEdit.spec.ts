/**
 * TIENDA · Editar mi tienda desde el perfil (solo la dueña o dueño):
 *  - el botón y el modal aparecen solo con sesión de esa tienda
 *  - validaciones por pestaña
 *  - guarda en Firebase, refresca el perfil y la sesión, sin tocar la contraseña
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, swalMock } from './setup';

vi.mock('@/composables/useCategorias', () => ({
  obtenerCategorias: vi.fn(async () => [
    { id: 'c1', nombre: 'Alimentos y Bebidas' },
    { id: 'c2', nombre: 'Electrónica' },
  ]),
}));
vi.mock('@/composables/useStorage', () => ({
  uploadStoreLogo: vi.fn(async () => 'https://cdn.test/logo-nuevo.png'),
  uploadStoreBanner: vi.fn(async () => 'https://cdn.test/banner-nuevo.png'),
  uploadStoreGallery: vi.fn(async () => []),
}));

import StoreProfile from '@/modules/store/views/StoreProfile.vue';
import StoreEditModal from '@/modules/store/components/StoreEditModal.vue';

const T = 'tienda-A';
const tienda = () => ({
  nombreTienda: 'Postres Lola',
  categoria: 'Alimentos y Bebidas',
  descripcion: 'Postres artesanales',
  telefono: '3751241116',
  incluyeWhatsapp: true,
  email: 'lola@test.com',
  calle: 'Avila Camacho',
  numero: '189',
  colonia: 'El Crucero',
  cp: '46798',
  municipio: 'Ameca',
  estado: 'Jalisco',
  metodosPago: ['Efectivo'],
  envioDomicilio: true,
  zonasEntrega: ['Centro'],
  horario: { Lunes: { inicio: '09:00', fin: '18:00' } },
  password: 'HASH-SECRETO',
  logoUrl: 'https://cdn.test/logo.png',
  bannerUrl: '',
});

const stubs = { ArrowBack: true, FontAwesomeIcon: true, PageHeader: true, transition: false };
let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; localStorage.clear(); });

beforeEach(() => {
  __reset({ tiendas: { [T]: tienda() }, articulos: {}, pedidos: {} });
  routeMock.params = { id: T };
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  (globalThis as any).URL.createObjectURL = () => 'blob:preview';
});

async function montarPerfil() {
  const w = mount(StoreProfile, { global: { stubs } });
  cleanups.push(() => w.unmount());
  await flushPromises();
  await flushPromises();
  return w;
}

describe('StoreProfile · acceso a edición', () => {
  it('un visitante no ve el botón de editar', async () => {
    const w = await montarPerfil();
    expect(w.text()).toContain('Postres Lola');
    expect(w.find('.btn-editar-tienda').exists()).toBe(false);
    expect(w.find('.editar-btn').exists()).toBe(false);
    expect(w.find('.se-modal').exists()).toBe(false);
  });

  it('la dueña o dueño ve el botón y abre el modal con sus datos cargados', async () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: T, nombreTienda: 'Postres Lola', telefono: '3751241116' }));
    const w = await montarPerfil();
    expect(w.find('.btn-editar-tienda').exists()).toBe(true);
    await w.find('.btn-editar-tienda').trigger('click');
    expect(w.find('.se-modal').exists()).toBe(true);
    expect((w.find('.se-modal input[maxlength="60"]').element as HTMLInputElement).value).toBe('Postres Lola');
  });

  it('otra tienda logueada tampoco puede editar esta', async () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: 'otra-tienda' }));
    const w = await montarPerfil();
    expect(w.find('.btn-editar-tienda').exists()).toBe(false);
  });
});

describe('StoreEditModal', () => {
  function montarModal(extra: Record<string, any> = {}) {
    const w = mount(StoreEditModal, { props: { visible: true, tienda: { tiendaId: T, ...tienda(), ...extra } as any } });
    cleanups.push(() => w.unmount());
    return w;
  }
  const campo = (w: any, tab: string, sel: string) => w.findAll('.se-section')[['datos', 'contacto', 'ubicacion', 'ventas', 'horario'].indexOf(tab)].find(sel);

  it('valida y salta a la pestaña con el primer error', async () => {
    const w = montarModal();
    await flushPromises();

    await campo(w, 'contacto', 'input[type=tel]').setValue('123');
    await w.find('form').trigger('submit');
    expect(w.find('.se-error-general').text()).toContain('Revisa los campos');
    expect(w.find('.se-tab.active').text()).toBe('Contacto');
    expect(campo(w, 'contacto', 'small:not(.hint)').text()).toContain('10 dígitos');
    expect(__getAt(`tiendas/${T}/telefono`)).toBe('3751241116'); // no se guardó
    expect(w.emitted('saved')).toBeUndefined();

    // horario incoherente
    await campo(w, 'contacto', 'input[type=tel]').setValue('3751241116');
    const horas = w.findAll('.se-section')[4].findAll('input[type=time]');
    await horas[0].setValue('18:00');
    await horas[1].setValue('09:00');
    await w.find('form').trigger('submit');
    expect(w.find('.se-tab.active').text()).toBe('Horario');
    expect(w.text()).toContain('la apertura debe ser antes del cierre');

    // sin métodos de pago
    await horas[0].setValue('09:00');
    await horas[1].setValue('18:00');
    await w.findAll('.se-section')[3].find('.se-chip input').setValue(false);
    await w.find('form').trigger('submit');
    expect(w.find('.se-tab.active').text()).toBe('Ventas');
    expect(w.text()).toContain('al menos un método de pago');
  });

  it('guarda solo los cambios, sube el logo nuevo y no toca la contraseña', async () => {
    const w = montarModal();
    await flushPromises();

    await campo(w, 'datos', 'input[maxlength="60"]').setValue('Postres Lola Deluxe');
    await campo(w, 'datos', 'textarea').setValue('Postres, pasteles y mesas de dulces');
    await campo(w, 'contacto', 'input[type=email]').setValue('hola@lola.mx');
    // método de pago extra y una zona nueva
    await w.findAll('.se-section')[3].findAll('.se-chip input')[2].setValue(true); // Transferencia
    await w.findAll('.se-section')[3].find('.se-zona-add input').setValue('La Villa');
    await w.findAll('.se-section')[3].find('.se-zona-add button').trigger('click');
    // logo
    const logo = w.findAll('input[type=file]')[1];
    Object.defineProperty(logo.element, 'files', { value: [new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' })], configurable: true });
    await logo.trigger('change');

    await w.find('form').trigger('submit');
    await flushPromises();
    await flushPromises();

    const guardada = __getAt(`tiendas/${T}`) as any;
    expect(guardada).toMatchObject({
      nombreTienda: 'Postres Lola Deluxe',
      descripcion: 'Postres, pasteles y mesas de dulces',
      email: 'hola@lola.mx',
      metodosPago: ['Efectivo', 'Transferencia'],
      zonasEntrega: ['Centro', 'La Villa'],
      logoUrl: 'https://cdn.test/logo-nuevo.png',
      telefono: '3751241116',
    });
    expect(guardada.password).toBe('HASH-SECRETO'); // intacta
    expect(guardada.horario.Lunes).toEqual({ inicio: '09:00', fin: '18:00' });
    expect(guardada.horario.Domingo).toEqual({ inicio: '', fin: '' });

    const emitido = w.emitted('saved')![0][0] as any;
    expect(emitido.nombreTienda).toBe('Postres Lola Deluxe');
    expect(emitido.password).toBeUndefined();
  });

  it('desactivar envío a domicilio limpia las zonas de entrega', async () => {
    const w = montarModal();
    await flushPromises();
    await w.findAll('.se-section')[3].findAll('.se-check input')[0].setValue(false);
    await w.find('form').trigger('submit');
    await flushPromises();
    expect(__getAt(`tiendas/${T}`)).toMatchObject({ envioDomicilio: false, zonasEntrega: [] });
  });
});

describe('StoreProfile · después de guardar', () => {
  it('refresca el perfil y la sesión de la tienda', async () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: T, nombre: 'Postres Lola', nombreTienda: 'Postres Lola', telefono: '3751241116' }));
    const w = await montarPerfil();
    await w.find('.btn-editar-tienda').trigger('click');
    await w.find('.se-modal input[maxlength="60"]').setValue('Dulces Lola');
    await w.find('.se-modal form').trigger('submit');
    await flushPromises();
    await flushPromises();

    expect(w.find('.se-modal').exists()).toBe(false);
    expect(w.find('.store-name').text()).toBe('Dulces Lola');
    const sesion = JSON.parse(localStorage.getItem('tiendas')!);
    expect(sesion.nombreTienda).toBe('Dulces Lola');
    expect(sesion.nombre).toBe('Dulces Lola');
    expect((swalMock.fire.mock.calls.at(-1)![0] as any).title).toBe('Tienda actualizada');
  });
});
