#!/usr/bin/env node
/**
 * Carga los 125 municipios de Jalisco en el nodo `municipios` de Realtime Database,
 * con la misma forma que usa la app: { id, municipio, estado, pueblos:[] }.
 *
 * Es idempotente: NO duplica los que ya existen (compara por nombre), así que los
 * municipios que ya tengan colonias cargadas se conservan intactos; solo agrega los
 * que faltan (con pueblos vacíos, para llenarlos después).
 *
 *   node scripts/cargar-municipios-jalisco.mjs           # simula (no escribe)
 *   node scripts/cargar-municipios-jalisco.mjs --apply    # escribe en la base
 *
 * Lee VITE_FIREBASE_DATABASE_URL del .env. Si las reglas exigen auth, FIREBASE_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';

function cargarEnv() {
  const ruta = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
cargarEnv();

const ESTADO = 'Jalisco';
const MUNICIPIOS = [
  'Acatic', 'Acatlán de Juárez', 'Ahualulco de Mercado', 'Amacueca', 'Amatitán', 'Ameca',
  'Arandas', 'El Arenal', 'Atemajac de Brizuela', 'Atengo', 'Atenguillo', 'Atotonilco el Alto',
  'Atoyac', 'Autlán de Navarro', 'Ayotlán', 'Ayutla', 'La Barca', 'Bolaños', 'Cabo Corrientes',
  'Casimiro Castillo', 'Cihuatlán', 'Zapotlán el Grande', 'Cocula', 'Colotlán',
  'Concepción de Buenos Aires', 'Cuautitlán de García Barragán', 'Cuautla', 'Cuquío', 'Chapala',
  'Chimaltitán', 'Chiquilistlán', 'Degollado', 'Ejutla', 'Encarnación de Díaz', 'Etzatlán',
  'El Grullo', 'Guachinango', 'Guadalajara', 'Hostotipaquillo', 'Huejúcar', 'Huejuquilla el Alto',
  'La Huerta', 'Ixtlahuacán de los Membrillos', 'Ixtlahuacán del Río', 'Jalostotitlán', 'Jamay',
  'Jesús María', 'Jilotlán de los Dolores', 'Jocotepec', 'Juanacatlán', 'Juchitlán',
  'Lagos de Moreno', 'El Limón', 'Magdalena', 'Santa María del Oro', 'La Manzanilla de la Paz',
  'Mascota', 'Mazamitla', 'Mexticacán', 'Mezquitic', 'Mixtlán', 'Ocotlán', 'Ojuelos de Jalisco',
  'Pihuamo', 'Poncitlán', 'Puerto Vallarta', 'Villa Purificación', 'Quitupan', 'El Salto',
  'San Cristóbal de la Barranca', 'San Diego de Alejandría', 'San Juan de los Lagos',
  'San Juanito de Escobedo', 'San Julián',
  'San Marcos', 'San Martín de Bolaños', 'San Martín Hidalgo', 'San Miguel el Alto', 'Gómez Farías',
  'San Sebastián del Oeste', 'Santa María de los Ángeles', 'Sayula', 'Tala', 'Talpa de Allende',
  'Tamazula de Gordiano', 'Tapalpa', 'Tecalitlán', 'Tecolotlán', 'Techaluta de Montenegro',
  'Tenamaxtlán', 'Teocaltiche', 'Teocuitatlán de Corona', 'Tepatitlán de Morelos', 'Tequila',
  'Teuchitlán', 'Tizapán el Alto', 'Tlajomulco de Zúñiga', 'San Pedro Tlaquepaque', 'Tolimán',
  'Tomatlán', 'Tonalá', 'Tonaya', 'Tonila', 'Totatiche', 'Tototlán', 'Tuxcacuesco', 'Tuxcueca',
  'Tuxpan', 'Unión de San Antonio', 'Unión de Tula', 'Valle de Guadalupe', 'Valle de Juárez',
  'San Gabriel', 'Villa Corona', 'Villa Guerrero', 'Villa Hidalgo', 'Cañadas de Obregón',
  'Yahualica de González Gallo', 'Zacoalco de Torres', 'Zapopan', 'Zapotiltic',
  'Zapotitlán de Vadillo', 'Zapotlán del Rey', 'Zapotlanejo', 'San Ignacio Cerro Gordo',
];

const aplicar = process.argv.includes('--apply');
const base = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Falta VITE_FIREBASE_DATABASE_URL en el .env');
  process.exit(1);
}
const authQS = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';
const norm = (s) => String(s || '').trim().toLowerCase();

console.log(`\nMunicipios de ${ESTADO} en la lista: ${MUNICIPIOS.length}`);

const r = await fetch(`${base}/municipios.json${authQS}`);
const data = (await r.json()) || {};
const existentes = new Set(Object.values(data).map((m) => norm(m?.municipio)));
console.log(`Ya en la base: ${existentes.size}`);

const faltan = MUNICIPIOS.filter((m) => !existentes.has(norm(m)));
console.log(`Se agregarían: ${faltan.length}\n`);
if (!faltan.length) {
  console.log('Nada que hacer: todos los municipios ya están.');
  process.exit(0);
}

if (!aplicar) {
  faltan.forEach((m) => console.log('  + ' + m));
  console.log('\nSimulación. Repite con --apply para escribir en la base.');
  process.exit(0);
}

let ok = 0;
for (const municipio of faltan) {
  // POST crea un nodo con push-id, igual que insertarPueblosPorMunicipio
  const res = await fetch(`${base}/municipios.json${authQS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ municipio, estado: ESTADO, pueblos: [] }),
  });
  if (res.ok) {
    // Guardar el id dentro del propio nodo (la app lee m.id)
    const { name: id } = await res.json();
    await fetch(`${base}/municipios/${id}/id.json${authQS}`, { method: 'PUT', body: JSON.stringify(id) });
    ok++;
  } else {
    console.log(`  ✗ ${municipio}: ${res.status}`);
  }
}
console.log(`\nListo: ${ok} municipio(s) agregado(s).`);
