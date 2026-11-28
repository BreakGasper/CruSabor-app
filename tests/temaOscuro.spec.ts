/**
 * Tema oscuro: ningún texto debe quedar claro sobre un fondo claro fijo.
 * Reglas que fijan un fondo claro (#fff, pasteles…) sin tokens del tema no pueden usar a la vez el color de texto
 * del tema (que en oscuro es claro) ni heredarlo cuando el elemento lleva texto: usar los pares fondo+texto del tema.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(vue|css)$/.test(n) ? [p] : [];
  });

const luminancia = (hex: string) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const fondoClaroFijo = (v: string) => {
  v = v.trim().toLowerCase();
  if (v === 'white') return true;
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/.test(v)) return luminancia(v) > 0.8;
  return false;
};
const TEXTO_DEL_TEMA = /var\(--(text|text-muted|brand-navy-text|brand-blue-text|on-primary)\)/;

function reglas(css: string) {
  return [...css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(), cuerpo: m[2] }));
}

describe('tema oscuro: contraste de las hojas de estilo', () => {
  it('ninguna regla con fondo claro fijo usa el color de texto del tema (claro en oscuro)', () => {
    const mal: string[] = [];
    for (const f of archivos(SRC)) {
      const t = readFileSync(f, 'utf8');
      const estilos = f.endsWith('.vue') ? [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]) : [t];
      for (const css of estilos) {
        for (const { sel, cuerpo } of reglas(css)) {
          const bg = [...cuerpo.matchAll(/(?<![-\w])background(?:-color)?\s*:\s*([^;]+);/g)].pop()?.[1];
          const color = [...cuerpo.matchAll(/(?<![-\w])color\s*:\s*([^;]+);/g)].pop()?.[1];
          if (bg && color && fondoClaroFijo(bg) && TEXTO_DEL_TEMA.test(color)) mal.push(`${f.replace(SRC, 'src')}  ${sel}  { background: ${bg.trim()}; color: ${color.trim()} }`);
        }
      }
    }
    expect(mal, 'Usa var(--surface-2)/var(--brand-blue-soft) o los pares --aviso/--ok/--peligro:\n' + mal.join('\n')).toEqual([]);
  });

  it('cada par de estado (aviso, ok, peligro) está definido en claro y en oscuro', () => {
    const css = readFileSync(join(SRC, 'assets/styles/ColorsVarCss.css'), 'utf8');
    const oscuro = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    for (const par of ['aviso', 'ok', 'peligro']) {
      for (const parte of ['fondo', 'texto']) {
        const nombre = `--${par}-${parte}:`;
        expect(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')), nombre + ' (claro)').toContain(nombre);
        expect(oscuro, nombre + ' (oscuro)').toContain(nombre);
      }
    }
  });

  it('en oscuro el texto de cada par se lee sobre su fondo (contraste ≥ 4.5)', () => {
    const css = readFileSync(join(SRC, 'assets/styles/ColorsVarCss.css'), 'utf8');
    const oscuro = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    const claro = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
    const valor = (bloque: string, n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(bloque)![1];
    const lumRelativa = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (a: string, b: string) => {
      const [x, y] = [lumRelativa(a), lumRelativa(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const par of ['aviso', 'ok', 'peligro']) {
      for (const [nombre, bloque] of [['claro', claro], ['oscuro', oscuro]] as const) {
        expect(contraste(valor(bloque, `${par}-fondo`), valor(bloque, `${par}-texto`)), `${par} ${nombre}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
