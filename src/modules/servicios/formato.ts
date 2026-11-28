/** Formatos de fecha y dinero para las pantallas de servicios (es-MX) */

/** "2026-12-05" -> "5 dic 2026" (sin que la zona horaria del dispositivo mueva el día) */
export function fechaCorta(aaaammdd?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(aaaammdd ?? '');
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ISO completo -> "5 dic 2026, 14:30" */
export function fechaHoraCorta(iso?: string): string {
  const d = new Date(iso ?? '');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export const dinero = (n: number): string => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** "2026-12-01" -> "mar, 1 dic" */
export function fechaDia(aaaammdd?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(aaaammdd ?? '');
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}
