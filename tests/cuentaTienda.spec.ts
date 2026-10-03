/**
 * Varias tiendas con un mismo celular (hasta 3, misma contraseña):
 * registro, login con elección de tienda, cambiar de tienda y límite al editar el teléfono.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { hashPassword } from '@/composables/usePassword';
import {
  MAX_TIENDAS_POR_TELEFONO,
  revisarTelefonoNuevaTienda,
  tiendasConPassword,
  cambiarTiendaActiva,
  leerSesionTienda,
  guardarSesionTienda,
} from '@/composables/cuentaTienda';
import StoreLogin from '@/modules/store/views/StoreLogin.vue';

const TEL = '3312345678';
let HASH_A = '';
let HASH_B = '';
beforeAll(async () => {
  HASH_A = await hashPassword('clave1');
  HASH_B = await hashPassword('otra22');
});

const tienda = (nombre: string, password: string, telefono = TEL) => ({ nombreTienda: nombre, telefono, password, calle: 'Juárez' });

beforeEach(() => {
  localStorage.clear();
  routerMock.replace.mockClear();
  routerMock.push.mockClear();
});
afterEach(() => localStorage.clear());

describe('reglas de la cuenta', () => {
  it(`el máximo es ${MAX_TIENDAS_POR_TELEFONO} tiendas por celular`, () => {
    expect(MAX_TIENDAS_POR_TELEFONO).toBe(3);
  });

  it('registrar otra tienda: libre, agregar con la misma contraseña, rechazar otra contraseña o el máximo', async () => {
    __reset({ tiendas: {} });
    expect(await revisarTelefonoNuevaTienda(TEL, 'clave1')).toBe('libre');

    __reset({ tiendas: { t1: tienda('Uno', HASH_A) } });
    expect(await revisarTelefonoNuevaTienda(TEL, 'clave1')).toBe('agregar');
    expect(await revisarTelefonoNuevaTienda(TEL, 'otra22')).toBe('password');

    __reset({ tiendas: { t1: tienda('Uno', HASH_A), t2: tienda('Dos', HASH_A), t3: tienda('Tres', HASH_A) } });
    expect(await revisarTelefonoNuevaTienda(TEL, 'clave1')).toBe('limite');
  });

  it('la contraseña solo abre las tiendas que la comparten', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A), t2: tienda('Dos', HASH_B), t3: tienda('Ajena', HASH_A, '3399999999') } });
    expect((await tiendasConPassword(TEL, 'clave1')).map((t) => t.id)).toEqual(['t1']);
  });
});

describe('login de tiendas', () => {
  const entrar = async (telefono: string, password: string) => {
    const w = mount(StoreLogin, { global: { stubs: { TopBarFija: true, MarcaCrustore: true } } });
    await w.find('input[type=tel], input[inputmode=numeric]').setValue(telefono);
    await w.find('input[autocomplete="current-password"]').setValue(password);
    await w.find('form').trigger('submit');
    // Comparar contraseñas (bcrypt) tarda; con toda la suite corriendo, más
    await vi.waitFor(() => expect(w.text()).not.toContain('Validando'), { timeout: 8000 });
    await flushPromises();
    return w;
  };

  it('con una sola tienda entra directo', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A) } });
    await entrar(TEL, 'clave1');
    expect(routerMock.replace).toHaveBeenCalledWith('/store/profile');
    expect(leerSesionTienda()).toMatchObject({ id: 't1', cuenta: [{ id: 't1', nombreTienda: 'Uno' }] });
  });

  it('con varias tiendas pregunta cuál administrar y la sesión recuerda las demás', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A), t2: tienda('Dos', HASH_A) } });
    const w = await entrar(TEL, 'clave1');
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(w.text()).toContain('¿Qué tienda quieres administrar?');

    await w.find('[data-testid="elegir-t2"]').trigger('click');
    expect(routerMock.replace).toHaveBeenCalledWith('/store/profile');
    const sesion = leerSesionTienda()!;
    expect(sesion.id).toBe('t2');
    expect(sesion.cuenta.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('contraseña equivocada no abre nada', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A) } });
    const w = await entrar(TEL, 'mala99');
    expect(w.text()).toContain('Celular o contraseña incorrectos');
    expect(leerSesionTienda()).toBeNull();
  });
});

describe('cambiar de tienda', () => {
  const sesionCon = (ids: string[]) =>
    guardarSesionTienda({
      id: ids[0],
      nombre: 'Uno',
      nombreTienda: 'Uno',
      telefono: TEL,
      cuenta: ids.map((id) => ({ id, nombreTienda: id })),
    });

  it('cambia a otra tienda de la cuenta y conserva la lista', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A), t2: tienda('Dos', HASH_A) } });
    sesionCon(['t1', 't2']);
    const nueva = await cambiarTiendaActiva('t2');
    expect(nueva).toMatchObject({ id: 't2', nombreTienda: 'Dos' });
    expect(leerSesionTienda()!.cuenta.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('no deja abrir una tienda que no es de la cuenta', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A), x: tienda('Ajena', HASH_A, '3399999999') } });
    sesionCon(['t1']);
    await expect(cambiarTiendaActiva('x')).rejects.toThrow('no es de tu cuenta');
  });

  it('si la tienda ya cambió de número, pide volver a entrar', async () => {
    __reset({ tiendas: { t1: tienda('Uno', HASH_A), t2: tienda('Dos', HASH_A, '3399999999') } });
    sesionCon(['t1', 't2']);
    await expect(cambiarTiendaActiva('t2')).rejects.toThrow('Vuelve a iniciar sesión');
    expect(leerSesionTienda()!.id).toBe('t1');
  });

  it('las sesiones de antes (sin lista) solo conocen su propia tienda', () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: 't1', nombreTienda: 'Uno', telefono: TEL }));
    expect(leerSesionTienda()!.cuenta).toEqual([{ id: 't1', nombreTienda: 'Uno' }]);
  });
});
