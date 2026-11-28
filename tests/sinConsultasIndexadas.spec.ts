import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La base real rechaza las consultas orderByChild si las reglas no declaran `.indexOn` (y el mock de las pruebas no lo nota).
 * El módulo de servicios no debe depender de eso: se lee por índices por cliente.
 */
const carpeta = join(process.cwd(), 'src/modules/servicios');
const archivos = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? archivos(join(d, n)) : [join(d, n)]));

describe('servicios no usa consultas que exigen .indexOn', () => {
  it('ningún archivo usa orderByChild', () => {
    const usan = archivos(carpeta).filter((f) => /\.(ts|vue)$/.test(f) && /orderByChild\(/.test(readFileSync(f, 'utf8')));
    expect(usan).toEqual([]);
  });
});
