#!/usr/bin/env node
/**
 * Migración única: marca como `estatus: "activa"` las tiendas registradas antes de la
 * regla de autorización/membresía (las que no tienen el campo `estatus`), para que
 * sigan vendiendo igual que hasta ahora. (`estado` es el estado geográfico; no se toca.)
 *
 * La app ya trata "sin estatus" como activa, así que este script solo deja el dato
 * explícito para que el panel de administración lo muestre bien.
 *
 * Uso:
 *   node scripts/migrar-estado-tiendas.mjs            # simulación: muestra qué cambiaría, no escribe
 *   node scripts/migrar-estado-tiendas.mjs --apply    # aplica los cambios en Firebase
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
  console.error('Falta VITE_FIREBASE_DATABASE_URL (en .env o en el entorno).');
  process.exit(1);
}
const AUTH = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';

async function leer(nodo) {
  const r = await fetch(`${BASE}/${nodo}.json${AUTH}`);
  if (!r.ok) throw new Error(`GET ${nodo}: ${r.status} ${await r.text()}`);
  return (await r.json()) || {};
}

async function actualizar(cambios) {
  const r = await fetch(`${BASE}/.json${AUTH}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  });
  if (!r.ok) throw new Error(`PATCH: ${r.status} ${await r.text()}`);
}

const tiendas = await leer('tiendas');
const ahora = new Date().toISOString();
const cambios = {};
const porEstado = { activa: 0, pendiente: 0, bloqueada: 0 };

for (const [id, t] of Object.entries(tiendas)) {
  if (t?.estatus) {
    porEstado[t.estatus] = (porEstado[t.estatus] || 0) + 1;
    continue;
  }
  cambios[`tiendas/${id}/estatus`] = 'activa';
  cambios[`tiendas/${id}/aprobadaEn`] = ahora;
  cambios[`tiendas/${id}/aprobadaPor`] = 'migracion';
  console.log(`${APLICAR ? 'ACTUALIZA' : 'cambiaría'}  ${id}  "${t?.nombreTienda ?? 'sin nombre'}"  → estatus=activa`);
}

const porActualizar = Object.keys(cambios).length / 3;
console.log('\nResumen');
console.log(`  Tiendas totales:        ${Object.keys(tiendas).length}`);
console.log(`  Ya tenían estatus:      activa=${porEstado.activa}  pendiente=${porEstado.pendiente}  bloqueada=${porEstado.bloqueada}`);
console.log(`  Por marcar como activa: ${porActualizar}`);

if (!porActualizar) {
  console.log('\nNada que migrar.');
} else if (!APLICAR) {
  console.log('\nSimulación. Ejecuta con --apply para escribir los cambios.');
} else {
  await actualizar(cambios);
  console.log(`\nListo: ${porActualizar} tiendas marcadas como activas.`);
}
