import { describe, it, expect } from 'vitest';
import {
  ASPECTOS, SIN_AJUSTES, ZOOM_MAX, ajustarPixeles, calcularRecorte, dimsGiradas, hayAjustes, moverCentro, sumarGiro, tamanoSalida,
} from '@/utils/recorte';

describe('calcularRecorte', () => {
  it('sin zoom toma el rectángulo más grande de esa proporción, centrado', () => {
    expect(calcularRecorte(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
    expect(calcularRecorte(3000, 4000, 1)).toEqual({ sx: 0, sy: 500, sw: 3000, sh: 3000 });
    const h = calcularRecorte(1000, 1000, 16 / 9);
    expect(h.sw).toBe(1000);
    expect(h.sh).toBeCloseTo(562.5, 3);
  });

  it('el zoom reduce el recorte y nunca pasa de los límites', () => {
    const r = calcularRecorte(2000, 2000, 1, 2);
    expect(r).toEqual({ sx: 500, sy: 500, sw: 1000, sh: 1000 });
    expect(calcularRecorte(2000, 2000, 1, 99).sw).toBe(2000 / ZOOM_MAX);
    expect(calcularRecorte(2000, 2000, 1, 0).sw).toBe(2000); // zoom inválido = 1
    expect(calcularRecorte(2000, 2000, 1, NaN).sw).toBe(2000);
  });

  it('el centro se corrige para no salirse de la imagen', () => {
    const r = calcularRecorte(2000, 1000, 1, 2, 5000, -300);
    expect(r.sx + r.sw).toBeLessThanOrEqual(2000);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx).toBeGreaterThanOrEqual(0);
    const izq = calcularRecorte(2000, 1000, 1, 2, -50, 500);
    expect(izq.sx).toBe(0);
  });

  it('siempre respeta la proporción pedida', () => {
    for (const a of ASPECTOS) for (const z of [1, 1.7, 3]) {
      const r = calcularRecorte(3456, 2304, a.valor, z, 1200, 900);
      expect(r.sw / r.sh).toBeCloseTo(a.valor, 6);
      expect(r.sx).toBeGreaterThanOrEqual(-1e-6);
      expect(r.sy).toBeGreaterThanOrEqual(-1e-6);
      expect(r.sx + r.sw).toBeLessThanOrEqual(3456 + 1e-6);
      expect(r.sy + r.sh).toBeLessThanOrEqual(2304 + 1e-6);
    }
  });
});

describe('giro, arrastre y tamaño final', () => {
  it('girar 90° intercambia ancho y alto, y los giros dan la vuelta', () => {
    expect(dimsGiradas(400, 300, 90)).toEqual({ w: 300, h: 400 });
    expect(dimsGiradas(400, 300, 180)).toEqual({ w: 400, h: 300 });
    expect(sumarGiro(0, -90)).toBe(270);
    expect(sumarGiro(270, 90)).toBe(0);
    expect(sumarGiro(90, 90)).toBe(180);
  });

  it('arrastrar a la derecha muestra lo que había a la izquierda (la foto sigue al dedo)', () => {
    const r = calcularRecorte(2000, 1000, 1, 2);
    const c = moverCentro(r, 50, 0, 300);
    expect(c.cx).toBeLessThan(r.sx + r.sw / 2);
    expect(c.cy).toBeCloseTo(r.sy + r.sh / 2, 6);
  });

  it('la foto final no pasa de 1600 px y conserva la proporción; las chicas no se agrandan', () => {
    const g = tamanoSalida(4000, 3000);
    expect(Math.max(g.w, g.h)).toBe(1600);
    expect(g.w / g.h).toBeCloseTo(4 / 3, 2);
    expect(tamanoSalida(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

describe('ajustarPixeles (brillo, contraste, color)', () => {
  const px = () => new Uint8ClampedArray([100, 150, 200, 255, 10, 20, 30, 128]);

  it('sin ajustes no toca nada', () => {
    const d = px();
    ajustarPixeles(d, SIN_AJUSTES);
    expect([...d]).toEqual([...px()]);
    expect(hayAjustes(SIN_AJUSTES)).toBe(false);
  });

  it('más brillo aclara y menos brillo oscurece; no toca la transparencia', () => {
    const claro = px();
    ajustarPixeles(claro, { ...SIN_AJUSTES, brillo: 50 });
    const oscuro = px();
    ajustarPixeles(oscuro, { ...SIN_AJUSTES, brillo: -50 });
    for (const i of [0, 1, 2]) {
      expect(claro[i]).toBeGreaterThan(px()[i]);
      expect(oscuro[i]).toBeLessThan(px()[i]);
    }
    expect(claro[3]).toBe(255);
    expect(claro[7]).toBe(128);
  });

  it('el contraste aleja los valores del gris medio', () => {
    const d = px();
    ajustarPixeles(d, { ...SIN_AJUSTES, contraste: 60 });
    expect(d[0]).toBeLessThan(100); // 100 < 128: baja
    expect(d[2]).toBeGreaterThan(200); // 200 > 128: sube
  });

  it('color -100 deja la imagen en grises; color +100 acentúa; los valores se acotan a 0–255', () => {
    const g = px();
    ajustarPixeles(g, { ...SIN_AJUSTES, color: -100 });
    expect(Math.abs(g[0] - g[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(g[1] - g[2])).toBeLessThanOrEqual(1);
    const v = px();
    ajustarPixeles(v, { brillo: 100, contraste: 100, color: 100 });
    for (const x of v) expect(x >= 0 && x <= 255).toBe(true);
  });
});
