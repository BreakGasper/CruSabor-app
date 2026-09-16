#!/usr/bin/env node
/**
 * Establece la MISMA contraseña para un cliente (usuarios/) y un administrador (admins/)
 * que comparten el mismo celular. La contraseña se guarda como hash bcrypt, que es como
 * la validan los dos logins (validatePasswordHash → bcrypt.compare).
 *
 *   usuarios/{id}.pass       (cliente, se busca por el campo `celular`)
 *   admins/{id}.password     (admin,   se busca por el campo `telefono`)
 *
 * Uso:
 *   node scripts/establecer-password.mjs --telefono 3751241114 --password 12345678           # simula
 *   node scripts/establecer-password.mjs --telefono 3751241114 --password 12345678 --apply    # escribe
 *
 * Lee VITE_FIREBASE_DATABASE_URL del .env. Si las reglas exigen auth, define FIREBASE_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

function cargarEnv() {
  const ruta = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
cargarEnv();

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const telefono = String(arg('telefono') || '').replace(/\D/g, '');
const password = arg('password') || '';
const aplicar = process.argv.includes('--apply');
const todos = process.argv.includes('--todos');

if (password.length < 6 || (!todos && telefono.length !== 10)) {
  console.error('Uso: --password <mín. 6> ( --telefono <10 dígitos> | --todos ) [--apply]');
  process.exit(1);
}

const base = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Falta VITE_FIREBASE_DATABASE_URL en el .env');
  process.exit(1);
}
const authQS = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';

const objetivos = [
  { nodo: 'usuarios', campoTel: 'celular', campoPass: 'pass' },
  { nodo: 'admins', campoTel: 'telefono', campoPass: 'password' },
];

console.log(`\nContraseña nueva: "${password}"  (se guardará como hash bcrypt)`);
console.log(todos ? 'Alcance: TODOS los registros de usuarios/ y admins/\n' : `Alcance: celular ${telefono}\n`);

let cambiados = 0;
for (const { nodo, campoTel, campoPass } of objetivos) {
  const r = await fetch(`${base}/${nodo}.json${authQS}`);
  const data = (await r.json()) || {};
  const hits = todos
    ? Object.entries(data)
    : Object.entries(data).filter(([, v]) => String(v?.[campoTel] || '').replace(/\D/g, '') === telefono);

  if (!hits.length) {
    console.log(`• ${nodo}: sin registros ${todos ? '' : `con ${campoTel}=${telefono} `}(se omite)`);
    continue;
  }
  console.log(`• ${nodo}: ${hits.length} registro(s)`);
  for (const [id, v] of hits) {
    const nombre = v.nombre || v.nombreTienda || '(sin nombre)';
    if (!aplicar) {
      if (!todos) console.log(`    - ${id} — ${nombre}: SE CAMBIARÍA ${campoPass}`);
      cambiados++;
    } else {
      const h = await bcrypt.hash(password, 10); // hash propio (salt distinto) por registro
      const put = await fetch(`${base}/${nodo}/${id}/${campoPass}.json${authQS}`, {
        method: 'PUT',
        body: JSON.stringify(h),
      });
      if (put.ok) cambiados++;
      else console.log(`    - ${id} — ${nombre}: ERROR ${put.status}`);
    }
  }
}

if (!cambiados) console.log('\nNo se encontró ningún registro.');
else if (!aplicar) console.log(`\nSimulación: se cambiarían ${cambiados} contraseña(s). Repite con --apply para escribir.`);
else console.log(`\nListo: ${cambiados} contraseña(s) actualizada(s).`);
