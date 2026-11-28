import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routerMock } from './setup';
import { guardSesion } from '@/router/guardSesion';
import { guardarSesion, cerrarSesion } from '@/utils/sessionUser';
import { serviciosRecientes } from '@/modules/servicios/descubrir';
import ServiciosRecientes from '@/modules/servicios/components/ServiciosRecientes.vue';

afterEach(() => { cerrarSesion(); localStorage.clear(); });

describe('la sesión se mantiene hasta «Cerrar sesión»', () => {
  it('sin sesión se puede abrir el acceso', () => {
    expect(guardSesion({ path: '/login', query: {} })).toBe(true);
    expect(guardSesion({ path: '/store/login', query: {} })).toBe(true);
  });
  it('cliente con sesión: volver a /login lo devuelve a donde iba o a la portada', () => {
    guardarSesion({ id: 'c1', nombre: 'Ana' });
    expect(guardSesion({ path: '/login', query: {} })).toEqual({ path: '/', replace: true });
    expect(guardSesion({ path: '/login', query: { redirect: '/mis-citas' } })).toEqual({ path: '/mis-citas', replace: true });
    expect(guardSesion({ path: '/login', query: { redirect: '//malo.com' } })).toEqual({ path: '/', replace: true }); // nunca fuera de la app
    expect(guardSesion({ path: '/store/login', query: {} })).toBe(true); // un cliente puede querer entrar como tienda
  });
  it('tienda con sesión: los accesos la devuelven a su perfil', () => {
    localStorage.setItem('tiendas', JSON.stringify({ id: 'T1', nombreTienda: 'X' }));
    expect(guardSesion({ path: '/store/login', query: {} })).toEqual({ path: '/store/profile', replace: true });
    expect(guardSesion({ path: '/login', query: {} })).toEqual({ path: '/store/profile', replace: true });
  });
  it('tras cerrar sesión el acceso vuelve a estar disponible', () => {
    guardarSesion({ id: 'c1' });
    cerrarSesion();
    expect(guardSesion({ path: '/login', query: {} })).toBe(true);
  });
});

const tienda = (id: string, extra: any = {}) => ({ tiendaId: id, nombreTienda: 'T' + id, estatus: 'activa', tipoNegocio: 'servicios', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' }, ...extra });
const srv = (id: string, tiendaId: string, creadoEn: string, activo = true) => ({ id, tiendaId, nombre: id, fotos: [], activo, creadoEn, orden: 1, tipoPrecio: 'fijo', precio: 100, categoria: 'otros', modalidad: 'local', contratacion: 'cita', descripcion: '', duracionMin: 30 }) as any;

describe('servicios recientes en la portada', () => {
  it('los más nuevos primero, solo activos y de tiendas visibles, con tope', () => {
    const r = serviciosRecientes([tienda('a') as any, tienda('b') as any], [srv('viejo', 'a', '2026-01-01'), srv('nuevo', 'b', '2026-11-01'), srv('oculto', 'a', '2026-12-01', false), srv('huerfano', 'zz', '2026-12-02'), srv('medio', 'a', '2026-06-01')], 2);
    expect(r.map((x) => x.servicio.id)).toEqual(['nuevo', 'medio']);
    expect(r[0].tienda.nombreTienda).toBe('Tb');
  });

  it('el componente muestra las tarjetas y abre el detalle; sin servicios no ocupa espacio', async () => {
    __reset({
      tiendas: { a: tienda('a', { tiendaId: undefined }) },
      servicios: { a: { s1: { nombre: 'Corte', descripcion: '', fotos: [], categoria: 'barberia', tipoPrecio: 'fijo', precio: 150, duracionMin: 60, modalidad: 'local', contratacion: 'cita', activo: true, orden: 1, creadoEn: '2026-11-01T00:00:00Z' } } },
    });
    const w = mount(ServiciosRecientes);
    await flushPromises(); await flushPromises();
    expect(w.find('[data-servicio="s1"]').exists()).toBe(true);
    await w.find('[data-servicio="s1"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/servicio/a/s1');
    await w.find('[data-testid="ver-todos-servicios"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/servicios');
    __reset({});
    const vacio = mount(ServiciosRecientes);
    await flushPromises();
    expect(vacio.find('[data-testid="servicios-recientes"]').exists()).toBe(false);
  });
});
