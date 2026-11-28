#!/usr/bin/env node
/**
 * Limpieza única: el registro de tiendas guardaba por error el campo `confirmPassword` (la contraseña que la
 * persona escribió al confirmar, EN TEXTO PLANO) dentro de `tiendas/{id}`. Ya no se guarda (useTiendas.crearTienda),
 * pero las tiendas registradas antes todavía lo tienen. Este script lo borra.
 *
 * No imprime ninguna contraseña: solo el id y el nombre de cada tienda afectada.
 *
 * Uso:
 *   node scripts/quitar-confirmpassword.mjs            # simulación: dice a cuántas tiendas les quitaría el campo
 *   node scripts/quitar-confirmpassword.mjs --apply    # lo borra en Firebase
 *
 * Lee VITE_FIREBASE_DATABASE_URL del archivo .env (o del entorno). Usa la API REST de Realtime Database;
 * si tus reglas exigen autenticación, define FIREBASE_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';

const APLICAR = process.argv.includes('--apply');
// Campos del formulario que nunca debieron guardarse
const CAMPOS = ['confirmPassword'];

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

const r = await fetch(`${BASE}/tiendas.json${AUTH}`);
if (!r.ok) throw new Error(`GET tiendas: ${r.status} ${await r.text()}`);
const tiendas = (await r.json()) || {};

const cambios = {};
let afectadas = 0;
for (const [id, t] of Object.entries(tiendas)) {
  const sobran = CAMPOS.filter((c) => t && Object.prototype.hasOwnProperty.call(t, c));
  if (!sobran.length) continue;
  afectadas++;
  for (const c of sobran) cambios[`tiendas/${id}/${c}`] = null;
  console.log(`${APLICAR ? 'LIMPIA' : 'limpiaría'}  ${id}  "${t?.nombreTienda ?? 'sin nombre'}"  (${sobran.join(', ')})`);
}

console.log(`\nTiendas totales: ${Object.keys(tiendas).length}   con campos de más: ${afectadas}`);
if (!afectadas) {
  console.log('Nada que limpiar.');
} else if (!APLICAR) {
  console.log('Simulación. Ejecuta con --apply para borrarlos.');
} else {
  const p = await fetch(`${BASE}/.json${AUTH}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) });
  if (!p.ok) throw new Error(`PATCH: ${p.status} ${await p.text()}`);
  console.log(`Listo: ${afectadas} tiendas limpias.`);
}
