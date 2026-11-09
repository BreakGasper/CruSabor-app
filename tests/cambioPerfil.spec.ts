/**
 * Cambio de perfil del admin: ve el cliente y las tiendas de su mismo celular,
 * entra sin contraseña, conserva su sesión de admin y puede volver al panel.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routerMock, routeMock } from './setup';
import { sessionUser, cerrarSesion } from '@/utils/sessionUser';
import { sessionAdmin, guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { leerSesionTienda } from '@/composables/cuentaTienda';
import { perfilesDelCelular } from '@/composables/cambioPerfil';
import AdminTopbar from '@/modules/admin/components/AdminTopbar.vue';
import VolverAdmin from '@/components/VolverAdmin.vue';

const TEL = '3312345678';
const OTRO = '3399999999';

const datos = () => ({
  usuarios: { u1: { celular: TEL, nombre: 'Ana', pass: 'hash-cliente' }, u2: { celular: OTRO, nombre: 'Otro', pass: 'x' } },
  tiendas: {
    t1: { telefono: TEL, nombreTienda: 'Uno', password: 'hash-tienda' },
    t2: { telefono: TEL, nombreTienda: 'Dos', password: 'hash-tienda' },
    t3: { telefono: OTRO, nombreTienda: 'Ajena', password: 'x' },
  },
});

const montarBarra = async () => {
  const w = mount(AdminTopbar, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, teleport: true } } });
  await w.find('[data-test="abrir-perfiles"]').trigger('click');
  await flushPromises();
  return w;
};

beforeEach(() => {
  localStorage.clear();
  cerrarSesion();
  routerMock.push.mockClear();
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Admin', telefono: TEL, rol: 'superadmin', inicio: '2026-11-09T00:00:00Z' });
  __reset(datos());
});
afterEach(() => {
  cerrarSesionAdmin();
  cerrarSesion();
  localStorage.clear();
});

describe('perfiles del celular', () => {
  it('solo encuentra el cliente y las tiendas de ese número', async () => {
    const p = await perfilesDelCelular(TEL);
    expect(p.cliente?.nombre).toBe('Ana');
    expect(p.tiendas.map((t) => t.nombreTienda).sort()).toEqual(['Dos', 'Uno']);
  });
});

describe('selector junto a la campana', () => {
  it('lista solo los perfiles que tiene el celular del admin', async () => {
    const w = await montarBarra();
    expect(w.findAll('[data-test="perfil-cliente"]')).toHaveLength(1);
    const tiendas = w.findAll('[data-test="perfil-tienda"]').map((b) => b.text());
    expect(tiendas).toHaveLength(2);
    expect(tiendas.join()).not.toContain('Ajena');
  });

  it('avisa cuando el celular no tiene otros perfiles', async () => {
    __reset({ usuarios: {}, tiendas: {} });
    const w = await montarBarra();
    expect(w.text()).toContain('no tiene otros perfiles');
    expect(w.findAll('[data-test="perfil-tienda"]')).toHaveLength(0);
  });

  it('cambiar a cliente abre su sesión sin contraseña y conserva la de admin', async () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: 't1' }));
    const w = await montarBarra();
    await w.find('[data-test="perfil-cliente"]').trigger('click');
    expect(sessionUser.value).toMatchObject({ id: 'u1', nombre: 'Ana', telefono: TEL });
    expect(JSON.stringify(sessionUser.value)).not.toContain('hash-cliente');
    expect(localStorage.getItem('tiendas')).toBeNull();
    expect(sessionAdmin.value?.id).toBe('adm-1');
    expect(routerMock.push).toHaveBeenCalledWith('/');
  });

  it('cambiar a tienda abre esa tienda con su cuenta y cierra la de cliente', async () => {
    const w = await montarBarra();
    await w.find('[data-test="perfil-cliente"]').trigger('click');
    const r = await montarBarra();
    const boton = r.findAll('[data-test="perfil-tienda"]').find((b) => b.text().includes('Dos'))!;
    await boton.trigger('click');
    const sesion = leerSesionTienda();
    expect(sesion).toMatchObject({ id: 't2', nombreTienda: 'Dos', telefono: TEL });
    expect(sesion?.cuenta).toHaveLength(2);
    expect(localStorage.getItem('tiendas')).not.toContain('hash-tienda');
    expect(sessionUser.value).toBeNull();
    expect(sessionAdmin.value?.id).toBe('adm-1');
    expect(routerMock.push).toHaveBeenLastCalledWith('/store/profile');
  });
});

describe('volver a admin', () => {
  const montarBoton = (path: string) => {
    (routeMock as any).path = path;
    return mount(VolverAdmin);
  };

  it('se ve fuera del panel y regresa cerrando el otro perfil', async () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: 't1' }));
    const w = montarBoton('/store/profile');
    await w.find('button').trigger('click');
    expect(localStorage.getItem('tiendas')).toBeNull();
    expect(sessionAdmin.value?.id).toBe('adm-1');
    expect(routerMock.push).toHaveBeenCalledWith('/admin');
  });

  it('no se ve dentro del panel ni sin sesión de admin', () => {
    expect(montarBoton('/admin/tiendas').find('button').exists()).toBe(false);
    cerrarSesionAdmin();
    expect(montarBoton('/').find('button').exists()).toBe(false);
  });
});
