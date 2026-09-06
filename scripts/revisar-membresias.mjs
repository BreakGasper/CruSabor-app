#!/usr/bin/env node
/**
 * Corre a mano la revisión diaria de membresías (la misma lógica que la función
 * programada `revisarMembresias`), usando la API REST de Realtime Database.
 *
 * Uso:
 *   node scripts/revisar-membresias.mjs            # simulación: muestra bloqueos y recordatorios, no escribe
 *   node scripts/revisar-membresias.mjs --apply    # aplica bloqueos y marca los recordatorios
 *   node scripts/revisar-membresias.mjs --fecha 2026-10-07   # simula "hoy" en otra fecha
 *
 * No envía correos (eso lo hace la función en Firebase con los secretos SMTP).
 * Lee VITE_FIREBASE_DATABASE_URL del .env; si tus reglas exigen auth, define FIREBASE_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ejecutarRevision } from '../functions/src/vencimientos.js';

const APLICAR = process.argv.includes('--apply');
const iFecha = process.argv.indexOf('--fecha');
const fechaArg = iFecha >= 0 ? process.argv[iFecha + 1] : undefined;

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

let contador = 0;
const almacen = {
  async leer(ruta) {
    const r = await fetch(`${BASE}/${ruta}.json${AUTH}`);
    if (!r.ok) throw new Error(`GET ${ruta}: ${r.status} ${await r.text()}`);
    return await r.json();
  },
  async actualizar(cambios) {
    const r = await fetch(`${BASE}/.json${AUTH}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    if (!r.ok) throw new Error(`PATCH: ${r.status} ${await r.text()}`);
  },
  // Id único al estilo push: fecha + contador (la REST API no genera keys en PATCH)
  nuevoId: () => `${Date.now().toString(36)}-${(++contador).toString(36)}`,
};

let ahora = new Date();
if (fechaArg) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaArg)) {
    console.error('--fecha debe ser YYYY-MM-DD');
    process.exit(1);
  }
  const [y, m, d] = fechaArg.split('-').map(Number);
  ahora = new Date(y, m - 1, d, 12);
}

const { resumen } = await ejecutarRevision(almacen, { ahora, aplicar: APLICAR, log: (m) => console.log(m) });

console.log('\nResumen');
console.log(`  Fecha revisada:      ${resumen.hoy}`);
console.log(`  Días de gracia:      ${resumen.diasGracia}`);
console.log(`  Tiendas con vigencia:${String(resumen.revisadas).padStart(3)}`);
console.log(`  Bloqueos:            ${resumen.bloqueadas}`);
console.log(`  Recordatorios:       ${resumen.recordatorios}`);
if (!APLICAR) console.log('\nSimulación. Ejecuta con --apply para escribir los cambios.');
else console.log('\nListo: cambios aplicados en Firebase.');
