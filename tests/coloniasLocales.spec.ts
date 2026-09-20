/**
 * Catálogo de colonias de Jalisco guardado en la app.
 *
 * Las dos APIs de colonias que se usaron se cayeron, así que el padrón vive en
 * `src/data/coloniasJalisco.json` y de ahí salen la lista del desplegable y el
 * C.P. de cada colonia. Sin red de por medio.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  claveMunicipio,
  coloniasDeMunicipio,
  cpDeColonia,
  tieneCatalogo,
} from '@/composables/coloniasLocales';
import { coloniasPorMunicipioConOrigen } from '@/composables/useCodigoPostal';

describe('claveMunicipio: reconocer el mismo nombre escrito de varias formas', () => {
  it('ignora acentos, mayúsculas, espacios y el "de"', () => {
    const esperado = claveMunicipio('San Martín de Hidalgo');
    for (const variante of [
      'San Martin de Hidalgo',
      'SAN MARTÍN DE HIDALGO',
      'San Martín Hidalgo', // como está hoy en la base
      'san martin hidalgo',
      'SanMartinHidalgo', // la entrada sin espacios que quedó en la base
      '  San Martín de Hidalgo  ',
    ]) {
      expect(claveMunicipio(variante)).toBe(esperado);
    }
  });

  it('no confunde municipios distintos', () => {
    expect(claveMunicipio('San Martín de Bolaños')).not.toBe(claveMunicipio('San Martín de Hidalgo'));
  });
});

describe('El catálogo cubre todo Jalisco', () => {
  it('tiene los municipios del estado, no solo San Martín', async () => {
    for (const m of ['San Martín de Hidalgo', 'Ameca', 'Guadalajara', 'Cocula', 'Zapopan']) {
      expect(await tieneCatalogo(m)).toBe(true);
      expect((await coloniasDeMunicipio(m)).length).toBeGreaterThan(5);
    }
  });

  it('fuera de Jalisco no hay catálogo', async () => {
    expect(await tieneCatalogo('Tepic')).toBe(false);
    expect(await coloniasDeMunicipio('Tepic')).toEqual([]);
    expect(await cpDeColonia('Tepic', 'Centro')).toBe('');
  });

  it('las listas vienen ordenadas y sin repetidos', async () => {
    for (const m of ['Ameca', 'San Martín de Hidalgo']) {
      const lista = await coloniasDeMunicipio(m);
      expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b, 'es')));
      expect(new Set(lista).size).toBe(lista.length);
    }
  });
});

describe('Lista de San Martín de Hidalgo', () => {
  it('trae las 21 localidades del municipio, con la cabecera entre ellas', async () => {
    const lista = await coloniasDeMunicipio('San Martín de Hidalgo');
    expect(lista).toHaveLength(21);
    expect(lista).toContain('San Martín Hidalgo'); // cabecera municipal
    expect(lista).toContain('San Jerónimo (Los Barbosa)'); // nombres completos, como el padrón
    expect(lista).toContain('La Loma'); // le falta al padrón; se agregó en el generador
    expect(lista).toContain('Río Grande'); // el padrón la escribe sin acento
  });

  it('responde igual aunque el municipio venga sin "de" o sin acentos', async () => {
    const conDe = await coloniasDeMunicipio('San Martín de Hidalgo');
    expect(await coloniasDeMunicipio('San Martín Hidalgo')).toEqual(conDe);
    expect(await coloniasDeMunicipio('SanMartinHidalgo')).toEqual(conDe);
  });
});

describe('C.P. de una colonia', () => {
  it('lo da para cualquier municipio del estado', async () => {
    expect(await cpDeColonia('San Martín de Hidalgo', 'San Martín Hidalgo')).toBe('46770');
    expect(await cpDeColonia('Ameca', 'Ameca Centro')).toBe('46600');
    expect(await cpDeColonia('Cocula', 'Cocula Centro')).toBe('48500');
    expect(await cpDeColonia('Zapopan', 'Zapopan Centro')).toBe('45100');
    expect(await cpDeColonia('Guadalajara', 'Americana')).toBe('44160');
  });

  it('el mismo nombre en dos municipios da el C.P. de cada uno', async () => {
    expect(await cpDeColonia('San Martín de Hidalgo', 'Lagunillas')).toBe('46794');
    expect(await cpDeColonia('Ameca', 'Lagunillas')).toBe('46719');
  });

  it('no castiga acentos ni mayúsculas al buscar la colonia', async () => {
    expect(await cpDeColonia('San Martín Hidalgo', 'trapiche de abra')).toBe('46776');
    expect(await cpDeColonia('San Martín de Hidalgo', 'JESUS MARIA (EL ZAPOTE)')).toBe('46797');
  });

  it('si el padrón le da varios C.P. a la misma colonia, no inventa uno', async () => {
    // "San Antonio" en Guadalajara está en 44170, 44257 y 44800: cualquiera sería adivinar
    expect(await cpDeColonia('Guadalajara', 'San Antonio')).toBe('');
  });

  it('una colonia que no está en el catálogo no devuelve nada', async () => {
    expect(await cpDeColonia('Ameca', 'Colonia que no existe')).toBe('');
  });

  it('todos los C.P. del catálogo son de 5 dígitos', async () => {
    for (const m of ['San Martín de Hidalgo', 'Ameca', 'Cocula']) {
      for (const colonia of await coloniasDeMunicipio(m)) {
        const cp = await cpDeColonia(m, colonia);
        if (cp) expect(cp).toMatch(/^\d{5}$/);
      }
    }
  });
});

describe('coloniasPorMunicipio usa el catálogo antes que la API', () => {
  it('para un municipio de Jalisco NO llama a la API', async () => {
    const fetchFalso = vi.fn();
    const { colonias, origen } = await coloniasPorMunicipioConOrigen('Ameca', fetchFalso as any);

    expect(fetchFalso).not.toHaveBeenCalled(); // la API está caída: ni se intenta
    expect(origen).toBe('catalogo');
    expect(colonias).toEqual(await coloniasDeMunicipio('Ameca'));
  });

  it('fuera del catálogo sigue consultando la API, como antes', async () => {
    const fetchFalso = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: [{ d_asenta: 'Centro', d_mnpio: 'Tepic' }] }),
    }));

    const { colonias, origen } = await coloniasPorMunicipioConOrigen('Tepic', fetchFalso as any);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(colonias).toEqual(['Centro']);
    expect(origen).toBe('api');
  });

  it('si la API falla, se devuelve vacío (texto libre)', async () => {
    const fetchFalso = vi.fn(async () => {
      throw new Error('API caída');
    });
    const { colonias, origen } = await coloniasPorMunicipioConOrigen('Tepic', fetchFalso as any);
    expect(colonias).toEqual([]);
    expect(origen).toBe('ninguna');
  });
});
