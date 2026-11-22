import { construirLayout } from './layouts';
import { estiloPorId, type DatosProducto, type DecorId, type Formato, type LayoutId, type Paleta, type Propuesta } from './tipos';
import type { Medir } from './util';

/**
 * Genera propuestas: combinaciones CONTROLADAS de layout, paleta y recursos decorativos del estilo elegido.
 * No hay azar suelto: cada propuesta sale de su número (tanda × 3 + posición), así que repetir da lo mismo
 * y las tres de una tanda siempre se distinguen entre sí.
 */

export interface EntradaGenerar {
  datos: DatosProducto;
  prod: { w: number; h: number };
  estiloId: string;
  formato: Formato;
  medir: Medir;
  /** 0 para las primeras tres; +1 con cada "Generar otras propuestas" */
  tanda?: number;
  /** Fuerza un layout (si no, se elige por el estilo) */
  layout?: LayoutId;
  /** Cuántas propuestas (3 por defecto) */
  cantidad?: number;
  /** Usa esta paleta en todas (p. ej. la del tema de Crustore) en lugar de las del estilo */
  paleta?: Paleta;
}

export function decorDeLaPropuesta(decorEstilo: DecorId[], k: number): DecorId[] {
  if (!decorEstilo.length) return [];
  // Dos recursos distintos por propuesta, que van rotando con k
  const a = decorEstilo[k % decorEstilo.length];
  const b = decorEstilo[(k + 1 + Math.floor(k / decorEstilo.length)) % decorEstilo.length];
  return a === b ? [a] : [a, b];
}

export function generarPropuestas(e: EntradaGenerar): Propuesta[] {
  const estilo = estiloPorId(e.estiloId);
  const tanda = Math.max(0, e.tanda ?? 0);
  const cantidad = e.cantidad ?? 3;
  const props: Propuesta[] = [];
  for (let i = 0; i < cantidad; i++) {
    const k = tanda * cantidad + i;
    const layout = e.layout ?? estilo.layouts[k % estilo.layouts.length];
    // La paleta cambia cuando se agotan los layouts, y también con la tanda, para no repetir pareja
    const pal = e.paleta ?? estilo.paletas[(Math.floor(k / estilo.layouts.length) + i + tanda) % estilo.paletas.length];
    const semilla = 1000 + k * 7919 + estilo.id.length * 31;
    const decor = decorDeLaPropuesta(estilo.decor, k);
    const elems = construirLayout({ w: e.formato.w, h: e.formato.h, datos: e.datos, prod: e.prod, estilo, paleta: pal, layout, semilla, medir: e.medir, decor });
    props.push({ id: `${estilo.id}-${layout}-${pal.id}-${k}`, estilo: estilo.id, layout, paleta: pal.id, ...(e.paleta ? { paletaObj: e.paleta } : {}), semilla, formato: e.formato, elems });
  }
  return props;
}
