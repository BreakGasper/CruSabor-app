/**
 * Banners del carrusel de la portada: reglas puras de vigencia, y el CRUD del admin
 * (crear, actualizar, activar/ocultar, eliminar) contra el Firebase en memoria.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __getAt, __getTree } from './mocks/firebaseDb';
import {
  bannerVigente,
  hoyISO,
  crearBanner,
  actualizarBanner,
  alternarBannerActivo,
  eliminarBanner,
  type Banner,
} from '@/composables/useBanners';

beforeEach(() => __reset({ banners: {} }));

describe('bannerVigente (regla pura)', () => {
  const HOY = '2026-09-16';
  it('un banner activo sin fechas siempre se muestra', () => {
    expect(bannerVigente({ activo: true }, HOY)).toBe(true);
  });
  it('un banner inactivo nunca se muestra', () => {
    expect(bannerVigente({ activo: false }, HOY)).toBe(false);
  });
  it('respeta la vigencia por fechas (inclusive en los extremos)', () => {
    expect(bannerVigente({ activo: true, fechaInicio: '2026-09-20' }, HOY)).toBe(false); // aún no empieza
    expect(bannerVigente({ activo: true, fechaFin: '2026-09-10' }, HOY)).toBe(false); // ya venció
    expect(bannerVigente({ activo: true, fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }, HOY)).toBe(true);
    expect(bannerVigente({ activo: true, fechaInicio: HOY, fechaFin: HOY }, HOY)).toBe(true); // hoy justo
  });
  it('hoyISO devuelve YYYY-MM-DD', () => {
    expect(hoyISO(new Date('2026-09-16T20:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('CRUD de banners (admin)', () => {
  it('crearBanner guarda los campos, pone orden al final y activo por defecto', async () => {
    const id1 = await crearBanner({ imagenUrl: 'https://cdn/a.jpg', titulo: 'Uno' });
    const id2 = await crearBanner({ imagenUrl: 'https://cdn/b.jpg', titulo: 'Dos', enlace: '/tiendas', fechaFin: '2026-12-31' });

    const b1 = __getAt(`banners/${id1}`);
    const b2 = __getAt(`banners/${id2}`);
    expect(b1).toMatchObject({ imagenUrl: 'https://cdn/a.jpg', titulo: 'Uno', activo: true, orden: 0 });
    expect(b1.creadoEn).toBeTruthy();
    expect(b2).toMatchObject({ titulo: 'Dos', enlace: '/tiendas', orden: 1, fechaFin: '2026-12-31' });
  });

  it('crearBanner exige imagen', async () => {
    await expect(crearBanner({ imagenUrl: '' } as any)).rejects.toThrow(/imagen/i);
  });

  it('actualizar, ocultar y eliminar', async () => {
    const id = await crearBanner({ imagenUrl: 'https://cdn/a.jpg', titulo: 'Original' });

    await actualizarBanner(id, { titulo: 'Cambiado', enlace: 'https://promo.mx' });
    expect(__getAt(`banners/${id}`)).toMatchObject({ titulo: 'Cambiado', enlace: 'https://promo.mx' });

    await alternarBannerActivo(id, false);
    expect(__getAt(`banners/${id}`).activo).toBe(false);

    await eliminarBanner(id);
    expect(__getAt(`banners/${id}`)).toBeUndefined();
  });
});
