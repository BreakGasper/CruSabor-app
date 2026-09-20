/**
 * Borrar de Cloudinary la imagen que se reemplazó.
 *
 * Corre en el servidor porque borrar exige la `api_secret`, que no puede viajar
 * en el bundle. El identificador sale de la URL ya guardada, así que no hizo
 * falta migrar nada en la base.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import {
  publicIdDesdeUrl,
  firmaDestroy,
  idsBorrables,
  configDesdeEntorno,
  publicIdsEnUso,
} from '../src/services/imagenes/logica.ts';
import { crearRouterImagenes } from '../src/services/imagenes/router.ts';

const CLOUD = 'https://res.cloudinary.com/dswymzhc2/image/upload';

describe('publicIdDesdeUrl', () => {
  it('saca el identificador de una URL normal', () => {
    expect(publicIdDesdeUrl(`${CLOUD}/v1773683511/edvdafqco8ujffeulwn7.jpg`)).toBe('edvdafqco8ujffeulwn7');
  });

  it('ignora las transformaciones', () => {
    expect(publicIdDesdeUrl(`${CLOUD}/f_auto,q_auto,w_600/v1773683511/abc.webp`)).toBe('abc');
    expect(publicIdDesdeUrl(`${CLOUD}/c_fill,h_200,w_200/v1/abc.png`)).toBe('abc');
  });

  it('conserva las carpetas: "tiendas/logo" no es "logo"', () => {
    expect(publicIdDesdeUrl(`${CLOUD}/v1/tiendas/t1/logo.png`)).toBe('tiendas/t1/logo');
  });

  it('funciona sin versión', () => {
    expect(publicIdDesdeUrl(`${CLOUD}/abc.jpg`)).toBe('abc');
  });

  it('RECHAZA lo que no es de Cloudinary: borrar por error sería irreversible', () => {
    expect(publicIdDesdeUrl('https://ejemplo.com/image/upload/v1/abc.jpg')).toBeNull();
    expect(publicIdDesdeUrl('https://res.cloudinary.com.malicioso.mx/image/upload/v1/x.jpg')).toBeNull();
    expect(publicIdDesdeUrl('/assets/icons/local.png')).toBeNull();
    expect(publicIdDesdeUrl('')).toBeNull();
    expect(publicIdDesdeUrl(null)).toBeNull();
    expect(publicIdDesdeUrl('no es una url')).toBeNull();
  });
});

describe('idsBorrables', () => {
  it('quita repetidos y lo que no es de Cloudinary', () => {
    expect(
      idsBorrables([
        `${CLOUD}/v1/a.jpg`,
        `${CLOUD}/v2/a.jpg`, // misma imagen, otra versión
        `${CLOUD}/v1/b.jpg`,
        'https://otro.com/c.jpg',
        '',
      ]),
    ).toEqual(['a', 'b']);
  });

  it('acepta una sola URL, no solo arreglos', () => {
    expect(idsBorrables(`${CLOUD}/v1/a.jpg`)).toEqual(['a']);
  });
});

describe('firmaDestroy', () => {
  it('firma los parámetros ordenados, como pide Cloudinary', () => {
    const esperado = createHash('sha1').update('public_id=abc&timestamp=1700000000secreto').digest('hex');
    expect(firmaDestroy('abc', 1700000000, 'secreto')).toBe(esperado);
  });

  it('cambia si cambia cualquier parte', () => {
    const base = firmaDestroy('abc', 1700000000, 'secreto');
    expect(firmaDestroy('abd', 1700000000, 'secreto')).not.toBe(base);
    expect(firmaDestroy('abc', 1700000001, 'secreto')).not.toBe(base);
    expect(firmaDestroy('abc', 1700000000, 'otra')).not.toBe(base);
  });
});

describe('configDesdeEntorno', () => {
  it('null si falta cualquiera de las tres variables', () => {
    expect(configDesdeEntorno({} as any)).toBeNull();
    expect(configDesdeEntorno({ CLOUDINARY_CLOUD_NAME: 'x', CLOUDINARY_API_KEY: 'y' } as any)).toBeNull();
    expect(
      configDesdeEntorno({ CLOUDINARY_CLOUD_NAME: 'x', CLOUDINARY_API_KEY: 'y', CLOUDINARY_API_SECRET: 'z' } as any),
    ).toEqual({ cloudName: 'x', apiKey: 'y', apiSecret: 'z' });
  });
});

/* ---------------- endpoints ---------------- */
const ENV_OK = {
  CLOUDINARY_CLOUD_NAME: 'dswymzhc2',
  CLOUDINARY_API_KEY: 'llave',
  CLOUDINARY_API_SECRET: 'secreto',
} as any;

/** Almacén falso: devuelve lo que se le pase por colección */
const almacenCon = (datos: Record<string, any> = {}) => async () => ({
  leer: async (ruta: string) => datos[ruta] ?? null,
  actualizar: async () => {},
  nuevoId: () => 'id',
});

function levantar(env: any, destruir?: any, almacen: any = almacenCon()) {
  const app = express();
  app.use(express.json());
  app.use('/imagenes', crearRouterImagenes({ env, destruir, almacen, log: () => {} }));
  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  return { servidor, base };
}

let cerrar: (() => void) | null = null;
beforeEach(() => {
  cerrar?.();
  cerrar = null;
});

describe('POST /imagenes/eliminar', () => {
  it('borra cada imagen y responde cuántas', async () => {
    const destruir = vi.fn(async () => true);
    const { servidor, base } = levantar(ENV_OK, destruir);
    cerrar = () => servidor.close();

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/a.jpg`, `${CLOUD}/v1/b.jpg`] }),
    });

    expect(await r.json()).toEqual({ borradas: 2, omitidas: 0, enUso: 0, activo: true });
    expect(destruir.mock.calls.map((c: any[]) => c[0])).toEqual(['a', 'b']);
    servidor.close();
  });

  it('sin credenciales no borra nada y lo dice, sin fallar', async () => {
    const destruir = vi.fn(async () => true);
    const { servidor, base } = levantar({}, destruir);
    cerrar = () => servidor.close();

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/a.jpg`] }),
    });

    expect(r.status).toBe(200); // la app no debe romperse por esto
    expect(await r.json()).toEqual({ borradas: 0, omitidas: 0, activo: false });
    expect(destruir).not.toHaveBeenCalled();
    servidor.close();
  });

  it('si una falla, las demás se siguen borrando', async () => {
    const destruir = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('Cloudinary caído');
      return true;
    });
    const { servidor, base } = levantar(ENV_OK, destruir);
    cerrar = () => servidor.close();

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/a.jpg`, `${CLOUD}/v1/b.jpg`, `${CLOUD}/v1/c.jpg`] }),
    });

    expect(await r.json()).toEqual({ borradas: 2, omitidas: 1, enUso: 0, activo: true });
    servidor.close();
  });

  it('una URL ajena no se intenta borrar', async () => {
    const destruir = vi.fn(async () => true);
    const { servidor, base } = levantar(ENV_OK, destruir);
    cerrar = () => servidor.close();

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://otro-servicio.com/foto.jpg'] }),
    });

    expect(await r.json()).toEqual({ borradas: 0, omitidas: 0, activo: true });
    expect(destruir).not.toHaveBeenCalled();
    servidor.close();
  });
});

describe('GET /imagenes/estado', () => {
  it('dice si está configurado y qué falta', async () => {
    const a = levantar({});
    const r1 = await (await fetch(`${a.base}/imagenes/estado`)).json();
    expect(r1.activo).toBe(false);
    expect(r1.faltan).toHaveLength(3);
    a.servidor.close();

    const b = levantar(ENV_OK);
    const r2 = await (await fetch(`${b.base}/imagenes/estado`)).json();
    expect(r2).toEqual({ activo: true, faltan: [] });
    b.servidor.close();
  });
});

/**
 * Solo se borran imágenes huérfanas.
 *
 * El endpoint no pide autenticación: sin esta comprobación, cualquiera con la
 * URL del servidor podría borrar las fotos de todas las tiendas.
 */
describe('publicIdsEnUso', () => {
  it('encuentra imágenes en cualquier parte del árbol, por hondo que esté', () => {
    const ids = publicIdsEnUso({
      articulos: {
        a1: { url: `${CLOUD}/v1/principal.jpg`, variantes: [{ url: `${CLOUD}/v1/variante.jpg` }] },
      },
      tiendas: { t1: { logoUrl: `${CLOUD}/v1/logo.png`, galleryUrls: [`${CLOUD}/v1/g1.jpg`] } },
      categorias: { c1: { icono: `${CLOUD}/v1/icono.png` } },
      banners: null,
    });
    expect([...ids].sort()).toEqual(['g1', 'icono', 'logo', 'principal', 'variante']);
  });

  it('ignora lo que no son imágenes de Cloudinary', () => {
    const ids = publicIdsEnUso({ articulos: { a1: { nombre: 'Pay', precio: 50, web: 'https://otro.com/x.jpg' } } });
    expect(ids.size).toBe(0);
  });
});

describe('POST /imagenes/eliminar · protege lo que está en uso', () => {
  const ENV = ENV_OK;

  it('NO borra una imagen que la base sigue referenciando', async () => {
    const destruir = vi.fn(async () => true);
    const baseConImagen = almacenCon({
      articulos: { a1: { url: `${CLOUD}/v1/enuso.jpg` } },
    });
    const { servidor, base } = levantar(ENV, destruir, baseConImagen);

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/enuso.jpg`] }),
    });

    expect(await r.json()).toEqual({ borradas: 0, omitidas: 1, enUso: 1, activo: true });
    expect(destruir).not.toHaveBeenCalled(); // ni se intentó
    servidor.close();
  });

  it('borra la huérfana y respeta la que sigue en uso, en la misma petición', async () => {
    const destruir = vi.fn(async () => true);
    const baseConImagen = almacenCon({
      tiendas: { t1: { logoUrl: `${CLOUD}/v1/logo-actual.png` } },
    });
    const { servidor, base } = levantar(ENV, destruir, baseConImagen);

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/logo-viejo.png`, `${CLOUD}/v1/logo-actual.png`] }),
    });

    expect(await r.json()).toEqual({ borradas: 1, omitidas: 1, enUso: 1, activo: true });
    expect(destruir.mock.calls.map((c: any[]) => c[0])).toEqual(['logo-viejo']);
    servidor.close();
  });

  it('si la base no se puede leer, no borra nada: ante la duda, no se toca', async () => {
    const destruir = vi.fn(async () => true);
    const baseCaida = async () => {
      throw new Error('Firebase no responde');
    };
    const { servidor, base } = levantar(ENV, destruir, baseCaida);

    const r = await fetch(`${base}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${CLOUD}/v1/a.jpg`] }),
    });

    expect(r.status).toBe(503);
    expect((await r.json()).motivo).toBe('base-no-disponible');
    expect(destruir).not.toHaveBeenCalled();
    servidor.close();
  });
});
