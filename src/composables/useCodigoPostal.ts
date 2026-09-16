/**
 * Búsqueda de colonias por código postal usando una API pública gratuita (sin token).
 *
 * Se usa en el registro y edición de tienda: al escribir un C.P. de 5 dígitos, autocompleta
 * las colonias, el municipio y el estado. Es "mejor esfuerzo": si la API no responde o el
 * navegador la bloquea, devuelve null y el formulario sigue con captura manual.
 *
 * API por defecto: SEPOMEX (Icalia Labs). Si algún día deja de funcionar, cambiar CP_API
 * y/o el parseo de `extraer()` es suficiente; el resto del código no depende de la forma.
 */
const CP_API = (cp: string) => `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;

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

/** Normaliza una respuesta cruda a { colonias, municipio, estado } */
export function extraer(data: any): InfoCP | null {
  const rows = filas(data);
  if (!rows.length) return null;
  const colonias = Array.from(
    new Set(
      rows
        .map((r) => texto(r?.d_asenta, r?.asentamiento, r?.colonia, r?.settlement, r?.name))
        .filter(Boolean),
    ),
  );
  const municipio = texto(rows[0]?.d_mnpio, rows[0]?.municipio, rows[0]?.municipality);
  const estado = texto(rows[0]?.d_estado, rows[0]?.estado, rows[0]?.state);
  if (!colonias.length && !municipio) return null;
  return { colonias, municipio, estado };
}

const COL_API = (m: string, page: number) =>
  `https://sepomex.icalialabs.com/api/v1/zip_codes?municipality=${encodeURIComponent(m)}&per_page=200&page=${page}`;

/**
 * Lista de colonias de un municipio (para el desplegable al elegir municipio).
 * Mejor esfuerzo: pide varias páginas a la API, filtra por municipio y quita duplicados.
 * Si la API falla o el municipio es enorme, devuelve lo que alcanzó (o []).
 */
export async function coloniasPorMunicipio(
  municipio: string,
  fetchImpl: typeof fetch = fetch,
  maxPaginas = 4,
): Promise<string[]> {
  const m = String(municipio || '').trim();
  if (!m) return [];
  const set = new Set<string>();
  try {
    for (let page = 1; page <= maxPaginas; page++) {
      const r = await fetchImpl(COL_API(m, page), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) break;
      const data = await r.json();
      const rows = filas(data);
      if (!rows.length) break;
      for (const row of rows) {
        const mun = texto(row?.d_mnpio, row?.municipio, row?.municipality);
        const col = texto(row?.d_asenta, row?.asentamiento, row?.colonia, row?.settlement);
        // Si la API no filtró, nos quedamos solo con las del municipio pedido
        if (col && (!mun || mun.toLowerCase() === m.toLowerCase())) set.add(col);
      }
      const totalPages = Number(data?.meta?.pagination?.total_pages);
      if ((totalPages && page >= totalPages) || rows.length < 200) break;
    }
  } catch {
    /* sin conexión / CORS / timeout: se devuelve lo que haya */
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
