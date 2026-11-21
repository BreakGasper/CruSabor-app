/**
 * Agente de WhatsApp: reglas puras, conversación completa (login → foto → confirmar → publicar)
 * y webhook (verificación + firma). WhatsApp, Gemini, la base y Cloudinary van simulados.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  comandoDe, diezDigitos, esSi, esNo, leerPrecio, validarBorrador, permitirMensaje, tienePermisoPublicar,
  buscarCatalogo, construirArticulo, MAX_MENSAJES_POR_VENTANA,
} from '../src/services/asistente/logica.ts';
import { crearAgente } from '../src/services/asistente/agente.ts';
import { crearRouterWhatsapp, variablesFaltantes } from '../src/services/whatsapp/router.ts';
import { mensajesDelAviso } from '../src/services/whatsapp/meta.ts';
import { crearGemini } from '../src/services/asistente/gemini.ts';
import { membresiaVigente } from '../src/composables/useMembresia.ts';

const HOY = new Date('2026-11-20T12:00:00');
const CATS = [{ id: 'c1', nombre: 'Postres' }, { id: 'c2', nombre: 'Ropa' }];

describe('reglas puras', () => {
  it('quita la lada de país del número de WhatsApp', () => {
    expect(diezDigitos('5218144047983')).toBe('8144047983');
    expect(diezDigitos('528144047983')).toBe('8144047983');
  });
  it('reconoce comandos y respuestas', () => {
    expect(comandoDe('Entrar')).toBe('entrar');
    expect(comandoDe('  SALIR ')).toBe('salir');
    expect(comandoDe('hola!')).toBe('ayuda');
    expect(comandoDe('quiero pasteles')).toBeNull();
    expect(esSi('Sí')).toBe(true);
    expect(esNo('no gracias')).toBe(true);
    expect(esSi('nunca')).toBe(false);
  });
  it('lee precios escritos de varias formas', () => {
    expect(leerPrecio('$1,250.50')).toBe(1250.5);
    expect(leerPrecio('120 pesos')).toBe(120);
    expect(leerPrecio(99)).toBe(99);
    expect(leerPrecio('gratis')).toBeNull();
  });
  it('valida el borrador de la IA: exige nombre y precio y acota todo', () => {
    expect(validarBorrador({ nombre: 'x' }, CATS)).toEqual({ ok: false, falta: ['el nombre del artículo', 'el precio'] });
    expect(validarBorrador({ nombre: 'Pastel', precio: -5 }, CATS).ok).toBe(false);
    expect(validarBorrador({ nombre: 'Pastel', precio: 9e9 }, CATS).ok).toBe(false);
    const v = validarBorrador({ nombre: 'Pastel\n de   chocolate', precio: '$350', categoriaId: 'inventada', categoria: 'postres', stock: 4 }, CATS);
    expect(v.ok && v.borrador).toMatchObject({ nombre: 'Pastel de chocolate', precio: 350, stock: 4, categoriaId: 'c1', categoria: 'Postres' });
    // una categoría que no existe se descarta en lugar de inventarla
    const w = validarBorrador({ nombre: 'Pastel', precio: 10, categoriaId: 'zzz' }, CATS);
    expect(w.ok && w.borrador.categoriaId).toBe('');
    // bajo pedido nunca controla stock
    const p = validarBorrador({ nombre: 'Pastel', precio: 10, stock: 5, porPedido: true }, CATS);
    expect(p.ok && p.borrador.stock).toBe(-1);
  });
  it('limita los mensajes por ventana de tiempo', () => {
    let marcas: number[] = [];
    for (let i = 0; i < MAX_MENSAJES_POR_VENTANA; i++) marcas = permitirMensaje(marcas, 1000 + i).marcas;
    expect(permitirMensaje(marcas, 2000).permitido).toBe(false);
    expect(permitirMensaje(marcas, 1000 + 11 * 60_000).permitido).toBe(true);
  });
  it('la regla de membresía es la misma que usa la app', () => {
    const casos: any[] = [
      { estatus: 'activa', membresia: { vigenteHasta: '2026-12-01' } },
      { estatus: 'activa', membresia: { vigenteHasta: '2026-11-19' } },
      { estatus: 'activa', membresia: { plan: 'prueba', vigenteHasta: '2026-11-19' } },
      { estatus: 'activa' },
      { estatus: 'bloqueada', membresia: { vigenteHasta: '2027-01-01' } },
      { estatus: 'pendiente', membresia: { vigenteHasta: '2027-01-01' } },
      {},
    ];
    for (const c of casos) expect(tienePermisoPublicar(c, HOY, 0)).toBe(membresiaVigente(c, HOY, 0));
  });
  it('construye el artículo con la forma que crea la app', () => {
    const b = { nombre: 'Pastel', descripcion: '', precio: 350, stock: -1, unidadMedida: 'pz', marca: '', color: '', tamano: '', material: '', categoriaId: 'c1', categoria: 'Postres', porPedido: false };
    const a = construirArticulo(b, { id: 't1', nombreTienda: 'Dulce' }, 'https://img/x.jpg', HOY, 'CRU-1');
    expect(a).toMatchObject({ tiendaId: 't1', tiendaNombre: 'Dulce', url: 'https://img/x.jpg', precio: 350, categoriaId: 'c1' });
    expect(a.variantes[0]).toMatchObject({ sku: 'CRU-1', isDefault: true, tieneStock: false, stock: -1, url: 'https://img/x.jpg' });
  });
  it('el catálogo solo muestra tiendas que pueden vender y artículos sin baja', () => {
    const tiendas = { t1: { nombreTienda: 'Dulce', estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } }, t2: { nombreTienda: 'Vencida', estatus: 'activa', membresia: { vigenteHasta: '2026-01-01' } } };
    const arts = {
      a1: { nombre: 'Pastel de chocolate', precio: 350, tiendaId: 't1', tiendaNombre: 'Dulce' },
      a2: { nombre: 'Pastel viejo', precio: 10, tiendaId: 't1', baja: true },
      a3: { nombre: 'Pastel de otra', precio: 10, tiendaId: 't2' },
    };
    const r = buscarCatalogo(tiendas, arts, '¿tienen pasteles de chocolate?', HOY);
    expect(r.articulos.map((a) => a.nombre)).toEqual(['Pastel de chocolate']);
  });
  it('lee los mensajes del aviso de Meta', () => {
    const aviso = { entry: [{ changes: [{ value: { messages: [
      { id: 'm1', from: '5218111111111', type: 'text', text: { body: 'hola' } },
      { id: 'm2', from: '5218111111111', type: 'image', image: { id: 'img1', caption: 'Pastel $350' } },
      { id: 'm3', from: '5218111111111', type: 'interactive', interactive: { button_reply: { id: 'guardar' } } },
      { id: 'm4', from: '5218111111111', type: 'audio' },
    ] } }] }] };
    expect(mensajesDelAviso(aviso).map((m) => [m.tipo, m.texto, m.mediaId])).toEqual([
      ['texto', 'hola', undefined], ['imagen', 'Pastel $350', 'img1'], ['boton', 'guardar', undefined], ['otro', '', undefined],
    ]);
  });
});

describe('Gemini', () => {
  const falso = () => {
    const llamadas: { url: string; headers: any; body: any }[] = [];
    const fetchFn = (async (url: string, init: any) => {
      llamadas.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"nombre":"Pastel","precio":350}' }] } }] }), { status: 200 });
    }) as any;
    return { llamadas, fetchFn };
  };
  it('usa el modelo por defecto vigente y la llave por cabecera (no en la URL)', async () => {
    const { llamadas, fetchFn } = falso();
    const g = crearGemini({ llave: 'LLAVE', fetchFn });
    expect(await g.extraerArticulo({ texto: 'Pastel $350', categorias: CATS })).toEqual({ nombre: 'Pastel', precio: 350 });
    expect(llamadas[0].url).toContain('/models/gemini-3.8-flash:generateContent');
    expect(llamadas[0].url).not.toContain('LLAVE');
    expect(llamadas[0].headers['x-goog-api-key']).toBe('LLAVE');
  });
  it('el modelo se puede cambiar sin tocar el código', async () => {
    const { llamadas, fetchFn } = falso();
    await crearGemini({ llave: 'k', modelo: 'otro-modelo', fetchFn }).responderCliente({ pregunta: 'hola', catalogo: { articulos: [], tiendas: [] }, urlApp: 'https://app.test' });
    expect(llamadas[0].url).toContain('/models/otro-modelo:');
    // sin tope de salida que pueda vaciar la respuesta en modelos con razonamiento
    expect(llamadas[0].body.generationConfig.maxOutputTokens).toBeUndefined();
  });
  it('un error de Gemini no filtra la llave', async () => {
    const fetchFn = (async () => new Response('{"error":{"code":404}}', { status: 404 })) as any;
    await expect(crearGemini({ llave: 'LLAVE', fetchFn }).responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' })).rejects.toThrow(/Gemini 404/);
  });
});

/* ---------------- conversación ---------------- */
const TEL = '5218111111111';
function montar(extra: { tiendas?: any; extraerCrudo?: any } = {}) {
  const bd: Record<string, any> = {
    tiendas: extra.tiendas ?? {
      t1: { nombreTienda: 'Dulce', telefono: '8111111111', password: bcrypt.hashSync('secreto1', 4), estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } },
    },
    categorias: { c1: { id: 'c1', nombre: 'Postres' } },
    articulos: {},
  };
  const enviados: string[] = [];
  const botones: string[] = [];
  let reloj = HOY.getTime();
  let subidas = 0;
  const almacen = async () => ({
    leer: async (r: string) => r.split('/').reduce((o: any, k) => o?.[k], bd) ?? null,
    actualizar: async (c: Record<string, any>) => { for (const [r, v] of Object.entries(c)) { const [n, id] = r.split('/'); (bd[n] ??= {})[id] = v; } },
    nuevoId: () => 'art1',
  });
  const agente = crearAgente({
    canal: {
      enviarTexto: async (_a, t) => { enviados.push(t); },
      enviarBotones: async (_a, t, b) => { botones.push(t); enviados.push(t + ' [' + b.map((x) => x.id).join(',') + ']'); },
      descargarImagen: async () => ({ mime: 'image/jpeg', bytes: Buffer.from('foto') }),
    },
    cerebro: {
      extraerArticulo: async ({ texto, borradorActual }) =>
        extra.extraerCrudo ?? (borradorActual ? { ...borradorActual, precio: Number(texto.match(/\d+/)?.[0]) } : { nombre: 'Pastel de chocolate', precio: 350, categoriaId: 'c1' }),
      responderCliente: async ({ catalogo }) => `Encontré ${catalogo.articulos.length} artículo(s)`,
    },
    almacen,
    subirImagen: async () => { subidas++; return 'https://img/foto.jpg'; },
    urlApp: 'https://app.test',
    ahora: () => new Date(reloj),
    sku: () => 'CRU-TEST',
    log: () => {},
  });
  let n = 0;
  const di = (m: any) => agente.procesar({ id: 'x' + n++, de: TEL, tipo: 'texto', texto: '', ...m });
  return { bd, enviados, botones, di, avanzar: (min: number) => { reloj += min * 60_000; }, subidas: () => subidas, agente };
}
const ultimo = (e: string[]) => e[e.length - 1];

describe('conversación del agente', () => {
  let c: ReturnType<typeof montar>;
  beforeEach(() => { c = montar(); });

  it('un cliente pregunta y recibe respuesta del catálogo, sin iniciar sesión', async () => {
    await c.di({ texto: 'quiero pasteles' });
    expect(ultimo(c.enviados)).toMatch(/Encontré/);
  });

  it('no deja publicar sin iniciar sesión', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/escribe \*entrar\*/);
    expect(c.bd.articulos).toEqual({});
  });

  it('un número sin tienda registrada no puede entrar', async () => {
    const x = montar({ tiendas: {} });
    await x.di({ texto: 'entrar' });
    expect(ultimo(x.enviados)).toMatch(/no tiene una tienda registrada/);
  });

  it('contraseña incorrecta no entra y 5 intentos bloquean el número', async () => {
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'mala' });
    expect(ultimo(c.enviados)).toMatch(/incorrecta \(1\/5\)/);
    for (let i = 0; i < 4; i++) await c.di({ texto: 'mala' });
    expect(ultimo(c.enviados)).toMatch(/bloqueado/);
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    expect(ultimo(c.enviados)).toMatch(/Demasiados intentos/);
    c.avanzar(16);
    await c.di({ texto: 'secreto1' });
    expect(ultimo(c.enviados)).toMatch(/Listo, entraste a \*Dulce\*/);
  });

  it('flujo completo: entrar → foto → confirmar → artículo publicado en SU tienda', async () => {
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    expect(ultimo(c.enviados)).toMatch(/Listo, entraste a \*Dulce\*/);

    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel de chocolate $350' });
    expect(ultimo(c.enviados)).toMatch(/Pastel de chocolate[\s\S]*\$350[\s\S]*Postres[\s\S]*Dulce[\s\S]*\[guardar,cancelar\]/);
    expect(c.bd.articulos).toEqual({}); // todavía NO se guardó nada

    await c.di({ tipo: 'boton', texto: 'guardar' });
    expect(ultimo(c.enviados)).toMatch(/ya está publicado/);
    expect(c.bd.articulos.art1).toMatchObject({ nombre: 'Pastel de chocolate', precio: 350, tiendaId: 't1', tiendaNombre: 'Dulce', url: 'https://img/foto.jpg', categoriaId: 'c1' });
    expect(c.subidas()).toBe(1);
  });

  it('permite corregir el borrador antes de publicar y descartar sin guardar', async () => {
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel' });
    await c.di({ texto: 'el precio es 120' });
    expect(ultimo(c.enviados)).toMatch(/\$120/);
    await c.di({ tipo: 'boton', texto: 'cancelar' });
    expect(ultimo(c.enviados)).toMatch(/Descartado/);
    expect(c.bd.articulos).toEqual({});
    expect(c.subidas()).toBe(0); // la foto no se sube si no se confirma
  });

  it('si falta el precio, lo pide y reintenta con la misma foto', async () => {
    const x = montar({ extraerCrudo: { nombre: 'Pastel' } });
    await x.di({ texto: 'entrar' });
    await x.di({ texto: 'secreto1' });
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel' });
    expect(ultimo(x.enviados)).toMatch(/No pude leer el precio/);
    expect(x.bd.articulos).toEqual({});
  });

  it('con la membresía vencida no publica aunque confirme', async () => {
    const x = montar({ tiendas: { t1: { nombreTienda: 'Dulce', telefono: '8111111111', password: bcrypt.hashSync('secreto1', 4), estatus: 'activa', membresia: { vigenteHasta: '2026-01-01' } } } });
    await x.di({ texto: 'entrar' });
    await x.di({ texto: 'secreto1' });
    expect(ultimo(x.enviados)).toMatch(/no tiene membresía vigente/);
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    await x.di({ tipo: 'boton', texto: 'guardar' });
    expect(ultimo(x.enviados)).toMatch(/no puedo publicar/);
    expect(x.bd.articulos).toEqual({});
  });

  it('la sesión caduca por inactividad y "salir" la cierra', async () => {
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    c.avanzar(31);
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(c.enviados.some((t) => /sesión caducó/.test(t))).toBe(true);
    expect(c.bd.articulos).toEqual({});
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    await c.di({ texto: 'salir' });
    expect(ultimo(c.enviados)).toMatch(/Sesión cerrada/);
  });

  it('con varias tiendas en el mismo número pide elegir cuál', async () => {
    const h = bcrypt.hashSync('secreto1', 4);
    const x = montar({ tiendas: {
      t1: { nombreTienda: 'Dulce', telefono: '8111111111', password: h, estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } },
      t2: { nombreTienda: 'Ropa Bonita', telefono: '8111111111', password: h, estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } },
    } });
    await x.di({ texto: 'entrar' });
    await x.di({ texto: 'secreto1' });
    expect(ultimo(x.enviados)).toMatch(/1\. Dulce\n2\. Ropa Bonita/);
    await x.di({ texto: '2' });
    expect(ultimo(x.enviados)).toMatch(/entraste a \*Ropa Bonita\*/);
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Blusa $200' });
    await x.di({ tipo: 'boton', texto: 'guardar' });
    expect(x.bd.articulos.art1.tiendaId).toBe('t2');
  });

  it('dos fotos seguidas no se pisan', async () => {
    await c.di({ texto: 'entrar' });
    await c.di({ texto: 'secreto1' });
    await Promise.all([c.di({ tipo: 'imagen', mediaId: 'a', texto: 'Uno $1' }), c.di({ tipo: 'boton', texto: 'guardar' })]);
    expect(c.bd.articulos.art1).toBeDefined();
  });
});

/* ---------------- webhook ---------------- */
describe('webhook', () => {
  const ENV: any = { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p', WHATSAPP_VERIFY_TOKEN: 'verif', WHATSAPP_APP_SECRET: 'secretoapp', GEMINI_API_KEY: 'g' };

  async function levantar(env: any, canal?: any) {
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
    app.use('/whatsapp', crearRouterWhatsapp({
      env, log: () => {}, canal,
      cerebro: { extraerArticulo: async () => ({}), responderCliente: async () => 'Hola cliente' },
      almacen: async () => ({ leer: async () => null, actualizar: async () => {}, nuevoId: () => 'x' }),
      subirImagen: async () => 'u',
    }));
    const srv = app.listen(0);
    return { base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/whatsapp`, cerrar: () => srv.close() };
  }
  const firmar = (cuerpo: string) => 'sha256=' + createHmac('sha256', 'secretoapp').update(cuerpo).digest('hex');

  it('sin variables se apaga y lo dice', async () => {
    expect(variablesFaltantes({} as any)).toContain('GEMINI_API_KEY');
    const s = await levantar({});
    const r = await (await fetch(`${s.base}/estado`)).json();
    expect(r.activo).toBe(false);
    expect((await fetch(`${s.base}/webhook`, { method: 'POST' })).status).toBe(503);
    s.cerrar();
  });

  it('verifica el webhook solo con el token correcto', async () => {
    const s = await levantar(ENV, { enviarTexto: async () => {}, enviarBotones: async () => {}, descargarImagen: async () => ({ mime: '', bytes: Buffer.from('') }) });
    const ok = await fetch(`${s.base}/webhook?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=777`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('777');
    expect((await fetch(`${s.base}/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`)).status).toBe(403);
    s.cerrar();
  });

  it('rechaza avisos sin firma válida y atiende los firmados (una sola vez aunque Meta reintente)', async () => {
    const dichos: string[] = [];
    const s = await levantar(ENV, { enviarTexto: async (_a: string, t: string) => { dichos.push(t); }, enviarBotones: async () => {}, descargarImagen: async () => ({ mime: '', bytes: Buffer.from('') }) });
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'dup1', from: '5218122222222', type: 'text', text: { body: 'quiero pasteles' } }] } }] }] });
    const post = (firma: string) => fetch(`${s.base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': firma }, body: cuerpo });
    expect((await post('sha256=falsa')).status).toBe(401);
    expect((await post(firmar(cuerpo))).status).toBe(200);
    expect((await post(firmar(cuerpo))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(dichos).toEqual(['Hola cliente']);
    s.cerrar();
  });
});
