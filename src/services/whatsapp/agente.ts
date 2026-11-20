/**
 * Agente de WhatsApp: la conversación (máquina de estados por número).
 *
 *   anónimo ──"entrar"──▶ esperando contraseña ──ok──▶ (elige tienda) ──▶ tienda
 *   tienda ──foto + datos──▶ confirmando ──"sí"──▶ artículo publicado ──▶ tienda
 *
 * Seguridad:
 *  - Para publicar hace falta el MISMO login que la app: el celular de WhatsApp tiene que ser el
 *    de la tienda Y la contraseña (hash bcrypt en tiendas/{id}/password) tiene que coincidir.
 *  - 5 contraseñas malas bloquean ese número 15 minutos; la sesión caduca a los 30 minutos.
 *  - Nada se publica sin que la tienda confirme el resumen. La IA solo propone datos, y todo lo
 *    que devuelve se valida (logica.ts) antes de mostrarse o guardarse.
 *  - La IA no tiene herramientas ni acceso a la base: solo recibe texto y devuelve texto/JSON.
 *
 * Las sesiones viven en memoria (como los códigos de recuperación): si el servidor se reinicia,
 * se vuelve a entrar. Todo lo externo (WhatsApp, IA, base, Cloudinary) se inyecta para probarlo.
 */
import bcrypt from 'bcryptjs';
import type { Almacen } from '../pagos/almacen.ts';
import type { Cerebro, Imagen } from './gemini.ts';
import type { Canal, MensajeEntrante } from './meta.ts';
import {
  MAX_BYTES_IMAGEN,
  MAX_INTENTOS_PASSWORD,
  MIMES_IMAGEN,
  MINUTOS_BLOQUEO,
  buscarCatalogo,
  comandoDe,
  construirArticulo,
  diezDigitos,
  esNo,
  esSi,
  permitirMensaje,
  resumenBorrador,
  sesionVigente,
  soloDigitos,
  tienePermisoPublicar,
  validarBorrador,
  type Borrador,
  type CategoriaLite,
} from './logica.ts';

type Estado = 'anonimo' | 'password' | 'eligiendo' | 'tienda' | 'confirmando';
interface TiendaSesion {
  id: string;
  nombreTienda: string;
}
interface Sesion {
  estado: Estado;
  ultima: number;
  intentos: number;
  bloqueadoHasta: number;
  marcas: number[];
  candidatas: (TiendaSesion & { password?: string })[];
  tienda?: TiendaSesion;
  borrador?: Borrador;
  imagen?: { mime: string; bytes: Buffer };
  textos: string[];
  ocupado: boolean;
}

export interface DepsAgente {
  canal: Canal;
  cerebro: Cerebro;
  almacen: () => Promise<Almacen>;
  /** Sube la foto (Cloudinary) y devuelve la URL pública */
  subirImagen: (bytes: Buffer, mime: string) => Promise<string>;
  urlApp: string;
  ahora?: () => Date;
  sku?: () => string;
  comparar?: (password: string, hash: string) => Promise<boolean>;
  sesiones?: Map<string, Sesion>;
  log?: (...a: any[]) => void;
}

const AYUDA =
  '👋 ¡Hola! Soy el asistente de *Crustore*.\n\n' +
  '🛒 *Clientes:* pregúntame por productos o tiendas (ej. "¿tienen pasteles en Guadalajara?").\n' +
  '🏪 *Tiendas:* escribe *entrar* para iniciar sesión y publicar artículos mandándome una foto con nombre, precio y detalles.';

const nuevaSesion = (): Sesion => ({
  estado: 'anonimo',
  ultima: 0,
  intentos: 0,
  bloqueadoHasta: 0,
  marcas: [],
  candidatas: [],
  textos: [],
  ocupado: false,
});

function generarSku() {
  return `CRU-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

export function crearAgente(deps: DepsAgente) {
  const sesiones = deps.sesiones ?? new Map<string, Sesion>();
  const ahora = deps.ahora ?? (() => new Date());
  const comparar = deps.comparar ?? ((p, h) => bcrypt.compare(p, h));
  const sku = deps.sku ?? generarSku;
  const log = deps.log ?? console.log;
  const cola = new Map<string, Promise<void>>();
  const decir = (a: string, t: string) => deps.canal.enviarTexto(a, t);

  let cache: { en: number; tiendas: any; articulos: any } | null = null;
  async function catalogo() {
    if (cache && ahora().getTime() - cache.en < 120_000) return cache;
    const a = await deps.almacen();
    cache = { en: ahora().getTime(), tiendas: await a.leer('tiendas'), articulos: await a.leer('articulos') };
    return cache;
  }

  async function categorias(): Promise<CategoriaLite[]> {
    const crudo = (await (await deps.almacen()).leer('categorias')) as Record<string, any> | null;
    return Object.entries(crudo ?? {})
      .filter(([, c]) => c && typeof c === 'object')
      .map(([id, c]) => ({ id: String(c.id ?? id), nombre: String(c.nombre ?? ''), padreId: c.padreId || undefined }));
  }

  /* ---------- login ---------- */

  async function iniciarLogin(de: string, s: Sesion) {
    const tel = diezDigitos(de);
    const todas = ((await (await deps.almacen()).leer('tiendas')) ?? {}) as Record<string, any>;
    const mias = Object.entries(todas)
      .filter(([, t]) => t && typeof t === 'object' && soloDigitos(t.telefono) === tel && t.password)
      .map(([id, t]) => ({ id, nombreTienda: String(t.nombreTienda ?? 'Tienda'), password: String(t.password) }));
    if (!mias.length) {
      return decir(de, `Este número no tiene una tienda registrada. Regístrala en ${deps.urlApp} con este mismo celular y luego escribe *entrar*.`);
    }
    s.candidatas = mias;
    s.estado = 'password';
    await decir(
      de,
      '🔐 Escribe la *contraseña de tu tienda* (la misma de la app).\n\nPor seguridad, después *elimina ese mensaje* del chat (mantén pulsado → Eliminar). Para salir escribe *cancelar*.',
    );
  }

  async function revisarPassword(de: string, s: Sesion, password: string) {
    if (ahora().getTime() < s.bloqueadoHasta) {
      return decir(de, `⛔ Demasiados intentos. Vuelve a intentar en unos minutos.`);
    }
    const validas: typeof s.candidatas = [];
    for (const t of s.candidatas) if (await comparar(password.trim(), t.password ?? '')) validas.push(t);

    if (!validas.length) {
      s.intentos += 1;
      if (s.intentos >= MAX_INTENTOS_PASSWORD) {
        s.bloqueadoHasta = ahora().getTime() + MINUTOS_BLOQUEO * 60_000;
        s.intentos = 0;
        s.estado = 'anonimo';
        s.candidatas = [];
        return decir(de, `⛔ Contraseña incorrecta demasiadas veces. Este número queda bloqueado ${MINUTOS_BLOQUEO} minutos.`);
      }
      return decir(de, `Contraseña incorrecta (${s.intentos}/${MAX_INTENTOS_PASSWORD}). Inténtalo otra vez o escribe *cancelar*.`);
    }

    s.intentos = 0;
    s.candidatas = validas;
    if (validas.length > 1) {
      s.estado = 'eligiendo';
      return decir(de, '¿Qué tienda vas a administrar? Responde con el número:\n' + validas.map((t, i) => `${i + 1}. ${t.nombreTienda}`).join('\n'));
    }
    return entrarATienda(de, s, validas[0]);
  }

  async function entrarATienda(de: string, s: Sesion, t: TiendaSesion) {
    s.tienda = { id: t.id, nombreTienda: t.nombreTienda };
    s.candidatas = [];
    s.estado = 'tienda';
    const tienda = ((await (await deps.almacen()).leer(`tiendas/${t.id}`)) ?? {}) as any;
    const aviso = tienePermisoPublicar(tienda, ahora())
      ? ''
      : '\n\n⚠️ Tu tienda no tiene membresía vigente o no está activa: podrás preparar artículos, pero no publicarlos hasta renovarla en la app.';
    await decir(
      de,
      `✅ Listo, entraste a *${t.nombreTienda}*.\n\n📸 Mándame una *foto* del artículo y, en el mismo mensaje, escribe nombre, precio y detalles (marca, color, tamaño, existencias…). Te muestro el resumen y, si lo confirmas, lo publico.\n\nPara salir escribe *salir*.${aviso}`,
    );
  }

  /* ---------- captura de artículos ---------- */

  async function proponer(de: string, s: Sesion, texto: string, imagen?: Imagen, borradorActual?: Borrador) {
    const cats = await categorias();
    const crudo = await deps.cerebro.extraerArticulo({ texto, imagen, categorias: cats, borradorActual });
    const v = validarBorrador(crudo, cats);
    if (!v.ok) {
      return decir(de, `No pude leer ${v.falta.join(' ni ')}. Escríbelo (ej. "Pastel de chocolate, $350") y lo vuelvo a intentar con la misma foto.`);
    }
    s.borrador = v.borrador;
    s.estado = 'confirmando';
    await deps.canal.enviarBotones(de, `Revisa el artículo:\n\n${resumenBorrador(v.borrador, s.tienda!.nombreTienda)}\n\n¿Lo publico? (también puedes escribirme un cambio, ej. "el precio es 120")`, [
      { id: 'guardar', titulo: '✅ Publicar' },
      { id: 'cancelar', titulo: '❌ Descartar' },
    ]);
  }

  async function recibirFoto(de: string, s: Sesion, m: MensajeEntrante) {
    const img = await deps.canal.descargarImagen(m.mediaId!);
    if (!MIMES_IMAGEN.includes(img.mime) || img.bytes.length > MAX_BYTES_IMAGEN) {
      return decir(de, 'Mándame la foto como JPG, PNG o WebP de máximo 5 MB.');
    }
    s.imagen = img;
    s.textos = m.texto ? [m.texto] : [];
    await proponer(de, s, m.texto, { mime: img.mime, base64: img.bytes.toString('base64') });
  }

  async function publicar(de: string, s: Sesion) {
    if (!s.borrador || !s.imagen || !s.tienda) return decir(de, 'No hay ningún artículo pendiente. Mándame una foto.');
    const a = await deps.almacen();
    const tienda = ((await a.leer(`tiendas/${s.tienda.id}`)) ?? {}) as any;
    if (!tienePermisoPublicar(tienda, ahora())) {
      return decir(de, '⚠️ Tu tienda no tiene membresía vigente o no está activa, así que no puedo publicar. Renueva en la app y vuelve a confirmar.');
    }
    s.ocupado = true;
    try {
      const url = await deps.subirImagen(s.imagen.bytes, s.imagen.mime);
      const id = a.nuevoId('articulos');
      await a.actualizar({ [`articulos/${id}`]: construirArticulo(s.borrador, s.tienda, url, ahora(), sku()) });
      log(`WhatsApp: artículo ${id} publicado en la tienda ${s.tienda.id}`);
      cache = null;
      const nombre = s.borrador.nombre;
      s.borrador = undefined;
      s.imagen = undefined;
      s.textos = [];
      s.estado = 'tienda';
      await decir(de, `🎉 *${nombre}* ya está publicado en *${s.tienda.nombreTienda}*. Puedes mandarme otro artículo o escribir *salir*.`);
    } finally {
      s.ocupado = false;
    }
  }

  /* ---------- clientes ---------- */

  async function atenderCliente(de: string, texto: string) {
    const { tiendas, articulos } = await catalogo();
    const encontrado = buscarCatalogo(tiendas, articulos, texto, ahora());
    await decir(de, (await deps.cerebro.responderCliente({ pregunta: texto, catalogo: encontrado, urlApp: deps.urlApp })) || AYUDA);
  }

  /* ---------- entrada ---------- */

  async function manejar(m: MensajeEntrante) {
    const de = m.de;
    const t = ahora().getTime();
    let s = sesiones.get(de) ?? nuevaSesion();
    sesiones.set(de, s);

    const lim = permitirMensaje(s.marcas, t);
    s.marcas = lim.marcas;
    if (!lim.permitido) return decir(de, 'Vas muy rápido 🙂 Espera unos minutos y seguimos.');

    if (s.estado !== 'anonimo' && !sesionVigente(s.ultima, t)) {
      const eraTienda = s.estado === 'tienda' || s.estado === 'confirmando';
      Object.assign(s, nuevaSesion(), { marcas: s.marcas, bloqueadoHasta: s.bloqueadoHasta });
      if (eraTienda) await decir(de, '⌛ Tu sesión caducó por inactividad. Escribe *entrar* para volver a iniciar sesión.');
    }
    s.ultima = t;

    if (m.tipo === 'otro') return decir(de, 'Por ahora solo entiendo mensajes de texto y fotos.');

    const cmd = m.tipo === 'texto' ? comandoDe(m.texto) : m.texto === 'cancelar' ? 'cancelar' : null;
    if (cmd === 'salir') {
      const marcas = s.marcas;
      Object.assign(s, nuevaSesion(), { marcas });
      return decir(de, '👋 Sesión cerrada.');
    }
    if (cmd === 'cancelar' && s.estado !== 'anonimo') {
      if (s.estado === 'confirmando' || s.estado === 'tienda') {
        s.borrador = undefined;
        s.imagen = undefined;
        s.estado = 'tienda';
        return decir(de, 'Descartado. Mándame otra foto cuando quieras, o escribe *salir*.');
      }
      Object.assign(s, nuevaSesion(), { marcas: s.marcas });
      return decir(de, 'Cancelado.');
    }

    switch (s.estado) {
      case 'password':
        if (m.tipo !== 'texto') return decir(de, 'Necesito tu contraseña en texto, o escribe *cancelar*.');
        return revisarPassword(de, s, m.texto);

      case 'eligiendo': {
        const i = Number(soloDigitos(m.texto)) - 1;
        const elegida = s.candidatas[i];
        if (!elegida) return decir(de, 'Responde con el número de la tienda de la lista.');
        return entrarATienda(de, s, elegida);
      }

      case 'tienda':
        if (m.tipo === 'imagen') return recibirFoto(de, s, m);
        if (s.imagen && m.tipo === 'texto') {
          // Faltó un dato: se vuelve a intentar con la foto ya recibida y lo que se ha escrito
          s.textos.push(m.texto);
          return proponer(de, s, s.textos.join('\n'), { mime: s.imagen.mime, base64: s.imagen.bytes.toString('base64') });
        }
        return decir(de, '📸 Mándame una foto del artículo con su nombre y precio en el mensaje. Para salir escribe *salir*.');

      case 'confirmando':
        if (s.ocupado) return decir(de, 'Estoy publicando, un momento…');
        if (m.tipo === 'imagen') return recibirFoto(de, s, m);
        if (m.texto === 'guardar' || esSi(m.texto)) return publicar(de, s);
        if (esNo(m.texto)) {
          s.borrador = undefined;
          s.imagen = undefined;
          s.estado = 'tienda';
          return decir(de, 'Descartado. Mándame otra foto cuando quieras.');
        }
        return proponer(de, s, m.texto, undefined, s.borrador);

      default:
        if (cmd === 'entrar') return iniciarLogin(de, s);
        if (m.tipo === 'imagen') return decir(de, 'Para publicar un artículo primero inicia sesión: escribe *entrar*.');
        if (cmd === 'ayuda') return decir(de, AYUDA);
        return atenderCliente(de, m.texto);
    }
  }

  /** Un mensaje a la vez por número (dos fotos seguidas no se pisan) y sin tumbar el servidor si algo falla */
  function procesar(m: MensajeEntrante): Promise<void> {
    const previo = cola.get(m.de) ?? Promise.resolve();
    const siguiente = previo
      .then(() => manejar(m))
      .catch(async (e) => {
        log('WhatsApp: error al atender un mensaje:', e?.message ?? e);
        const s = sesiones.get(m.de);
        if (s) s.ocupado = false;
        await decir(m.de, 'Tuve un problema para atenderte. Inténtalo de nuevo en un momento.').catch(() => {});
      })
      .finally(() => {
        if (cola.get(m.de) === siguiente) cola.delete(m.de);
      });
    cola.set(m.de, siguiente);
    return siguiente;
  }

  return { procesar, sesiones };
}
