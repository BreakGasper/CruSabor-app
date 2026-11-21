/**
 * Agente de chat (WhatsApp): la conversación, por número.
 *
 * Primero se pregunta "¿eres cliente o tienda?":
 *
 *   CLIENTE ─ consulta artículos, precios, tiendas, horarios, ubicaciones y lo demás que ve en la app.
 *             No puede cambiar nada.
 *   TIENDA ── entra con celular + contraseña (la sesión dura HASTA EL FIN DEL DÍA, hora de México; al día
 *             siguiente hay que entrar otra vez) y SOLO sobre su propia tienda puede:
 *               · publicar artículos (foto + datos)        · ver los datos de su tienda
 *               · cambiar su perfil (horario, pagos, envío, dirección, redes, descripción, logo y portada)
 *             Todo cambio se muestra y exige confirmación antes de escribirse.
 *
 * Seguridad:
 *  - El celular del chat (WhatsApp lo verifica) tiene que ser el de la tienda Y la contraseña (hash bcrypt
 *    en tiendas/{id}/password) tiene que coincidir. 5 contraseñas malas bloquean ese número 15 minutos.
 *  - La tienda sobre la que se escribe sale SIEMPRE de la sesión, nunca de lo que diga el mensaje. Solo se
 *    pueden escribir los campos de CAMPOS_EDITABLES (no contraseña, celular, nombre, estado ni membresía).
 *  - La sesión del día se guarda en la base (whatsappSesiones/) para sobrevivir a que el servidor se duerma o
 *    se reinicie. Como esa base acepta escrituras abiertas, cada registro va FIRMADO (HMAC con un secreto del
 *    servidor): nadie puede fabricar uno para entrar a una tienda sin contraseña.
 *  - La IA no tiene herramientas ni acceso a la base: recibe texto y devuelve texto/JSON, y todo lo que
 *    devuelve se valida (logica.ts) antes de mostrarse o guardarse.
 *
 * Es independiente del canal: cada canal traduce sus avisos a `MensajeEntrante`. Todo lo externo (canal, IA,
 * base, Cloudinary) se inyecta para probarlo.
 */
import bcrypt from 'bcryptjs';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Almacen } from '../pagos/almacen.ts';
import type { Cerebro, Imagen } from './gemini.ts';
import type { Canal, MensajeEntrante } from './canal.ts';
import {
  CAMPOS_EDITABLES,
  MAX_BYTES_IMAGEN,
  MAX_INTENTOS_PASSWORD,
  MIMES_IMAGEN,
  MINUTOS_BLOQUEO,
  buscarCatalogo,
  comandoDe,
  construirArticulo,
  diaMx,
  diezDigitos,
  esNo,
  esSi,
  momentoMx,
  normalizar,
  perfilParaIA,
  permitirMensaje,
  resumenBorrador,
  resumenTienda,
  respuestaSinIA,
  rolDe,
  soloDigitos,
  tienePermisoPublicar,
  validarBorrador,
  validarCambiosPerfil,
  type Borrador,
  type CategoriaLite,
} from './logica.ts';

type Rol = 'cliente' | 'tienda';
type Estado = 'anonimo' | 'password' | 'eligiendo' | 'tienda' | 'confirmando' | 'confirmandoPerfil';
interface TiendaSesion {
  id: string;
  nombreTienda: string;
}
interface PerfilPendiente {
  cambios: Record<string, any>;
  lineas: string[];
  /** Cambio de logo o portada: la foto espera en `imagen` hasta confirmar */
  imagenCampo?: 'logoUrl' | 'bannerUrl';
}
interface Sesion {
  estado: Estado;
  rol?: Rol;
  /** Ya se intentó restaurar la sesión del día guardada en la base */
  cargada: boolean;
  ultima: number;
  intentos: number;
  bloqueadoHasta: number;
  marcas: number[];
  candidatas: (TiendaSesion & { password?: string })[];
  tienda?: TiendaSesion;
  /** Día (México) en que la tienda entró: la sesión vale mientras sea el mismo día */
  dia?: string;
  borrador?: Borrador;
  perfil?: PerfilPendiente;
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
  /** Borra de Cloudinary las imágenes reemplazadas que ya nadie usa. Opcional: sin él, se quedan huérfanas */
  eliminarImagenes?: (urls: string[]) => Promise<unknown>;
  urlApp: string;
  /** Secreto para firmar la sesión guardada. Sin él, la sesión solo vive en memoria */
  secreto?: string;
  ahora?: () => Date;
  sku?: () => string;
  comparar?: (password: string, hash: string) => Promise<boolean>;
  sesiones?: Map<string, Sesion>;
  log?: (...a: any[]) => void;
}

const BOTONES_ROL = [
  { id: 'rol_cliente', titulo: '🛒 Soy cliente' },
  { id: 'rol_tienda', titulo: '🏪 Soy tienda' },
];

const INTRO_CLIENTE =
  '🛒 *Modo cliente.* Pregúntame por productos, precios, tiendas, horarios, ubicaciones, formas de pago o envíos. ' +
  'Por ejemplo: "¿tienen pasteles?" o "¿a qué hora abre Dulce Hogar?".\n\nPara cambiar de opción escribe *menú*.';

const nuevaSesion = (): Sesion => ({
  estado: 'anonimo',
  cargada: false,
  ultima: 0,
  intentos: 0,
  bloqueadoHasta: 0,
  marcas: [],
  candidatas: [],
  textos: [],
  ocupado: false,
});

const generarSku = () => `CRU-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;
const clave = (de: string) => createHash('sha256').update(de).digest('hex').slice(0, 32);

export function crearAgente(deps: DepsAgente) {
  const sesiones = deps.sesiones ?? new Map<string, Sesion>();
  const ahora = deps.ahora ?? (() => new Date());
  const comparar = deps.comparar ?? ((p, h) => bcrypt.compare(p, h));
  const sku = deps.sku ?? generarSku;
  const log = deps.log ?? console.log;
  const secreto = deps.secreto ?? process.env.WHATSAPP_APP_SECRET ?? '';
  const cola = new Map<string, Promise<void>>();
  const decir = (a: string, t: string) => deps.canal.enviarTexto(a, t);
  /**
   * Pregunta con botones; si WhatsApp los rechaza (o falla el envío interactivo), manda la MISMA pregunta como texto
   * y dice qué palabra escribir. El agente entiende las dos formas, así que nunca se queda mudo por un botón.
   */
  async function conBotones(a: string, texto: string, botones: { id: string; titulo: string }[], alterno: string) {
    try {
      if (texto.length > 900) {
        // WhatsApp limita a ~1000 caracteres el texto de un mensaje con botones: el detalle va aparte y los botones llevan solo la pregunta
        await decir(a, texto);
        await deps.canal.enviarBotones(a, '👆 ¿Qué hago?', botones);
        return;
      }
      await deps.canal.enviarBotones(a, texto, botones);
    } catch (e: any) {
      log('WhatsApp: no se pudieron enviar los botones; se manda como texto:', String(e?.message ?? e).slice(0, 200));
      // Si el detalle largo ya salió, solo falta decir cómo contestar
      await decir(a, texto.length > 900 ? alterno : `${texto}\n\n${alterno}`);
    }
  }
  const momento = () => {
    const m = momentoMx(ahora().getTime());
    return `${m.dia} ${m.hora}`;
  };

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

  const leerTienda = async (id: string) => ((await (await deps.almacen()).leer(`tiendas/${id}`)) ?? {}) as any;

  /* ---------- sesión del día (guardada y firmada) ---------- */

  const firmar = (de: string, tiendaId: string, dia: string) => createHmac('sha256', secreto).update(`${de}|${tiendaId}|${dia}`).digest('hex');

  async function guardarSesion(de: string, tiendaId: string, dia: string) {
    if (!secreto) return;
    try {
      await (await deps.almacen()).actualizar({ [`whatsappSesiones/${clave(de)}`]: { tiendaId, dia, firma: firmar(de, tiendaId, dia) } });
    } catch (e: any) {
      log('WhatsApp: no se pudo guardar la sesión del día:', e?.message ?? e);
    }
  }

  async function borrarSesion(de: string) {
    if (!secreto) return;
    try {
      await (await deps.almacen()).actualizar({ [`whatsappSesiones/${clave(de)}`]: null });
    } catch (e: any) {
      log('WhatsApp: no se pudo borrar la sesión guardada:', e?.message ?? e);
    }
  }

  /** Si este número ya entró HOY (y el servidor se reinició o durmió), recupera la sesión sin pedir contraseña */
  async function restaurarSesion(de: string, s: Sesion, hoy: string) {
    if (!secreto) return;
    try {
      const a = await deps.almacen();
      const r = (await a.leer(`whatsappSesiones/${clave(de)}`)) as { tiendaId?: string; dia?: string; firma?: string } | null;
      if (!r?.tiendaId || r.dia !== hoy || !r.firma) return;
      const esperada = Buffer.from(firmar(de, r.tiendaId, r.dia));
      const dada = Buffer.from(String(r.firma));
      if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) {
        log('WhatsApp: sesión guardada con firma inválida (ignorada)');
        return;
      }
      const t = await leerTienda(r.tiendaId);
      // El número tiene que seguir siendo el dueño de la tienda
      if (!t || soloDigitos(t.telefono) !== diezDigitos(de)) return;
      s.tienda = { id: r.tiendaId, nombreTienda: String(t.nombreTienda ?? 'Tienda') };
      s.dia = hoy;
      s.estado = 'tienda';
      s.rol = 'tienda';
    } catch (e: any) {
      log('WhatsApp: no se pudo restaurar la sesión del día:', e?.message ?? e);
    }
  }

  /**
   * Deja la sesión en blanco. Se BORRAN todas las claves antes de reasignar: `Object.assign` solo no basta,
   * porque los campos opcionales (tienda, dia, rol…) no existen en la sesión nueva y se quedarían con su valor.
   */
  function limpiar(s: Sesion) {
    const { marcas, bloqueadoHasta } = s;
    for (const k of Object.keys(s)) delete (s as any)[k];
    Object.assign(s, nuevaSesion(), { marcas, bloqueadoHasta, cargada: true });
  }

  async function cerrarSesion(de: string, s: Sesion) {
    await borrarSesion(de);
    limpiar(s);
  }

  /* ---------- roles y menús ---------- */

  const menuAdmin = (nombre: string) =>
    `🏪 Administras *${nombre}*. Puedo ayudarte con:\n\n` +
    '📸 *Publicar un artículo:* mándame una foto con nombre, precio y detalles en el mismo mensaje.\n' +
    '📋 *Ver los datos de tu tienda:* escribe *mi tienda*.\n' +
    '✏️ *Cambiar tu perfil:* por ejemplo "abro de lunes a viernes de 9 a 6", "acepto tarjeta", "hago envíos a Centro y Zapopan" o "mi descripción es…".\n' +
    '🖼️ *Logo o portada:* manda la foto con la palabra *logo* o *portada*.\n\n' +
    'Tu sesión dura hasta el fin del día. Escribe *salir* para cerrarla o *menú* para cambiar de opción.';

  async function preguntarRol(de: string, s: Sesion) {
    const sesion = s.tienda ? `\n\n(Tienes sesión abierta hoy como *${s.tienda.nombreTienda}*; si eliges tienda, entras sin contraseña.)` : '';
    await conBotones(de, `👋 ¡Hola! Soy el asistente de *Crustore*. ¿Qué quieres hacer?\n\n🛒 *Soy cliente:* consultar artículos, precios, tiendas, horarios y ubicaciones.\n🏪 *Soy tienda:* administrar tu tienda.${sesion}`, BOTONES_ROL, 'Responde *cliente* o *tienda*.');
  }

  async function elegirRol(de: string, s: Sesion, rol: Rol) {
    s.borrador = undefined;
    s.perfil = undefined;
    s.imagen = undefined;
    s.textos = [];
    if (rol === 'cliente') {
      s.rol = 'cliente';
      return decir(de, INTRO_CLIENTE);
    }
    s.rol = 'tienda';
    if (s.tienda) {
      s.estado = 'tienda';
      return decir(de, `✅ Sesión de hoy activa.\n\n${menuAdmin(s.tienda.nombreTienda)}`);
    }
    return iniciarLogin(de, s);
  }

  /* ---------- login ---------- */

  async function iniciarLogin(de: string, s: Sesion) {
    const tel = diezDigitos(de);
    const todas = ((await (await deps.almacen()).leer('tiendas')) ?? {}) as Record<string, any>;
    const mias = Object.entries(todas)
      .filter(([, t]) => t && typeof t === 'object' && soloDigitos(t.telefono) === tel && t.password)
      .map(([id, t]) => ({ id, nombreTienda: String(t.nombreTienda ?? 'Tienda'), password: String(t.password) }));
    if (!mias.length) {
      s.rol = undefined;
      return decir(de, `Este número no tiene una tienda registrada. Regístrala en ${deps.urlApp} con este mismo celular y luego escribe *entrar*.\n\nSi solo quieres consultar, escribe *menú* y elige *Soy cliente*.`);
    }
    s.candidatas = mias;
    s.estado = 'password';
    await decir(de, '🔐 Escribe la *contraseña de tu tienda* (la misma de la app).\n\nPor seguridad, después *elimina ese mensaje* del chat (mantén pulsado → Eliminar). Para salir escribe *cancelar*.');
  }

  async function revisarPassword(de: string, s: Sesion, password: string) {
    if (ahora().getTime() < s.bloqueadoHasta) {
      return decir(de, '⛔ Demasiados intentos. Vuelve a intentar en unos minutos.');
    }
    const validas: typeof s.candidatas = [];
    for (const t of s.candidatas) if (await comparar(password.trim(), t.password ?? '')) validas.push(t);

    if (!validas.length) {
      s.intentos += 1;
      if (s.intentos >= MAX_INTENTOS_PASSWORD) {
        s.bloqueadoHasta = ahora().getTime() + MINUTOS_BLOQUEO * 60_000;
        s.intentos = 0;
        s.estado = 'anonimo';
        s.rol = undefined;
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
    s.rol = 'tienda';
    s.dia = diaMx(ahora().getTime());
    await guardarSesion(de, t.id, s.dia);
    const tienda = await leerTienda(t.id);
    const aviso = tienePermisoPublicar(tienda, ahora())
      ? ''
      : '\n\n⚠️ Tu tienda no tiene membresía vigente o no está activa: podrás preparar artículos y editar tu perfil, pero no publicar artículos hasta renovarla en la app.';
    await decir(de, `✅ Listo, entraste a *${t.nombreTienda}*.\n\n${menuAdmin(t.nombreTienda)}${aviso}`);
  }

  /* ---------- tienda: ver datos ---------- */

  async function verTienda(de: string, s: Sesion) {
    const a = await deps.almacen();
    const articulos = ((await a.leer('articulos')) ?? {}) as Record<string, any>;
    const total = Object.values(articulos).filter((x: any) => x && String(x.tiendaId) === s.tienda!.id && x.baja !== true).length;
    await decir(de, resumenTienda(await leerTienda(s.tienda!.id), total, ahora()));
  }

  /* ---------- tienda: cambios al perfil ---------- */

  async function pedirConfirmacionPerfil(de: string, s: Sesion, perfil: PerfilPendiente, extra = '') {
    s.perfil = perfil;
    s.estado = 'confirmandoPerfil';
    await conBotones(de, `Voy a cambiar en *${s.tienda!.nombreTienda}*:\n\n${perfil.lineas.map((l) => `• ${l}`).join('\n')}${extra}\n\n¿Lo guardo? (o escríbeme otro cambio)`, [
      { id: 'guardar', titulo: '✅ Guardar' },
      { id: 'cancelar', titulo: '❌ Cancelar' },
    ], 'Responde *sí* para guardar o *no* para cancelar.');
  }

  async function textoDeTienda(de: string, s: Sesion, texto: string) {
    if (comandoDe(texto) === 'datos') return verTienda(de, s);
    const tienda = await leerTienda(s.tienda!.id);
    const r = await deps.cerebro.interpretarAdmin({ texto, perfil: perfilParaIA(tienda), ahora: momento() });
    const noPermitido = Array.isArray(r?.noPermitido) && r.noPermitido.length;
    const avisoNoPermitido = noPermitido
      ? '\n\nℹ️ El nombre de la tienda, el celular, la contraseña, la categoría y la membresía no se cambian por aquí: hazlo en la app.'
      : '';

    if (r?.accion === 'ver_tienda') return verTienda(de, s);
    if (r?.accion === 'editar_perfil') {
      const v = validarCambiosPerfil(r.cambios, tienda);
      const ignorados = v.ignorados.length ? `\n\n⚠️ No pude aplicar: ${v.ignorados.join(', ')}.` : '';
      if (!Object.keys(v.cambios).length) {
        return decir(de, `No encontré un cambio que pueda aplicar.${ignorados}${avisoNoPermitido}\n\nEjemplos: "abro de lunes a viernes de 9 a 6", "acepto efectivo y tarjeta", "mi descripción es …".`);
      }
      return pedirConfirmacionPerfil(de, s, { cambios: v.cambios, lineas: v.lineas }, ignorados + avisoNoPermitido);
    }
    return decir(de, `${menuAdmin(s.tienda!.nombreTienda)}${avisoNoPermitido}`);
  }

  async function aplicarPerfil(de: string, s: Sesion) {
    const p = s.perfil;
    if (!p || !s.tienda) return decir(de, 'No hay ningún cambio pendiente.');
    s.ocupado = true;
    try {
      let cambios = p.cambios;
      if (p.imagenCampo) {
        if (!s.imagen) return decir(de, 'Se perdió la foto. Mándala de nuevo con la palabra *logo* o *portada*.');
        cambios = { [p.imagenCampo]: await deps.subirImagen(s.imagen.bytes, s.imagen.mime) };
      }
      // Defensa en profundidad: aunque la validación ya filtró, solo se escribe lo permitido y SOLO en la tienda de la sesión
      const permitidos = new Set<string>(CAMPOS_EDITABLES);
      const rutas: Record<string, any> = {};
      for (const [campo, valor] of Object.entries(cambios)) if (permitidos.has(campo)) rutas[`tiendas/${s.tienda.id}/${campo}`] = valor;
      if (!Object.keys(rutas).length) return decir(de, 'No hay nada que guardar.');
      // Lo que había antes, para borrarlo DESPUÉS de guardar lo nuevo (si se borrara antes y el guardado
      // fallara, la tienda se quedaría sin logo)
      const anterior = p.imagenCampo ? String((await leerTienda(s.tienda.id))?.[p.imagenCampo] ?? '') : '';
      await (await deps.almacen()).actualizar(rutas);
      log(`WhatsApp: perfil de la tienda ${s.tienda.id} actualizado (${Object.keys(rutas).length} campo(s))`);
      if (anterior && p.imagenCampo && anterior !== cambios[p.imagenCampo]) {
        // Sin await y sin lanzar: si falla, la imagen vieja solo queda huérfana, como antes
        void Promise.resolve(deps.eliminarImagenes?.([anterior])).catch((e) => log('WhatsApp: no se pudo borrar la imagen anterior:', e?.message ?? e));
      }
      cache = null;
      s.perfil = undefined;
      s.imagen = undefined;
      s.estado = 'tienda';
      await decir(de, '✅ Listo, ya quedó guardado. Escribe *mi tienda* para verlo.');
    } finally {
      s.ocupado = false;
    }
  }

  /* ---------- tienda: artículos y fotos ---------- */

  async function proponer(de: string, s: Sesion, texto: string, imagen?: Imagen, borradorActual?: Borrador) {
    const cats = await categorias();
    const crudo = await deps.cerebro.extraerArticulo({ texto, imagen, categorias: cats, borradorActual });
    const v = validarBorrador(crudo, cats);
    if (!v.ok) {
      return decir(de, `No pude leer ${v.falta.join(' ni ')}. Escríbelo (ej. "Pastel de chocolate, $350") y lo vuelvo a intentar con la misma foto.`);
    }
    s.borrador = v.borrador;
    s.estado = 'confirmando';
    await conBotones(de, `Revisa el artículo:\n\n${resumenBorrador(v.borrador, s.tienda!.nombreTienda)}\n\n¿Lo publico? (también puedes escribirme un cambio, ej. "el precio es 120")`, [
      { id: 'guardar', titulo: '✅ Publicar' },
      { id: 'cancelar', titulo: '❌ Descartar' },
    ], 'Responde *sí* para publicar o *no* para descartar.');
  }

  async function recibirFoto(de: string, s: Sesion, m: MensajeEntrante) {
    let img: { mime: string; bytes: Buffer };
    try {
      img = await deps.canal.descargarImagen(m.mediaId!);
    } catch (e: any) {
      log('WhatsApp: no se pudo descargar la foto:', String(e?.message ?? e).slice(0, 200));
      return decir(de, 'No pude descargar tu foto 😕 Mándala de nuevo en un momento.');
    }
    if (!MIMES_IMAGEN.includes(img.mime) || img.bytes.length > MAX_BYTES_IMAGEN) {
      return decir(de, 'Mándame la foto como JPG, PNG o WebP de máximo 5 MB.');
    }
    s.borrador = undefined;
    s.perfil = undefined;
    s.estado = 'tienda';
    s.imagen = img;
    // "logo" o "portada" en el pie de la foto: es para el perfil de la tienda, no un artículo
    const pie = m.texto.toLowerCase();
    const campo = /\b(logo|logotipo)\b/.test(pie) ? 'logoUrl' : /\b(portada|banner)\b/.test(pie) ? 'bannerUrl' : null;
    if (campo) return pedirConfirmacionPerfil(de, s, { cambios: {}, lineas: [campo === 'logoUrl' ? 'Poner esta foto como el *logo* de la tienda' : 'Poner esta foto como la *portada* de la tienda'], imagenCampo: campo });
    s.textos = m.texto ? [m.texto] : [];
    // Leer la foto con la IA puede tardar: se avisa para que no parezca que no pasó nada
    await decir(de, '📸 Recibí tu foto, estoy leyendo los datos…');
    await proponer(de, s, m.texto, { mime: img.mime, base64: img.bytes.toString('base64') });
  }

  async function publicar(de: string, s: Sesion) {
    if (!s.borrador || !s.imagen || !s.tienda) return decir(de, 'No hay ningún artículo pendiente. Mándame una foto.');
    const a = await deps.almacen();
    const tienda = await leerTienda(s.tienda.id);
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
      await decir(de, `🎉 *${nombre}* ya está publicado en *${s.tienda.nombreTienda}*. Puedes mandarme otro artículo o escribir *menú*.`);
    } finally {
      s.ocupado = false;
    }
  }

  /* ---------- clientes ---------- */

  async function atenderCliente(de: string, texto: string) {
    const { tiendas, articulos } = await catalogo();
    const encontrado = buscarCatalogo(tiendas, articulos, texto, ahora());
    let respuesta: string;
    try {
      respuesta = await deps.cerebro.responderCliente({ pregunta: texto, catalogo: encontrado, urlApp: deps.urlApp, ahora: momento() });
    } catch (e: any) {
      // Sin IA (cuota agotada o saturación) igual se entrega lo que se encontró, en una lista simple
      log('WhatsApp: la IA no respondió; se contesta sin IA:', String(e?.message ?? e).slice(0, 160));
      if (encontrado.tiendas.length || encontrado.articulos.length) return decir(de, respuestaSinIA(encontrado, deps.urlApp));
      throw e;
    }
    await decir(de, respuesta || INTRO_CLIENTE);
  }

  /* ---------- entrada ---------- */

  async function manejar(m: MensajeEntrante) {
    const de = m.de;
    const t = ahora().getTime();
    const hoy = diaMx(t);
    const s = sesiones.get(de) ?? nuevaSesion();
    sesiones.set(de, s);

    const lim = permitirMensaje(s.marcas, t);
    s.marcas = lim.marcas;
    if (!lim.permitido) return decir(de, 'Vas muy rápido 🙂 Espera unos minutos y seguimos.');

    // El servidor pudo dormirse o reiniciarse: si este número ya entró HOY, se recupera la sesión
    if (!s.cargada) {
      s.cargada = true;
      await restaurarSesion(de, s, hoy);
      // Entra como cliente hasta que elija; la sesión recuperada solo evita pedir la contraseña
      if (s.tienda) s.rol = undefined;
    }

    // La sesión de una tienda vale hasta el fin del día (hora de México)
    if (s.tienda && s.dia !== hoy) {
      await cerrarSesion(de, s);
      await decir(de, '⌛ Tu sesión de ayer caducó (las sesiones duran hasta el fin del día). Escribe *entrar* para iniciar sesión de nuevo.');
      return;
    }
    s.ultima = t;

    if (m.tipo === 'otro') return decir(de, 'Por ahora solo entiendo mensajes de texto y fotos.');

    const texto = m.tipo === 'texto' || m.tipo === 'boton' ? m.texto : '';
    const cmd = m.tipo === 'texto' ? comandoDe(texto) : null;
    const boton = m.tipo === 'boton' ? m.texto : '';

    if (cmd === 'salir') {
      await cerrarSesion(de, s);
      return decir(de, '👋 Sesión cerrada. Escribe *hola* cuando quieras volver.');
    }
    if (cmd === 'cancelar' || boton === 'cancelar') {
      if (s.estado === 'confirmando' || s.estado === 'confirmandoPerfil' || s.estado === 'tienda') {
        s.borrador = undefined;
        s.perfil = undefined;
        s.imagen = undefined;
        s.estado = s.tienda ? 'tienda' : 'anonimo';
        return decir(de, 'Descartado. Mándame otra foto o dime qué quieres cambiar, o escribe *menú*.');
      }
      limpiar(s);
      return decir(de, 'Cancelado. Escribe *hola* para empezar de nuevo.');
    }

    // Pasos que esperan una respuesta concreta (no se interrumpen con el menú)
    if (s.estado === 'password' && m.tipo === 'texto') return revisarPassword(de, s, m.texto);
    if (s.estado === 'password') return decir(de, 'Necesito tu contraseña en texto, o escribe *cancelar*.');
    if (s.estado === 'eligiendo') {
      const elegida = s.candidatas[Number(soloDigitos(texto)) - 1];
      if (!elegida) return decir(de, 'Responde con el número de la tienda de la lista.');
      return entrarATienda(de, s, elegida);
    }

    // Elegir o cambiar de rol
    const eleccion = boton === 'rol_cliente' || boton === 'rol_tienda' ? rolDe(boton) : cmd === 'entrar' ? 'tienda' : !s.rol && m.tipo === 'texto' ? rolDe(texto) : null;
    if (eleccion) return elegirRol(de, s, eleccion);
    if (cmd === 'menu') {
      s.rol = undefined; // la respuesta por texto ("cliente" / "tienda") solo se lee mientras no hay rol elegido
      return preguntarRol(de, s);
    }
    if (!s.rol) return preguntarRol(de, s);

    /* ---------------- CLIENTE ---------------- */
    if (s.rol === 'cliente') {
      if (m.tipo === 'imagen') return decir(de, 'Como cliente solo puedo ayudarte a consultar. Para publicar artículos o editar una tienda escribe *menú* y elige *Soy tienda*.');
      if (cmd === 'ayuda' || cmd === 'datos') return decir(de, INTRO_CLIENTE);
      if (m.tipo === 'texto') return atenderCliente(de, m.texto);
      return decir(de, 'Escríbeme tu pregunta 🙂');
    }

    /* ---------------- TIENDA (con sesión) ---------------- */
    if (!s.tienda) return iniciarLogin(de, s);
    if (cmd === 'ayuda') return decir(de, menuAdmin(s.tienda.nombreTienda));

    switch (s.estado) {
      case 'confirmando':
        if (s.ocupado) return decir(de, 'Estoy publicando, un momento…');
        if (m.tipo === 'imagen') return recibirFoto(de, s, m);
        if (boton === 'guardar' || esSi(texto)) return publicar(de, s);
        if (esNo(texto)) {
          s.borrador = undefined;
          s.imagen = undefined;
          s.estado = 'tienda';
          return decir(de, 'Descartado. Mándame otra foto cuando quieras.');
        }
        if (cmd === 'datos') return verTienda(de, s);
        return proponer(de, s, texto, undefined, s.borrador);

      case 'confirmandoPerfil':
        if (s.ocupado) return decir(de, 'Estoy guardando, un momento…');
        if (m.tipo === 'imagen') return recibirFoto(de, s, m);
        if (boton === 'guardar' || esSi(texto)) return aplicarPerfil(de, s);
        if (esNo(texto)) {
          s.perfil = undefined;
          s.imagen = undefined;
          s.estado = 'tienda';
          return decir(de, 'Descartado. Dime qué otro cambio quieres.');
        }
        // Otro mensaje: se toma como una petición nueva (la anterior se descarta)
        s.perfil = undefined;
        s.imagen = undefined;
        s.estado = 'tienda';
        return textoDeTienda(de, s, texto);

      default:
        if (m.tipo === 'imagen') return recibirFoto(de, s, m);
        if (m.tipo !== 'texto') return decir(de, menuAdmin(s.tienda.nombreTienda));
        if (s.imagen && /^(reintentar|reintenta|otra vez|de nuevo|intenta de nuevo|vuelve a intentar)$/.test(normalizar(m.texto))) {
          // La IA estaba saturada: se repite con la foto y los datos que ya se tenían
          return proponer(de, s, s.textos.join('\n'), { mime: s.imagen.mime, base64: s.imagen.bytes.toString('base64') });
        }
        if (s.imagen && cmd !== 'datos') {
          // Faltó un dato del artículo: se vuelve a intentar con la foto ya recibida y lo que se ha escrito
          s.textos.push(m.texto);
          return proponer(de, s, s.textos.join('\n'), { mime: s.imagen.mime, base64: s.imagen.bytes.toString('base64') });
        }
        return textoDeTienda(de, s, m.texto);
    }
  }

  /** Un mensaje a la vez por número (dos fotos seguidas no se pisan) y sin tumbar el servidor si algo falla */
  function procesar(m: MensajeEntrante): Promise<void> {
    const previo = cola.get(m.de) ?? Promise.resolve();
    const inicio = Date.now();
    const siguiente = previo
      .then(() => manejar(m))
      .then(() => {
        // Sin contenido ni número: solo en qué paso quedó la conversación y cuánto tardó
        const s = sesiones.get(m.de);
        log(`WhatsApp: mensaje atendido (${m.tipo}; rol=${s?.rol ?? 'sin elegir'}; paso=${s?.estado ?? '—'}; ${Date.now() - inicio} ms)`);
      })
      .catch(async (e) => {
        log('WhatsApp: error al atender un mensaje:', e?.message ?? e);
        const s = sesiones.get(m.de);
        if (s) s.ocupado = false;
        const msg = String(e?.message ?? '');
        const ia = /^Gemini/.test(msg);
        const cuota = /^Gemini 429/.test(msg);
        const conFoto = Boolean(s?.imagen);
        const reintento = conFoto ? 'Escribe *reintentar* y lo vuelvo a intentar con tu foto.' : 'Inténtalo de nuevo en unos minutos.';
        await decir(
          m.de,
          cuota
            ? `Se agotó el uso gratuito de mi inteligencia artificial por ahora 😕 ${reintento} Si ya se usó mucho hoy, puede tardar hasta mañana.`
            : ia
              ? `Mi asistente de inteligencia artificial está saturado en este momento 😕 ${reintento}`
              : 'Tuve un problema para atenderte. Inténtalo de nuevo en un momento.',
        ).catch(() => {});
      })
      .finally(() => {
        if (cola.get(m.de) === siguiente) cola.delete(m.de);
      });
    cola.set(m.de, siguiente);
    return siguiente;
  }

  return { procesar, sesiones };
}
