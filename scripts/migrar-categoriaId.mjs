#!/usr/bin/env node
/**
 * Migración única: asigna `categoriaId` a los artículos que solo tienen el nombre en `categoria`.
 *
 * Uso:
 *   node scripts/migrar-categoriaId.mjs            # simulación: muestra qué cambiaría, no escribe
 *   node scripts/migrar-categoriaId.mjs --apply    # aplica los cambios en Firebase
 *
 * Lee VITE_FIREBASE_DATABASE_URL del archivo .env (o del entorno). Usa la API REST de
 * Realtime Database; si tus reglas exigen autenticación, agrega `?auth=<token>` con
 * FIREBASE_AUTH_TOKEN en el entorno.
 */
import fs from 'node:fs';
import path from 'node:path';

const APLICAR = process.argv.includes('--apply');

function cargarEnv() {
  const ruta = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
cargarEnv();

const BASE = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
if (!BASE) {
  console.error('Falta VITE_FIREBASE_DATABASE_URL (en .env o en el entorno).');
  process.exit(1);
}
const AUTH = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';

const normalizar = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function leer(nodo) {
  const r = await fetch(`${BASE}/${nodo}.json${AUTH}`);
  if (!r.ok) throw new Error(`GET ${nodo}: ${r.status} ${await r.text()}`);
  return (await r.json()) || {};
}

async function actualizar(cambios) {
  // Una sola escritura multi-ruta: { "articulos/<id>/categoriaId": "<catId>", ... }
  const r = await fetch(`${BASE}/.json${AUTH}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  });
  if (!r.ok) throw new Error(`PATCH: ${r.status} ${await r.text()}`);
}

const [categorias, articulos] = await Promise.all([leer('categorias'), leer('articulas'.replace('as', 'os'))]);

// nombre normalizado -> id de categoría
const porNombre = new Map();
for (const [id, c] of Object.entries(categorias)) porNombre.set(normalizar(c?.nombre), id);

const cambios = {};
const sinCategoria = [];
const sinCoincidencia = [];
let yaTenian = 0;

for (const [id, a] of Object.entries(articulos)) {
  if (a?.categoriaId && categorias[a.categoriaId]) { yaTenian++; continue; }
  if (!a?.categoria) { sinCategoria.push(`${id} (${a?.nombre ?? 'sin nombre'})`); continue; }
  const catId = porNombre.get(normalizar(a.categoria));
  if (!catId) { sinCoincidencia.push(`${id} (${a.nombre}) → "${a.categoria}"`); continue; }
  cambios[`articulos/${id}/categoriaId`] = catId;
  console.log(`${APLICAR ? 'ACTUALIZA' : 'cambiaría'}  ${id}  "${a.nombre}"  categoria="${a.categoria}"  → categoriaId=${catId}`);
}

console.log('\nResumen');
console.log(`  Artículos totales:           ${Object.keys(articulos).length}`);
console.log(`  Ya tenían categoriaId:       ${yaTenian}`);
console.log(`  Por actualizar:              ${Object.keys(cambios).length}`);
console.log(`  Sin campo categoria:         ${sinCategoria.length}`);
console.log(`  Categoría sin coincidencia:  ${sinCoincidencia.length}`);
if (sinCategoria.length) console.log('    ' + sinCategoria.join('\n    '));
if (sinCoincidencia.length) console.log('    ' + sinCoincidencia.join('\n    '));

if (!Object.keys(cambios).length) {
  console.log('\nNada que migrar.');
} else if (!APLICAR) {
  console.log('\nSimulación. Ejecuta con --apply para escribir los cambios.');
} else {
  await actualizar(cambios);
  console.log(`\nListo: ${Object.keys(cambios).length} artículos actualizados.`);
}
