/**
 * Búsqueda de colonias por código postal usando una API pública gratuita (sin token).
 *
 * Se usa en el registro y edición de tienda: al escribir un C.P. de 5 dígitos, autocompleta
 * las colonias, el municipio y el estado. Es "mejor esfuerzo": si la API no responde o el
 * navegador la bloquea, devuelve null y el formulario sigue con captura manual.
 *
 * API por defecto: SEPOMEX (api-sepomex.hckdrk.mx), gratuita y sin token. Si deja de
 * funcionar, cambiar CP_API / COL_API y/o el parseo de `extraer()`; el resto no depende
 * de la forma exacta de la respuesta.
 */
import { coloniasDeMunicipio, tieneCatalogo } from './coloniasLocales';

const CP_API = (cp: string) => `https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`;

export interface InfoCP {
  colonias: string[];
  municipio: string;
  estado: string;
}

const texto = (...vals: any[]) => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
};

/** Saca de la respuesta (varias formas posibles) la lista de asentamientos */
function filas(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.zip_codes)) return data.zip_codes;
  if (Array.isArray(data.response)) return data.response;
  if (data.response && typeof data.response === 'object') return [data.response];
  return [];
}

/** El asentamiento puede venir como string (una fila por colonia) o como arreglo (modo simplificado) */
function coloniasDeFila(r: any): string[] {
  const a = r?.d_asenta ?? r?.asentamiento ?? r?.colonia ?? r?.settlement ?? r?.name;
  if (Array.isArray(a)) return a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  const t = texto(a);
  return t ? [t] : [];
}

/** Normaliza una respuesta cruda a { colonias, municipio, estado } */
export function extraer(data: any): InfoCP | null {
  const rows = filas(data);
  if (!rows.length) return null;
  const colonias = Array.from(new Set(rows.flatMap(coloniasDeFila)));
  const municipio = texto(rows[0]?.d_mnpio, rows[0]?.municipio, rows[0]?.municipality);
  const estado = texto(rows[0]?.d_estado, rows[0]?.estado, rows[0]?.state);
  if (!colonias.length && !municipio) return null;
  return { colonias, municipio, estado };
}

const COL_API = (m: string) =>
  `https://api-sepomex.hckdrk.mx/query/get_colonia_por_municipio/${encodeURIComponent(m)}`;

/** De dónde salió la lista de colonias, que no es lo mismo para validar */
export type OrigenColonias = 'catalogo' | 'api' | 'ninguna';

/**
 * Lista de colonias de un municipio (para el desplegable al elegir municipio),
 * junto con el origen del dato.
 *
 * Primero el catálogo guardado en la app (`coloniasLocales.ts`), que cubre todo
 * Jalisco: es lo único que funciona con la API caída, y ni se consulta la red.
 *
 * Si el municipio no está en el catálogo (otro estado), mejor esfuerzo por API:
 * se filtra por municipio y se quitan duplicados. Si no responde, [] y el
 * formulario sigue con captura por código postal o texto libre.
 */
export async function coloniasPorMunicipioConOrigen(
  municipio: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ colonias: string[]; origen: OrigenColonias }> {
  const m = String(municipio || '').trim();
  if (!m) return { colonias: [], origen: 'ninguna' };

  if (await tieneCatalogo(m)) {
    return { colonias: await coloniasDeMunicipio(m), origen: 'catalogo' };
  }

  const colonias = await porApi(m, fetchImpl);
  return { colonias, origen: colonias.length ? 'api' : 'ninguna' };
}

/** Solo los nombres, para quien no necesita saber de dónde salieron */
export async function coloniasPorMunicipio(
  municipio: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  return (await coloniasPorMunicipioConOrigen(municipio, fetchImpl)).colonias;
}

async function porApi(m: string, fetchImpl: typeof fetch): Promise<string[]> {
  const set = new Set<string>();
  try {
    const r = await fetchImpl(COL_API(m), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    for (const row of filas(data)) {
      const mun = texto(row?.d_mnpio, row?.municipio, row?.municipality);
      // Si la API no filtró, nos quedamos solo con las del municipio pedido
      if (mun && mun.toLowerCase() !== m.toLowerCase()) continue;
      for (const col of coloniasDeFila(row)) set.add(col);
    }
  } catch {
    /* sin conexión / CORS / timeout / endpoint no disponible: [] */
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

/** Consulta el C.P. (5 dígitos). Devuelve null si no hay 5 dígitos o si la API falla. */
export async function buscarPorCP(cp: string, fetchImpl: typeof fetch = fetch): Promise<InfoCP | null> {
  const limpio = String(cp || '').replace(/\D/g, '');
  if (limpio.length !== 5) return null;
  try {
    const r = await fetchImpl(CP_API(limpio), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return extraer(await r.json());
  } catch {
    return null; // sin conexión, CORS, timeout: se sigue con captura manual
  }
}
