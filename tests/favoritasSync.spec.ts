/**
 * Al entrar al perfil de una tienda marcada como favorita, la copia local
 * (nombre, logo, categoría, ubicación, teléfono) se actualiza con los datos reales.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routeMock } from './setup';
import { withSetup, flush } from './helpers';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';

vi.mock('@/composables/useAuth', () => ({ fetchUsuarioById: vi.fn(async () => null) }));
import StoreProfile from '@/modules/store/views/StoreProfile.vue';

const T = 'tienda-A';
const stubs = { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, transition: false };
let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; });

beforeEach(async () => {
  __reset({
    tiendas: {
      [T]: {
        nombreTienda: 'Postres Lola Deluxe', logoUrl: 'https://cdn.test/logo-nuevo.png', categoria: 'Repostería',
        colonia: 'La Villa', municipio: 'Ameca', telefono: '3751111111', envioDomicilio: true, metodosPago: ['Efectivo'], horario: {},
      },
    },
    articulos: {}, pedidos: {},
  });
  routeMock.params = { id: T };
  sessionUser.value = { id: 'cliente-1' };
  await db.TiendasFavoritas.clear();
  // copia vieja guardada cuando se marcó favorita
  await db.TiendasFavoritas.add({
    tiendaId: T, idUsuario: 'cliente-1', nombreTienda: 'Postres Lola', logoUrl: 'https://cdn.test/logo-viejo.png',
    categoria: 'Alimentos y Bebidas', colonia: 'Centro', municipio: 'Ameca', telefono: '3751241116', fecha_hora: '2026-01-01T00:00:00.000Z',
  } as any);
  // favorita de otro usuario: no debe tocarse
  await db.TiendasFavoritas.add({
    tiendaId: T, idUsuario: 'otro', nombreTienda: 'Postres Lola', logoUrl: '', categoria: '', colonia: 'Centro', municipio: 'Ameca', telefono: '3751241116', fecha_hora: '2026-01-01T00:00:00.000Z',
  } as any);
});

describe('useTiendasFavoritas.sincronizar', () => {
  it('actualiza solo la copia del usuario actual y conserva la fecha en que se marcó', async () => {
    const { result, unmount } = withSetup(() => useTiendasFavoritas());
    cleanups.push(unmount);
    await flush();

    const cambio = await result.sincronizar({
      tiendaId: T, nombreTienda: 'Postres Lola Deluxe', logoUrl: 'https://cdn.test/logo-nuevo.png',
      categoria: 'Repostería', colonia: 'La Villa', municipio: 'Ameca', telefono: '3751111111',
    } as any);
    expect(cambio).toBe(true);

    const mia = await db.TiendasFavoritas.where('[tiendaId+idUsuario]').equals([T, 'cliente-1']).first();
    expect(mia).toMatchObject({
      nombreTienda: 'Postres Lola Deluxe', logoUrl: 'https://cdn.test/logo-nuevo.png', categoria: 'Repostería',
      colonia: 'La Villa', telefono: '3751111111', fecha_hora: '2026-01-01T00:00:00.000Z',
    });
    expect(result.favoritas.value[0].nombreTienda).toBe('Postres Lola Deluxe'); // estado reactivo al día

    const ajena = await db.TiendasFavoritas.where('[tiendaId+idUsuario]').equals([T, 'otro']).first();
    expect(ajena!.nombreTienda).toBe('Postres Lola');
  });

  it('no hace nada si la tienda no es favorita o no hay sesión', async () => {
    const { result, unmount } = withSetup(() => useTiendasFavoritas());
    cleanups.push(unmount);
    await flush();
    expect(await result.sincronizar({ tiendaId: 'otra-tienda', nombreTienda: 'X' } as any)).toBe(false);
    sessionUser.value = null;
    expect(await result.sincronizar({ tiendaId: T, nombreTienda: 'X' } as any)).toBe(false);
    const mia = await db.TiendasFavoritas.where('[tiendaId+idUsuario]').equals([T, 'cliente-1']).first();
    expect(mia!.nombreTienda).toBe('Postres Lola'); // sin cambios
  });

  it('si los datos ya coinciden no reescribe', async () => {
    const { result, unmount } = withSetup(() => useTiendasFavoritas());
    cleanups.push(unmount);
    await flush();
    const igual = { tiendaId: T, nombreTienda: 'Postres Lola', logoUrl: 'https://cdn.test/logo-viejo.png', categoria: 'Alimentos y Bebidas', colonia: 'Centro', municipio: 'Ameca', telefono: '3751241116' } as any;
    expect(await result.sincronizar(igual)).toBe(false);
  });
});

describe('StoreProfile', () => {
  it('al abrir el perfil de una tienda favorita, la copia local se actualiza sola', async () => {
    const w = mount(StoreProfile, { global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(w.find('.store-name').text()).toBe('Postres Lola Deluxe');
    expect(w.find('.fav-store-btn').classes()).toContain('active');

    const mia = await db.TiendasFavoritas.where('[tiendaId+idUsuario]').equals([T, 'cliente-1']).first();
    expect(mia).toMatchObject({ nombreTienda: 'Postres Lola Deluxe', logoUrl: 'https://cdn.test/logo-nuevo.png', colonia: 'La Villa', telefono: '3751111111' });
  });
});
