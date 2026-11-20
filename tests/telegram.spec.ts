/**
 * Canal de Telegram: traducción de avisos, envío (Bot API simulada), login por contacto compartido,
 * borrado de la contraseña, bloqueo por tienda y webhook. Telegram, Gemini, la base y Cloudinary van simulados.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import bcrypt from 'bcryptjs';
import type { AddressInfo } from 'node:net';
import { aHtml, secretoValido, actualizacion, crearCanalTelegram } from '../src/services/telegram/canal.ts';
import { crearRouterTelegram, faltantesTelegram } from '../src/services/telegram/router.ts';
import { crearAgente } from '../src/services/asistente/agente.ts';

const priv = (extra: any) => ({ update_id: 1, message: { message_id: 10, from: { id: 777, is_bot: false }, chat: { id: 777, type: 'private' }, ...extra } });

describe('traducción de avisos de Telegram', () => {
  it('texto, foto con pie, /start y botones', () => {
    expect(actualizacion(priv({ text: 'hola' }))?.mensaje).toMatchObject({ tipo: 'texto', texto: 'hola', de: '777', idMensaje: '10' });
    expect(actualizacion(priv({ text: '/start' }))?.mensaje?.texto).toBe('ayuda');
    const foto = actualizacion(priv({ caption: 'Pastel $350', photo: [{ file_id: 'chica' }, { file_id: 'grande' }] }))?.mensaje;
    expect(foto).toMatchObject({ tipo: 'imagen', texto: 'Pastel $350', mediaId: 'grande' });
    const cb = actualizacion({ update_id: 2, callback_query: { id: 'cb1', from: { id: 777 }, data: 'guardar', message: { chat: { id: 777, type: 'private' } } } });
    expect(cb?.callbackId).toBe('cb1');
    expect(cb?.mensaje).toMatchObject({ tipo: 'boton', texto: 'guardar', de: '777' });
  });
  it('ignora grupos y bots (ahí otros verían la contraseña)', () => {
    expect(actualizacion({ update_id: 3, message: { message_id: 1, from: { id: 1 }, chat: { id: -5, type: 'group' }, text: 'hola' } })?.mensaje).toBeNull();
    expect(actualizacion(priv({ from: { id: 9, is_bot: true }, text: 'hola' }))?.mensaje).toBeNull();
  });
  it('solo vale el contacto PROPIO, no uno reenviado de otra persona', () => {
    const propio = actualizacion(priv({ contact: { phone_number: '+52 81 1111 1111', user_id: 777 } }))?.mensaje;
    expect(propio).toMatchObject({ tipo: 'contacto', telefono: '+52 81 1111 1111' });
    const ajeno = actualizacion(priv({ contact: { phone_number: '+52 81 9999 9999', user_id: 555 } }))?.mensaje;
    expect(ajeno?.tipo).toBe('otro');
    const sinId = actualizacion(priv({ contact: { phone_number: '+52 81 9999 9999' } }))?.mensaje;
    expect(sinId?.tipo).toBe('otro');
  });
  it('escapa HTML y convierte *negritas*', () => {
    expect(aHtml('*Hola* <b>x</b> & más')).toBe('<b>Hola</b> &lt;b&gt;x&lt;/b&gt; &amp; más');
  });
  it('compara el secreto sin aceptar vacíos ni distintos', () => {
    expect(secretoValido('abc', 'abc')).toBe(true);
    expect(secretoValido('abd', 'abc')).toBe(false);
    expect(secretoValido(undefined, 'abc')).toBe(false);
    expect(secretoValido('', '')).toBe(false);
  });
});

describe('envío por la Bot API', () => {
  function fake(respuesta: (m: string, b: any) => any = () => ({ ok: true, result: {} })) {
    const llamadas: { url: string; body: any }[] = [];
    const fetchFn = (async (url: string, init: any) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      llamadas.push({ url, body });
      if (url.includes('/file/bot')) return new Response(Buffer.from('bytes'), { status: 200 });
      const r = respuesta(url.split('/').pop()!, body);
      return new Response(JSON.stringify(r), { status: r.ok === false ? 400 : 200 });
    }) as any;
    return { llamadas, canal: crearCanalTelegram({ token: '123:SECRETO', fetchFn }) };
  }
  it('manda texto en HTML, botones, pide el celular y borra mensajes', async () => {
    const { canal, llamadas } = fake();
    await canal.enviarTexto('777', '*Listo* <ok>');
    await canal.enviarBotones('777', 'Resumen', [{ id: 'guardar', titulo: 'Publicar' }]);
    await canal.pideTelefono!('777', 'Comparte');
    await canal.borrarMensaje!('777', '10');
    expect(llamadas[0].body).toMatchObject({ chat_id: '777', text: '<b>Listo</b> &lt;ok&gt;', parse_mode: 'HTML' });
    expect(llamadas[1].body.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Publicar', callback_data: 'guardar' });
    expect(llamadas[2].body.reply_markup.keyboard[0][0].request_contact).toBe(true);
    expect(llamadas[3]).toMatchObject({ url: expect.stringContaining('/deleteMessage'), body: { chat_id: '777', message_id: 10 } });
  });
  it('descarga la foto con getFile y deduce el tipo por la extensión', async () => {
    const { canal } = fake((m) => (m === 'getFile' ? { ok: true, result: { file_path: 'photos/a.png' } } : { ok: true }));
    const img = await canal.descargarImagen('f1');
    expect(img.mime).toBe('image/png');
    expect(img.bytes.toString()).toBe('bytes');
  });
  it('un error de Telegram nunca filtra el token', async () => {
    const { canal } = fake(() => ({ ok: false, description: 'Bad Request: chat not found' }));
    await expect(canal.enviarTexto('1', 'x')).rejects.toThrow(/chat not found/);
    await canal.enviarTexto('1', 'x').catch((e) => expect(String(e.message)).not.toContain('SECRETO'));
  });
});

/* ---------------- login por contacto + contraseña ---------------- */
function montar() {
  const bd: Record<string, any> = {
    tiendas: { t1: { nombreTienda: 'Dulce', telefono: '8111111111', password: bcrypt.hashSync('secreto1', 4), estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } } },
    categorias: { c1: { id: 'c1', nombre: 'Postres' } },
    articulos: {},
  };
  const dichos: string[] = [];
  const borrados: string[] = [];
  const pidioTelefono: string[] = [];
  let reloj = new Date('2026-11-20T12:00:00').getTime();
  const agente = crearAgente({
    canal: {
      enviarTexto: async (_a, t) => { dichos.push(t); },
      enviarBotones: async (_a, t) => { dichos.push(t); },
      descargarImagen: async () => ({ mime: 'image/jpeg', bytes: Buffer.from('f') }),
      pideTelefono: async (_a, t) => { pidioTelefono.push(t); },
      borrarMensaje: async (_a, id) => { borrados.push(id); },
    },
    cerebro: { extraerArticulo: async () => ({ nombre: 'Pastel', precio: 350, categoriaId: 'c1' }), responderCliente: async () => 'ok' },
    almacen: async () => ({
      leer: async (r: string) => r.split('/').reduce((o: any, k) => o?.[k], bd) ?? null,
      actualizar: async (c: Record<string, any>) => { for (const [r, v] of Object.entries(c)) { const [n, id] = r.split('/'); (bd[n] ??= {})[id] = v; } },
      nuevoId: () => 'art1',
    }),
    subirImagen: async () => 'https://img/f.jpg',
    urlApp: 'https://app.test',
    ahora: () => new Date(reloj),
    log: () => {},
  });
  let n = 0;
  const di = (de: string, m: any) => agente.procesar({ id: 'm' + n++, de, tipo: 'texto', texto: '', ...m });
  return { bd, dichos, borrados, pidioTelefono, di, avanzar: (min: number) => { reloj += min * 60_000; } };
}
const ultimo = (a: string[]) => a[a.length - 1];

describe('login en Telegram', () => {
  it('pide compartir el celular, pide la contraseña, la borra y deja publicar', async () => {
    const c = montar();
    await c.di('777', { texto: 'entrar' });
    expect(c.pidioTelefono).toHaveLength(1);
    await c.di('777', { tipo: 'contacto', telefono: '+52 1 81 1111 1111', idMensaje: '5' });
    expect(ultimo(c.dichos)).toMatch(/contraseña de tu tienda[\s\S]*Borraré tu mensaje/);
    await c.di('777', { texto: 'secreto1', idMensaje: '6' });
    expect(c.borrados).toEqual(['6']); // la contraseña se borra del chat
    expect(ultimo(c.dichos)).toMatch(/entraste a \*Dulce\*/);
    await c.di('777', { tipo: 'imagen', mediaId: 'f', texto: 'Pastel $350' });
    await c.di('777', { tipo: 'boton', texto: 'guardar' });
    expect(c.bd.articulos.art1).toMatchObject({ nombre: 'Pastel', tiendaId: 't1' });
  });
  it('sin compartir el contacto no avanza, y un celular sin tienda se rechaza', async () => {
    const c = montar();
    await c.di('777', { texto: 'entrar' });
    await c.di('777', { texto: '8111111111' }); // teclear el número NO sirve: debe venir del contacto
    expect(ultimo(c.dichos)).toMatch(/Compartir mi número/);
    await c.di('777', { tipo: 'contacto', telefono: '8100000000' });
    expect(ultimo(c.dichos)).toMatch(/no tiene una tienda registrada/);
  });
  it('adivinar la contraseña desde varias cuentas también se bloquea (por tienda)', async () => {
    const c = montar();
    for (let i = 0; i < 10; i++) {
      const chat = String(1000 + i); // 10 chats distintos, 1 intento fallido cada uno
      await c.di(chat, { texto: 'entrar' });
      await c.di(chat, { tipo: 'contacto', telefono: '8111111111' });
      await c.di(chat, { texto: 'mala' + i });
    }
    await c.di('2000', { texto: 'entrar' });
    await c.di('2000', { tipo: 'contacto', telefono: '8111111111' });
    await c.di('2000', { texto: 'secreto1' }); // ni la correcta entra mientras la tienda está bloqueada
    expect(ultimo(c.dichos)).toMatch(/Demasiados intentos/);
    c.avanzar(16);
    await c.di('2000', { texto: 'secreto1' });
    expect(ultimo(c.dichos)).toMatch(/entraste a \*Dulce\*/);
  });
});

/* ---------------- webhook ---------------- */
describe('webhook de Telegram', () => {
  const ENV: any = { TELEGRAM_BOT_TOKEN: '1:t', TELEGRAM_WEBHOOK_SECRET: 'mi_secreto-1', GEMINI_API_KEY: 'g', API_PUBLIC_URL: 'https://api.test/' };
  async function levantar(env: any) {
    const dichos: string[] = [];
    const registros: string[] = [];
    const canal: any = {
      enviarTexto: async (_a: string, t: string) => { dichos.push(t); },
      enviarBotones: async () => {}, descargarImagen: async () => ({ mime: '', bytes: Buffer.from('') }),
      responderCallback: async () => {},
      registrarWebhook: async (url: string, secreto: string) => { registros.push(url + '|' + secreto); },
    };
    const app = express();
    app.use(express.json());
    app.use('/telegram', crearRouterTelegram({
      env, log: () => {}, canal,
      cerebro: { extraerArticulo: async () => ({}), responderCliente: async () => 'Hola cliente' },
      almacen: async () => ({ leer: async () => null, actualizar: async () => {}, nuevoId: () => 'x' }),
      subirImagen: async () => 'u',
    }));
    const srv = app.listen(0);
    return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/telegram`, dichos, registros, cerrar: () => srv.close() };
  }

  it('sin variables se apaga y dice cuáles faltan; rechaza un secreto con caracteres no permitidos', async () => {
    expect(faltantesTelegram({} as any)).toEqual(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'GEMINI_API_KEY']);
    expect(faltantesTelegram({ ...ENV, TELEGRAM_WEBHOOK_SECRET: 'tiene espacios!' })[0]).toMatch(/solo letras/);
    const s = await levantar({});
    expect((await (await fetch(`${s.base}/estado`)).json()).activo).toBe(false);
    expect((await fetch(`${s.base}/webhook`, { method: 'POST' })).status).toBe(503);
    s.cerrar();
  });
  it('registra el webhook solo, rechaza avisos sin secreto y atiende una sola vez los reintentos', async () => {
    const s = await levantar(ENV);
    await new Promise((r) => setTimeout(r, 20));
    expect(s.registros).toEqual(['https://api.test/telegram/webhook|mi_secreto-1']);
    const cuerpo = JSON.stringify(priv({ text: 'quiero pasteles' }));
    const post = (secreto?: string) => fetch(`${s.base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secreto ? { 'x-telegram-bot-api-secret-token': secreto } : {}) }, body: cuerpo });
    expect((await post()).status).toBe(401);
    expect((await post('otro')).status).toBe(401);
    expect((await post('mi_secreto-1')).status).toBe(200);
    expect((await post('mi_secreto-1')).status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(s.dichos).toEqual(['Hola cliente']);
    s.cerrar();
  });
});
