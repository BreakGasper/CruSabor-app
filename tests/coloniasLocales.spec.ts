/**
 * Colonias guardadas en la app para municipios que la API no cubre.
 *
 * SEPOMEX no devuelve nada para San Martín de Hidalgo (ni por nombre ni por
 * C.P.), así que su lista vive en `coloniasLocales.ts`. Los demás municipios
 * siguen igual: API, y texto libre si falla.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  claveMunicipio,
  coloniasLocales,
  tieneColoniasLocales,
} from '@/composables/coloniasLocales';
import { coloniasPorMunicipio } from '@/composables/useCodigoPostal';

describe('claveMunicipio: reconocer el mismo municipio escrito de varias formas', () => {
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

describe('Lista de San Martín de Hidalgo', () => {
  it('tiene localidades y la cabecera entre ellas', () => {
    const lista = coloniasLocales('San Martín de Hidalgo');
    expect(lista.length).toBeGreaterThan(5);
    expect(lista.some((c) => /cabecera/i.test(c))).toBe(true);
  });

  it('responde igual aunque el nombre venga sin "de" o sin acentos', () => {
    const conDe = coloniasLocales('San Martín de Hidalgo');
    expect(coloniasLocales('San Martín Hidalgo')).toEqual(conDe);
    expect(coloniasLocales('SanMartinHidalgo')).toEqual(conDe);
  });

  it('viene ordenada alfabéticamente y sin repetidos', () => {
    const lista = coloniasLocales('San Martín de Hidalgo');
    expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b, 'es')));
    expect(new Set(lista).size).toBe(lista.length);
  });

  it('los demás municipios no tienen lista propia', () => {
    expect(tieneColoniasLocales('Guadalajara')).toBe(false);
    expect(tieneColoniasLocales('Ameca')).toBe(false);
    expect(coloniasLocales('Guadalajara')).toEqual([]);
    expect(tieneColoniasLocales('San Martín de Hidalgo')).toBe(true);
  });
});

describe('coloniasPorMunicipio usa la lista local antes que la API', () => {
  it('para San Martín devuelve la lista guardada SIN llamar a la API', async () => {
    const fetchFalso = vi.fn();
    const lista = await coloniasPorMunicipio('San Martín de Hidalgo', fetchFalso as any);

    expect(fetchFalso).not.toHaveBeenCalled(); // la API está caída: ni se intenta
    expect(lista).toEqual(coloniasLocales('San Martín de Hidalgo'));
  });

  it('para el resto de municipios sigue consultando la API, como antes', async () => {
    const fetchFalso = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: [{ d_asenta: 'Centro', d_mnpio: 'Ameca' }] }),
    }));

    const lista = await coloniasPorMunicipio('Ameca', fetchFalso as any);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(lista).toEqual(['Centro']);
  });

  it('si la API falla en otro municipio, se sigue devolviendo vacío (texto libre)', async () => {
    const fetchFalso = vi.fn(async () => {
      throw new Error('API caída');
    });
    expect(await coloniasPorMunicipio('Ameca', fetchFalso as any)).toEqual([]);
  });
});
