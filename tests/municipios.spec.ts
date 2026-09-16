/**
 * Municipios y alcance (admin) + búsqueda de colonias por código postal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __getAt, __getTree } from './mocks/firebaseDb';
import {
  MUNICIPIOS_JALISCO,
  tieneAlcance,
  sembrarMunicipiosJalisco,
  setAlcanceMunicipio,
  marcarTodosAlcance,
  obtenerMunicipios,
} from '@/composables/useLugar';
import { extraer, buscarPorCP, coloniasPorMunicipio } from '@/composables/useCodigoPostal';

describe('municipios de Jalisco', () => {
  it('la lista tiene los 125 municipios, sin duplicados', () => {
    expect(MUNICIPIOS_JALISCO).toHaveLength(125);
    expect(new Set(MUNICIPIOS_JALISCO.map((m) => m.toLowerCase())).size).toBe(125);
  });

  it('tieneAlcance: solo true = sí (ausente o false = no; opt-in)', () => {
    expect(tieneAlcance({ alcance: true })).toBe(true);
    expect(tieneAlcance({})).toBe(false);
    expect(tieneAlcance({ alcance: false })).toBe(false);
  });
});

describe('sembrar y alcance (admin)', () => {
  beforeEach(() => __reset({ municipios: {} }));

  it('siembra los 125 municipios (sin alcance por defecto) y no duplica al repetir', async () => {
    const n = await sembrarMunicipiosJalisco();
    expect(n).toBe(125);
    const nodo = __getTree().municipios;
    expect(Object.keys(nodo)).toHaveLength(125);
    // Nacen SIN alcance: el admin marca a mano
    expect(Object.values(nodo).every((m: any) => m.alcance === false)).toBe(true);

    const otra = await sembrarMunicipiosJalisco();
    expect(otra).toBe(0);
    expect(Object.keys(__getTree().municipios)).toHaveLength(125);
  });

  it('conserva municipios existentes (por nombre) al sembrar', async () => {
    __reset({ municipios: { g1: { id: 'g1', municipio: 'Guadalajara', estado: 'Jalisco', pueblos: ['Centro'], alcance: true } } });
    await sembrarMunicipiosJalisco();
    // Guadalajara sigue siendo la misma entrada, con sus colonias
    expect(__getAt('municipios/g1/pueblos')).toEqual(['Centro']);
    expect(Object.keys(__getTree().municipios)).toHaveLength(125);
  });

  it('setAlcanceMunicipio cambia el flag', async () => {
    __reset({ municipios: { m1: { id: 'm1', municipio: 'Tonalá', estado: 'Jalisco', pueblos: [], alcance: true } } });
    await setAlcanceMunicipio('m1', false);
    expect(__getAt('municipios/m1/alcance')).toBe(false);

    const lista = await obtenerMunicipios();
    expect(lista.find((m) => m.id === 'm1')!.alcance).toBe(false);
  });

  it('marcarTodosAlcance cambia todos de una vez', async () => {
    __reset({
      municipios: {
        a: { id: 'a', municipio: 'Guadalajara', estado: 'Jalisco', pueblos: [], alcance: false },
        b: { id: 'b', municipio: 'Zapopan', estado: 'Jalisco', pueblos: [], alcance: false },
      },
    });
    await marcarTodosAlcance(true);
    expect(__getAt('municipios/a/alcance')).toBe(true);
    expect(__getAt('municipios/b/alcance')).toBe(true);
    await marcarTodosAlcance(false);
    expect(__getAt('municipios/a/alcance')).toBe(false);
    expect(__getAt('municipios/b/alcance')).toBe(false);
  });
});

describe('colonias por código postal', () => {
  it('extraer entiende varias formas de respuesta', () => {
    expect(extraer({ zip_codes: [{ d_asenta: 'Centro', d_mnpio: 'Guadalajara', d_estado: 'Jalisco' }] })).toEqual({
      colonias: ['Centro'],
      municipio: 'Guadalajara',
      estado: 'Jalisco',
    });
    expect(extraer([{ asentamiento: 'Americana', municipio: 'Guadalajara', estado: 'Jalisco' }])).toMatchObject({
      colonias: ['Americana'],
      municipio: 'Guadalajara',
    });
    expect(extraer({ response: { asentamiento: 'Moderna', municipio: 'Guadalajara' } })).toMatchObject({
      colonias: ['Moderna'],
    });
    expect(extraer({})).toBeNull();
  });

  it('buscarPorCP exige 5 dígitos y no lanza si la API falla', async () => {
    expect(await buscarPorCP('123')).toBeNull();
    const fetchCaido = vi.fn(async () => {
      throw new Error('sin red');
    });
    expect(await buscarPorCP('44100', fetchCaido as any)).toBeNull();
  });

  it('buscarPorCP devuelve colonias cuando la API responde', async () => {
    const fetchOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({ zip_codes: [{ d_asenta: 'Centro', d_mnpio: 'Guadalajara', d_estado: 'Jalisco' }] }),
    }));
    const info = await buscarPorCP('44100', fetchOk as any);
    expect(info).toMatchObject({ colonias: ['Centro'], municipio: 'Guadalajara' });
  });

  it('coloniasPorMunicipio dedup, ordena y filtra por municipio; tolera fallos', async () => {
    const fetchOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        zip_codes: [
          { d_asenta: 'Centro', d_mnpio: 'Guadalajara' },
          { d_asenta: 'Americana', d_mnpio: 'Guadalajara' },
          { d_asenta: 'Centro', d_mnpio: 'Guadalajara' }, // duplicado
          { d_asenta: 'OtraCiudad', d_mnpio: 'Zapopan' }, // otro municipio: se ignora
        ],
        meta: { pagination: { total_pages: 1 } },
      }),
    }));
    const cols = await coloniasPorMunicipio('Guadalajara', fetchOk as any);
    expect(cols).toEqual(['Americana', 'Centro']);

    const fetchCaido = vi.fn(async () => {
      throw new Error('sin red');
    });
    expect(await coloniasPorMunicipio('Guadalajara', fetchCaido as any)).toEqual([]);
    expect(await coloniasPorMunicipio('', fetchOk as any)).toEqual([]);
  });
});
