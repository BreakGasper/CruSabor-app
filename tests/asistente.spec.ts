/**
 * Agente de WhatsApp: reglas puras, roles (cliente / tienda), sesión del día, cambios de perfil,
 * publicación de artículos y webhook. WhatsApp, Gemini, la base y Cloudinary van simulados.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createHmac, createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  comandoDe, rolDe, diezDigitos, esSi, esNo, leerPrecio, validarBorrador, permitirMensaje, tienePermisoPublicar,
  buscarCatalogo, construirArticulo, diaMx, momentoMx, validarCambiosPerfil, tiendaPublica, resumenTienda,
  MAX_MENSAJES_POR_VENTANA,
} from '../src/services/asistente/logica.ts';
import { crearAgente } from '../src/services/asistente/agente.ts';
import { crearRouterWhatsapp, variablesFaltantes } from '../src/services/whatsapp/router.ts';
import { mensajesDelAviso } from '../src/services/whatsapp/meta.ts';
import { crearGemini } from '../src/services/asistente/gemini.ts';
import { membresiaVigente } from '../src/composables/useMembresia.ts';

// 12:00 en México (UTC-6) del viernes 20 de noviembre de 2026
const HOY = new Date('2026-11-20T18:00:00Z');
const CATS = [{ id: 'c1', nombre: 'Postres' }, { id: 'c2', nombre: 'Ropa' }];

describe('reglas puras', () => {
  it('quita la lada de país del número de WhatsApp', () => {
    expect(diezDigitos('5218144047983')).toBe('8144047983');
    expect(diezDigitos('528144047983')).toBe('8144047983');
  });
  it('reconoce comandos, roles y respuestas', () => {
    expect(comandoDe('Entrar')).toBe('entrar');
    expect(comandoDe('  SALIR ')).toBe('salir');
    expect(comandoDe('hola!')).toBe('menu');
    expect(comandoDe('ayuda')).toBe('ayuda');
    expect(comandoDe('mi tienda')).toBe('datos');
    expect(comandoDe('publicar')).toBeNull(); // confirmar un artículo no debe confundirse con "entrar"
    expect(comandoDe('quiero pasteles')).toBeNull();
    expect(rolDe('rol_cliente')).toBe('cliente');
    expect(rolDe('Soy tienda')).toBe('tienda');
    expect(rolDe('quiero pasteles')).toBeNull();
    expect(esSi('Sí')).toBe(true);
    expect(esSi('publicar')).toBe(true);
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
    const w = validarBorrador({ nombre: 'Pastel', precio: 10, categoriaId: 'zzz' }, CATS);
    expect(w.ok && w.borrador.categoriaId).toBe('');
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
  it('el día y la hora se cuentan en México, no en la zona del servidor', () => {
    expect(diaMx(HOY.getTime())).toBe('2026-11-20');
    expect(momentoMx(HOY.getTime())).toEqual({ dia: 'Viernes', hora: '12:00' });
    // 05:30 UTC del 21 todavía es 23:30 del 20 en México
    expect(diaMx(new Date('2026-11-21T05:30:00Z').getTime())).toBe('2026-11-20');
    expect(diaMx(new Date('2026-11-21T06:00:00Z').getTime())).toBe('2026-11-21');
  });
});

describe('lo que ve un cliente', () => {
  const tiendas = {
    t1: { nombreTienda: 'Dulce Hogar', categoria: 'Postres', estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' }, password: 'HASH-SECRETO', calle: 'Hidalgo', numero: '12', colonia: 'Centro', cp: '45000', municipio: 'Zapopan', estado: 'Jalisco', telefono: '3331112222', incluyeWhatsapp: true, email: 'dulce@ej.mx', metodosPago: ['Efectivo', 'Tarjeta'], envioDomicilio: true, zonasEntrega: ['Centro'], horario: { Lunes: { inicio: '09:00', fin: '18:00' }, Martes: { inicio: '', fin: '' } }, faq: 'Hacemos pedidos con 2 días' },
    t2: { nombreTienda: 'Vencida', estatus: 'activa', membresia: { vigenteHasta: '2026-01-01' } },
  };
  const arts = {
    a1: { nombre: 'Pastel de chocolate', precio: 350, tiendaId: 't1', tiendaNombre: 'Dulce Hogar', unidadMedida: 'pz', variantes: [{ color: 'Café', tamano: 'Grande', stock: 3, tieneStock: true }] },
    a2: { nombre: 'Pastel viejo', precio: 10, tiendaId: 't1', baja: true },
    a3: { nombre: 'Pastel de otra', precio: 10, tiendaId: 't2' },
    a4: { nombre: 'Galletas', precio: 40, tiendaId: 't1', tiendaNombre: 'Dulce Hogar', porPedido: true },
  };
  it('artículos: solo de tiendas que pueden vender y sin dar de baja, con opciones y disponibilidad', () => {
    const r = buscarCatalogo(tiendas, arts, '¿tienen pasteles de chocolate?', HOY);
    expect(r.articulos.map((a) => a.nombre)).toEqual(['Pastel de chocolate']);
    expect(r.articulos[0]).toMatchObject({ precio: 350, tienda: 'Dulce Hogar', colores: ['Café'], tamanos: ['Grande'], disponible: true });
  });
  it('tiendas: horario, ubicación, contacto, pagos y envío (lo que muestra el perfil público), y también sus artículos', () => {
    const r = buscarCatalogo(tiendas, arts, 'horario de Dulce Hogar', HOY);
    expect(r.tiendas).toHaveLength(1);
    expect(r.tiendas[0]).toMatchObject({
      nombre: 'Dulce Hogar', direccion: 'Hidalgo 12, Col. Centro, C.P. 45000, Zapopan, Jalisco', telefono: '3331112222', whatsapp: true,
      metodosPago: ['Efectivo', 'Tarjeta'], envioDomicilio: true, zonasEntrega: ['Centro'],
    });
    expect(r.tiendas[0].horario.Lunes).toBe('09:00-18:00');
    expect(r.tiendas[0].horario.Martes).toBe('cerrado');
    expect(r.articulos.map((a) => a.nombre).sort()).toEqual(['Galletas', 'Pastel de chocolate']); // preguntar por la tienda trae sus artículos
  });
  it('nunca expone la contraseña ni datos internos', () => {
    const pub = JSON.stringify(tiendaPublica(tiendas.t1));
    expect(pub).not.toContain('HASH-SECRETO');
    expect(pub).not.toContain('membresia');
    expect(pub).not.toContain('estatus');
    expect(JSON.stringify(buscarCatalogo(tiendas, arts, 'Dulce Hogar', HOY))).not.toContain('HASH-SECRETO');
  });
  it('el administrador ve además su membresía y cuántos artículos tiene', () => {
    const r = resumenTienda(tiendas.t1, 2, HOY);
    expect(r).toMatch(/Dulce Hogar/);
    expect(r).toMatch(/Lunes: 09:00-18:00/);
    expect(r).toMatch(/Martes: cerrado/);
    expect(r).toMatch(/Artículos publicados: 2/);
    expect(r).toMatch(/vigente.*2027-01-01/);
    expect(r).not.toContain('HASH-SECRETO');
  });
});

describe('cambios al perfil: validación', () => {
  const actual = { horario: { Lunes: { inicio: '09:00', fin: '18:00' }, Sábado: { inicio: '10:00', fin: '14:00' } }, envioDomicilio: false };
  it('horario: normaliza horas y días, cierra días y CONSERVA los días que no se mencionan', () => {
    const v = validarCambiosPerfil({ horario: [{ dia: 'martes', inicio: '9:00', fin: '17:30' }, { dia: 'Sabado', cerrado: true }] }, actual);
    expect(v.cambios.horario.Martes).toEqual({ inicio: '09:00', fin: '17:30' });
    expect(v.cambios.horario.Sábado).toEqual({ inicio: '', fin: '' });
    expect(v.cambios.horario.Lunes).toEqual({ inicio: '09:00', fin: '18:00' }); // intacto
    expect(Object.keys(v.cambios.horario)).toHaveLength(7);
  });
  it('rechaza horas imposibles y apertura después del cierre', () => {
    const v = validarCambiosPerfil({ horario: [{ dia: 'Lunes', inicio: '25:00', fin: '18:00' }, { dia: 'Martes', inicio: '18:00', fin: '09:00' }, { dia: 'Funday', inicio: '9:00', fin: '10:00' }] }, actual);
    expect(v.cambios.horario).toBeUndefined();
    expect(v.ignorados).toHaveLength(3);
  });
  it('un valor vacío significa "sin cambio" (la IA puede devolver campos vacíos que no deben borrar nada)', () => {
    const v = validarCambiosPerfil({ descripcion: '', calle: '', cp: '', email: '', metodosPago: [], zonasEntrega: [], horario: [], incluyeWhatsapp: '', envioDomicilio: '' }, actual);
    expect(v.cambios).toEqual({});
    expect(v.ignorados).toEqual([]);
  });
  it('formas de pago: solo las que existen; envío y zonas coherentes', () => {
    const v = validarCambiosPerfil({ metodosPago: ['tarjeta de crédito', 'efectivo', 'bitcoin'], envioDomicilio: 'si', zonasEntrega: ['Centro', ' Zapopan '] }, actual);
    expect(v.cambios.metodosPago).toEqual(['Tarjeta', 'Efectivo']);
    expect(v.cambios).toMatchObject({ envioDomicilio: true, zonasEntrega: ['Centro', 'Zapopan'] });
    const sin = validarCambiosPerfil({ envioDomicilio: 'no', zonasEntrega: ['Centro'] }, actual);
    expect(sin.cambios).toMatchObject({ envioDomicilio: false, zonasEntrega: [] });
    expect(validarCambiosPerfil({ metodosPago: ['bitcoin'] }, actual).cambios.metodosPago).toBeUndefined();
  });
  it('correo, código postal y enlaces se validan; un enlace javascript: se descarta', () => {
    const v = validarCambiosPerfil({ email: 'no-es-correo', cp: '123', facebookUrl: 'javascript:alert(1)', instagramUrl: 'instagram.com/dulce' }, actual);
    expect(v.cambios).toEqual({ instagramUrl: 'https://instagram.com/dulce' });
    expect(v.ignorados).toHaveLength(3);
    expect(validarCambiosPerfil({ cp: '45000', email: 'a@b.mx' }, actual).cambios).toEqual({ cp: '45000', email: 'a@b.mx' });
  });
  it('los campos prohibidos (contraseña, celular, nombre, estado, membresía) jamás pasan', () => {
    const v = validarCambiosPerfil({ password: 'x', telefono: '8100000000', nombreTienda: 'Otro', estatus: 'activa', membresia: { vigenteHasta: '2099-01-01' }, categoria: 'X', tiendaId: 't9', descripcion: 'Rica repostería' }, actual);
    expect(v.cambios).toEqual({ descripcion: 'Rica repostería' });
  });
  it('limpia saltos de línea y recorta largos', () => {
    const v = validarCambiosPerfil({ descripcion: 'a\n\nb ' + 'x'.repeat(900) }, actual);
    expect(v.cambios.descripcion.startsWith('a b ')).toBe(true);
    expect(v.cambios.descripcion.length).toBe(500);
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
  it('reintenta ante un pico de demanda (503) y responde cuando Google se recupera', async () => {
    let n = 0;
    const esperas: number[] = [];
    const fetchFn = (async () => {
      n++;
      return n < 3
        ? new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola cliente' }] } }] }), { status: 200 });
    }) as any;
    const g = crearGemini({ llave: 'k', fetchFn, esperar: async (ms) => { esperas.push(ms); } });
    expect(await g.responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' })).toBe('Hola cliente');
    expect(n).toBe(3);
    expect(esperas).toEqual([1500, 4000]);
  });
  it('si Google sigue caído, se rinde tras los reintentos; y un 404 no se reintenta', async () => {
    let n = 0;
    const caido = (async () => { n++; return new Response('{"error":{"code":503}}', { status: 503 }); }) as any;
    await expect(crearGemini({ llave: 'k', fetchFn: caido, esperar: async () => {} }).responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' })).rejects.toThrow(/Gemini 503/);
    expect(n).toBe(3);
    let m = 0;
    const noExiste = (async () => { m++; return new Response('{"error":{"code":404}}', { status: 404 }); }) as any;
    await expect(crearGemini({ llave: 'k', fetchFn: noExiste, esperar: async () => {} }).responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' })).rejects.toThrow(/Gemini 404/);
    expect(m).toBe(1);
  });
  it('un error de Gemini no filtra la llave', async () => {
    const fetchFn = (async () => new Response('{"error":{"code":404}}', { status: 404 })) as any;
    await expect(crearGemini({ llave: 'LLAVE', fetchFn }).responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' })).rejects.toThrow(/Gemini 404/);
  });
});


describe('Gemini: interpretar a la tienda', () => {
  it('manda el perfil actual y la hora, y devuelve el JSON (o "otro" si no es JSON válido)', async () => {
    let cuerpo: any;
    const fetchFn = (async (_u: string, init: any) => { cuerpo = JSON.parse(init.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"accion":"editar_perfil","cambios":{"descripcion":"Hola"}}' }] } }] }), { status: 200 }); }) as any;
    const g = crearGemini({ llave: 'k', fetchFn });
    expect(await g.interpretarAdmin({ texto: 'mi descripción es Hola', perfil: { metodosPago: ['Efectivo'] }, ahora: 'Viernes 12:00' })).toEqual({ accion: 'editar_perfil', cambios: { descripcion: 'Hola' } });
    expect(cuerpo.systemInstruction.parts[0].text).toMatch(/Viernes 12:00[\s\S]*Efectivo/);
    expect(cuerpo.generationConfig.responseMimeType).toBe('application/json');
    const roto = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'no es json' }] } }] }), { status: 200 })) as any;
    expect(await crearGemini({ llave: 'k', fetchFn: roto }).interpretarAdmin({ texto: 'x', perfil: {} })).toEqual({ accion: 'otro' });
  });
});

/* ---------------- conversación ---------------- */
const TEL = '5218111111111'; // celular de la tienda t1 (8111111111)
const SECRETO = 'secreto-de-prueba';
const clave = (de: string) => createHash('sha256').update(de).digest('hex').slice(0, 32);
const HASH = bcrypt.hashSync('secreto1', 4);
const tiendaBase = (extra: any = {}) => ({
  nombreTienda: 'Dulce', categoria: 'Postres', telefono: '8111111111', password: HASH, estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' },
  horario: { Lunes: { inicio: '09:00', fin: '18:00' } }, metodosPago: ['Efectivo'], ...extra,
});

function montar(extra: { tiendas?: any; extraerCrudo?: any; admin?: (texto: string) => any } = {}) {
  const bd: Record<string, any> = {
    tiendas: extra.tiendas ?? { t1: tiendaBase() },
    categorias: { c1: { id: 'c1', nombre: 'Postres' } },
    articulos: {},
  };
  const enviados: string[] = [];
  const botones: string[][] = [];
  const respuestasCliente: any[] = [];
  let reloj = HOY.getTime();
  let subidas = 0;
  /** Cada borrado pedido, con el logo que tenía la tienda EN ESE MOMENTO (para comprobar que fue después de guardar) */
  const borradas: { urls: string[]; logoAlBorrar: any; bannerAlBorrar: any }[] = [];
  let fallaBorrado = false;
  const poner = (ruta: string, valor: any) => {
    const partes = ruta.split('/');
    let o = bd;
    for (const k of partes.slice(0, -1)) o = o[k] ??= {};
    if (valor === null) delete o[partes[partes.length - 1]];
    else o[partes[partes.length - 1]] = valor;
  };
  const almacen = async () => ({
    leer: async (r: string) => r.split('/').reduce((o: any, k) => o?.[k], bd) ?? null,
    actualizar: async (c: Record<string, any>) => { for (const [r, v] of Object.entries(c)) poner(r, v); },
    nuevoId: () => 'art1',
  });
  const crear = () => crearAgente({
    canal: {
      enviarTexto: async (_a, t) => { enviados.push(t); },
      enviarBotones: async (_a, t, b) => { botones.push(b.map((x) => x.id)); enviados.push(t + ' [' + b.map((x) => x.id).join(',') + ']'); },
      descargarImagen: async () => ({ mime: 'image/jpeg', bytes: Buffer.from('foto') }),
    },
    cerebro: {
      extraerArticulo: async ({ texto, borradorActual }) =>
        extra.extraerCrudo ?? (borradorActual ? { ...borradorActual, precio: Number(texto.match(/\d+/)?.[0]) } : { nombre: 'Pastel de chocolate', precio: 350, categoriaId: 'c1' }),
      responderCliente: async (a) => { respuestasCliente.push(a); return `Encontré ${a.catalogo.articulos.length} artículo(s)`; },
      interpretarAdmin: async ({ texto }) => (extra.admin ? extra.admin(texto) : { accion: 'otro' }),
    },
    almacen,
    subirImagen: async () => { subidas++; return `https://img/foto${subidas}.jpg`; },
    eliminarImagenes: async (urls) => {
      borradas.push({ urls, logoAlBorrar: bd.tiendas.t1?.logoUrl, bannerAlBorrar: bd.tiendas.t1?.bannerUrl });
      if (fallaBorrado) throw new Error('Cloudinary caído');
    },
    urlApp: 'https://app.test',
    secreto: SECRETO,
    ahora: () => new Date(reloj),
    sku: () => 'CRU-TEST',
    log: () => {},
  });
  let agente = crear();
  let n = 0;
  const di = (m: any, de = TEL) => agente.procesar({ id: 'x' + n++, de, tipo: 'texto', texto: '', ...m });
  const boton = (id: string, de = TEL) => di({ tipo: 'boton', texto: id }, de);
  const entrar = async (de = TEL) => { await di({ texto: 'entrar' }, de); await di({ texto: 'secreto1' }, de); };
  return {
    bd, enviados, botones, respuestasCliente, di, boton, entrar,
    avanzar: (min: number) => { reloj += min * 60_000; },
    subidas: () => subidas,
    borradas,
    fallarBorrado: () => { fallaBorrado = true; },
    /** Simula que Render se durmió o reinició: se pierde toda la memoria del agente */
    reiniciar: () => { agente = crear(); },
  };
}
const ultimo = (e: string[]) => e[e.length - 1];

describe('roles: cliente o tienda', () => {
  let c: ReturnType<typeof montar>;
  beforeEach(() => { c = montar(); });

  it('lo primero que pregunta es si es cliente o tienda, sea cual sea el primer mensaje', async () => {
    await c.di({ texto: 'quiero pasteles' });
    expect(ultimo(c.enviados)).toMatch(/¿Qué quieres hacer\?[\s\S]*Soy cliente[\s\S]*Soy tienda[\s\S]*\[rol_cliente,rol_tienda\]/);
    expect(c.respuestasCliente).toHaveLength(0); // todavía no consulta nada
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' }, '5218199999999');
    expect(ultimo(c.enviados)).toMatch(/Soy cliente/);
    expect(c.bd.articulos).toEqual({});
  });

  it('cliente: consulta artículos, tiendas, horarios y ubicaciones', async () => {
    await c.boton('rol_cliente');
    expect(ultimo(c.enviados)).toMatch(/Modo cliente/);
    await c.di({ texto: '¿a qué hora abre Dulce?' });
    expect(ultimo(c.enviados)).toMatch(/Encontré/);
    const ctx = c.respuestasCliente[0];
    expect(ctx.catalogo.tiendas[0]).toMatchObject({ nombre: 'Dulce' });
    expect(ctx.catalogo.tiendas[0].horario.Lunes).toBe('09:00-18:00');
    expect(ctx.ahora).toBe('Viernes 12:00'); // para decir si está abierta ahora
  });

  it('cliente: no puede publicar, ver datos internos ni editar nada', async () => {
    await c.boton('rol_cliente');
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/Como cliente solo puedo ayudarte a consultar/);
    await c.di({ texto: 'cambia el horario de Dulce a lunes de 1 a 2' });
    expect(c.respuestasCliente).toHaveLength(1); // se trató como una pregunta, no como una orden
    expect(c.bd.tiendas.t1.horario).toEqual({ Lunes: { inicio: '09:00', fin: '18:00' } });
    expect(c.bd.articulos).toEqual({});
  });

  it('"menú" vuelve a preguntar y "entrar" es un atajo a tienda', async () => {
    await c.boton('rol_cliente');
    await c.di({ texto: 'menú' });
    expect(ultimo(c.enviados)).toMatch(/\[rol_cliente,rol_tienda\]/);
    await c.di({ texto: 'entrar' });
    expect(ultimo(c.enviados)).toMatch(/contraseña de tu tienda/);
  });

  it('un número sin tienda registrada no puede entrar como tienda', async () => {
    const x = montar({ tiendas: {} });
    await x.boton('rol_tienda');
    expect(ultimo(x.enviados)).toMatch(/no tiene una tienda registrada/);
    await x.di({ texto: 'quiero pasteles' }); // sigue sin rol: vuelve a preguntar
    expect(ultimo(x.enviados)).toMatch(/Soy cliente/);
  });
});

describe('login de tienda', () => {
  let c: ReturnType<typeof montar>;
  beforeEach(() => { c = montar(); });

  it('contraseña incorrecta no entra y 5 intentos bloquean el número', async () => {
    await c.boton('rol_tienda');
    await c.di({ texto: 'mala' });
    expect(ultimo(c.enviados)).toMatch(/incorrecta \(1\/5\)/);
    for (let i = 0; i < 4; i++) await c.di({ texto: 'mala' });
    expect(ultimo(c.enviados)).toMatch(/bloqueado/);
    await c.entrar();
    expect(ultimo(c.enviados)).toMatch(/Demasiados intentos/);
    c.avanzar(16);
    await c.entrar();
    expect(ultimo(c.enviados)).toMatch(/Listo, entraste a \*Dulce\*/);
  });

  it('al entrar muestra qué puede hacer y NO publica nada sin confirmar', async () => {
    await c.boton('rol_tienda');
    await c.di({ texto: 'secreto1' });
    expect(ultimo(c.enviados)).toMatch(/Listo, entraste a \*Dulce\*[\s\S]*Publicar un artículo[\s\S]*mi tienda[\s\S]*Cambiar tu perfil[\s\S]*hasta el fin del día/);
  });

  it('con varias tiendas en el mismo número pide elegir cuál, y todo lo que haga va SOLO a esa', async () => {
    const x = montar({ tiendas: {
      t1: tiendaBase({ nombreTienda: 'Dulce' }),
      t2: tiendaBase({ nombreTienda: 'Ropa Bonita' }),
      t3: tiendaBase({ nombreTienda: 'Ajena', telefono: '8199999999', password: bcrypt.hashSync('otra', 4) }),
    }, admin: () => ({ accion: 'editar_perfil', cambios: { descripcion: 'Ropa de moda' } }) });
    await x.entrar();
    expect(ultimo(x.enviados)).toMatch(/1\. Dulce\n2\. Ropa Bonita/);
    await x.di({ texto: '2' });
    expect(ultimo(x.enviados)).toMatch(/entraste a \*Ropa Bonita\*/);
    await x.di({ texto: 'mi descripción es ropa de moda' });
    await x.boton('guardar');
    expect(x.bd.tiendas.t2.descripcion).toBe('Ropa de moda');
    expect(x.bd.tiendas.t1.descripcion).toBeUndefined();
    expect(x.bd.tiendas.t3.descripcion).toBeUndefined();
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Blusa $200' });
    await x.boton('guardar');
    expect(x.bd.articulos.art1.tiendaId).toBe('t2');
  });
});

describe('tienda: artículos', () => {
  let c: ReturnType<typeof montar>;
  beforeEach(async () => { c = montar(); await c.boton('rol_tienda'); await c.di({ texto: 'secreto1' }); });

  it('flujo completo: foto → resumen → confirmar → artículo publicado en SU tienda', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel de chocolate $350' });
    expect(ultimo(c.enviados)).toMatch(/Pastel de chocolate[\s\S]*\$350[\s\S]*Postres[\s\S]*Dulce[\s\S]*\[guardar,cancelar\]/);
    expect(c.bd.articulos).toEqual({});
    await c.boton('guardar');
    expect(ultimo(c.enviados)).toMatch(/ya está publicado/);
    expect(c.bd.articulos.art1).toMatchObject({ nombre: 'Pastel de chocolate', precio: 350, tiendaId: 't1', tiendaNombre: 'Dulce', url: 'https://img/foto1.jpg', categoriaId: 'c1' });
    expect(c.subidas()).toBe(1);
  });

  it('también se puede confirmar escribiendo "publicar" (no se confunde con entrar)', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    await c.di({ texto: 'publicar' });
    expect(c.bd.articulos.art1).toBeDefined();
  });

  it('permite corregir el borrador antes de publicar y descartar sin guardar ni subir la foto', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel' });
    await c.di({ texto: 'el precio es 120' });
    expect(ultimo(c.enviados)).toMatch(/\$120/);
    await c.boton('cancelar');
    expect(ultimo(c.enviados)).toMatch(/Descartado/);
    expect(c.bd.articulos).toEqual({});
    expect(c.subidas()).toBe(0);
  });

  it('dos mensajes seguidos no se pisan', async () => {
    await Promise.all([c.di({ tipo: 'imagen', mediaId: 'a', texto: 'Uno $1' }), c.boton('guardar')]);
    expect(c.bd.articulos.art1).toBeDefined();
  });

  it('si falta el precio, lo pide y no guarda nada', async () => {
    const x = montar({ extraerCrudo: { nombre: 'Pastel' } });
    await x.entrar();
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel' });
    expect(ultimo(x.enviados)).toMatch(/No pude leer el precio/);
    expect(x.bd.articulos).toEqual({});
  });

  it('con la membresía vencida avisa y no publica aunque confirme', async () => {
    const x = montar({ tiendas: { t1: tiendaBase({ membresia: { vigenteHasta: '2026-01-01' } }) } });
    await x.entrar();
    expect(ultimo(x.enviados)).toMatch(/no tiene membresía vigente/);
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    await x.boton('guardar');
    expect(ultimo(x.enviados)).toMatch(/no puedo publicar/);
    expect(x.bd.articulos).toEqual({});
  });
});

describe('tienda: sus datos y su perfil', () => {
  const cambiosHorario = { accion: 'editar_perfil', cambios: { horario: [{ dia: 'Martes', inicio: '9:00', fin: '18:00' }, { dia: 'Miércoles', inicio: '9:00', fin: '18:00' }], metodosPago: ['Tarjeta', 'Efectivo'] } };
  let c: ReturnType<typeof montar>;
  beforeEach(async () => { c = montar({ admin: (t) => (/mi tienda|datos/i.test(t) ? { accion: 'ver_tienda' } : cambiosHorario) }); await c.boton('rol_tienda'); await c.di({ texto: 'secreto1' }); });

  it('"mi tienda" muestra los datos de SU tienda con membresía y artículos, sin la contraseña', async () => {
    await c.di({ texto: 'mi tienda' });
    const r = ultimo(c.enviados);
    expect(r).toMatch(/Dulce[\s\S]*Horario[\s\S]*Lunes: 09:00-18:00[\s\S]*Artículos publicados: 0[\s\S]*Membresía: ✅ vigente/);
    expect(r).not.toContain(HASH);
  });

  it('pedir un cambio lo muestra y NO escribe nada hasta confirmar; al confirmar conserva lo demás', async () => {
    await c.di({ texto: 'abro martes y miércoles de 9 a 6 y acepto tarjeta' });
    expect(ultimo(c.enviados)).toMatch(/Voy a cambiar en \*Dulce\*[\s\S]*Formas de pago: Tarjeta, Efectivo[\s\S]*Martes: 09:00-18:00[\s\S]*\[guardar,cancelar\]/);
    expect(c.bd.tiendas.t1.horario.Martes).toBeUndefined();
    await c.boton('guardar');
    expect(ultimo(c.enviados)).toMatch(/ya quedó guardado/);
    expect(c.bd.tiendas.t1.horario.Martes).toEqual({ inicio: '09:00', fin: '18:00' });
    expect(c.bd.tiendas.t1.horario.Lunes).toEqual({ inicio: '09:00', fin: '18:00' }); // intacto
    expect(c.bd.tiendas.t1.metodosPago).toEqual(['Tarjeta', 'Efectivo']);
    expect(c.bd.tiendas.t1.password).toBe(HASH);
  });

  it('cancelar descarta el cambio', async () => {
    await c.di({ texto: 'abro martes de 9 a 6' });
    await c.boton('cancelar');
    expect(c.bd.tiendas.t1.horario.Martes).toBeUndefined();
  });

  it('lo prohibido jamás se escribe aunque la IA lo proponga: contraseña, celular, nombre, estado, membresía', async () => {
    const x = montar({ admin: () => ({ accion: 'editar_perfil', cambios: { password: 'nueva', telefono: '8100000000', nombreTienda: 'Hackeada', estatus: 'bloqueada', membresia: { vigenteHasta: '2099-01-01' }, descripcion: 'Rica repostería' }, noPermitido: ['cambiar la contraseña'] }) });
    await x.entrar();
    await x.di({ texto: 'cambia mi contraseña y mi descripción' });
    expect(ultimo(x.enviados)).toMatch(/Descripción: Rica repostería[\s\S]*no se cambian por aquí/);
    expect(ultimo(x.enviados)).not.toMatch(/Hackeada|nueva|8100000000/);
    await x.boton('guardar');
    const t = x.bd.tiendas.t1;
    expect(t).toMatchObject({ descripcion: 'Rica repostería', password: HASH, telefono: '8111111111', nombreTienda: 'Dulce', estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } });
  });

  it('si no hay nada aplicable, lo dice y da ejemplos', async () => {
    const x = montar({ admin: () => ({ accion: 'editar_perfil', cambios: { horario: [{ dia: 'Lunes', inicio: '25:00', fin: '26:00' }] } }) });
    await x.entrar();
    await x.di({ texto: 'abro de 25 a 26' });
    expect(ultimo(x.enviados)).toMatch(/No encontré un cambio que pueda aplicar[\s\S]*Ejemplos/);
  });

  it('un mensaje que no es ni dato ni cambio muestra qué puede hacer', async () => {
    const x = montar();
    await x.entrar();
    await x.di({ texto: 'blah' });
    expect(ultimo(x.enviados)).toMatch(/Administras \*Dulce\*/);
  });

  it('la foto con la palabra "logo" cambia el logo (no crea un artículo) y solo tras confirmar', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'este es mi logo' });
    expect(ultimo(c.enviados)).toMatch(/\*logo\* de la tienda[\s\S]*\[guardar,cancelar\]/);
    expect(c.subidas()).toBe(0);
    await c.boton('guardar');
    expect(c.bd.tiendas.t1.logoUrl).toBe('https://img/foto1.jpg');
    expect(c.bd.articulos).toEqual({});
    await c.di({ tipo: 'imagen', mediaId: 'i2', texto: 'portada nueva' });
    await c.boton('guardar');
    expect(c.bd.tiendas.t1.bannerUrl).toBe('https://img/foto2.jpg');
  });

  it('al cambiar el logo o la portada borra la imagen ANTERIOR de Cloudinary, y solo después de guardar la nueva', async () => {
    c.bd.tiendas.t1.logoUrl = 'https://res.cloudinary.com/x/image/upload/v1/viejo-logo.jpg';
    c.bd.tiendas.t1.bannerUrl = 'https://res.cloudinary.com/x/image/upload/v1/vieja-portada.jpg';
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'nuevo logo' });
    expect(c.borradas).toHaveLength(0); // sin confirmar no se toca nada
    await c.boton('guardar');
    expect(c.borradas).toHaveLength(1);
    expect(c.borradas[0].urls).toEqual(['https://res.cloudinary.com/x/image/upload/v1/viejo-logo.jpg']);
    expect(c.borradas[0].logoAlBorrar).toBe('https://img/foto1.jpg'); // ya estaba guardado el nuevo cuando se borró el viejo
    await c.di({ tipo: 'imagen', mediaId: 'i2', texto: 'portada' });
    await c.boton('guardar');
    expect(c.borradas[1].urls).toEqual(['https://res.cloudinary.com/x/image/upload/v1/vieja-portada.jpg']);
    // la portada nueva no toca el logo
    expect(c.bd.tiendas.t1.logoUrl).toBe('https://img/foto1.jpg');
  });

  it('si la tienda no tenía logo, no hay nada que borrar', async () => {
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'logo' });
    await c.boton('guardar');
    expect(c.bd.tiendas.t1.logoUrl).toBe('https://img/foto1.jpg');
    expect(c.borradas).toHaveLength(0);
  });

  it('si el borrado en Cloudinary falla, el cambio se guarda igual', async () => {
    c.bd.tiendas.t1.logoUrl = 'https://res.cloudinary.com/x/image/upload/v1/viejo.jpg';
    c.fallarBorrado();
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'logo' });
    await c.boton('guardar');
    expect(ultimo(c.enviados)).toMatch(/ya quedó guardado/);
    expect(c.bd.tiendas.t1.logoUrl).toBe('https://img/foto1.jpg');
  });

  it('un cambio de texto (horario, pagos…) no borra ninguna imagen', async () => {
    c.bd.tiendas.t1.logoUrl = 'https://res.cloudinary.com/x/image/upload/v1/logo.jpg';
    await c.di({ texto: 'abro martes de 9 a 6' });
    await c.boton('guardar');
    expect(c.borradas).toHaveLength(0);
  });
});

describe('sesión que dura hasta el fin del día', () => {
  let c: ReturnType<typeof montar>;
  beforeEach(async () => { c = montar(); await c.boton('rol_tienda'); await c.di({ texto: 'secreto1' }); });

  it('durante el día no vuelve a pedir contraseña, aunque pasen muchas horas', async () => {
    c.avanzar(9 * 60); // 21:00 en México, todavía el mismo día
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/Revisa el artículo/);
  });

  it('al día siguiente caduca y hay que entrar otra vez', async () => {
    c.avanzar(13 * 60); // 01:00 del día siguiente en México
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/sesión de ayer caducó/);
    expect(c.bd.articulos).toEqual({});
    expect(c.bd.whatsappSesiones).toEqual({}); // y se borra lo guardado
    await c.entrar();
    expect(ultimo(c.enviados)).toMatch(/Listo, entraste a \*Dulce\*/);
  });

  it('a las 23:59 todavía vale y pasada la medianoche ya no', async () => {
    c.avanzar(11 * 60 + 59); // 23:59
    await c.di({ texto: 'mi tienda' });
    expect(ultimo(c.enviados)).not.toMatch(/caducó/);
    c.avanzar(2); // 00:01
    await c.di({ texto: 'mi tienda' });
    expect(ultimo(c.enviados)).toMatch(/caducó/);
  });

  it('si Render se duerme o reinicia, el mismo día entra SIN contraseña (la sesión quedó guardada)', async () => {
    expect(Object.keys(c.bd.whatsappSesiones)).toEqual([clave(TEL)]);
    c.reiniciar();
    await c.di({ texto: 'hola' });
    expect(ultimo(c.enviados)).toMatch(/Tienes sesión abierta hoy como \*Dulce\*/);
    await c.boton('rol_tienda');
    expect(ultimo(c.enviados)).toMatch(/Sesión de hoy activa[\s\S]*Administras \*Dulce\*/);
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    await c.boton('guardar');
    expect(c.bd.articulos.art1.tiendaId).toBe('t1');
  });

  it('reiniciar al día siguiente NO recupera la sesión de ayer', async () => {
    c.reiniciar();
    c.avanzar(13 * 60);
    await c.di({ texto: 'hola' });
    await c.boton('rol_tienda');
    expect(ultimo(c.enviados)).toMatch(/contraseña de tu tienda/);
  });

  it('"salir" cierra la sesión y borra lo guardado', async () => {
    await c.di({ texto: 'salir' });
    expect(ultimo(c.enviados)).toMatch(/Sesión cerrada/);
    expect(c.bd.whatsappSesiones).toEqual({});
    c.reiniciar();
    await c.boton('rol_tienda');
    expect(ultimo(c.enviados)).toMatch(/contraseña de tu tienda/);
  });

  it('"salir" de verdad cierra: volver a entrar el mismo día pide la contraseña (sin reiniciar el servidor)', async () => {
    await c.di({ texto: 'salir' });
    await c.boton('rol_tienda');
    expect(ultimo(c.enviados)).toMatch(/contraseña de tu tienda/);
    expect(c.enviados.slice(-2).join('\n')).not.toMatch(/Sesión de hoy activa/);
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' }); // la foto es tomada como contraseña, no publica
    expect(c.bd.articulos).toEqual({});
  });

  it('un cliente con sesión abierta puede cambiar a modo cliente y volver sin contraseña', async () => {
    await c.boton('rol_cliente');
    await c.di({ texto: 'quiero pasteles' });
    expect(c.respuestasCliente).toHaveLength(1);
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/Como cliente solo puedo/);
    await c.boton('rol_tienda');
    expect(ultimo(c.enviados)).toMatch(/Sesión de hoy activa/);
  });

  it('INTENTOS DE SALTARSE EL LOGIN: registros guardados falsos, copiados o de otro dueño no sirven', async () => {
    const atacante = '5218100000000';
    const hoy = diaMx(HOY.getTime());
    const antes = c.enviados.length; // lo anterior es el login legítimo de la tienda
    // 1) fabricado a mano en la base (que acepta escrituras abiertas) con firma inventada
    c.bd.whatsappSesiones[clave(atacante)] = { tiendaId: 't1', dia: hoy, firma: 'a'.repeat(64) };
    await c.di({ texto: 'hola' }, atacante);
    await c.boton('rol_tienda', atacante);
    expect(ultimo(c.enviados)).toMatch(/no tiene una tienda registrada/); // ni siquiera es dueño; no entró
    expect(c.enviados.slice(antes).join('\n')).not.toMatch(/entraste a|Sesión de hoy activa/);
    // 2) copiar el registro VÁLIDO de la víctima a la clave del atacante
    c.bd.whatsappSesiones[clave(atacante)] = { ...c.bd.whatsappSesiones[clave(TEL)] };
    c.reiniciar();
    await c.boton('rol_tienda', atacante);
    expect(c.enviados.slice(antes).join('\n')).not.toMatch(/Sesión de hoy activa|entraste a/);
    expect(c.bd.articulos).toEqual({});
  });

  it('si el celular ya no es el dueño de la tienda, la sesión guardada no vale', async () => {
    c.bd.tiendas.t1.telefono = '8177777777';
    c.reiniciar();
    await c.boton('rol_tienda');
    expect(c.enviados.join('\n')).not.toMatch(/Sesión de hoy activa/);
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
      cerebro: { extraerArticulo: async () => ({}), responderCliente: async () => 'Hola cliente', interpretarAdmin: async () => ({ accion: 'otro' }) },
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
    const s = await levantar(ENV, { enviarTexto: async (_a: string, t: string) => { dichos.push(t); }, enviarBotones: async (_a: string, t: string) => { dichos.push(t); }, descargarImagen: async () => ({ mime: '', bytes: Buffer.from('') }) });
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'dup1', from: '5218122222222', type: 'text', text: { body: 'quiero pasteles' } }] } }] }] });
    const post = (firma: string) => fetch(`${s.base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': firma }, body: cuerpo });
    expect((await post('sha256=falsa')).status).toBe(401);
    expect((await post(firmar(cuerpo))).status).toBe(200);
    expect((await post(firmar(cuerpo))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(dichos).toHaveLength(1);
    expect(dichos[0]).toMatch(/Soy cliente/); // lo primero que se pregunta
    s.cerrar();
  });
});
