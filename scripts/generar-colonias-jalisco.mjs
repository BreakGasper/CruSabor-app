#!/usr/bin/env node
/**
 * Genera `src/data/coloniasJalisco.json`: las colonias de los 125 municipios de
 * Jalisco con su código postal, para que la app no dependa de ninguna API.
 *
 *   node scripts/generar-colonias-jalisco.mjs                 # baja el padrón y genera
 *   node scripts/generar-colonias-jalisco.mjs --csv ruta.csv  # usa un CSV ya descargado
 *
 * El padrón es el de SEPOMEX (Correos de México), publicado como CSV en
 * ORIGEN. Columnas: cp,area,tipo,ciudad,municipio,estado. Nos quedamos con
 * Jalisco, y de cada fila con el nombre del asentamiento y su C.P.
 *
 * Correr esto de nuevo solo hace falta cuando cambie el padrón (SEPOMEX lo
 * actualiza de vez en cuando) o cuando haya que agregar un ajuste. El archivo
 * generado sí se versiona: es el que carga la app.
 */
import fs from 'node:fs';
import path from 'node:path';

const ORIGEN = 'https://raw.githubusercontent.com/eacp/py-mx-postal/master/mx.csv';
const ESTADO = 'Jalisco';
const SALIDA = path.resolve('src/data/coloniasJalisco.json');

/**
 * Correcciones al padrón, revisadas contra el catálogo del municipio.
 *
 * El padrón tiene huecos y nombres sin acentos. Cada ajuste va aquí, con su
 * motivo, para que se note qué es dato oficial y qué se corrigió a mano.
 */
const AJUSTES = {
  'San Martín Hidalgo': {
    // Falta en el padrón; sí aparece en el catálogo de colonias del municipio.
    agregar: [['La Loma', '46770']],
    // El padrón la escribe sin acento.
    renombrar: { 'Rio Grande': 'Río Grande' },
  },
};

/** Divide una línea de CSV respetando las comillas */
function columnas(linea) {
  const out = [];
  let actual = '';
  let entreComillas = false;
  for (const c of linea) {
    if (c === '"') entreComillas = !entreComillas;
    else if (c === ',' && !entreComillas) {
      out.push(actual);
      actual = '';
    } else actual += c;
  }
  out.push(actual);
  return out.map((s) => s.trim());
}

async function leerCsv() {
  const i = process.argv.indexOf('--csv');
  if (i !== -1 && process.argv[i + 1]) return fs.readFileSync(process.argv[i + 1], 'utf8');
  console.log(`Descargando el padrón de ${ORIGEN} ...`);
  const r = await fetch(ORIGEN);
  if (!r.ok) throw new Error(`No se pudo descargar el padrón (HTTP ${r.status})`);
  return r.text();
}

const csv = await leerCsv();
const lineas = csv.split(/\r?\n/);
const encabezado = columnas(lineas[0]);
const col = (nombre) => encabezado.indexOf(nombre);
const iCp = col('cp');
const iNombre = col('area');
const iMunicipio = col('municipio');
const iEstado = col('estado');
if ([iCp, iNombre, iMunicipio, iEstado].some((i) => i < 0)) {
  throw new Error(`El CSV no trae las columnas esperadas: ${encabezado.join(', ')}`);
}

/** municipio -> Map<"nombre|cp", [nombre, cp]>, para no repetir pares */
const porMunicipio = new Map();
for (const linea of lineas.slice(1)) {
  if (!linea.trim()) continue;
  const c = columnas(linea);
  if (c[iEstado] !== ESTADO) continue;
  const municipio = c[iMunicipio];
  const nombre = c[iNombre];
  const cp = String(c[iCp]).padStart(5, '0');
  if (!municipio || !nombre || !/^\d{5}$/.test(cp)) continue;
  if (!porMunicipio.has(municipio)) porMunicipio.set(municipio, new Map());
  porMunicipio.get(municipio).set(`${nombre}|${cp}`, [nombre, cp]);
}

// Ajustes revisados a mano
for (const [municipio, ajuste] of Object.entries(AJUSTES)) {
  const pares = porMunicipio.get(municipio);
  if (!pares) throw new Error(`Ajuste para "${municipio}", que no está en el padrón`);
  for (const [viejo, nuevo] of Object.entries(ajuste.renombrar ?? {})) {
    for (const [clave, par] of [...pares]) {
      if (par[0] !== viejo) continue;
      pares.delete(clave);
      pares.set(`${nuevo}|${par[1]}`, [nuevo, par[1]]);
    }
  }
  for (const [nombre, cp] of ajuste.agregar ?? []) pares.set(`${nombre}|${cp}`, [nombre, cp]);
}

const catalogo = {};
for (const municipio of [...porMunicipio.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
  catalogo[municipio] = [...porMunicipio.get(municipio).values()].sort((a, b) =>
    a[0].localeCompare(b[0], 'es'),
  );
}

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(catalogo, null, 0) + '\n', 'utf8');

const total = Object.values(catalogo).reduce((n, l) => n + l.length, 0);
const kb = (fs.statSync(SALIDA).size / 1024).toFixed(0);
console.log(`✅ ${Object.keys(catalogo).length} municipios, ${total} colonias → ${SALIDA} (${kb} KB)`);
