import { formatoPesos, plantillaPorId, formatoPorId, porcentajeMenos } from '@/composables/usePublicaciones';

/**
 * Dibuja la imagen de la publicación en un <canvas>: foto, título, precio y nombre de la tienda sobre la
 * plantilla elegida. Todo en el navegador (gratis, sin servidor ni IA).
 */

export interface OpcionesDibujo {
  foto: CanvasImageSource | null;
  fotoAncho?: number;
  fotoAlto?: number;
  plantilla: string;
  formato: string;
  titulo: string;
  texto?: string;
  precio: number | null;
  precioAntes: number | null;
  tienda: string;
}

/**
 * Parte un texto en renglones que quepan en `ancho`, con `medir` (ancho de un trozo de texto).
 * Si no cabe en `maxLineas`, el último renglón termina en "…". Pura, para poder probarla sin canvas.
 */
export function partirLineas(medir: (t: string) => number, texto: string, ancho: number, maxLineas: number): string[] {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  const recortar = (t: string) => {
    let x = t;
    while (x.length > 1 && medir(`${x}…`) > ancho) x = x.slice(0, -1);
    return `${x}…`;
  };
  for (let i = 0; i < palabras.length; i++) {
    const prueba = actual ? `${actual} ${palabras[i]}` : palabras[i];
    if (medir(prueba) <= ancho) {
      actual = prueba;
      continue;
    }
    if (!actual) {
      // Una palabra más ancha que el renglón: se corta
      actual = palabras[i];
      let cortada = actual;
      while (cortada.length > 1 && medir(cortada) > ancho) cortada = cortada.slice(0, -1);
      lineas.push(cortada);
      actual = '';
    } else {
      lineas.push(actual);
      actual = palabras[i];
    }
    if (lineas.length === maxLineas) {
      lineas[maxLineas - 1] = recortar(lineas[maxLineas - 1]);
      return lineas;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    cortadas[maxLineas - 1] = recortar(cortadas[maxLineas - 1]);
    return cortadas;
  }
  return lineas;
}

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FUENTE = `'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

export function dibujarPublicacion(canvas: HTMLCanvasElement, o: OpcionesDibujo): void {
  const pl = plantillaPorId(o.plantilla);
  const fm = formatoPorId(o.formato);
  canvas.width = fm.ancho;
  canvas.height = fm.alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = fm.ancho;
  const H = fm.alto;
  const vertical = H > W;
  const margen = 60;
  const ancho = W - margen * 2;

  // Fondo
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pl.fondo[0]);
  g.addColorStop(1, pl.fondo[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Foto (recortada para llenar el recuadro)
  const fotoY = vertical ? 110 : margen;
  const fotoH = vertical ? 1020 : 600;
  ctx.save();
  rectRedondeado(ctx, margen, fotoY, ancho, fotoH, 36);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(margen, fotoY, ancho, fotoH);
  if (o.foto) {
    const fw = o.fotoAncho || (o.foto as any).width || (o.foto as any).naturalWidth || ancho;
    const fh = o.fotoAlto || (o.foto as any).height || (o.foto as any).naturalHeight || fotoH;
    const escala = Math.max(ancho / fw, fotoH / fh);
    const dw = fw * escala;
    const dh = fh * escala;
    ctx.drawImage(o.foto, margen + (ancho - dw) / 2, fotoY + (fotoH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = pl.texto;
    ctx.globalAlpha = 0.5;
    ctx.font = `600 44px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText('Agrega tu foto', W / 2, fotoY + fotoH / 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Etiqueta de descuento sobre la foto
  const menos = porcentajeMenos(o.precio, o.precioAntes);
  if (menos > 0) {
    const bw = 230;
    const bh = 96;
    const bx = W - margen - bw - 24;
    const by = fotoY + 24;
    ctx.fillStyle = pl.acento;
    rectRedondeado(ctx, bx, by, bw, bh, 48);
    ctx.fill();
    ctx.fillStyle = pl.sobreAcento;
    ctx.font = `800 54px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`-${menos}%`, bx + bw / 2, by + bh / 2 + 2);
  }

  // Título
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = fotoY + fotoH + (vertical ? 90 : 70);
  const tamTitulo = vertical ? 76 : 62;
  ctx.fillStyle = pl.texto;
  ctx.font = `800 ${tamTitulo}px ${FUENTE}`;
  const lineasTitulo = partirLineas((t) => ctx.measureText(t).width, o.titulo, ancho, vertical ? 3 : 2);
  for (const l of lineasTitulo) {
    ctx.fillText(l, margen, y);
    y += tamTitulo * 1.1;
  }

  // Texto corto (solo si hay lugar)
  if (o.texto?.trim()) {
    ctx.font = `400 ${vertical ? 40 : 34}px ${FUENTE}`;
    ctx.globalAlpha = 0.9;
    const lineasTexto = partirLineas((t) => ctx.measureText(t).width, o.texto, ancho, vertical ? 4 : 1);
    y += 6;
    for (const l of lineasTexto) {
      ctx.fillText(l, margen, y);
      y += (vertical ? 40 : 34) * 1.3;
    }
    ctx.globalAlpha = 1;
  }

  // Precio y tienda, pegados abajo
  const pieY = H - margen;
  if (o.precio) {
    const txt = formatoPesos(o.precio);
    ctx.font = `800 ${vertical ? 84 : 70}px ${FUENTE}`;
    const pw = ctx.measureText(txt).width + 70;
    const ph = vertical ? 124 : 104;
    ctx.fillStyle = pl.acento;
    rectRedondeado(ctx, margen, pieY - ph, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = pl.sobreAcento;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, margen + 35, pieY - ph / 2 + 3);
    if (o.precioAntes && menos > 0) {
      ctx.fillStyle = pl.texto;
      ctx.globalAlpha = 0.75;
      ctx.font = `500 ${vertical ? 46 : 40}px ${FUENTE}`;
      const antes = `antes ${formatoPesos(o.precioAntes)}`;
      const ax = margen + pw + 30;
      ctx.fillText(antes, ax, pieY - ph / 2 + 3);
      const aw = ctx.measureText(antes).width;
      ctx.fillRect(ax, pieY - ph / 2 + 3, aw, 4); // tachado
      ctx.globalAlpha = 1;
    }
  }
  if (o.tienda) {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = pl.texto;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 ${vertical ? 38 : 32}px ${FUENTE}`;
    const [linea] = partirLineas((t) => ctx.measureText(t).width, `🏪 ${o.tienda}`, ancho, 1);
    ctx.fillText(linea, margen, o.precio ? pieY - (vertical ? 150 : 128) : pieY);
    ctx.globalAlpha = 1;
  }
}

/** El canvas como archivo PNG/JPEG listo para subir o compartir */
export function canvasABlob(canvas: HTMLCanvasElement, tipo = 'image/jpeg', calidad = 0.9): Promise<Blob> {
  return new Promise((ok, mal) => {
    try {
      canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen.'))), tipo, calidad);
    } catch (e: any) {
      // Una foto de otro sitio sin permiso (CORS) deja el canvas "contaminado" y no se puede exportar
      mal(new Error('No se pudo exportar la imagen: sube la foto desde tu teléfono en lugar de usar la del artículo.'));
    }
  });
}
