/**
 * Colonias y localidades guardadas en la app, para municipios que la API no cubre.
 *
 * La API de SEPOMEX no devuelve nada para San Martín de Hidalgo —ni por nombre ni
 * por código postal—, así que quien registra su tienda ahí se queda sin lista y
 * tiene que escribir a mano. Esta tabla la suple.
 *
 * Es deliberadamente una tabla y no un caso especial: agregar otro municipio es
 * añadir una entrada aquí, sin tocar la lógica. Los municipios que no estén en la
 * tabla siguen exactamente igual que antes (API, y texto libre si falla).
 *
 * PARA EDITAR: añade o quita nombres en el arreglo del municipio. Es la única
 * fuente; no hay copias en otros archivos.
 */

/** Compara nombres de municipio sin castigar acentos, mayúsculas, "de" ni espacios */
export function claveMunicipio(nombre: unknown): string {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/\bde\b/g, '') // "San Martín de Hidalgo" == "San Martín Hidalgo"
    .replace(/[^a-z0-9]/g, ''); // espacios y signos fuera: "SanMartinHidalgo" también entra
}

/**
 * Localidades de San Martín de Hidalgo, Jalisco.
 *
 * Cabecera municipal y sus delegaciones y agencias. **Conviene que alguien de la
 * zona la revise**: se armó sin poder consultar la API (está caída) y es mejor
 * que sobre un nombre a que a una tienda le falte el suyo. Si falta alguno, el
 * formulario sigue aceptando texto libre, así que nadie se queda bloqueado.
 */
const SAN_MARTIN_DE_HIDALGO = [
  'San Martín de Hidalgo (Cabecera)',
  'El Tepehuaje de Morelos',
  'Santa Cruz de las Flores',
  'Ipazoltic',
  'Camajapita',
  'Lagunillas',
  'El Crucero',
  'Buenavista',
  'Cofradía',
  'Los Guerrero',
  'Labor de Medina',
  'El Salitre',
  'Trapiche',
  'Jesús María',
  'Santa Rita',
  'La Estancia',
  'El Tecolote',
  'Arroyo Hondo',
  'La Providencia',
  'Presa de Trigomil',
];

/** Municipios con lista propia, por clave normalizada */
const CATALOGO: Record<string, string[]> = {
  [claveMunicipio('San Martín de Hidalgo')]: SAN_MARTIN_DE_HIDALGO,
};

/** ¿Este municipio tiene lista guardada en la app? */
export function tieneColoniasLocales(municipio: unknown): boolean {
  return Boolean(CATALOGO[claveMunicipio(municipio)]);
}

/**
 * Localidades guardadas de un municipio, ordenadas. Vacío si no tiene lista
 * propia: entonces el flujo normal (API / texto libre) se encarga.
 */
export function coloniasLocales(municipio: unknown): string[] {
  const lista = CATALOGO[claveMunicipio(municipio)];
  return lista ? [...lista].sort((a, b) => a.localeCompare(b, 'es')) : [];
}
