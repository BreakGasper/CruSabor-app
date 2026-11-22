import { ref } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, push, set, update, remove } from '@/services/baseDatos';

/**
 * Publicaciones de las tiendas: la imagen de promoción (flyer) y el texto que la acompaña, listos para
 * compartir en WhatsApp, Facebook y demás. Es una herramienta de difusión: NO toca precios ni artículos
 * (los descuentos con vigencia son las "promociones" de `usePromociones.ts`).
 *
 *   publicaciones/{tiendaId}/{id}: { id, tiendaId, tiendaNombre, titulo, texto, precio, precioAntes,
 *                                    plantilla, formato, imagenUrl, articuloId, creadaEn }
 *
 * Todo se genera en el navegador (canvas), así que no cuesta nada ni depende de una IA de pago.
 */

export interface Plantilla {
  id: string;
  nombre: string;
  /** Degradado del fondo, de arriba a abajo */
  fondo: [string, string];
  /** Color del texto principal */
  texto: string;
  /** Color de la etiqueta del precio y de los detalles */
  acento: string;
  /** Texto sobre el acento */
  sobreAcento: string;
}

export const PLANTILLAS: Plantilla[] = [
  { id: 'clasica', nombre: 'Clásica', fondo: ['#1f3a5f', '#10233b'], texto: '#ffffff', acento: '#ffd166', sobreAcento: '#10233b' },
  { id: 'oferta', nombre: 'Oferta', fondo: ['#d62828', '#8e1010'], texto: '#ffffff', acento: '#ffe14d', sobreAcento: '#6b0b0b' },
  { id: 'elegante', nombre: 'Elegante', fondo: ['#1b1b1f', '#000000'], texto: '#f5efe0', acento: '#d4af37', sobreAcento: '#1b1b1f' },
  { id: 'fresca', nombre: 'Fresca', fondo: ['#2a9d6f', '#1a6b4a'], texto: '#ffffff', acento: '#fff3b0', sobreAcento: '#14503a' },
  { id: 'suave', nombre: 'Suave', fondo: ['#fff1e6', '#ffd9c2'], texto: '#4a2c1a', acento: '#e76f51', sobreAcento: '#ffffff' },
];

export interface Formato {
  id: 'cuadrado' | 'historia';
  nombre: string;
  ancho: number;
  alto: number;
}

/** Cuadrado sirve para el chat y el muro; historia (vertical) para estados e Instagram */
export const FORMATOS: Formato[] = [
  { id: 'cuadrado', nombre: 'Cuadrado (publicación)', ancho: 1080, alto: 1080 },
  { id: 'historia', nombre: 'Vertical (estado / historia)', ancho: 1080, alto: 1920 },
];

export const MAX_TITULO = 60;
export const MAX_TEXTO = 400;
export const MAX_PRECIO = 1_000_000;

export interface Publicacion {
  id: string;
  tiendaId: string;
  tiendaNombre: string;
  titulo: string;
  texto: string;
  precio: number | null;
  precioAntes: number | null;
  plantilla: string;
  formato: string;
  imagenUrl: string;
  articuloId: string;
  creadaEn: string;
}

const pesos = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const formatoPesos = pesos;

/** "$1,250.50", "350", "350 pesos" → número; null si vacío o inválido (0 y negativos no valen) */
export function leerMonto(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v <= MAX_PRECIO ? Math.round(v * 100) / 100 : null;
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return n > 0 && n <= MAX_PRECIO ? Math.round(n * 100) / 100 : null;
}

/** Lo que falta o está mal antes de guardar; vacío = listo */
export function validarPublicacion(d: { titulo: unknown; precio: unknown; precioAntes: unknown; texto: unknown }): string[] {
  const errores: string[] = [];
  const titulo = String(d.titulo ?? '').trim();
  if (titulo.length < 2) errores.push('Escribe el título (mínimo 2 letras).');
  if (titulo.length > MAX_TITULO) errores.push(`El título no puede pasar de ${MAX_TITULO} caracteres.`);
  const precioEscrito = String(d.precio ?? '').trim();
  const precio = leerMonto(d.precio);
  if (precioEscrito && precio === null) errores.push('El precio no es válido.');
  const antesEscrito = String(d.precioAntes ?? '').trim();
  const antes = leerMonto(d.precioAntes);
  if (antesEscrito && antes === null) errores.push('El precio anterior no es válido.');
  if (precio !== null && antes !== null && antes <= precio) errores.push('El precio anterior debe ser mayor que el precio actual.');
  if (String(d.texto ?? '').length > MAX_TEXTO) errores.push(`El texto no puede pasar de ${MAX_TEXTO} caracteres.`);
  return errores;
}

export const plantillaPorId = (id: unknown): Plantilla => PLANTILLAS.find((p) => p.id === id) ?? PLANTILLAS[0];
export const formatoPorId = (id: unknown): Formato => FORMATOS.find((f) => f.id === id) ?? FORMATOS[0];

/** Descuento entero en %, 0 si no aplica */
export function porcentajeMenos(precio: number | null, antes: number | null): number {
  if (!precio || !antes || antes <= precio) return 0;
  return Math.round((1 - precio / antes) * 100);
}

/** El texto que acompaña a la imagen al compartirla */
export function armarTexto(d: { titulo: string; texto?: string; precio?: number | null; precioAntes?: number | null; tienda?: string; enlace?: string }): string {
  const l: string[] = [`🛍️ *${d.titulo.trim()}*`];
  if (d.precio) {
    const menos = porcentajeMenos(d.precio, d.precioAntes ?? null);
    l.push(d.precioAntes && menos > 0 ? `💲 Ahora ${pesos(d.precio)} (antes ${pesos(d.precioAntes)}, -${menos}%)` : `💲 ${pesos(d.precio)}`);
  }
  if (d.texto?.trim()) l.push(d.texto.trim());
  if (d.tienda) l.push(`🏪 ${d.tienda}`);
  if (d.enlace) l.push(`👉 ${d.enlace}`);
  return l.join('\n');
}

/** Enlaces para abrir cada red con el texto ya escrito (gratis, sin permisos: la persona solo toca "enviar") */
export const enlaceWhatsapp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
export const enlaceFacebook = (url: string, texto = '') => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}${texto ? `&quote=${encodeURIComponent(texto)}` : ''}`;
export const enlaceTelegram = (url: string, texto: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`;
export const enlaceX = (texto: string, url: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`;

/** Normaliza una fila de la base (lo que falte toma un valor seguro) */
export function normalizarPublicacion(id: string, tiendaId: string, d: any): Publicacion | null {
  if (!d || typeof d !== 'object') return null;
  const titulo = String(d.titulo ?? '').trim();
  if (!titulo) return null;
  return {
    id,
    tiendaId,
    tiendaNombre: String(d.tiendaNombre ?? ''),
    titulo,
    texto: String(d.texto ?? ''),
    precio: leerMonto(d.precio),
    precioAntes: leerMonto(d.precioAntes),
    plantilla: plantillaPorId(d.plantilla).id,
    formato: formatoPorId(d.formato).id,
    imagenUrl: String(d.imagenUrl ?? ''),
    articuloId: String(d.articuloId ?? ''),
    creadaEn: String(d.creadaEn ?? ''),
  };
}

/* ---------------- base de datos ---------------- */

export interface DatosPublicacion {
  tiendaId: string;
  tiendaNombre: string;
  titulo: string;
  texto: string;
  precio: number | null;
  precioAntes: number | null;
  plantilla: string;
  formato: string;
  imagenUrl: string;
  articuloId?: string;
}

export async function guardarPublicacion(d: DatosPublicacion): Promise<string> {
  const errores = validarPublicacion({ titulo: d.titulo, precio: d.precio, precioAntes: d.precioAntes, texto: d.texto });
  if (errores.length) throw new Error(errores[0]);
  if (!d.tiendaId) throw new Error('Falta la tienda.');
  if (!d.imagenUrl) throw new Error('Falta la imagen de la publicación.');
  const nueva = push(dbRef(db, `publicaciones/${d.tiendaId}`));
  const id = nueva.key!;
  await set(nueva, {
    id,
    tiendaId: d.tiendaId,
    tiendaNombre: d.tiendaNombre,
    titulo: d.titulo.trim(),
    texto: d.texto.trim(),
    precio: d.precio ?? null,
    precioAntes: d.precioAntes ?? null,
    plantilla: plantillaPorId(d.plantilla).id,
    formato: formatoPorId(d.formato).id,
    imagenUrl: d.imagenUrl,
    articuloId: d.articuloId ?? '',
    creadaEn: new Date().toISOString(),
  });
  return id;
}

export async function eliminarPublicacion(tiendaId: string, id: string): Promise<void> {
  await remove(dbRef(db, `publicaciones/${tiendaId}/${id}`));
}

/** Marca que se compartió (solo para mostrar "compartida" en la lista) */
export async function marcarCompartida(tiendaId: string, id: string): Promise<void> {
  await update(dbRef(db, `publicaciones/${tiendaId}/${id}`), { compartidaEn: new Date().toISOString() });
}

/** Lista en vivo de las publicaciones de UNA tienda, más recientes primero */
export function usePublicaciones(tiendaId: string) {
  const lista = ref<Publicacion[]>([]);
  const cargando = ref(true);
  const baja = onValue(
    dbRef(db, `publicaciones/${tiendaId}`),
    (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      lista.value = Object.entries(data)
        .map(([id, p]) => normalizarPublicacion(id, tiendaId, p))
        .filter((p): p is Publicacion => p !== null)
        .sort((a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime());
      cargando.value = false;
    },
    (e) => {
      console.error('❌ Error leyendo publicaciones:', e);
      cargando.value = false;
    },
  );
  return { lista, cargando, detener: baja as unknown as () => void };
}
