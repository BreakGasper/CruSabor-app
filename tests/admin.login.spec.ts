/**
 * Login de administrador: mismo esquema que cliente y tienda (celular + hash bcrypt
 * en la base, sesión en localStorage) y guard de las rutas /admin.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { hashPassword } from '@/composables/usePassword';
import { loginAdmin, findAdminByPhone, crearAdmin } from '@/composables/useAdmin';
import {
  sessionAdmin,
  guardarSesionAdmin,
  cerrarSesionAdmin,
  cargarSesionAdmin,
  isAdminLoggedIn,
} from '@/utils/sessionAdmin';
import { sessionUser } from '@/utils/sessionUser';
import { guardAdmin, RUTA_ADMIN_LOGIN, RUTA_ADMIN_HOME } from '@/modules/admin/adminRoutes';
import AdminLogin from '@/modules/admin/views/AdminLogin.vue';

const TEL = '3312345678';
let hashOk: string;

beforeAll(async () => {
  hashOk = await hashPassword('Clave123');
});

beforeEach(() => {
  __reset({
    admins: {
      'adm-1': { nombre: 'Ana Admin', telefono: TEL, password: hashOk, rol: 'superadmin', activo: true },
      'adm-2': { nombre: 'Inactivo', telefono: '3300000000', password: hashOk, rol: 'admin', activo: false },
    },
  });
  localStorage.clear();
  cerrarSesionAdmin();
  sessionUser.value = null;
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
});
afterEach(() => {
  cerrarSesionAdmin();
  localStorage.clear();
});

const ruta = (path: string, requiereAdmin = false) =>
  ({ path, meta: requiereAdmin ? { requiereAdmin: true } : {} }) as any;

describe('useAdmin', () => {
  it('encuentra al admin por celular aunque venga con guiones', async () => {
    const a = await findAdminByPhone('331-234-5678');
    expect(a?.id).toBe('adm-1');
    expect(a?.nombre).toBe('Ana Admin');
  });

  it('login correcto regresa al admin sin la contraseña y registra el último acceso', async () => {
    const r = await loginAdmin(TEL, 'Clave123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.admin.nombre).toBe('Ana Admin');
      expect((r.admin as any).password).toBeUndefined();
    }
    expect(typeof __getAt('admins/adm-1/ultimoAcceso')).toBe('string');
  });

  it('distingue celular desconocido, cuenta inactiva y contraseña incorrecta', async () => {
    expect(await loginAdmin('3399999999', 'Clave123')).toEqual({ ok: false, motivo: 'no-encontrado' });
    expect(await loginAdmin('3300000000', 'Clave123')).toEqual({ ok: false, motivo: 'inactivo' });
    expect(await loginAdmin(TEL, 'otra')).toEqual({ ok: false, motivo: 'password' });
  });

  it('crearAdmin guarda la contraseña como hash y no permite celulares repetidos', async () => {
    const id = await crearAdmin({ nombre: 'Nuevo', telefono: '333-111-2222', password: 'Secreta1' });
    const guardado = __getAt(`admins/${id}`);
    expect(guardado.telefono).toBe('3331112222');
    expect(guardado.password).not.toBe('Secreta1');
    expect(guardado.password).toMatch(/^\$2[aby]\$/);
    expect(guardado.rol).toBe('admin');
    expect((await loginAdmin('3331112222', 'Secreta1')).ok).toBe(true);
    await expect(crearAdmin({ nombre: 'Otro', telefono: TEL, password: 'Secreta1' })).rejects.toThrow(/Ya existe/);
  });
});

describe('sesión de administrador', () => {
  it('se guarda en localStorage y se recupera al recargar', () => {
    expect(isAdminLoggedIn()).toBe(false);
    guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana', telefono: TEL, rol: 'superadmin', inicio: 'x' });
    expect(isAdminLoggedIn()).toBe(true);
    sessionAdmin.value = null; // simula recarga de la página
    cargarSesionAdmin();
    expect(sessionAdmin.value?.id).toBe('adm-1');
    cerrarSesionAdmin();
    expect(localStorage.getItem('admin')).toBeNull();
    expect(isAdminLoggedIn()).toBe(false);
  });
});

describe('guard de rutas /admin', () => {
  it('sin sesión manda al login las rutas protegidas y deja pasar el resto', () => {
    expect(guardAdmin(ruta(RUTA_ADMIN_HOME, true))).toBe(RUTA_ADMIN_LOGIN);
    expect(guardAdmin(ruta(RUTA_ADMIN_LOGIN))).toBe(true);
    expect(guardAdmin(ruta('/tiendas'))).toBe(true);
  });

  it('con sesión deja pasar a las protegidas y el login redirige al tablero', () => {
    guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana', telefono: TEL, rol: 'superadmin', inicio: 'x' });
    expect(guardAdmin(ruta(RUTA_ADMIN_HOME, true))).toBe(true);
    expect(guardAdmin(ruta(RUTA_ADMIN_LOGIN))).toBe(RUTA_ADMIN_HOME);
  });
});

describe('pantalla AdminLogin', () => {
  const stubs = { ArrowBack: true };

  /** Envía el formulario y espera a que termine la validación (bcrypt es asíncrono por trozos). */
  async function llenar(w: ReturnType<typeof mount>, tel: string, pass: string) {
    await w.find('#admin-phone').setValue(tel);
    await w.find('#admin-pass').setValue(pass);
    await w.find('form').trigger('submit');
    await flushPromises();
    const limite = Date.now() + 5000;
    while (w.find('button[type="submit"]').text().includes('Validando') && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 20));
      await flushPromises();
    }
  }

  it('formatea el celular con guiones mientras se escribe', async () => {
    const w = mount(AdminLogin, { global: { stubs } });
    await w.find('#admin-phone').setValue('3312345678');
    expect((w.find('#admin-phone').element as HTMLInputElement).value).toBe('331-234-5678');
  });

  it('entra, cierra las sesiones de cliente y tienda y va al tablero', async () => {
    sessionUser.value = { id: 'cliente-1' };
    localStorage.setItem('usuario', JSON.stringify({ id: 'cliente-1' }));
    localStorage.setItem('tiendas', JSON.stringify({ id: 't1' }));

    const w = mount(AdminLogin, { global: { stubs } });
    await llenar(w, '3312345678', 'Clave123');

    expect(sessionAdmin.value).toMatchObject({ id: 'adm-1', nombre: 'Ana Admin', rol: 'superadmin' });
    expect(JSON.parse(localStorage.getItem('admin')!).id).toBe('adm-1');
    expect(localStorage.getItem('usuario')).toBeNull();
    expect(localStorage.getItem('tiendas')).toBeNull();
    expect(sessionUser.value).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith(RUTA_ADMIN_HOME);
  });

  it('muestra el error y no crea sesión cuando la contraseña es incorrecta', async () => {
    const w = mount(AdminLogin, { global: { stubs } });
    await llenar(w, '3312345678', 'incorrecta');
    expect(w.find('.error-banner').text()).toMatch(/incorrectos/);
    expect(sessionAdmin.value).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('valida el celular antes de consultar', async () => {
    const w = mount(AdminLogin, { global: { stubs } });
    await llenar(w, '331', 'Clave123');
    expect(w.find('.error-msg').text()).toMatch(/10 dígitos/);
    expect(sessionAdmin.value).toBeNull();
  });
});
