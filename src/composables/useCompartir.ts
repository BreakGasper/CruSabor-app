/**
 * Compartir una pantalla de la app: perfil de tienda, producto, etc.
 *
 * En el teléfono lo natural es `navigator.share`: abre la hoja del sistema con
 * todas las apps instaladas (WhatsApp, Messenger, Telegram, Mensajes...) y es la
 * misma que usan Instagram o Mercado Libre. No existe en escritorio ni en algunos
 * navegadores, así que siempre queda la lista de respaldo con enlaces directos.
 *
 * Las funciones que arman texto y enlaces son puras (reciben el origen) para poder
 * probarlas; las que tocan el navegador viven al final y nunca lanzan.
 */

/** Qué pasó al intentar compartir con el menú del sistema */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'sin-soporte';

export interface ContenidoCompartir {
  titulo: string;
  texto: string;
  url: string;
}

/** Destinos de la lista de respaldo (cuando no hay menú del sistema) */
export type DestinoCompartir = 'whatsapp' | 'facebook' | 'telegram' | 'correo';

/* =========================================================================
 *  ENLACES Y TEXTOS (puros)
 * ========================================================================= */

const origenActual = () =>
  typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Enlace absoluto a una ruta de la app.
 * Se arma desde el origen y la ruta, nunca desde `location.href`, para no arrastrar
 * la query del momento (p. ej. `?pago=exito` al volver de Mercado Pago).
 */
export function urlAbsoluta(ruta: string, origen = origenActual()): string {
  const base = (origen || '').replace(/\/$/, '');
  const camino = ruta.startsWith('/') ? ruta : `/${ruta}`;
  return `${base}${camino}`;
}

/** Enlace público al perfil de una tienda */
export function urlPerfilTienda(tiendaId: string, origen = origenActual()): string {
  return urlAbsoluta(`/store/profile/${tiendaId}`, origen);
}

/** Enlace público al detalle de un artículo */
export function urlProducto(articuloId: string, origen = origenActual()): string {
  return urlAbsoluta(`/producto/${articuloId}`, origen);
}

/** Mensaje que acompaña al enlace de una tienda */
export function textoCompartirTienda(nombreTienda: string, categoria?: string): string {
  const nombre = (nombreTienda || '').trim() || 'esta tienda';
  const rubro = (categoria || '').trim();
  return rubro
    ? `Mira ${nombre} (${rubro}) en MAVI`
    : `Mira ${nombre} en MAVI`;
}

/**
 * Mensaje que acompaña al enlace de un artículo.
 * A propósito sin precio: cada variante tiene el suyo y cambia con el tiempo, así que
 * el mensaje quedaría contradiciendo a la pantalla que abre quien lo recibe.
 */
export function textoCompartirProducto(nombre: string, nombreTienda?: string): string {
  const articulo = (nombre || '').trim() || 'este producto';
  const tienda = (nombreTienda || '').trim();
  return tienda ? `Mira ${articulo} de ${tienda} en MAVI` : `Mira ${articulo} en MAVI`;
}

/** Texto y enlace en un solo mensaje, para destinos que no aceptan la url aparte */
export function textoConUrl(texto: string, url: string): string {
  const t = (texto || '').trim();
  return t ? `${t}\n${url}` : url;
}

/** Enlace de WhatsApp que deja elegir el contacto (no abre un chat concreto) */
export function enlaceWhatsApp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(textoConUrl(texto, url))}`;
}

export function enlaceFacebook(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function enlaceTelegram(texto: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`;
}

export function enlaceCorreo(titulo: string, texto: string, url: string): string {
  return `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(textoConUrl(texto, url))}`;
}

/** El enlace de cada destino de respaldo */
export function enlaceDestino(destino: DestinoCompartir, c: ContenidoCompartir): string {
  switch (destino) {
    case 'whatsapp':
      return enlaceWhatsApp(c.texto, c.url);
    case 'facebook':
      return enlaceFacebook(c.url);
    case 'telegram':
      return enlaceTelegram(c.texto, c.url);
    case 'correo':
      return enlaceCorreo(c.titulo, c.texto, c.url);
  }
}

/* =========================================================================
 *  NAVEGADOR
 * ========================================================================= */

/** ¿El navegador ofrece el menú de compartir del sistema? (móvil, casi siempre) */
export function hayCompartirNativo(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Abre el menú de compartir del sistema.
 * Cerrar el menú sin elegir no es un error: Android y iOS rechazan con AbortError.
 */
export async function compartirNativo(c: ContenidoCompartir): Promise<ResultadoCompartir> {
  if (!hayCompartirNativo()) return 'sin-soporte';
  try {
    await navigator.share({ title: c.titulo, text: c.texto, url: c.url });
    return 'compartido';
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'cancelado';
    // Permiso denegado o navegador sin soporte real: que la pantalla ofrezca la lista
    return 'sin-soporte';
  }
}

/**
 * Copia texto al portapapeles. `navigator.clipboard` solo existe en https (o localhost),
 * así que hay respaldo con un textarea temporal para los demás casos.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue al respaldo
  }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
