/**
 * Efecto "Text Scramble" (decode / glitch reveal / matrix): aparecen letras y símbolos al azar, cambian rápido,
 * poco a poco se van acomodando y al final queda el texto correcto.
 *
 * Aquí vive la parte pura (sin DOM ni temporizadores) para poder probarla: cada carácter tiene un fotograma en el
 * que empieza a "barajarse" y otro en el que se fija en su letra final.
 */

export const GLIFOS = '!<>-_\\/[]{}—=+*^?#%&$@0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface CaracterPlan {
  /** Carácter final */
  c: string;
  /** Fotograma en el que se fija en `c` */
  fin: number;
}

export interface PlanScramble {
  caracteres: CaracterPlan[];
  fotogramas: number;
}

/**
 * Reparte cuándo se fija cada carácter (todos arrancan barajados desde el primer cuadro). Los espacios no se animan.
 * `fotogramas` es la duración total del efecto; el último carácter se fija a más tardar en el último.
 */
export function crearPlanScramble(texto: string, azar: () => number = Math.random, fotogramas = 36): PlanScramble {
  const total = Math.max(2, Math.trunc(fotogramas));
  const caracteres = Array.from(String(texto ?? '')).map((c) => {
    if (/\s/.test(c)) return { c, fin: 0 };
    const fin = Math.min(total, Math.max(4, Math.floor(total * 0.3 + azar() * total * 0.7)));
    return { c, fin };
  });
  // Siempre termina exactamente en el último fotograma, aunque el azar haya sido muy favorable
  const ultimo = caracteres.reduce((m, x) => Math.max(m, x.fin), 0);
  if (caracteres.some((x) => !/\s/.test(x.c)) && ultimo < total) {
    const i = caracteres.findIndex((x) => x.fin === ultimo && !/\s/.test(x.c));
    if (i >= 0) caracteres[i].fin = total;
  }
  return { caracteres, fotogramas: total };
}

/** Texto que se ve en el fotograma `f` (0 = todo barajado; `fotogramas` o más = texto final) */
export function fotogramaScramble(plan: PlanScramble, f: number, azar: () => number = Math.random): string {
  let salida = '';
  for (const { c, fin } of plan.caracteres) {
    salida += /\s/.test(c) || f >= fin ? c : GLIFOS[Math.floor(azar() * GLIFOS.length)];
  }
  return salida;
}

/** ¿La persona pidió menos movimiento? Entonces el texto aparece directo, sin animación */
export function prefiereMenosMovimiento(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
