#!/usr/bin/env node
/**
 * Reparación: copia el nombre ACTUAL de cada tienda (`tiendas/{id}/nombreTienda`) en
 * `articulos/{id}/tiendaNombre` de sus artículos. Sirve para artículos publicados antes de que
 * la app propagara el nombre al editar el perfil de la tienda (useTiendas.actualizarTienda).
 *
 * Uso:
 *   node scripts/sincronizar-nombre-tienda.mjs            # simulación: muestra qué cambiaría
 *   node scripts/sincronizar-nombre-tienda.mjs --apply    # aplica los cambios en Firebase
 *
 * Lee VITE_FIREBASE_DATABASE_URL del archivo .env (o del entorno). Usa la API REST de
 * Realtime Database; si tus reglas exigen autenticación, define FIREBASE_AUTH_TOKEN.
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
  console.error('Falta VITE_FIREBASE_DATABASE_URL en .env');
  process.exit(1);
}
const auth = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';

async function leer(ruta) {
  const r = await fetch(`${BASE}/${ruta}.json${auth}`);
  if (!r.ok) throw new Error(`GET ${ruta}: HTTP ${r.status}`);
  return (await r.json()) || {};
}

const [tiendas, articulos] = await Promise.all([leer('tiendas'), leer('articulos')]);
const cambios = {};
for (const [id, a] of Object.entries(articulos)) {
  const nombre = tiendas[a?.tiendaId]?.nombreTienda;
  if (!nombre) continue; // tienda inexistente o sin nombre: no se toca
  if (a.tiendaNombre !== nombre) {
    cambios[`${id}/tiendaNombre`] = nombre;
    console.log(`${id}: "${a.tiendaNombre ?? ''}" -> "${nombre}"`);
  }
}

const n = Object.keys(cambios).length;
if (!n) {
  console.log('Todos los artículos ya tienen el nombre actual de su tienda.');
} else if (!APLICAR) {
  console.log(`\n${n} artículo(s) por actualizar. Ejecuta con --apply para escribir.`);
} else {
  const r = await fetch(`${BASE}/articulos.json${auth}`, { method: 'PATCH', body: JSON.stringify(cambios) });
  if (!r.ok) throw new Error(`PATCH articulos: HTTP ${r.status}`);
  console.log(`\n${n} artículo(s) actualizados.`);
}
