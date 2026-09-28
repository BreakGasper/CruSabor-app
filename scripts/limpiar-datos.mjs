#!/usr/bin/env node
/**
 * Deja la base lista para arrancar en limpio: vacía clientes, tiendas, artículos
 * y todo lo que cuelga de ellos, borra sus imágenes de Cloudinary y conserva la
 * configuración de la app.
 *
 *   SE VACÍAN   usuarios, tiendas, articulos, pedidos, promociones, calificaciones,
 *               solicitudesPago, pagosMercadoPago, Lugar (tokens de avisos viejos)
 *   SE QUEDAN   admins, categorias, municipios, configuracion, banners, iconosTematica
 *
 * Imágenes: solo se borran las que usan los nodos que se vacían, y nunca una que
 * también use algo que se queda (las categorías y el banner viven en la misma
 * cuenta de Cloudinary).
 *
 * Antes de tocar nada guarda en backups/ un respaldo COMPLETO de la base y la
 * lista de imágenes (con datos personales: backups/ no va al repositorio).
 *
 * Uso:
 *   node scripts/limpiar-datos.mjs            # simula: respalda y dice qué borraría
 *   node scripts/limpiar-datos.mjs --apply    # respalda y borra
 *
 * Lee del .env: VITE_FIREBASE_DATABASE_URL y CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.
 * Si las reglas exigen auth, define FIREBASE_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function cargarEnv() {
  const ruta = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
cargarEnv();

const VACIAR = [
  'usuarios',
  'tiendas',
  'articulos',
  'pedidos',
  'promociones',
  'calificaciones',
  'solicitudesPago',
  'pagosMercadoPago',
  'Lugar',
];

const aplicar = process.argv.includes('--apply');

const base = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Falta VITE_FIREBASE_DATABASE_URL en el .env');
  process.exit(1);
}
const authQS = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';
const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;

/** Todas las URLs de Cloudinary que aparecen en un árbol de datos */
function urlsCloudinary(nodo) {
  const urls = new Set();
  const recorrer = (v) => {
    if (typeof v === 'string') {
      if (/res\.cloudinary\.com/.test(v)) urls.add(v);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(recorrer);
    }
  };
  recorrer(nodo);
  return urls;
}

/** Misma regla que src/services/imagenes/logica.ts → publicIdDesdeUrl */
function publicIdDesdeUrl(url) {
  let ruta;
  try {
    const u = new URL(String(url).trim());
    if (!/(^|\.)cloudinary\.com$/i.test(u.hostname)) return null;
    ruta = u.pathname;
  } catch {
    return null;
  }
  const i = ruta.indexOf('/upload/');
  if (i === -1) return null;
  let partes = ruta.slice(i + '/upload/'.length).split('/').filter(Boolean);
  while (partes.length > 1 && /(^|,)[a-z]{1,3}_/i.test(partes[0])) partes = partes.slice(1);
  if (partes.length > 1 && /^v\d+$/.test(partes[0])) partes = partes.slice(1);
  return partes.join('/').replace(/\.[a-z0-9]+$/i, '') || null;
}

async function borrarImagen(publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash('sha1').update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature });
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  return j.result || `error ${r.status}`;
}

// 1. Respaldo completo, siempre (también al simular)
const res = await fetch(`${base}/.json${authQS}`);
if (!res.ok) {
  console.error(`No se pudo leer la base (${res.status}). No se borró nada.`);
  process.exit(1);
}
const todo = (await res.json()) || {};

const aBorrar = new Set();
for (const n of VACIAR) urlsCloudinary(todo[n]).forEach((u) => aBorrar.add(u));
const seQuedan = new Set();
for (const n of Object.keys(todo).filter((k) => !VACIAR.includes(k))) urlsCloudinary(todo[n]).forEach((u) => seQuedan.add(u));
const idsQuedan = new Set([...seQuedan].map(publicIdDesdeUrl));
const imagenes = [...new Set([...aBorrar].map(publicIdDesdeUrl))].filter((id) => id && !idsQuedan.has(id));

fs.mkdirSync('backups', { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
const archivo = path.join('backups', `respaldo-${sello}.json`);
fs.writeFileSync(archivo, JSON.stringify({ base: todo, imagenesBorradas: imagenes }, null, 2));
console.log(`\nRespaldo completo: ${archivo}\n`);

// 2. Qué se vacía y qué se queda
for (const nodo of VACIAR) {
  const n = todo[nodo] ? Object.keys(todo[nodo]).length : 0;
  console.log(`  ${aplicar ? 'vaciando   ' : 'se vaciaría'}  ${nodo.padEnd(18)} ${n} registro(s)`);
}
console.log(`  ${aplicar ? 'borrando   ' : 'se borrarían'} ${imagenes.length} imagen(es) de Cloudinary`);
console.log(`\n  se quedan: ${Object.keys(todo).filter((k) => !VACIAR.includes(k)).join(', ')}\n`);

if (!aplicar) {
  console.log('Simulación: no se borró nada. Para borrar, agrega --apply.');
  process.exit(0);
}

// 3. Imágenes primero: si algo falla aquí, los datos siguen y se puede reintentar
if (imagenes.length && !(cloud && apiKey && apiSecret)) {
  console.error('Faltan las claves CLOUDINARY_* en el .env. No se borró nada.');
  process.exit(1);
}
const resultados = {};
for (const id of imagenes) {
  const r = await borrarImagen(id);
  resultados[r] = (resultados[r] || 0) + 1;
  if (r !== 'ok' && r !== 'not found') console.log(`    ${id}: ${r}`);
}
console.log('  Imágenes:', JSON.stringify(resultados));

// 4. Datos en una sola escritura: o se vacían todos los nodos o ninguno
const cambios = Object.fromEntries(VACIAR.map((n) => [n, null]));
const del = await fetch(`${base}/.json${authQS}`, { method: 'PATCH', body: JSON.stringify(cambios) });
if (!del.ok) {
  console.error(`Falló el vaciado de datos (${del.status}): ${await del.text()}`);
  process.exit(1);
}
console.log('\nListo: clientes, tiendas, artículos y sus imágenes, vaciados.');
