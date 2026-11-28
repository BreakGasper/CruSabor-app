/**
 * Escenas de fondo con IA para «Crear publicación». La IA inventa solo el fondo (a partir de un texto) y el
 * producto de la tienda se pega encima: el producto nunca sale distinto del real.
 * La generación ocurre en el servidor (la llave de Cloudflare no puede estar en la app).
 */

const API = () => String((import.meta as any).env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export interface EstiloEscena {
  id: string;
  nombre: string;
  icono: string;
  /** Lo que se le pide a la IA (en inglés rinde mejor) */
  descripcion: string;
}

export const ESTILOS_ESCENA: EstiloEscena[] = [
  { id: 'mesa', nombre: 'Mesa de madera', icono: '🪵', descripcion: 'rustic wooden table, warm morning window light' },
  { id: 'estudio', nombre: 'Estudio', icono: '📸', descripcion: 'clean photo studio, smooth pastel backdrop, soft shadow' },
  { id: 'naturaleza', nombre: 'Naturaleza', icono: '🌿', descripcion: 'green leaves and grass outdoors, sunlight through trees' },
  { id: 'playa', nombre: 'Playa', icono: '🏖️', descripcion: 'sandy beach with turquoise sea in the background, sunny day' },
  { id: 'ciudad', nombre: 'Ciudad', icono: '🏙️', descripcion: 'modern city street at golden hour, blurred buildings' },
  { id: 'fiesta', nombre: 'Fiesta', icono: '🎉', descripcion: 'festive party atmosphere, colorful confetti and bokeh lights' },
  { id: 'navidad', nombre: 'Navidad', icono: '🎄', descripcion: 'cozy christmas scene, warm fairy lights, pine branches' },
  { id: 'minimal', nombre: 'Minimalista', icono: '⬜', descripcion: 'minimal bright background, marble surface, elegant and airy' },
];

export interface EstadoEscenas {
  activo: boolean;
  restantesHoy: number;
}

/** ¿Está conectado el servicio de IA? Si el servidor no responde, se trata como apagado (nunca lanza). */
export async function estadoEscenas(): Promise<EstadoEscenas> {
  try {
    const r = await fetch(`${API()}/escenas/estado`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { activo: false, restantesHoy: 0 };
    const d = await r.json();
    return { activo: !!d.activo, restantesHoy: Number(d.restantesHoy) || 0 };
  } catch {
    return { activo: false, restantesHoy: 0 };
  }
}

export class ErrorEscena extends Error {}

/** Pide una escena y devuelve la imagen ya cargada. Lanza ErrorEscena con un mensaje para mostrar. */
export async function generarEscena(descripcion: string): Promise<{ imagen: HTMLImageElement; restantesHoy: number }> {
  let r: Response;
  try {
    r = await fetch(`${API()}/escenas/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ErrorEscena('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.');
  }
  let d: any = {};
  try {
    d = await r.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (d?.activo === false) throw new ErrorEscena('Las escenas con IA todavía no están activadas.');
  if (!r.ok || !d?.imagen) throw new ErrorEscena(d?.mensaje || 'No se pudo generar la escena. Intenta de nuevo.');
  const imagen = await new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new ErrorEscena('La escena llegó dañada. Intenta de nuevo.'));
    img.src = d.imagen;
  });
  return { imagen, restantesHoy: Number(d.restantesHoy) || 0 };
}
