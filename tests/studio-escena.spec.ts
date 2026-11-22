import { describe, it, expect } from 'vitest';
import { empaquetarJSON, desempaquetarJSON } from '@/modules/studio/escena';

describe('estudio: guardado liviano de imágenes', () => {
  it('cambia cada blob: del diseño por una clave y lo devuelve igual al reabrir', () => {
    const a = new Blob(['aaa']);
    const b = new Blob(['bbbb']);
    const mapa: Record<string, Blob> = { 'blob:http://x/1': a, 'blob:http://x/2': b };
    const json = JSON.stringify({ objects: [{ src: 'blob:http://x/1' }, { src: 'blob:http://x/2' }, { src: 'blob:http://x/1' }, { src: 'https://cdn/x.png' }] });
    const emp = empaquetarJSON(json, (u) => mapa[u]);
    expect(emp.imagenes).toEqual([a, b]); // la repetida se guarda una sola vez
    expect(emp.json).not.toContain('blob:');
    expect(emp.json).toContain('https://cdn/x.png'); // lo que no es blob se respeta
    const nuevas: Blob[] = [];
    const rest = desempaquetarJSON(emp.json, emp.imagenes, (bl) => { nuevas.push(bl); return `blob:nuevo/${nuevas.length}`; });
    const o = JSON.parse(rest);
    expect(o.objects.map((x: any) => x.src)).toEqual(['blob:nuevo/1', 'blob:nuevo/2', 'blob:nuevo/1', 'https://cdn/x.png']);
  });

  it('un blob desconocido se deja como está (no se pierde el JSON)', () => {
    const emp = empaquetarJSON('{"src":"blob:http://x/9"}', () => undefined);
    expect(emp.imagenes).toEqual([]);
    expect(emp.json).toContain('blob:http://x/9');
  });
});
