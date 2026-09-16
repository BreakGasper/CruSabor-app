/**
 * Cuentas de administrador: gestión (crear, editar, contraseña, activar/desactivar con sus
 * reglas) y elección "cliente o administrador" al entrar con un celular que es de ambos.
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt, __getTree } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { flush, withSetup } from './helpers';
import { hashPassword, validatePasswordHash } from '@/composables/usePassword';
import {
  crearAdmin,
  actualizarAdmin,
  cambiarPasswordAdmin,
  motivoBloqueoCambio,
  useAdminsEnVivo,
  type Admin,
} from '@/composables/useAdmin';
import { sessionAdmin, cerrarSesionAdmin, guardarSesionAdmin } from '@/utils/sessionAdmin';
import { sessionUser } from '@/utils/sessionUser';

// Login.vue usa el router de la app directamente
vi.mock('@/router', () => ({ default: routerMock }));
import Login from '@/modules/home/components/Login.vue';
import AdminCuentas from '@/modules/admin/views/AdminCuentas.vue';
import { __setConfiguracion } from '@/composables/useConfiguracion';

const TEL = '3751241114';
let hashCliente: string;
let hashAdmin: string;

beforeAll(async () => {
  hashCliente = await hashPassword('Cliente123');
  hashAdmin = await hashPassword('Admin123');
});

beforeEach(() => {
  __reset({
    admins: {
      'adm-1': { nombre: 'Carlos Super', telefono: TEL, password: hashAdmin, rol: 'superadmin', activo: true },
      'adm-2': { nombre: 'Beto Admin', telefono: '3300000001', password: hashAdmin, rol: 'admin', activo: true },
    },
    usuarios: {
      'u-1': { id: 'u-1', nombre: 'Carlos Gaspar', celular: TEL, pass: hashCliente, email: 'c@test.com', tipo: 'client' },
      'u-2': { id: 'u-2', nombre: 'Solo Cliente', celular: '3399999999', pass: hashCliente, tipo: 'client' },
    },
  });
  localStorage.clear();
  cerrarSesionAdmin();
  sessionUser.value = null as any;
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
});
afterEach(() => {
  cerrarSesionAdmin();
  localStorage.clear();
});

const todos = (): Admin[] => Object.entries(__getAt('admins')).map(([id, a]: any) => ({ ...a, id, activo: a.activo !== false }));

describe('Gestión de cuentas', () => {
  it('crea una cuenta con hash y valida datos', async () => {
    const id = await crearAdmin({ nombre: 'Nueva', telefono: '331-111-2222', password: 'Clave123', rol: 'admin', creadoPor: 'adm-1' });
    const a = __getAt(`admins/${id}`);
    expect(a).toMatchObject({ nombre: 'Nueva', telefono: '3311112222', rol: 'admin', activo: true, creadoPor: 'adm-1' });
    expect(await validatePasswordHash('Clave123', a.password)).toBe(true);
    await expect(crearAdmin({ nombre: 'X', telefono: TEL, password: 'Clave123' })).rejects.toThrow(/nombre/);
    await expect(crearAdmin({ nombre: 'Otra', telefono: TEL, password: 'Clave123' })).rejects.toThrow(/Ya existe/);
    await expect(crearAdmin({ nombre: 'Otra', telefono: '3312223333', password: '123' })).rejects.toThrow(/contraseña/);
  });

  it('edita nombre y rol, cambia la contraseña y activa/desactiva', async () => {
    await actualizarAdmin('adm-2', { nombre: 'Beto Nuevo', rol: 'superadmin' });
    expect(__getAt('admins/adm-2')).toMatchObject({ nombre: 'Beto Nuevo', rol: 'superadmin' });
    await cambiarPasswordAdmin('adm-2', 'Nueva123');
    expect(await validatePasswordHash('Nueva123', __getAt('admins/adm-2/password'))).toBe(true);
    await actualizarAdmin('adm-2', { activo: false });
    expect(__getAt('admins/adm-2/activo')).toBe(false);
    await expect(cambiarPasswordAdmin('adm-2', '12')).rejects.toThrow(/contraseña/);
  });

  it('reglas: solo superadmin, no auto-desactivarse y siempre un superadmin activo', () => {
    const yo = { id: 'adm-1', rol: 'superadmin' as const };
    const lista = todos();
    const a1 = lista.find((a) => a.id === 'adm-1')!;
    const a2 = lista.find((a) => a.id === 'adm-2')!;
    expect(motivoBloqueoCambio({ id: 'adm-2', rol: 'admin' }, a1, { activo: false }, lista)).toMatch(/superadministrador/);
    expect(motivoBloqueoCambio(yo, a1, { activo: false }, lista)).toMatch(/propia cuenta/);
    expect(motivoBloqueoCambio(yo, a1, { rol: 'admin' }, lista)).toMatch(/quitarte/);
    expect(motivoBloqueoCambio(yo, a2, { activo: false }, lista)).toBeNull();
    // Si el otro fuera el único superadmin activo, no se puede desactivar
    const soloOtro = lista.map((a) => (a.id === 'adm-1' ? { ...a, rol: 'admin' as const } : { ...a, rol: 'superadmin' as const }));
    expect(motivoBloqueoCambio({ id: 'adm-1', rol: 'superadmin' }, soloOtro[1], { activo: false }, soloOtro)).toMatch(/al menos un superadministrador/);
  });

  it('useAdminsEnVivo lista sin contraseña y ordenado', async () => {
    const { result, unmount } = withSetup(() => useAdminsEnVivo());
    await flush();
    expect(result.admins.value.map((a) => a.nombre)).toEqual(['Beto Admin', 'Carlos Super']);
    expect(result.admins.value[0].password).toBeUndefined();
    unmount();
  });

  it('la vista muestra las cuentas y solo el superadmin ve acciones', async () => {
    guardarSesionAdmin({ id: 'adm-2', nombre: 'Beto', telefono: '3300000001', rol: 'admin', inicio: 'x' });
    let w = mount(AdminCuentas, { global: { stubs: { AdminTopbar: true } } });
    await flushPromises();
    expect(w.findAll('.fila')).toHaveLength(2);
    expect(w.find('.aviso').exists()).toBe(true);
    expect(w.find('.btn-primary').exists()).toBe(false);
    w.unmount();

    guardarSesionAdmin({ id: 'adm-1', nombre: 'Carlos', telefono: TEL, rol: 'superadmin', inicio: 'x' });
    w = mount(AdminCuentas, { global: { stubs: { AdminTopbar: true } } });
    await flushPromises();
    expect(w.find('.btn-primary').exists()).toBe(true);
    const propia = w.find('[data-admin="adm-1"]');
    expect(propia.find('.btn-eliminar').attributes('disabled')).toBeDefined(); // no puede desactivarse
    expect(w.find('[data-admin="adm-2"] .btn-eliminar').attributes('disabled')).toBeUndefined();
    w.unmount();
  });
});

describe('Login: celular de cliente y administrador', () => {
  const stubs = { ArrowBack: true, TopBarFija: true, ForgotPassword: true, CustomToast: true };

  async function enviar(w: ReturnType<typeof mount>, tel: string, pass: string) {
    const inputs = w.findAll('input');
    await inputs[0].setValue(tel);
    await inputs[1].setValue(pass);
    await w.find('form').trigger('submit');
    await flushPromises();
    const limite = Date.now() + 5000;
    while (!w.find('.eleccion-acceso').exists() && !routerMock.replace.mock.calls.length && !w.text().includes('❌') && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 20));
      await flushPromises();
    }
  }

  it('oculta "¿Tienes una tienda?" cuando el registro de tiendas está cerrado', async () => {
    __setConfiguracion({ registro: { tiendasAbierto: false } });
    const w = mount(Login, { global: { stubs } });
    await flushPromises();
    expect(w.find('.switch-link').exists()).toBe(false);

    __setConfiguracion({ registro: { tiendasAbierto: true } });
    await flushPromises();
    expect(w.find('.switch-link').exists()).toBe(true);

    w.unmount();
    __setConfiguracion(null); // vuelve a suscribirse al mock para las demás pruebas
  });

  it('con un celular que también es admin pregunta cómo entrar; como cliente crea la sesión de cliente', async () => {
    const w = mount(Login, { global: { stubs } });
    await enviar(w, '3751241114', 'Cliente123');
    expect(w.find('.eleccion-acceso').exists()).toBe(true);
    expect(sessionUser.value).toBeNull();

    await w.find('.eleccion-btn.cliente').trigger('click');
    expect(sessionUser.value).toMatchObject({ id: 'u-1', nombre: 'Carlos Gaspar' });
    expect(sessionAdmin.value).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith('/');
    w.unmount();
  });

  it('como administrador con la misma contraseña entra directo al panel', async () => {
    // El admin comparte la contraseña del cliente
    __reset({ ...__getTree(), admins: { 'adm-1': { nombre: 'Carlos Super', telefono: TEL, password: hashCliente, rol: 'superadmin', activo: true } } });
    const w = mount(Login, { global: { stubs } });
    await enviar(w, '3751241114', 'Cliente123');
    await w.find('.eleccion-btn.admin').trigger('click');
    await flushPromises();
    const limite = Date.now() + 5000;
    while (!sessionAdmin.value && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 20));
      await flushPromises();
    }
    expect(sessionAdmin.value).toMatchObject({ id: 'adm-1', rol: 'superadmin' });
    expect(sessionUser.value).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith('/admin');
    w.unmount();
  });

  it('como administrador con contraseña distinta avisa y manda al acceso del panel con el celular', async () => {
    const w = mount(Login, { global: { stubs } });
    await enviar(w, '3751241114', 'Cliente123');
    expect(w.find('.eleccion-acceso').exists()).toBe(true);

    await w.find('.eleccion-btn.admin').trigger('click');
    let limite = Date.now() + 5000;
    while (!w.find('.eleccion-error').exists() && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 20));
      await flushPromises();
    }
    expect(w.find('.eleccion-error').text()).toMatch(/distinta/);
    expect(sessionAdmin.value).toBeNull();
    limite = Date.now() + 3000;
    while (!routerMock.push.mock.calls.length && Date.now() < limite) await new Promise((r) => setTimeout(r, 50));
    expect(routerMock.push).toHaveBeenCalledWith({ path: '/admin/login', query: { tel: TEL } });
    w.unmount();
  });

  it('un celular que solo es cliente entra directo sin preguntar', async () => {
    const w = mount(Login, { global: { stubs } });
    await enviar(w, '3399999999', 'Cliente123');
    expect(w.find('.eleccion-acceso').exists()).toBe(false);
    expect(sessionUser.value).toMatchObject({ id: 'u-2' });
    expect(routerMock.replace).toHaveBeenCalledWith('/');
    w.unmount();
  });
});
