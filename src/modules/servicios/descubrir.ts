import { estadoEfectivo, type ControlTienda } from '@/composables/useMembresia';
import type { Tienda } from '@/composables/useTiendas';
import { CATEGORIAS_SERVICIO, nombreCategoriaServicio, type ModalidadAtencion, type Servicio } from './tipos';
import { atiendeADomicilio, atiendeEnLocal, modalidadDe, ofreceServicios } from './negocio';

/**
 * Encontrar servicios: qué tiendas mostrar en el directorio y cómo buscarlas. Lógica pura (sin Firebase).
 * Solo salen tiendas que ofrecen servicios y están disponibles (activas, con membresía vigente).
 */

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export type FiltroModalidad = 'todas' | 'local' | 'domicilio';

export interface FiltrosDirectorio {
  texto?: string;
  categoria?: string; // id de CATEGORIAS_SERVICIO ('' = todas)
  modalidad?: FiltroModalidad;
}

/** Tiendas que se pueden descubrir como profesionales */
export const tiendasDeServicios = (tiendas: Tienda[], ahora: Date = new Date()): Tienda[] =>
  tiendas.filter((t) => ofreceServicios(t) && estadoEfectivo(t as ControlTienda, ahora) === 'activa');

/** Servicios activos de una tienda, agrupados: { tiendaId: Servicio[] } */
export function serviciosPorTienda(servicios: Servicio[]): Record<string, Servicio[]> {
  const salida: Record<string, Servicio[]> = {};
  for (const s of servicios) if (s.activo) (salida[s.tiendaId] ??= []).push(s);
  return salida;
}

/** "Desde $X": el menor precio entre sus servicios con precio; null si todos son a cotizar */
export function precioDesde(servicios: Pick<Servicio, 'precio' | 'tipoPrecio'>[] | undefined): number | null {
  const precios = (servicios ?? []).filter((s) => s.tipoPrecio !== 'cotizar' && s.precio > 0).map((s) => s.precio);
  return precios.length ? Math.min(...precios) : null;
}

const coincideModalidad = (m: ModalidadAtencion, f: FiltroModalidad) => f === 'todas' || (f === 'local' ? atiendeEnLocal(m) : atiendeADomicilio(m));

/** Filtra profesionales por texto (nombre, categoría, especialidades, servicios), categoría y modalidad */
export function filtrarProfesionales(tiendas: Tienda[], porTienda: Record<string, Servicio[]>, f: FiltrosDirectorio = {}): Tienda[] {
  const q = sinAcentos(f.texto ?? '');
  return tiendas
    .filter((t) => !f.categoria || t.categoriaServicio === f.categoria)
    .filter((t) => coincideModalidad(modalidadDe(t), f.modalidad ?? 'todas'))
    .filter((t) => {
      if (!q) return true;
      const pajar = [t.nombreTienda, t.descripcion, nombreCategoriaServicio(t.categoriaServicio), ...(t.especialidades ?? []), ...(porTienda[t.tiendaId ?? ''] ?? []).flatMap((s) => [s.nombre, s.descripcion])].join(' ');
      return sinAcentos(pajar).includes(q);
    })
    .sort((a, b) => a.nombreTienda.localeCompare(b.nombreTienda, 'es'));
}

/** Servicios (de las tiendas visibles) que coinciden con la búsqueda, categoría y modalidad */
export function filtrarServicios(tiendas: Tienda[], porTienda: Record<string, Servicio[]>, f: FiltrosDirectorio = {}): Array<{ servicio: Servicio; tienda: Tienda }> {
  const q = sinAcentos(f.texto ?? '');
  const salida: Array<{ servicio: Servicio; tienda: Tienda }> = [];
  for (const tienda of tiendas) {
    for (const servicio of porTienda[tienda.tiendaId ?? ''] ?? []) {
      if (f.categoria && servicio.categoria !== f.categoria && tienda.categoriaServicio !== f.categoria) continue;
      if (!coincideModalidad(servicio.modalidad, f.modalidad ?? 'todas')) continue;
      if (q && !sinAcentos(`${servicio.nombre} ${servicio.descripcion} ${tienda.nombreTienda}`).includes(q)) continue;
      salida.push({ servicio, tienda });
    }
  }
  return salida.sort((a, b) => a.servicio.nombre.localeCompare(b.servicio.nombre, 'es'));
}

/** Categorías de servicio que tienen al menos una tienda visible, con cuántas */
export function categoriasConProfesionales(tiendas: Tienda[]): Array<{ id: string; nombre: string; icono: string; total: number }> {
  return CATEGORIAS_SERVICIO.map((c) => ({ ...c, total: tiendas.filter((t) => t.categoriaServicio === c.id).length })).filter((c) => c.total > 0);
}
