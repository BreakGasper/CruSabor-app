#!/usr/bin/env node
/**
 * Crea un administrador del sistema en `admins/` de Realtime Database.
 * La contraseña se guarda como hash bcrypt, igual que clientes y tiendas.
 *
 * Uso:
 *   node scripts/crear-admin.mjs --telefono 3312345678 --nombre "Nombre Apellido" --password "MiClave123"
 *   node scripts/crear-admin.mjs --telefono 3312345678 --nombre "Nombre" --password "..." --rol superadmin
 *
 * Lee VITE_FIREBASE_DATABASE_URL del archivo .env (o del entorno). Usa la API REST de
 * Realtime Database; si tus reglas exigen autenticación, define FIREBASE_AUTH_TOKEN.
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

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const telefono = String(arg('telefono') || '').replace(/\D/g, '');
const nombre = (arg('nombre') || '').trim();
const password = arg('password') || '';
const rol = arg('rol') || 'admin';

const errores = [];
if (telefono.length !== 10) errores.push('--telefono debe tener 10 dígitos');
if (!nombre) errores.push('--nombre es obligatorio');
if (password.length < 6) errores.push('--password debe tener al menos 6 caracteres');
if (!['admin', 'superadmin'].includes(rol)) errores.push('--rol debe ser admin o superadmin');
if (errores.length) {
  console.error(errores.join('\n'));
  console.error('\nEjemplo: node scripts/crear-admin.mjs --telefono 3312345678 --nombre "Ana López" --password "MiClave123"');
  process.exit(1);
}

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

const admins = await leer('admins');
const repetido = Object.values(admins).find((a) => a?.telefono === telefono);
if (repetido) {
  console.error(`Ya existe un administrador con el celular ${telefono} (${repetido.nombre}).`);
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const r = await fetch(`${BASE}/admins.json${AUTH}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre,
    telefono,
    password: hash,
    rol,
    activo: true,
    creadoEn: new Date().toISOString(),
  }),
});
if (!r.ok) throw new Error(`POST admins: ${r.status} ${await r.text()}`);
const { name: id } = await r.json();

console.log(`Administrador creado: ${nombre} (${telefono}) rol=${rol} id=${id}`);
console.log('Ya puede entrar en /admin/login con su celular y contraseña.');
