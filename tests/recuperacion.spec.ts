/**
 * Recuperar contraseña con el código en el SERVIDOR: lógica pura
 * (src/services/recuperacion/logica.ts) y los endpoints del router con un almacén
 * en memoria y un correo simulado. El navegador nunca conoce ni valida el código.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import {
  soloDigitos,
  generarCodigo,
  evaluarCodigo,
  validarPassword,
  ocultarCorreo,
  expiraEn,
  MAX_INTENTOS,
  type SolicitudRecuperacion,
} from '../src/services/recuperacion/logica.ts';
import { crearRouterRecuperacion } from '../src/services/recuperacion/router.ts';
import type { Almacen } from '../src/services/pagos/almacen.ts';

const AHORA = new Date('2026-09-16T18:00:00Z');

/* ---------------- lógica pura ---------------- */
describe('lógica pura', () => {
  it('generarCodigo da 4 dígitos', () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^\d{4}$/);
  });

  it('soloDigitos limpia el teléfono', () => {
    expect(soloDigitos('375-124-1114')).toBe('3751241114');
    expect(soloDigitos(null)).toBe('');
  });

  it('evaluarCodigo respeta caducidad, intentos y coincidencia', () => {
    const base: SolicitudRecuperacion = { codigoHash: 'x', userId: 'u1', email: 'a@b.mx', expiraMs: AHORA.getTime() + 60000, intentos: 0 };
    expect(evaluarCodigo(undefined, false, AHORA.getTime())).toBe('sin-solicitud');
    expect(evaluarCodigo(base, true, AHORA.getTime())).toBe('ok');
    expect(evaluarCodigo(base, false, AHORA.getTime())).toBe('incorrecto');
    expect(evaluarCodigo({ ...base, expiraMs: AHORA.getTime() - 1 }, true, AHORA.getTime())).toBe('expirado');
    expect(evaluarCodigo({ ...base, intentos: MAX_INTENTOS }, true, AHORA.getTime())).toBe('bloqueado');
  });

  it('validarPassword acepta de 6 a 10 caracteres', () => {
    expect(validarPassword('12345')).toMatch(/al menos 6/);
    expect(validarPassword('123456')).toBeNull();
    expect(validarPassword('1234567890')).toBeNull(); // el máximo justo
    expect(validarPassword('12345678901')).toMatch(/no puede pasar de 10/);
    expect(validarPassword('a'.repeat(80))).toMatch(/no puede pasar de 10/);
  });

  it('ocultarCorreo no revela el correo completo', () => {
    expect(ocultarCorreo('breakgasper@gmail.com')).toBe('b**********@gmail.com');
    expect(ocultarCorreo('sincorreo')).toBe('');
  });
});

/* ---------------- endpoints ---------------- */
function almacenEnMemoria(datos: any) {
  const tree: any = JSON.parse(JSON.stringify(datos));
  const getAt = (r: string) => r.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const setAt = (r: string, v: any) => {
    const p = r.split('/').filter(Boolean);
    let o = tree;
    for (const k of p.slice(0, -1)) o = o[k] ??= {};
    if (v === null) delete o[p[p.length - 1]];
    else o[p[p.length - 1]] = v;
  };
  const a: Almacen & { tree: any } = {
    tree,
    leer: async (r) => getAt(r) ?? null,
    actualizar: async (c) => Object.entries(c).forEach(([k, v]) => setAt(k, v)),
    nuevoId: () => 'id',
  };
  return a;
}

let servidor: ReturnType<express.Express['listen']>;
let base = '';
let almacen: ReturnType<typeof almacenEnMemoria>;
let codigos: Map<string, SolicitudRecuperacion>;
let correos: { to: string; subject: string; html: string }[];
let correoOk = true;

const CODIGO_FIJO = '4242';

function levantar() {
  const app = express();
  app.use(express.json());
  app.use(
    '/recuperar-password',
    crearRouterRecuperacion({
      almacen: async () => almacen,
      codigos,
      generarCodigo: () => CODIGO_FIJO,
      enviarCorreo: async (m) => {
        correos.push(m);
        return { success: correoOk };
      },
      ahora: () => AHORA,
      log: () => {},
    }),
  );
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}
const post = (ruta: string, body?: any) =>
  fetch(`${base}${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  almacen = almacenEnMemoria({
    usuarios: {
      u1: { nombre: 'Carlos', celular: '3751241114', email: 'breakgasper@gmail.com', pass: 'hash-viejo' },
      u2: { nombre: 'Sin correo', celular: '3339990000' },
    },
  });
  codigos = new Map();
  correos = [];
  correoOk = true;
  servidor?.close();
  levantar();
});
afterAll(() => servidor?.close());

describe('POST /recuperar-password/solicitar', () => {
  it('envía el código y lo guarda hasheado; la respuesta no lo revela', async () => {
    const r = await post('/recuperar-password/solicitar', { telefono: '375-124-1114' });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toEqual({ ok: true, email: 'b**********@gmail.com' });

    // El correo llevó el código en claro; lo guardado es un hash, no el código
    expect(correos).toHaveLength(1);
    expect(correos[0].html).toContain(CODIGO_FIJO);
    const sol = codigos.get('3751241114')!;
    expect(sol.codigoHash).not.toBe(CODIGO_FIJO);
    expect(await bcrypt.compare(CODIGO_FIJO, sol.codigoHash)).toBe(true);
    expect(JSON.stringify(d)).not.toContain(CODIGO_FIJO);
  });

  it('teléfono sin cuenta o sin correo: 404 y no manda correo', async () => {
    expect((await post('/recuperar-password/solicitar', { telefono: '3339990000' })).status).toBe(404); // sin email
    expect((await post('/recuperar-password/solicitar', { telefono: '0000000000' })).status).toBe(404); // no existe
    expect(correos).toHaveLength(0);
  });

  it('teléfono inválido: 400', async () => {
    expect((await post('/recuperar-password/solicitar', { telefono: '123' })).status).toBe(400);
  });

  it('si el correo falla, no deja la solicitud viva', async () => {
    correoOk = false;
    const r = await post('/recuperar-password/solicitar', { telefono: '3751241114' });
    expect(r.status).toBe(502);
    expect(codigos.has('3751241114')).toBe(false);
  });
});

describe('POST /recuperar-password/cambiar', () => {
  const pedir = () => post('/recuperar-password/solicitar', { telefono: '3751241114' });

  it('código correcto: cambia la contraseña (hash) y consume la solicitud', async () => {
    await pedir();
    const r = await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: CODIGO_FIJO, nuevaPassword: 'nueva123' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });

    const nuevo = almacen.tree.usuarios.u1.pass;
    expect(nuevo).not.toBe('hash-viejo');
    expect(await bcrypt.compare('nueva123', nuevo)).toBe(true);
    expect(codigos.has('3751241114')).toBe(false); // un solo uso
  });

  it('código incorrecto: no cambia nada y cuenta el intento', async () => {
    await pedir();
    const r = await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: '0000', nuevaPassword: 'nueva123' });
    expect(r.status).toBe(400);
    expect(almacen.tree.usuarios.u1.pass).toBe('hash-viejo');
    expect(codigos.get('3751241114')!.intentos).toBe(1);
  });

  it('se bloquea tras demasiados intentos', async () => {
    await pedir();
    for (let i = 0; i < MAX_INTENTOS; i++) {
      await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: '0000', nuevaPassword: 'nueva123' });
    }
    // El intento MAX+1, aun con el código correcto, se rechaza como bloqueado
    const r = await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: CODIGO_FIJO, nuevaPassword: 'nueva123' });
    expect(r.status).toBe(429);
    expect(almacen.tree.usuarios.u1.pass).toBe('hash-viejo');
  });

  it('sin solicitud previa: 400', async () => {
    const r = await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: CODIGO_FIJO, nuevaPassword: 'nueva123' });
    expect(r.status).toBe(400);
  });

  it('contraseña muy corta: 400 aunque el código sea correcto', async () => {
    await pedir();
    const r = await post('/recuperar-password/cambiar', { telefono: '3751241114', codigo: CODIGO_FIJO, nuevaPassword: '123' });
    expect(r.status).toBe(400);
    expect(almacen.tree.usuarios.u1.pass).toBe('hash-viejo');
  });
});

/**
 * El tope de la contraseña tiene que ser el mismo en toda la app.
 *
 * Si el registro admite 10 pero cambiar la contraseña solo 8, alguien se queda
 * sin poder volver a poner la suya. Y los formularios de acceso NO llevan tope:
 * quien ya tenga una más larga debe poder seguir entrando.
 */
describe('Límites de contraseña, parejos en toda la app', () => {
  it('el servidor y la app usan los mismos topes', async () => {
    const app = await import('../src/composables/usePassword');
    const servidor = await import('../src/services/recuperacion/logica.ts');
    expect(app.PASSWORD_MIN).toBe(servidor.PASSWORD_MIN);
    expect(app.PASSWORD_MAX).toBe(servidor.PASSWORD_MAX);
    expect(app.PASSWORD_MAX).toBe(10);
  });

  it('errorLongitudPassword acepta de 6 a 10', async () => {
    const { errorLongitudPassword } = await import('../src/composables/usePassword');
    expect(errorLongitudPassword('12345')).toMatch(/al menos 6/);
    expect(errorLongitudPassword('123456')).toBeNull();
    expect(errorLongitudPassword('1234567890')).toBeNull();
    expect(errorLongitudPassword('12345678901')).toMatch(/no puede pasar de 10/);
  });

  it('ninguna pantalla de ACCESO recorta la contraseña', async () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const logins = [
      'src/modules/home/components/Login.vue',
      'src/modules/store/views/StoreLogin.vue',
      'src/modules/admin/views/AdminLogin.vue',
    ];
    for (const ruta of logins) {
      const sfc = fs.readFileSync(ruta, 'utf8');
      // se aísla el input de contraseña y se comprueba que no traiga maxlength
      const i = sfc.indexOf("'text' : 'password'");
      expect(i, `${ruta}: no se encontró el campo de contraseña`).toBeGreaterThan(-1);
      const campo = sfc.slice(sfc.lastIndexOf('<input', i), sfc.indexOf('/>', i));
      expect(campo, `${ruta} recorta la contraseña al entrar`).not.toMatch(/maxlength/);
    }
  });
});
