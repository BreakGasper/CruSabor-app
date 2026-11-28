/**
 * crearTienda (real, contra la base en memoria): lo que se guarda de una tienda nueva.
 * Bug que cubre: el registro guardaba `confirmPassword` (la contraseña escrita al confirmar, en TEXTO PLANO)
 * y los archivos crudos del formulario dentro de `tiendas/{id}`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __getAt } from './mocks/firebaseDb';

const subir = vi.hoisted(() => ({ logo: vi.fn(async () => 'https://cdn.test/logo.png'), banner: vi.fn(async () => 'https://cdn.test/banner.png'), galeria: vi.fn(async () => ['https://cdn.test/g1.png']) }));
vi.mock('@/composables/useStorage', () => ({ uploadStoreLogo: subir.logo, uploadStoreBanner: subir.banner, uploadStoreGallery: subir.galeria }));

import { useTiendas } from '@/composables/useTiendas';

beforeEach(() => {
  __reset({ tiendas: {} });
  Object.values(subir).forEach((f) => f.mockClear());
});

const formulario = () => ({
  nombreTienda: 'Tienda Nueva',
  telefono: '3300000000',
  password: 'HASH',
  confirmPassword: 'Clave-secreta-1',
  logo: new File(['x'], 'l.png'),
  gallery: [new File(['x'], 'g.png')],
  banner: new File(['x'], 'b.png'),
  logoFile: new File(['x'], 'l.png'),
  galleryFiles: [new File(['x'], 'g.png')],
  bannerFile: new File(['x'], 'b.png'),
  tipoNegocio: 'productos',
});

describe('crearTienda', () => {
  it('no guarda la confirmación de la contraseña ni los archivos crudos', async () => {
    const id = await useTiendas().crearTienda(formulario() as any);
    const guardada = __getAt(`tiendas/${id}`);
    expect(guardada).toMatchObject({ nombreTienda: 'Tienda Nueva', password: 'HASH', tipoNegocio: 'productos' });
    for (const campo of ['confirmPassword', 'logo', 'gallery', 'banner', 'logoFile', 'galleryFiles', 'bannerFile']) expect(campo in guardada, campo).toBe(false);
    expect(JSON.stringify(guardada)).not.toContain('Clave-secreta-1');
  });

  it('las imágenes sí se suben y solo se guardan sus URL', async () => {
    const id = await useTiendas().crearTienda(formulario() as any);
    expect(subir.logo).toHaveBeenCalledTimes(1);
    expect(subir.banner).toHaveBeenCalledTimes(1);
    expect(subir.galeria).toHaveBeenCalledTimes(1);
    expect(__getAt(`tiendas/${id}`)).toMatchObject({ logoUrl: 'https://cdn.test/logo.png', bannerUrl: 'https://cdn.test/banner.png', galleryUrls: ['https://cdn.test/g1.png'] });
  });

  it('la primera tienda de un celular nace activa con prueba gratis; la segunda, pendiente', async () => {
    const a = await useTiendas().crearTienda(formulario() as any);
    expect(__getAt(`tiendas/${a}`)).toMatchObject({ estatus: 'activa', membresia: { plan: 'prueba' } });
    const b = await useTiendas().crearTienda({ ...formulario(), nombreTienda: 'Segunda' } as any);
    expect(__getAt(`tiendas/${b}/estatus`)).toBe('pendiente');
  });
});
