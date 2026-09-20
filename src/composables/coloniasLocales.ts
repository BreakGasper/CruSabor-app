/**
 * Catálogo de colonias de Jalisco guardado en la app: el nombre de cada
 * asentamiento y su código postal, para los 125 municipios del estado.
 *
 * Por qué vive aquí y no se pide a una API: ya se cayeron dos (Icalia y
 * api-sepomex.hckdrk.mx), y mientras están caídas nadie puede elegir su colonia
 * ni se le llena el C.P. El padrón de SEPOMEX cambia poco, así que guardarlo
 * sale más barato que depender de un servicio gratuito.
 *
 * El dato sale de `src/data/coloniasJalisco.json`, que genera
 * `scripts/generar-colonias-jalisco.mjs` desde el padrón. PARA EDITARLO no se
 * toca el JSON a mano: se agrega el ajuste en ese script (ahí queda escrito qué
 * es oficial y qué se corrigió) y se vuelve a correr.
 *
 * El JSON son ~160 KB, así que se carga solo cuando hace falta (`import()`
 * dinámico, un chunk aparte) y se queda en memoria para las siguientes
 * consultas. De ahí que estas funciones sean asíncronas.
 */

/** Compara nombres sin castigar acentos, mayúsculas, "de" ni espacios */
export function claveMunicipio(nombre: unknown): string {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/\bde\b/g, '') // "San Martín de Hidalgo" == "San Martín Hidalgo"
    .replace(/[^a-z0-9]/g, ''); // espacios y signos fuera: "SanMartinHidalgo" también entra
}

/** Una colonia del catálogo: su nombre como lo escribe el padrón, y su C.P. */
export interface ColoniaCp {
  nombre: string;
  cp: string;
}

/** Forma del JSON generado: municipio -> pares [nombre, C.P.] */
type CatalogoCrudo = Record<string, [string, string][]>;

interface MunicipioCatalogo {
  /** Nombres únicos y ordenados, para el desplegable */
  colonias: string[];
  /** clave de colonia -> C.P. que el padrón le da (puede ser más de uno) */
  cps: Map<string, string[]>;
}

function construir(datos: CatalogoCrudo): Map<string, MunicipioCatalogo> {
  const mapa = new Map<string, MunicipioCatalogo>();
  for (const [municipio, pares] of Object.entries(datos)) {
    const colonias: string[] = [];
    const cps = new Map<string, string[]>();
    for (const [nombre, cp] of pares) {
      if (!colonias.includes(nombre)) colonias.push(nombre);
      const clave = claveMunicipio(nombre);
      const suyos = cps.get(clave) ?? [];
      if (!suyos.includes(cp)) suyos.push(cp);
      cps.set(clave, suyos);
    }
    colonias.sort((a, b) => a.localeCompare(b, 'es'));
    mapa.set(claveMunicipio(municipio), { colonias, cps });
  }
  return mapa;
}

let catalogo: Promise<Map<string, MunicipioCatalogo>> | null = null;

/** Carga el catálogo una sola vez. Si el chunk no llega, queda vacío y se reintenta después. */
function cargar(): Promise<Map<string, MunicipioCatalogo>> {
  if (!catalogo) {
    catalogo = import('@/data/coloniasJalisco.json')
      .then((m) => construir(((m as any).default ?? m) as CatalogoCrudo))
      .catch((e) => {
        console.error('No se pudo cargar el catálogo de colonias:', e);
        catalogo = null; // sin conexión al cargar el chunk: que el siguiente intento lo baje
        return new Map<string, MunicipioCatalogo>();
      });
  }
  return catalogo;
}

async function buscar(municipio: unknown): Promise<MunicipioCatalogo | undefined> {
  return (await cargar()).get(claveMunicipio(municipio));
}

/** ¿El catálogo cubre este municipio? */
export async function tieneCatalogo(municipio: unknown): Promise<boolean> {
  return Boolean(await buscar(municipio));
}

/**
 * Colonias del municipio, ordenadas y sin repetir. Vacío si no está en el
 * catálogo (otro estado): ahí sigue el flujo normal, API o texto libre.
 */
export async function coloniasDeMunicipio(municipio: unknown): Promise<string[]> {
  return (await buscar(municipio))?.colonias ?? [];
}

/**
 * C.P. de una colonia, o '' si no se puede afirmar cuál es.
 *
 * Devuelve '' en dos casos: la colonia no está en el catálogo, o el padrón le da
 * más de un C.P. (pasa en unas 75 colonias de Jalisco, casi todas de Guadalajara
 * y Zapopan, donde el mismo nombre se reparte en varios códigos). Entre escribir
 * un C.P. que puede no ser el suyo y no tocar el campo, no se toca.
 */
export async function cpDeColonia(municipio: unknown, colonia: unknown): Promise<string> {
  const cps = (await buscar(municipio))?.cps.get(claveMunicipio(colonia));
  return cps?.length === 1 ? cps[0] : '';
}
