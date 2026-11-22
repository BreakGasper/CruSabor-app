import { describe, it, expect } from 'vitest';
import { ESTILOS, FORMATOS_ESTUDIO, LAYOUTS, DATOS_VACIOS, type DatosProducto } from '@/modules/studio/motor/tipos';
import { generarPropuestas } from '@/modules/studio/motor/generar';
import { construirLayout } from '@/modules/studio/motor/layouts';
import { verificar, ajustarTexto, partir, formatearPrecio, porcentajeOferta, crearRng } from '@/modules/studio/motor/util';
import { generarDecor, DECOR_NOMBRES } from '@/modules/studio/motor/decor';

// Medida simulada: 0.55 del tamaño por letra (parecida a una fuente sans normal) y más ancho si pesa más
const medir = (t: string, tam: number, peso: number) => t.length * tam * (0.52 + (peso >= 800 ? 0.06 : 0));

const COMPLETO: DatosProducto = {
  ...DATOS_VACIOS,
  nombre: 'Piñata de Tractor', precio: 550, precioAntes: 700, descripcion: 'Piñata con forma de tractor John Deere, hecha a mano.',
  categoria: 'Piñatas', medidas: '80 cm alto x 1 mt ancho', disponibilidad: 'Disponible', color: 'Verde', caracteristicas: ['Hecha a mano', 'Papel de china', 'Lista para rellenar'], tienda: 'CG-Rat', conLogo: true,
};
const BASICO: DatosProducto = { ...DATOS_VACIOS, nombre: 'Pastel', precio: 350 };
const LARGO: DatosProducto = { ...COMPLETO, nombre: 'Pastel de tres leches con fresas naturales, decorado a mano para cumpleaños y bodas', descripcion: 'x'.repeat(400), medidas: '120 cm de ancho por 80 cm de alto por 40 cm de profundidad', precioAntes: null, precio: 1250.5, tienda: 'Pastelería Los Hermanos Gutiérrez de la Colonia Centro' };
const SIN_PRECIO: DatosProducto = { ...COMPLETO, precio: null, precioAntes: null };

const FOTOS = [{ w: 1000, h: 1000 }, { w: 3000, h: 1500 }, { w: 800, h: 2400 }, { w: 4000, h: 3000 }];
const VARIANTES: [string, DatosProducto][] = [['completo', COMPLETO], ['básico', BASICO], ['largo', LARGO], ['sin precio', SIN_PRECIO]];

describe('motor de diseño: ningún texto se sale ni se encima, en TODAS las combinaciones', () => {
  for (const estilo of ESTILOS) {
    for (const layout of LAYOUTS) {
      it(`${estilo.nombre} · ${layout.nombre}`, () => {
        const fallos: string[] = [];
        for (const formato of FORMATOS_ESTUDIO) {
          for (const [nombre, datos] of VARIANTES) {
            for (const prod of FOTOS) {
              for (let p = 0; p < estilo.paletas.length; p++) {
                const elems = construirLayout({ w: formato.w, h: formato.h, datos, prod, estilo, paleta: estilo.paletas[p], layout: layout.id, semilla: 7 + p, medir, decor: estilo.decor.slice(0, 2) });
                const prob = verificar(elems, formato.w, formato.h);
                if (prob.length) fallos.push(`${formato.id}/${nombre}/${prod.w}x${prod.h}/${estilo.paletas[p].id}: ${JSON.stringify(prob[0])}`);
              }
            }
          }
        }
        expect(fallos.slice(0, 5)).toEqual([]);
      });
    }
  }
});

describe('motor de diseño: contenido', () => {
  const base = { datos: COMPLETO, prod: { w: 1000, h: 1000 }, estiloId: 'granja', formato: FORMATOS_ESTUDIO[0], medir };

  it('incluye los datos del producto como elementos y el precio es un elemento visual grande', () => {
    const [p] = generarPropuestas(base);
    const roles = p.elems.map((e) => e.rol);
    for (const r of ['fondo', 'producto', 'titulo', 'precio']) expect(roles, r).toContain(r);
    const precio = p.elems.find((e) => e.rol === 'precio')!;
    const titulo = p.elems.find((e) => e.rol === 'titulo')!;
    expect(precio.texto).toBe('$550');
    expect(precio.tam!).toBeGreaterThan(40);
    expect(titulo.texto!.replace(/\n/g, ' ')).toMatch(/Piñata de Tractor/);
    expect(p.elems.find((e) => e.rol === 'precio-antes')!.tachado).toBe(true);
    expect(p.elems.find((e) => e.rol === 'oferta')!.texto).toBe('-21%');
  });

  it('sin precio no inventa uno; sin descripción ni datos, no deja huecos de texto vacío', () => {
    const [p] = generarPropuestas({ ...base, datos: { ...BASICO, precio: null } });
    expect(p.elems.some((e) => e.rol === 'precio' || e.rol === 'oferta')).toBe(false);
    expect(p.elems.filter((e) => e.tipo === 'texto').every((e) => (e.texto ?? '').trim().length > 0)).toBe(true);
  });

  it('un nombre larguísimo se reduce y recorta sin salirse de su zona', () => {
    const [p] = generarPropuestas({ ...base, datos: LARGO });
    const t = p.elems.find((e) => e.rol === 'titulo')!;
    expect(t.texto!.split('\n').length).toBeLessThanOrEqual(3);
    expect(verificar(p.elems, p.formato.w, p.formato.h)).toEqual([]);
  });

  it('la foto cubre la caja si se parece a ella y entra completa si es muy distinta', () => {
    const cuadrada = generarPropuestas({ ...base, prod: { w: 1000, h: 1000 }, estiloId: 'fiesta' })[0].elems.find((e) => e.rol === 'producto')!;
    const panoramica = generarPropuestas({ ...base, prod: { w: 4000, h: 800 }, estiloId: 'fiesta' })[0].elems.find((e) => e.rol === 'producto')!;
    expect(['cubrir', 'contener']).toContain(cuadrada.ajuste);
    expect(panoramica.ajuste).toBe('contener');
    expect(panoramica.w / panoramica.h).toBeCloseTo(5, 0);
  });

  it('cada layout reparte el lienzo de forma distinta (no es solo otro color), en vertical y en horizontal', () => {
    for (const formato of [FORMATOS_ESTUDIO[0], FORMATOS_ESTUDIO[4]]) {
      const firmas = new Set<string>();
      for (const l of LAYOUTS) {
        const elems = construirLayout({ w: formato.w, h: formato.h, datos: COMPLETO, prod: { w: 1000, h: 1000 }, estilo: ESTILOS[0], paleta: ESTILOS[0].paletas[0], layout: l.id, semilla: 1, medir, decor: [] });
        const pr = elems.find((e) => e.rol === 'producto')!;
        const ti = elems.find((e) => e.rol === 'titulo')!;
        const pre = elems.find((e) => e.rol === 'precio')!;
        const r = (n: number) => Math.round(n / 30);
        firmas.add([r(pr.x), r(pr.y), r(pr.w), r(pr.h), pr.rot ?? 0, ti.alinear, r(ti.y), r(pre.y), r(pre.x)].join('|'));
      }
      // En horizontal algunos layouts comparten el reparto lateral, pero al menos la mitad deben distinguirse
      expect(firmas.size, formato.id).toBeGreaterThanOrEqual(formato.w > formato.h ? 3 : 6);
    }
  });
});

describe('propuestas', () => {
  const base = { datos: COMPLETO, prod: { w: 1000, h: 1000 }, formato: FORMATOS_ESTUDIO[1], medir };

  it('son 3 por tanda, distintas entre sí y repetibles', () => {
    for (const estilo of ESTILOS.filter((s) => s.id !== 'personalizado')) {
      const a = generarPropuestas({ ...base, estiloId: estilo.id });
      expect(a).toHaveLength(3);
      const claves = a.map((p) => `${p.layout}|${p.paleta}|${p.elems.filter((e) => e.rol.startsWith('decor')).length}|${p.semilla}`);
      expect(new Set(claves).size, estilo.id).toBe(3);
      expect(generarPropuestas({ ...base, estiloId: estilo.id }).map((p) => p.id)).toEqual(a.map((p) => p.id));
      expect(JSON.stringify(generarPropuestas({ ...base, estiloId: estilo.id })[0].elems)).toBe(JSON.stringify(a[0].elems));
    }
  });

  it('"generar otras" da propuestas nuevas en cada tanda', () => {
    const vistas = new Set<string>();
    for (let t = 0; t < 4; t++) for (const p of generarPropuestas({ ...base, estiloId: 'fiesta', tanda: t })) vistas.add(p.id);
    expect(vistas.size).toBe(12);
  });

  it('los layouts de un estilo se respetan y se puede forzar uno', () => {
    const estilo = ESTILOS.find((e) => e.id === 'premium')!;
    for (const p of generarPropuestas({ ...base, estiloId: 'premium' })) expect(estilo.layouts).toContain(p.layout);
    expect(generarPropuestas({ ...base, estiloId: 'premium', layout: 'catalog' }).every((p) => p.layout === 'catalog')).toBe(true);
  });

  it('el estilo personalizado arranca limpio (sin recursos decorativos)', () => {
    const [p] = generarPropuestas({ ...base, estiloId: 'personalizado' });
    expect(p.elems.some((e) => e.rol.startsWith('decor-') && e.rol !== 'decor-sombra')).toBe(false);
  });
});

describe('utilidades del motor', () => {
  it('ajustarTexto: baja el tamaño hasta que cabe y nunca se pasa de la caja', () => {
    const o = { tamMax: 100, maxLineas: 3, peso: 700, fuente: 'x', interlineado: 1.1 };
    const corto = ajustarTexto(medir, 'Hola', 600, 150, o);
    const largo = ajustarTexto(medir, 'Una descripción bastante larga que no cabe a tamaño grande', 600, 150, o);
    expect(corto.tam).toBe(100);
    expect(largo.tam).toBeLessThan(100);
    expect(largo.alto).toBeLessThanOrEqual(150 + 1);
    const absurdo = ajustarTexto(medir, 'palabra'.repeat(80), 200, 60, { ...o, maxLineas: 1 });
    expect(absurdo.lineas).toHaveLength(1);
    expect(absurdo.lineas[0].endsWith('…') || absurdo.ancho <= 200).toBe(true);
  });

  it('partir respeta ancho y máximo de renglones', () => {
    const r = partir((t) => t.length * 10, 'uno dos tres cuatro cinco seis', 80, 2);
    expect(r.lineas).toHaveLength(2);
    expect(r.recortado).toBe(true);
    expect(r.lineas[1].endsWith('…')).toBe(true);
  });

  it('precio y oferta', () => {
    expect(formatearPrecio(550)).toBe('$550');
    expect(formatearPrecio(1250.5)).toBe('$1,250.50');
    expect(formatearPrecio(null)).toBe('');
    expect(porcentajeOferta(550, 700)).toBe(21);
    expect(porcentajeOferta(700, 550)).toBe(0);
  });

  it('el azar con semilla es repetible', () => {
    const a = crearRng(5);
    const b = crearRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(crearRng(6)()).not.toBe(crearRng(5)());
  });

  it('biblioteca de recursos: todos generan algo y tienen nombre', () => {
    const paleta = ESTILOS[0].paletas[0];
    for (const id of Object.keys(DECOR_NOMBRES) as (keyof typeof DECOR_NOMBRES)[]) {
      const r = generarDecor(id, { w: 1080, h: 1620, rng: crearRng(3), paleta });
      expect(r.length, id).toBeGreaterThan(0);
      expect(r.every((e) => e.rol.startsWith('decor'))).toBe(true);
    }
  });
});

import { paletaDesdeTema, contraste, leerColor } from '@/modules/studio/motor/tema';

describe('tema de Crustore en los diseños', () => {
  const TEMAS = {
    'carbon-lima': { oscuro: '#1c1f1a', boton: '#1c1f1a', sobreBoton: '#c6f432', acento: '#b5e61d', marca: '#627c10' },
    'rosa-negro': { oscuro: '#141414', boton: '#d6006f', sobreBoton: '#ffffff', acento: '#ffffff', marca: '#d6006f' },
    'azul-anil': { oscuro: '#2b3a8c', boton: '#2b3a8c', sobreBoton: '#ffffff', acento: '#f5a623', marca: '#2b3a8c' },
    crustore: { oscuro: '#1f2430', boton: '#ff2e97', sobreBoton: '#1e232f', acento: '#00a9c2', marca: '#7548f0' },
  };

  it('el acento siempre se distingue del fondo, también cuando el botón de la paleta es oscuro (carbón y lima)', () => {
    for (const [nombre, t] of Object.entries(TEMAS)) {
      const p = paletaDesdeTema(t);
      expect(contraste(p.acento, p.fondoA), nombre).toBeGreaterThanOrEqual(3);
      expect(contraste(p.sobreAcento, p.acento), nombre).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.titulo, p.fondoA), nombre).toBeGreaterThanOrEqual(7);
      expect(p.id).toBe('tema');
    }
    // En carbón y lima el botón es casi igual al fondo: el acento sale del lima, no del botón
    const lima = paletaDesdeTema(TEMAS['carbon-lima']);
    expect(lima.acento).not.toBe('#1c1f1a');
    expect(['#b5e61d', '#c6f432']).toContain(lima.acento);
  });

  it('colores ilegibles no rompen nada', () => {
    const p = paletaDesdeTema({ oscuro: 'var(--x)', boton: '', sobreBoton: 'rojo', acento: 'x', marca: '' });
    expect(leerColor(p.fondoA)).not.toBeNull();
    expect(leerColor(p.acento)).not.toBeNull();
  });

  it('con la paleta del tema, todas las propuestas la usan y no se sale nada, en todos los estilos', () => {
    for (const t of Object.values(TEMAS)) {
      const paleta = paletaDesdeTema(t);
      for (const estilo of ESTILOS) {
        for (const formato of FORMATOS_ESTUDIO) {
          for (const p of generarPropuestas({ datos: COMPLETO, prod: { w: 1000, h: 1000 }, estiloId: estilo.id, formato, medir, paleta })) {
            expect(p.paleta).toBe('tema');
            expect(p.paletaObj).toEqual(paleta);
            expect(verificar(p.elems, formato.w, formato.h), `${estilo.id}/${formato.id}`).toEqual([]);
          }
        }
      }
    }
  });
});
