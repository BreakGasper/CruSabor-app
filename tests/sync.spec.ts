/**
 * Sincronización de carrito, favoritos y tiendas favoritas con Firebase
 * (usuarios/{id}/sync): sube al cambiar, baja al iniciar sesión en otro dispositivo,
 * propaga eliminaciones y no mezcla usuarios.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { iniciarSincronizacion, bajar, subir, __resetSync } from '@/db/sync';

const espera = (ms = 600) => new Promise((r) => setTimeout(r, ms));
const item = (id: string, uid = 'u1') => ({
  id_articulo: id, sku: 's-' + id, id_usuario: uid, cantidad: 1, precio: 10, nombre: 'P ' + id, url: '', detalle: '',
  id_tienda: 't1', nombre_tienda: 'Lola', almacen: '', anticipo: 0, categoria: '', descuentoCupon: 0, estatus: 'Preparacion',
  fechaEntrega: '', fecha_hora: '', id_pedido: 'p', metodo_pago: 'Efectivo',
});

beforeEach(async () => {
  __reset({ usuarios: {} });
  __resetSync();
  sessionUser.value = null;
  await db.Carrito.clear();
  await db.Favoritos.clear();
  await db.TiendasFavoritas.clear();
});
afterEach(() => __resetSync());

describe('sync', () => {
  it('primer inicio de sesión sin copia remota: sube lo local; después cada cambio se sube solo', async () => {
    await db.Carrito.add(item('a') as any);
    await db.Favoritos.put({ articuloId: 'a', idUsuario: 'u1', nombre: 'P a', precio: 10, categoriaId: '', descripcion: '', unidadMedida: '', puntuacion: 0 } as any);

    iniciarSincronizacion();
    sessionUser.value = { id: 'u1' };
    await espera();

    let remoto = __getAt('usuarios/u1/sync');
    expect(Object.keys(remoto.carrito)).toEqual(['a__s-a']);
    expect(remoto.carrito['a__s-a']).toMatchObject({ id_articulo: 'a', nombre_tienda: 'Lola' });
    expect(remoto.carrito['a__s-a'].id).toBeUndefined(); // sin el autoincremental de Dexie
    expect(Object.keys(remoto.favoritos)).toEqual(['a']);

    // cambio local → se sube (debounce)
    await db.Carrito.add(item('b') as any);
    await db.TiendasFavoritas.add({ tiendaId: 't1', idUsuario: 'u1', nombreTienda: 'Lola', fecha_hora: 'x' } as any);
    await espera(900);
    remoto = __getAt('usuarios/u1/sync');
    expect(Object.keys(remoto.carrito).sort()).toEqual(['a__s-a', 'b__s-b']);
    expect(Object.keys(remoto.tiendasFavoritas)).toEqual(['t1']);

    // eliminación local → desaparece del remoto
    await db.Carrito.where('id_articulo').equals('a').delete();
    await espera(900);
    expect(Object.keys(__getAt('usuarios/u1/sync/carrito'))).toEqual(['b__s-b']);
  });

  it('otro dispositivo: al iniciar sesión baja la copia remota y reemplaza lo local del usuario', async () => {
    __reset({
      usuarios: {
        u1: {
          sync: {
            carrito: { 'x__s-x': { ...item('x'), id: undefined } },
            favoritos: { f1: { articuloId: 'f1', idUsuario: 'u1', nombre: 'Fav', precio: 5 } },
            tiendasFavoritas: { t9: { tiendaId: 't9', idUsuario: 'u1', nombreTienda: 'Otra', fecha_hora: 'x' } },
            actualizado: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    });
    // en este dispositivo había cosas viejas del mismo usuario y cosas de otro usuario
    await db.Carrito.add(item('viejo') as any);
    await db.Carrito.add(item('ajeno', 'u2') as any);

    iniciarSincronizacion();
    sessionUser.value = { id: 'u1' };
    await espera();

    const mio = await db.Carrito.where('id_usuario').equals('u1').toArray();
    expect(mio.map((c) => c.id_articulo)).toEqual(['x']); // lo remoto manda
    expect(await db.Carrito.where('id_usuario').equals('u2').count()).toBe(1); // el otro usuario intacto
    expect(await db.Favoritos.where('idUsuario').equals('u1').count()).toBe(1);
    expect((await db.TiendasFavoritas.where('idUsuario').equals('u1').first())!.nombreTienda).toBe('Otra');
  });

  it('cerrar sesión detiene la subida; iniciar con otro usuario usa su propio nodo', async () => {
    iniciarSincronizacion();
    sessionUser.value = { id: 'u1' };
    await espera();
    sessionUser.value = null;
    await espera(200);
    await db.Carrito.add(item('z') as any); // sin sesión: no debe subirse a nadie
    await espera(900);
    expect(__getAt('usuarios/u1/sync/carrito')).toBeUndefined();

    sessionUser.value = { id: 'u2' };
    await espera();
    await db.Carrito.add(item('w', 'u2') as any);
    await espera(900);
    expect(Object.keys(__getAt('usuarios/u2/sync/carrito'))).toEqual(['w__s-w']);
    expect(__getAt('usuarios/u1/sync/carrito')).toBeUndefined();
  });

  it('bajar/subir directos funcionan sin el observador', async () => {
    sessionUser.value = { id: 'u1' };
    await db.Carrito.add(item('q') as any);
    await bajar('u1'); // no hay remoto → sube local
    expect(Object.keys(__getAt('usuarios/u1/sync/carrito'))).toEqual(['q__s-q']);
    await db.Carrito.clear();
    await bajar('u1'); // ahora sí hay remoto → lo baja
    expect(await db.Carrito.count()).toBe(1);
    // subir ignora usuarios que no son el activo del observador
    await subir('otro');
    expect(__getAt('usuarios/otro')).toBeUndefined();
  });
});
