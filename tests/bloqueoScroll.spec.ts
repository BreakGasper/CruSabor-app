/**
 * Con un diálogo abierto solo se desplaza el diálogo, no la pantalla de atrás.
 * La regla vive en el CSS global y se apoya en las clases de las capas de diálogo: si alguien agrega una capa nueva
 * y no la incluye ahí, esta prueba lo avisa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const css = readFileSync(join(SRC, 'assets/styles/ColorsVarCss.css'), 'utf8');
const vues = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? vues(p) : n.endsWith('.vue') ? [p] : [];
  });

/** Selectores de la regla `body:has(...) { overflow: hidden }` */
const reglaBloqueo = /body:has\(([^)]*\[aria-modal="true"\])\)\s*\{\s*overflow:\s*hidden/.exec(css);
const incluidos = (reglaBloqueo?.[1] ?? '').split(',').map((x) => x.trim().replace(/^\./, ''));

// Capas que NO son diálogos (adornos sobre una imagen, etc.)
const NO_SON_DIALOGO = new Set(['avatar-overlay']);

describe('bloqueo del scroll de fondo con diálogos', () => {
  it('existe la regla para <body> y <html>, y respeta aria-modal', () => {
    expect(reglaBloqueo).not.toBeNull();
    expect(/html:has\([^)]*\)/.test(css)).toBe(true);
    expect(incluidos).toContain('[aria-modal="true"]');
  });

  it('cada capa de diálogo de la app (clase *-overlay u .overlay) está incluida', () => {
    const faltan: string[] = [];
    for (const f of vues(SRC)) {
      const t = readFileSync(f, 'utf8');
      const plantilla = t.slice(0, t.indexOf('<script') > 0 ? t.indexOf('<script') : t.length);
      for (const m of plantilla.matchAll(/class="([^"]*)"/g)) {
        const clases = m[1].split(/\s+/);
        if (clases.some((c) => incluidos.includes(c))) continue; // el elemento ya queda cubierto por alguna de sus clases
        for (const c of clases) {
          if ((/overlay$/.test(c) || c === 'overlay') && !NO_SON_DIALOGO.has(c)) faltan.push(`${f.replace(SRC, 'src')}: .${c}`);
        }
      }
    }
    expect([...new Set(faltan)], 'Agrega estas clases a la regla body:has(...) de ColorsVarCss.css').toEqual([]);
  });

  it('las capas de diálogo evitan que el desplazamiento "contagie" a la pantalla de atrás (overscroll-behavior)', () => {
    expect(css).toMatch(/\.se-overlay[^{]*\{\s*overscroll-behavior:\s*contain/);
    expect(css).toMatch(/\.sd-cuerpo[^{]*\{?[^}]*overscroll-behavior:\s*contain/);
  });
});
