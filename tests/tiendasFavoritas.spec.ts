/**
 * Perfil · "Tiendas favoritas": muestra las últimas agregadas (límite) y
 * siempre ofrece "Ver todas mis favoritas", que abre /tiendas filtrado.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { db } from '@/db';
import { sessionUser } from '@/utils/sessionUser';
import { routerMock } from './setup';
import TiendasFavoritas from '@/modules/home/components/TiendasFavoritas.vue';

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; });

const fav = (tiendaId: string, nombreTienda: string, fecha: string) => ({
  tiendaId, idUsuario: 'cliente-1', nombreTienda, logoUrl: '', categoria: '', colonia: 'Centro', municipio: 'Ameca', telefono: '3751234567', fecha_hora: fecha,
});

beforeEach(async () => {
  await db.TiendasFavoritas.clear();
  routerMock.push.mockClear();
  sessionUser.value = { id: 'cliente-1' };
});

const stubs = { FontAwesomeIcon: true };

describe('TiendasFavoritas', () => {
  it('muestra las 3 últimas agregadas y el enlace "Ver todas" con el total', async () => {
    await db.TiendasFavoritas.bulkAdd([
      fav('t1', 'Antigua', '2026-01-01T10:00:00.000Z'),
      fav('t2', 'Panadería', '2026-03-01T10:00:00.000Z'),
      fav('t3', 'Postres Lola', '2026-04-01T10:00:00.000Z'),
      fav('t4', 'Café Centro', '2026-05-01T10:00:00.000Z'),
    ]);
    const w = mount(TiendasFavoritas, { props: { limit: 3 }, global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();

    expect(w.findAll('.tf-card')).toHaveLength(3);
    expect(w.findAll('.tf-nombre').map((n) => n.text())).toEqual(['Café Centro', 'Postres Lola', 'Panadería']);
    expect(w.find('.tf-ver-todas').text()).toBe('➤ Ver todas mis favoritas (4)');

    await w.find('.tf-ver-todas').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith({ path: '/tiendas', query: { favoritas: '1' } });
  });

  it('con menos favoritas que el límite igual muestra el enlace, sin total', async () => {
    await db.TiendasFavoritas.bulkAdd([fav('t1', 'Una', '2026-01-01T10:00:00.000Z')]);
    const w = mount(TiendasFavoritas, { props: { limit: 3 }, global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    await flushPromises();
    expect(w.findAll('.tf-card')).toHaveLength(1);
    expect(w.find('.tf-ver-todas').text()).toBe('➤ Ver todas mis favoritas');
  });

  it('sin favoritas muestra el estado vacío con acceso a explorar y sin enlace', async () => {
    const w = mount(TiendasFavoritas, { props: { limit: 3 }, global: { stubs } });
    cleanups.push(() => w.unmount());
    await flushPromises();
    expect(w.find('.tf-empty').text()).toContain('Aún no tienes tiendas favoritas');
    expect(w.find('.tf-ver-todas').exists()).toBe(false);
  });
});
