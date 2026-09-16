#!/usr/bin/env node
/**
 * Diagnóstico del correo (SMTP de Gmail). Lee SMTP_USER/SMTP_PASS del .env,
 * prueba la conexión y la autenticación, e imprime el error EXACTO si falla.
 *
 *   node scripts/probar-correo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

// Cargar .env (mismo criterio que el servidor)
const ruta = path.resolve(process.cwd(), '.env');
if (fs.existsSync(ruta)) {
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
console.log('SMTP_USER:', JSON.stringify(user));
console.log('SMTP_PASS largo:', pass.length, '(la de aplicación de Gmail son 16)');

// Si pasas un teléfono (node scripts/probar-correo.mjs 3751241114) busca a ese
// usuario en la base y le envía, igual que el endpoint /recuperar-password/solicitar.
const telArg = String(process.argv[2] || '').replace(/\D/g, '');
let destino = user; // por defecto, a sí mismo
if (telArg) {
  const base = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
  console.log(`\nBuscando en la base al usuario con celular ${telArg}...`);
  const r = await fetch(`${base}/usuarios.json`);
  const usuarios = (await r.json()) || {};
  const hit = Object.values(usuarios).find((u) => String(u?.celular || '').replace(/\D/g, '') === telArg);
  if (!hit) {
    console.log('   ❌ No existe un usuario con ese celular.');
    process.exit(1);
  }
  console.log('   nombre:', hit.nombre || '(sin nombre)');
  console.log('   email en la base:', JSON.stringify(hit.email));
  if (!hit.email) {
    console.log('   ❌ Ese usuario NO tiene email registrado: por eso no se puede enviar el código.');
    process.exit(1);
  }
  destino = hit.email;
}
console.log('Se enviará a:', JSON.stringify(destino));
console.log('');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass },
});

try {
  console.log('1) Probando conexión + autenticación con Gmail...');
  await transporter.verify();
  console.log('   ✅ Gmail aceptó las credenciales.');

  console.log('2) Enviando un correo de prueba a ' + destino + '...');
  const info = await transporter.sendMail({
    from: `"CRUSTORE" <${user}>`,
    to: destino,
    subject: 'Prueba de correo - CruStore',
    html: '<p>Si ves esto, el correo funciona ✅</p>',
  });
  console.log('   ✅ Enviado. messageId:', info.messageId);
  console.log('\nTODO BIEN. Revisa la bandeja de ' + destino + ' (y spam).');
} catch (e) {
  console.log('\n❌ FALLÓ. Detalle del error:');
  console.log('   code:', e?.code);
  console.log('   command:', e?.command);
  console.log('   response:', e?.response);
  console.log('   message:', e?.message);
  console.log('\nPista rápida:');
  if (e?.code === 'EAUTH' || /5\.7\.8|Username and Password not accepted/i.test(e?.response || '')) {
    console.log('   → Credenciales rechazadas: la contraseña de aplicación no corresponde a', user + ',');
    console.log('     o la verificación en dos pasos no está activa en esa cuenta. Genera una nueva.');
  } else if (/ETIMEDOUT|ESOCKET|ECONNECTION|ECONNREFUSED/.test(e?.code || '')) {
    console.log('   → Tu red bloquea la salida a Gmail (puerto 465). En local no saldrá,');
    console.log('     pero desde Render sí. Habría que probar en Render, no en tu compu.');
  } else {
    console.log('   → Error distinto; pega estas líneas para revisarlo.');
  }
}
