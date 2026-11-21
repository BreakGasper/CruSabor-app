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
  buscarCatalogo, construirArticulo, diaMx, momentoMx, validarCambiosPerfil, tiendaPublica, resumenTienda, respuestaSinIA,
  MAX_MENSAJES_POR_VENTANA,
} from '../src/services/asistente/logica.ts';
import { crearAgente } from '../src/services/asistente/agente.ts';
import { crearRouterWhatsapp, variablesFaltantes } from '../src/services/whatsapp/router.ts';
import { mensajesDelAviso, crearCanalMeta } from '../src/services/whatsapp/meta.ts';
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

describe('canal de Meta', () => {
  it('registra desde qué número sale la respuesta (solo los últimos 4 dígitos) y nunca el token', async () => {
    const logs: string[] = [];
    const llamadas: string[] = [];
    const fetchFn = (async (url: string) => { llamadas.push(url); return new Response('{}', { status: 200 }); }) as any;
    const canal = crearCanalMeta({ token: 'TOKEN-SECRETO', phoneNumberId: '1436909166179242', fetchFn, log: (...a) => logs.push(a.join(' ')) });
    await canal.enviarTexto('5218111111111', 'hola');
    expect(llamadas[0]).toContain('/1436909166179242/messages');
    expect(logs).toEqual(['WhatsApp: respuesta enviada desde el número con identificador …9242']);
    expect(logs.join()).not.toMatch(/TOKEN-SECRETO|1436909166179242/);
  });
});

describe('canal de Meta: errores', () => {
  it('el error de envío dice desde qué número se intentó (últimos 4 dígitos) y no filtra el token', async () => {
    const fetchFn = (async () => new Response('{"error":{"code":131037}}', { status: 400 })) as any;
    const canal = crearCanalMeta({ token: 'TOKEN-SECRETO', phoneNumberId: '1436909166179242', fetchFn, log: () => {} });
    const e: any = await canal.enviarTexto('5218111111111', 'hola').catch((x) => x);
    expect(e.message).toMatch(/WhatsApp envío 400 \(desde el número …9242\): .*131037/);
    expect(e.message).not.toMatch(/TOKEN-SECRETO|1436909166179242/);
  });
});

describe('canal de Meta: números de México (52 con o sin el 1)', () => {
  const montarFalso = (aceptado: string) => {
    const destinos: string[] = [];
    const logs: string[] = [];
    const fetchFn = (async (_u: string, init: any) => {
      const to = JSON.parse(init.body).to;
      destinos.push(to);
      return to === aceptado
        ? new Response('{}', { status: 200 })
        : new Response('{"error":{"message":"(#131030) Recipient phone number not in allowed list","code":131030,"type":"OAuthException"}}', { status: 400 });
    }) as any;
    return { destinos, logs, canal: crearCanalMeta({ token: 't', phoneNumberId: '1358790853995153', fetchFn, log: (...a) => logs.push(a.join(' ')) }) };
  };

  it('si 521… no está autorizado reintenta con 52… y recuerda cuál sirvió', async () => {
    const { canal, destinos, logs } = montarFalso('528111111111');
    await canal.enviarTexto('5218111111111', 'hola');
    expect(destinos).toEqual(['5218111111111', '528111111111']);
    expect(logs.join('\n')).toMatch(/otro formato del número de México/);
    await canal.enviarTexto('5218111111111', 'otra');
    expect(destinos.slice(2)).toEqual(['528111111111']); // directo, sin volver a fallar
  });

  it('también al revés (52… → 521…)', async () => {
    const { canal, destinos } = montarFalso('5218111111111');
    await canal.enviarTexto('528111111111', 'hola');
    expect(destinos).toEqual(['528111111111', '5218111111111']);
  });

  it('si ninguno de los dos formatos está autorizado, falla con el error original (solo un reintento)', async () => {
    const { canal, destinos } = montarFalso('nunca');
    const e: any = await canal.enviarTexto('5218111111111', 'hola').catch((x) => x);
    expect(e.message).toMatch(/131030/);
    expect(destinos).toHaveLength(2);
  });

  it('otros errores y números que no son de México no se reintentan', async () => {
    let n = 0;
    const otro = (async () => { n++; return new Response('{"error":{"code":131037}}', { status: 400 }); }) as any;
    await crearCanalMeta({ token: 't', phoneNumberId: '1', fetchFn: otro, log: () => {} }).enviarTexto('5218111111111', 'x').catch(() => {});
    expect(n).toBe(1);
    const { canal, destinos } = montarFalso('nunca');
    await canal.enviarTexto('14155550123', 'x').catch(() => {});
    expect(destinos).toEqual(['14155550123']);
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
  it('"lista de tiendas" y "¿qué tiendas hay?" muestran un listado (antes no encontraban nada)', () => {
    const muchas: any = { ...tiendas, t3: { nombreTienda: 'Abarrotes Lupe', categoria: 'Abarrotes', estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } } };
    for (const pregunta of ['lista de tiendas', '¿qué tiendas hay?', 'todas las tiendas disponibles', 'tiendas']) {
      const r = buscarCatalogo(muchas, arts, pregunta, HOY);
      expect(r.tiendas.map((t) => t.nombre)).toEqual(['Abarrotes Lupe', 'Dulce Hogar']); // ordenadas; la de membresía vencida no aparece
      expect(r.articulos).toEqual([]);
    }
    // con un filtro real sigue buscando normal
    expect(buscarCatalogo(muchas, arts, 'tiendas en Zapopan', HOY).tiendas.map((t) => t.nombre)).toEqual(['Dulce Hogar']);
  });

  it('"¿qué productos tienen?" muestra los artículos más recientes de tiendas que pueden vender', () => {
    const con: any = { ...arts, a1: { ...arts.a1, fecha_hora: '2026-11-01' }, a4: { ...arts.a4, fecha_hora: '2026-11-15' } };
    const r = buscarCatalogo(tiendas, con, 'lista de productos', HOY);
    expect(r.articulos.map((a) => a.nombre)).toEqual(['Galletas', 'Pastel de chocolate']);
    expect(r.tiendas).toEqual([]);
  });

  it('respuestaSinIA: listado de tiendas, y detalle completo cuando es una sola', () => {
    const lista = respuestaSinIA(buscarCatalogo({ ...tiendas, t3: { nombreTienda: 'Abarrotes Lupe', estatus: 'activa', membresia: { vigenteHasta: '2027-01-01' } } } as any, arts, 'lista de tiendas', HOY), 'https://app.test');
    expect(lista).toMatch(/no está disponible[\s\S]*Tiendas[\s\S]*• \*Abarrotes Lupe\*[\s\S]*• \*Dulce Hogar\* — Postres, Zapopan[\s\S]*https:\/\/app\.test/);
    const una = respuestaSinIA(buscarCatalogo(tiendas, arts, 'horario de Dulce Hogar', HOY), 'https://app.test');
    expect(una).toMatch(/Dulce Hogar[\s\S]*Hidalgo 12[\s\S]*3331112222 · WhatsApp[\s\S]*Lun 09:00-18:00[\s\S]*Mar cerrado[\s\S]*Efectivo, Tarjeta[\s\S]*Envío a domicilio: sí/);
    expect(una).not.toContain('HASH-SECRETO');
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
  /** fetch falso: responde según el modelo de la URL y a la lista de modelos */
  const falsoPorModelo = (resp: Record<string, () => Response | Promise<Response>>, lista?: any[]) => {
    const llamadas: string[] = [];
    const fetchFn = (async (url: string) => {
      if (url.includes(':generateContent')) {
        const modelo = /models\/([^:]+):/.exec(url)![1];
        llamadas.push(modelo);
        return resp[modelo] ? resp[modelo]() : new Response('{"error":{"code":404}}', { status: 404 });
      }
      llamadas.push('LISTA');
      return new Response(JSON.stringify({ models: lista ?? [] }), { status: 200 });
    }) as any;
    return { llamadas, fetchFn };
  };
  const ok = (t: string) => () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }), { status: 200 });
  const r503 = () => new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 });
  const timeout = () => { const e: any = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; };
  const modelo = (name: string, metodos = ['generateContent']) => ({ name: `models/${name}`, supportedGenerationMethods: metodos });
  const preguntar = (g: any) => g.responderCliente({ pregunta: 'x', catalogo: { articulos: [], tiendas: [] }, urlApp: 'u' });

  it('si el modelo principal sigue saturado tras los reintentos, prueba otro modelo Flash que Google ofrece', async () => {
    const { llamadas, fetchFn } = falsoPorModelo(
      { 'gemini-3.8-flash': r503, 'gemini-3.7-flash': ok('Respuesta del alterno') },
      [modelo('gemini-3.8-flash'), modelo('gemini-3.7-flash'), modelo('gemini-3.7-flash-image'), modelo('gemini-3.7-flash-tts'), modelo('gemini-embedding-001', ['embedContent']), modelo('gemini-2.0-pro')],
    );
    const g = crearGemini({ llave: 'k', fetchFn, esperar: async () => {} });
    expect(await preguntar(g)).toBe('Respuesta del alterno');
    // 3 intentos al principal, la consulta de modelos y el alterno; sin tocar los de imagen, voz ni embeddings
    expect(llamadas).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'LISTA', 'gemini-3.7-flash']);
  });

  it('un timeout se reintenta una sola vez y luego pasa al otro modelo (cada timeout cuesta 30 s)', async () => {
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': timeout as any, 'gemini-3.7-flash': ok('ya') }, [modelo('gemini-3.7-flash')]);
    const g = crearGemini({ llave: 'k', fetchFn, esperar: async () => {} });
    expect(await preguntar(g)).toBe('ya');
    expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(2);
  });

  it('si el modelo ya no existe (404) pasa al siguiente sin reintentar ni esperar', async () => {
    const esperas: number[] = [];
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.7-flash': ok('del alterno') }, [modelo('gemini-3.7-flash')]);
    const g = crearGemini({ llave: 'k', fetchFn, esperar: async (ms) => { esperas.push(ms); } });
    expect(await preguntar(g)).toBe('del alterno');
    expect(llamadas).toEqual(['gemini-3.8-flash', 'LISTA', 'gemini-3.7-flash']);
    expect(esperas).toEqual([]);
  });

  it('GEMINI_FALLBACK_MODEL fija los alternos a mano (sin consultar la lista)', async () => {
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r503, 'mi-modelo': ok('manual') });
    const g = crearGemini({ llave: 'k', fetchFn, modeloAlterno: 'models/mi-modelo', esperar: async () => {} });
    expect(await preguntar(g)).toBe('manual');
    expect(llamadas).not.toContain('LISTA');
  });

  it('un error de verdad (llave mala, petición inválida) falla de inmediato, sin probar otros modelos', async () => {
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': () => new Response('{"error":{"code":403}}', { status: 403 }) });
    await expect(preguntar(crearGemini({ llave: 'k', fetchFn, esperar: async () => {} }))).rejects.toThrow(/Gemini 403/);
    expect(llamadas).toEqual(['gemini-3.8-flash']);
  });

  it('si todos fallan, el error dice cuál fue el último modelo y si fue por falta de respuesta', async () => {
    const { fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r503, 'gemini-3.7-flash': timeout as any }, [modelo('gemini-3.7-flash')]);
    const e: any = await preguntar(crearGemini({ llave: 'k', fetchFn, esperar: async () => {} })).catch((x: any) => x);
    expect(e.message).toMatch(/^Gemini: sin respuesta en 30 s \(modelo gemini-3\.7-flash\)/);
  });

  it('no sigue intentando indefinidamente: pasado el tiempo total se rinde', async () => {
    let t = 0;
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': () => { t += 50_000; return r503(); } }, [modelo('gemini-3.7-flash')]);
    const e: any = await preguntar(crearGemini({ llave: 'k', fetchFn, esperar: async () => {}, ahoraMs: () => t })).catch((x: any) => x);
    expect(e.message).toMatch(/Gemini 503/);
    expect(llamadas.filter((m) => m !== 'LISTA').length).toBeLessThanOrEqual(2);
  });

  it('una cuota agotada (429) no se reintenta en el mismo modelo: pasa de inmediato a otro, que tiene su propia cuota', async () => {
    const esperas: number[] = [];
    const r429 = () => new Response('{"error":{"code":429,"message":"You exceeded your current quota"}}', { status: 429 });
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429, 'gemini-3.7-flash-lite': ok('con otra cuota') }, [modelo('gemini-3.7-flash-lite')]);
    const g = crearGemini({ llave: 'k', fetchFn, esperar: async (ms) => { esperas.push(ms); } });
    expect(await preguntar(g)).toBe('con otra cuota');
    expect(llamadas).toEqual(['gemini-3.8-flash', 'LISTA', 'gemini-3.7-flash-lite']);
    expect(esperas).toEqual([]);
  });

  it('si todos los modelos tienen la cuota agotada, el error es 429 (para avisar al usuario)', async () => {
    const r429 = () => new Response('{"error":{"code":429}}', { status: 429 });
    const { fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429, 'gemini-3.7-flash': r429 }, [modelo('gemini-3.7-flash')]);
    const e: any = await preguntar(crearGemini({ llave: 'k', fetchFn, esperar: async () => {} })).catch((x: any) => x);
    expect(e.message).toMatch(/^Gemini 429 \(modelo gemini-3\.7-flash\)/);
  });

  it('los alternos se eligen con criterio: primero los "lite" (más cuota) y los más nuevos; nunca omni, imagen, voz ni embeddings', async () => {
    const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': () => new Response('{"error":{"code":404}}', { status: 404 }) }, [
      modelo('gemini-omni-1.2-flash'), modelo('gemini-3.7-flash'), modelo('gemini-3.6-flash-lite'), modelo('gemini-3.7-flash-lite'),
      modelo('gemini-3.7-flash-image'), modelo('gemini-3.7-flash-live'), modelo('gemini-2.0-flash'), modelo('gemini-embedding-001', ['embedContent']),
    ]);
    await preguntar(crearGemini({ llave: 'k', fetchFn, esperar: async () => {} })).catch(() => {});
    expect(llamadas.filter((m) => m !== 'LISTA')).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash-lite', 'gemini-3.6-flash-lite', 'gemini-3.7-flash']);
  });

  describe('límite por minuto (RPM) del nivel gratuito', () => {
    const r429 = (retraso?: string) => () =>
      new Response(JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota', details: retraso ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: retraso }] : [] } }), { status: 429 });
    /** Reloj falso: esperar() lo adelanta, como pasaría de verdad */
    const reloj = () => {
      let t = 1_000_000;
      const esperas: number[] = [];
      return { esperas, ahoraMs: () => t, esperar: async (ms: number) => { esperas.push(ms); t += ms; } };
    };

    it('mientras un modelo está "enfriándose" no se le vuelve a llamar (no gasta cuota ni tiempo)', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429(), 'gemini-3.7-flash-lite': ok('alterno') }, [modelo('gemini-3.7-flash-lite')]);
      const g = crearGemini({ llave: 'k', fetchFn, ...r });
      expect(await preguntar(g)).toBe('alterno');
      expect(await preguntar(g)).toBe('alterno'); // segunda pregunta, dentro del minuto
      expect(await preguntar(g)).toBe('alterno');
      // el principal solo se intentó UNA vez; el resto fue directo al alterno
      expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(1);
      expect(llamadas.filter((m) => m === 'gemini-3.7-flash-lite')).toHaveLength(3);
    });

    it('pasado el enfriamiento (60 s si Google no dice cuánto), el modelo principal vuelve a usarse', async () => {
      const r = reloj();
      let primeraVez = true;
      const { llamadas, fetchFn } = falsoPorModelo(
        { 'gemini-3.8-flash': () => { if (primeraVez) { primeraVez = false; return r429()(); } return ok('principal')(); }, 'gemini-3.7-flash-lite': ok('alterno') },
        [modelo('gemini-3.7-flash-lite')],
      );
      const g = crearGemini({ llave: 'k', fetchFn, ...r });
      expect(await preguntar(g)).toBe('alterno');
      await r.esperar(61_000);
      expect(await preguntar(g)).toBe('principal');
      expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(2);
    });

    it('si TODOS están sin cuota y Google pide esperar poco (retryDelay), espera eso y lo vuelve a intentar', async () => {
      const r = reloj();
      let aprendido = false;
      const { llamadas, fetchFn } = falsoPorModelo(
        { 'gemini-3.8-flash': () => (aprendido ? ok('ya hay cuota')() : r429('12s')()), 'gemini-3.7-flash': () => { aprendido = true; return r429('15s')(); } },
        [modelo('gemini-3.7-flash')],
      );
      const g = crearGemini({ llave: 'k', fetchFn, ...r });
      expect(await preguntar(g)).toBe('ya hay cuota');
      expect(r.esperas).toHaveLength(1);
      expect(r.esperas[0]).toBeGreaterThanOrEqual(12_000); // lo que pidió Google para el primero que se libera
      expect(r.esperas[0]).toBeLessThanOrEqual(13_000);
      expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(2);
    });

    it('si falta mucho para que se libere (más de 25 s), falla enseguida con 429 y SIN esperar ni hacer más llamadas', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429('50s'), 'gemini-3.7-flash': r429('55s') }, [modelo('gemini-3.7-flash')]);
      const g = crearGemini({ llave: 'k', fetchFn, ...r });
      await expect(preguntar(g)).rejects.toThrow(/^Gemini 429/);
      expect(r.esperas).toEqual([]);
      const antes = llamadas.length;
      // la siguiente pregunta, aún dentro del enfriamiento, ni siquiera sale a la red
      await expect(preguntar(g)).rejects.toThrow(/^Gemini 429 \(modelo .*\): cuota por minuto agotada, disponible en \d+ s/);
      expect(llamadas.length).toBe(antes);
    });

    it('un 503 u otro error mezclado no se confunde con falta de cuota (no espera a que se libere)', async () => {
      const r = reloj();
      const { fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429('10s'), 'gemini-3.7-flash': r503 }, [modelo('gemini-3.7-flash')]);
      const e: any = await preguntar(crearGemini({ llave: 'k', fetchFn, ...r })).catch((x: any) => x);
      expect(e.message).toMatch(/^Gemini 503 \(modelo gemini-3\.7-flash\)/);
      expect(r.esperas.every((ms) => ms <= 4_000)).toBe(true); // solo las pausas cortas de los reintentos
    });
  });

  describe('cadena de modelos (GEMINI_MODEL="a,b,c")', () => {
    const r429 = (texto = 'You exceeded your current quota') => () => new Response(JSON.stringify({ error: { code: 429, message: texto } }), { status: 429 });
    const reloj = () => {
      let t = 1_000_000;
      return { ahoraMs: () => t, esperar: async (ms: number) => { t += ms; }, avanzar: (ms: number) => { t += ms; } };
    };

    it('usa los modelos en el orden indicado: cuando a uno se le acaba la cuota sigue con el siguiente, y luego con el otro', async () => {
      const r = reloj();
      const logs: string[] = [];
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429(), 'gemini-2.5-flash-lite': r429(), 'gemini-2.5-flash': ok('el tercero') });
      const g = crearGemini({ llave: 'k', modelo: 'gemini-3.8-flash, gemini-2.5-flash-lite ,models/gemini-2.5-flash', fetchFn, ...r, log: (...a) => logs.push(a.join(' ')) });
      expect(await preguntar(g)).toBe('el tercero');
      expect(llamadas).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']); // sin consultar la lista de Google
      expect(logs.join('\n')).toMatch(/gemini-3\.8-flash agotó su cuota por minuto[\s\S]*gemini-2\.5-flash-lite agotó su cuota por minuto[\s\S]*respondió el modelo gemini-2\.5-flash /);
    });

    it('reparte el trabajo: mientras el principal está apartado, las siguientes preguntas van directo al que sí tiene cuota', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-3.8-flash': r429(), 'gemini-2.5-flash-lite': ok('lite') });
      const g = crearGemini({ llave: 'k', modelo: 'gemini-3.8-flash,gemini-2.5-flash-lite', fetchFn, ...r, log: () => {} });
      for (let i = 0; i < 4; i++) expect(await preguntar(g)).toBe('lite');
      expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(1);
      expect(llamadas.filter((m) => m === 'gemini-2.5-flash-lite')).toHaveLength(4);
      r.avanzar(61_000); // pasó el minuto: el principal vuelve a ser el primero
      await preguntar(g);
      expect(llamadas.filter((m) => m === 'gemini-3.8-flash')).toHaveLength(2);
    });

    it('un modelo con "limit: 0" (no incluido en el plan gratuito) se aparta una hora, no un minuto', async () => {
      const r = reloj();
      const sinPlan = r429('Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.0-flash');
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-2.0-flash': sinPlan, 'gemini-2.5-flash-lite': ok('lite') });
      const g = crearGemini({ llave: 'k', modelo: 'gemini-2.0-flash,gemini-2.5-flash-lite', fetchFn, ...r, log: () => {} });
      await preguntar(g);
      r.avanzar(120_000); // pasaron 2 minutos: un modelo con cuota por minuto ya habría vuelto, este no
      await preguntar(g);
      expect(llamadas.filter((m) => m === 'gemini-2.0-flash')).toHaveLength(1);
      r.avanzar(3_600_000); // pasada la hora, se le da otra oportunidad
      await preguntar(g);
      expect(llamadas.filter((m) => m === 'gemini-2.0-flash')).toHaveLength(2);
    });

    it('un modelo que no existe para la cuenta (404) se aparta una hora y no se vuelve a pedir en cada mensaje', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({ 'gemini-2.5-flash-lite': ok('lite') }); // el resto da 404
      const g = crearGemini({ llave: 'k', modelo: 'gemini-viejo,gemini-2.5-flash-lite', fetchFn, ...r, log: () => {} });
      await preguntar(g);
      await preguntar(g);
      await preguntar(g);
      expect(llamadas.filter((m) => m === 'gemini-viejo')).toHaveLength(1);
    });

    it('si ningún modelo de la cadena está disponible, falla enseguida y dice por qué', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({});
      const g = crearGemini({ llave: 'k', modelo: 'a-viejo,b-viejo', fetchFn, ...r, log: () => {} });
      await expect(preguntar(g)).rejects.toThrow(/^Gemini 404 \(modelo b-viejo\)/);
      const antes = llamadas.length;
      await expect(preguntar(g)).rejects.toThrow(/^Gemini 404 \(modelo b-viejo\): no disponible para esta cuenta/);
      expect(llamadas.length).toBe(antes); // la segunda vez ni sale a la red
    });

    it('la cadena de GEMINI_MODEL y GEMINI_FALLBACK_MODEL se suman sin repetir', async () => {
      const r = reloj();
      const { llamadas, fetchFn } = falsoPorModelo({ 'c': ok('c') });
      const g = crearGemini({ llave: 'k', modelo: 'a,b', modeloAlterno: 'b,c', fetchFn, ...r, log: () => {} });
      expect(await preguntar(g)).toBe('c');
      expect(llamadas).toEqual(['a', 'b', 'c']);
    });
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

function montar(extra: { tiendas?: any; extraerCrudo?: any; admin?: (texto: string) => any; sinBotones?: boolean } = {}) {
  const bd: Record<string, any> = {
    tiendas: extra.tiendas ?? { t1: tiendaBase() },
    categorias: { c1: { id: 'c1', nombre: 'Postres' } },
    articulos: {},
  };
  const enviados: string[] = [];
  const logs: string[] = [];
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
  const canal: any = {
      enviarTexto: async (_a, t) => { enviados.push(t); },
      enviarBotones: async (_a, t, b) => {
        if (extra.sinBotones) throw new Error('WhatsApp envío 400: interactive no permitido');
        botones.push(b.map((x) => x.id)); enviados.push(t + ' [' + b.map((x) => x.id).join(',') + ']');
      },
      descargarImagen: async () => ({ mime: 'image/jpeg', bytes: Buffer.from('foto') }),
  };
  const cerebro: any = {
      extraerArticulo: async ({ texto, borradorActual }) =>
        extra.extraerCrudo ?? (borradorActual ? { ...borradorActual, precio: Number(texto.match(/\d+/)?.[0]) } : { nombre: 'Pastel de chocolate', precio: 350, categoriaId: 'c1' }),
      responderCliente: async (a) => { respuestasCliente.push(a); return `Encontré ${a.catalogo.articulos.length} artículo(s)`; },
      interpretarAdmin: async ({ texto }) => (extra.admin ? extra.admin(texto) : { accion: 'otro' }),
  };
  const crear = () => crearAgente({
    canal,
    cerebro,
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
    log: (...a) => { logs.push(a.join(' ')); },
  });
  let agente = crear();
  let n = 0;
  const di = (m: any, de = TEL) => agente.procesar({ id: 'x' + n++, de, tipo: 'texto', texto: '', ...m });
  const boton = (id: string, de = TEL) => di({ tipo: 'boton', texto: id }, de);
  const entrar = async (de = TEL) => { await di({ texto: 'entrar' }, de); await di({ texto: 'secreto1' }, de); };
  return {
    bd, enviados, logs, botones, respuestasCliente, di, boton, entrar, canal, cerebro,
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

describe('registros de diagnóstico (sin contenido ni números)', () => {
  it('dice en qué paso quedó cada mensaje y no filtra textos, contraseñas ni teléfonos', async () => {
    const c = montar();
    await c.di({ texto: 'hola' });
    await c.di({ texto: 'soy tienda' });
    await c.di({ texto: 'secreto1' });
    const diag = c.logs.filter((l) => l.startsWith('WhatsApp: mensaje atendido'));
    expect(diag).toHaveLength(3);
    expect(diag[0]).toMatch(/texto; rol=sin elegir; paso=anonimo; \d+ ms/);
    expect(diag[1]).toMatch(/rol=tienda; paso=password/);
    expect(diag[2]).toMatch(/rol=tienda; paso=tienda/);
    const todo = c.logs.join('\n');
    expect(todo).not.toContain('secreto1');
    expect(todo).not.toContain('8111111111');
    expect(todo).not.toContain(TEL);
  });
});

describe('si WhatsApp rechaza los botones, el agente sigue funcionando por texto', () => {
  it('menú, login, artículo y perfil se pueden hacer escribiendo palabras', async () => {
    const c = montar({ sinBotones: true, admin: () => ({ accion: 'editar_perfil', cambios: { descripcion: 'Rica repostería' } }) });
    await c.di({ texto: 'hola' });
    expect(ultimo(c.enviados)).toMatch(/¿Qué quieres hacer\?[\s\S]*Responde \*cliente\* o \*tienda\*/);
    expect(c.logs.some((l) => /no se pudieron enviar los botones/.test(l))).toBe(true);
    await c.di({ texto: 'soy tienda' });
    expect(ultimo(c.enviados)).toMatch(/contraseña de tu tienda/);
    await c.di({ texto: 'secreto1' });
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(c.enviados)).toMatch(/Revisa el artículo[\s\S]*Responde \*sí\* para publicar o \*no\* para descartar/);
    await c.di({ texto: 'sí' });
    expect(c.bd.articulos.art1).toMatchObject({ nombre: 'Pastel de chocolate', tiendaId: 't1' });
    await c.di({ texto: 'mi descripción es rica repostería' });
    expect(ultimo(c.enviados)).toMatch(/Responde \*sí\* para guardar o \*no\* para cancelar/);
    await c.di({ texto: 'sí' });
    expect(c.bd.tiendas.t1.descripcion).toBe('Rica repostería');
  });

  it('después de "menú", responder por texto "cliente" funciona aunque ya hubiera un rol elegido', async () => {
    const c = montar({ sinBotones: true });
    await c.di({ texto: 'hola' });
    await c.di({ texto: 'tienda' });
    await c.di({ texto: 'secreto1' });
    await c.di({ texto: 'menú' });
    await c.di({ texto: 'cliente' });
    expect(ultimo(c.enviados)).toMatch(/Modo cliente/);
    await c.di({ texto: 'menú' });
    await c.di({ texto: 'tienda' });
    expect(ultimo(c.enviados)).toMatch(/Sesión de hoy activa/);
  });
});

describe('IA saturada o foto que no se puede descargar', () => {
  it('avisa que leerá la foto; si la IA falla lo dice con claridad y "reintentar" repite con la misma foto', async () => {
    let falla = true;
    const x = montar();
    // El cerebro de prueba se reemplaza: falla una vez y luego responde
    const original = x.cerebro.extraerArticulo;
    x.cerebro.extraerArticulo = async (a: any) => { if (falla) { falla = false; throw new Error('Gemini: sin respuesta en 30 s (modelo gemini-3.8-flash)'); } return original(a); };
    await x.entrar();
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel de chocolate $350' });
    expect(x.enviados.some((t) => /Recibí tu foto, estoy leyendo los datos/.test(t))).toBe(true);
    expect(ultimo(x.enviados)).toMatch(/inteligencia artificial está saturado[\s\S]*Escribe \*reintentar\*/);
    expect(x.bd.articulos).toEqual({});
    await x.di({ texto: 'reintentar' });
    expect(ultimo(x.enviados)).toMatch(/Revisa el artículo[\s\S]*Pastel de chocolate/);
    await x.boton('guardar');
    expect(x.bd.articulos.art1).toMatchObject({ nombre: 'Pastel de chocolate', tiendaId: 't1' });
  });

  it('sin foto, el aviso de IA saturada no promete "reintentar"', async () => {
    const x = montar();
    x.cerebro.interpretarAdmin = async () => { throw new Error('Gemini 503 (modelo x): demanda'); };
    await x.entrar();
    await x.di({ texto: 'abro de lunes a viernes' });
    expect(ultimo(x.enviados)).toMatch(/saturado[\s\S]*Inténtalo de nuevo en unos minutos/);
    expect(ultimo(x.enviados)).not.toMatch(/reintentar/);
  });

  it('si no se puede descargar la foto de WhatsApp, lo dice y lo registra (sin tumbar nada)', async () => {
    const x = montar();
    x.canal.descargarImagen = async () => { throw new Error('The operation was aborted due to timeout'); };
    await x.entrar();
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(x.enviados)).toMatch(/No pude descargar tu foto/);
    expect(x.logs.some((l) => /no se pudo descargar la foto/.test(l))).toBe(true);
    expect(x.bd.articulos).toEqual({});
  });
});

describe('cuando la IA no está disponible', () => {
  it('un cliente que pide la lista de tiendas recibe la lista aunque Gemini esté sin cuota', async () => {
    const x = montar({ tiendas: { t1: tiendaBase({ nombreTienda: 'Dulce', municipio: 'Zapopan' }), t2: tiendaBase({ nombreTienda: 'Ropa Bonita', telefono: '8122222222' }) } });
    x.cerebro.responderCliente = async () => { throw new Error('Gemini 429 (modelo gemini-3.7-flash): You exceeded your current quota'); };
    await x.boton('rol_cliente');
    await x.di({ texto: 'lista de tiendas' });
    expect(ultimo(x.enviados)).toMatch(/no está disponible[\s\S]*• \*Dulce\*[\s\S]*• \*Ropa Bonita\*/);
    expect(x.logs.some((l) => /se contesta sin IA/.test(l))).toBe(true);
    expect(x.enviados.join('\n')).not.toMatch(/Tuve un problema/);
  });

  it('si no hay nada que mostrar y la IA no está, avisa que se agotó la cuota (sin culpar a otra cosa)', async () => {
    const x = montar();
    x.cerebro.responderCliente = async () => { throw new Error('Gemini 429 (modelo gemini-3.7-flash): You exceeded your current quota'); };
    await x.boton('rol_cliente');
    await x.di({ texto: 'zzz algo que no existe' });
    expect(ultimo(x.enviados)).toMatch(/Se agotó el uso gratuito de mi inteligencia artificial/);
  });

  it('para la tienda con una foto, el aviso de cuota ofrece "reintentar"', async () => {
    const x = montar();
    x.cerebro.extraerArticulo = async () => { throw new Error('Gemini 429 (modelo gemini-3.7-flash): quota'); };
    await x.entrar();
    await x.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    expect(ultimo(x.enviados)).toMatch(/Se agotó el uso gratuito[\s\S]*Escribe \*reintentar\*/);
  });
});

describe('mensajes largos con botones', () => {
  it('un resumen de más de ~1000 caracteres va como texto y los botones solo llevan la pregunta', async () => {
    const largo = 'x'.repeat(600);
    const c = montar({ extraerCrudo: { nombre: 'N'.repeat(80), precio: 350, descripcion: largo, marca: largo, color: largo, tamano: largo, material: largo } });
    await c.entrar();
    await c.di({ tipo: 'imagen', mediaId: 'i1', texto: 'Pastel $350' });
    const ultimos = c.enviados.slice(-2);
    expect(ultimos[0]).toMatch(/Revisa el artículo/);
    expect(ultimos[0].length).toBeGreaterThan(900);
    expect(ultimos[1]).toMatch(/^👆 ¿Qué hago\? \[guardar,cancelar\]$/);
    await c.boton('guardar');
    expect(c.bd.articulos.art1).toBeDefined();
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
