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
  /** La foto ya viene sin fondo (recortada): se dibuja flotando, sin marco */
  recortada?: boolean;
  /** Fondo inventado por la IA: cubre toda la imagen y el texto pasa a blanco sobre un degradado oscuro */
  escena?: CanvasImageSource | null;
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

/** Escena de IA: cubre todo el lienzo y un degradado oscuro deja leer el texto (a la izquierda en banners, abajo en los demás) */
function pintarEscena(ctx: CanvasRenderingContext2D, escena: CanvasImageSource, W: number, H: number, horizontal: boolean) {
  const ew = (escena as any).width || (escena as any).naturalWidth || W;
  const eh = (escena as any).height || (escena as any).naturalHeight || H;
  const e = Math.max(W / ew, H / eh);
  ctx.drawImage(escena, (W - ew * e) / 2, (H - eh * e) / 2, ew * e, eh * e);
  const g = horizontal ? ctx.createLinearGradient(0, 0, W * 0.65, 0) : ctx.createLinearGradient(0, H * 0.4, 0, H);
  g.addColorStop(0, horizontal ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0)');
  g.addColorStop(1, horizontal ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.78)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Producto sin fondo: círculo de color detrás, foto completa (sin recortar) y una sombra suave */
function dibujarFotoRecortada(ctx: CanvasRenderingContext2D, foto: CanvasImageSource, x: number, y: number, w: number, h: number, acento: string, k: number, circulo = true) {
  const fw = (foto as any).width || (foto as any).naturalWidth || w;
  const fh = (foto as any).height || (foto as any).naturalHeight || h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (circulo) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = acento;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const escala = Math.min((w * 0.92) / fw, (h * 0.92) / fh);
  const dw = fw * escala;
  const dh = fh * escala;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40 * k;
  ctx.shadowOffsetY = 18 * k;
  ctx.drawImage(foto, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

/**
 * Banner y formatos anchos: el texto a la izquierda (tienda, título, texto, precio) y la foto a la derecha.
 * Todas las medidas se escalan con la altura (`k`), así sirve igual para 3:1 y 16:9.
 */
function dibujarHorizontal(ctx: CanvasRenderingContext2D, o: OpcionesDibujo, pl: ReturnType<typeof plantillaPorId>, W: number, H: number) {
  const k = H / 600;
  const m = 50 * k;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, pl.fondo[0]);
  g.addColorStop(1, pl.fondo[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (o.escena) pintarEscena(ctx, o.escena, W, H, true);

  // Foto a la derecha
  const colX = W * 0.56;
  const fotoX = colX;
  const fotoY = m;
  const fotoW = W - colX - m;
  const fotoH = H - m * 2;
  if (o.foto && o.recortada) {
    dibujarFotoRecortada(ctx, o.foto, fotoX, fotoY, fotoW, fotoH, pl.acento, k, !o.escena);
  } else {
    ctx.save();
    rectRedondeado(ctx, fotoX, fotoY, fotoW, fotoH, 30 * k);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
    if (o.foto) {
      const fw = o.fotoAncho || (o.foto as any).width || (o.foto as any).naturalWidth || fotoW;
      const fh = o.fotoAlto || (o.foto as any).height || (o.foto as any).naturalHeight || fotoH;
      const escala = Math.max(fotoW / fw, fotoH / fh);
      ctx.drawImage(o.foto, fotoX + (fotoW - fw * escala) / 2, fotoY + (fotoH - fh * escala) / 2, fw * escala, fh * escala);
    } else {
      ctx.fillStyle = pl.texto;
      ctx.globalAlpha = 0.5;
      ctx.font = `600 ${34 * k}px ${FUENTE}`;
      ctx.textAlign = 'center';
      ctx.fillText('Agrega tu foto', fotoX + fotoW / 2, fotoY + fotoH / 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Etiqueta de descuento sobre la foto
  const menos = porcentajeMenos(o.precio, o.precioAntes);
  if (menos > 0) {
    const bw = 190 * k;
    const bh = 80 * k;
    const bx = fotoX + fotoW - bw - 12 * k;
    const by = fotoY + 12 * k;
    ctx.fillStyle = pl.acento;
    rectRedondeado(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = pl.sobreAcento;
    ctx.font = `800 ${46 * k}px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`-${menos}%`, bx + bw / 2, by + bh / 2 + 2 * k);
  }

  // Texto a la izquierda
  const anchoTexto = colX - m - 30 * k;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (o.tienda) {
    ctx.fillStyle = pl.texto;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 ${30 * k}px ${FUENTE}`;
    const [linea] = partirLineas((t) => ctx.measureText(t).width, o.tienda, anchoTexto, 1);
    ctx.fillText(linea, m, m + 26 * k);
    ctx.globalAlpha = 1;
  }
  const lineasMax = H / W > 0.45 ? 3 : 2; // el 16:9 tiene más alto: caben tres renglones
  const tam = (lineasMax === 3 ? 66 : 76) * k;
  ctx.fillStyle = pl.texto;
  ctx.font = `800 ${tam}px ${FUENTE}`;
  let y = m + (o.tienda ? 120 : 84) * k;
  for (const l of partirLineas((t) => ctx.measureText(t).width, o.titulo, anchoTexto, lineasMax)) {
    ctx.fillText(l, m, y);
    y += tam * 1.08;
  }
  if (o.texto?.trim()) {
    ctx.font = `400 ${34 * k}px ${FUENTE}`;
    ctx.globalAlpha = 0.9;
    y += 4 * k;
    for (const l of partirLineas((t) => ctx.measureText(t).width, o.texto, anchoTexto, 2)) {
      ctx.fillText(l, m, y);
      y += 34 * k * 1.3;
    }
    ctx.globalAlpha = 1;
  }

  // Precio abajo
  if (o.precio) {
    const ph = 100 * k;
    const pieY = H - m;
    ctx.font = `800 ${64 * k}px ${FUENTE}`;
    const txt = formatoPesos(o.precio);
    const pw = ctx.measureText(txt).width + 60 * k;
    ctx.fillStyle = pl.acento;
    rectRedondeado(ctx, m, pieY - ph, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = pl.sobreAcento;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, m + 30 * k, pieY - ph / 2 + 3 * k);
    if (o.precioAntes && menos > 0) {
      ctx.fillStyle = pl.texto;
      ctx.globalAlpha = 0.75;
      ctx.font = `500 ${36 * k}px ${FUENTE}`;
      const antes = `antes ${formatoPesos(o.precioAntes)}`;
      const ax = m + pw + 24 * k;
      if (ax + ctx.measureText(antes).width <= colX - 10 * k) {
        ctx.fillText(antes, ax, pieY - ph / 2 + 3 * k);
        ctx.fillRect(ax, pieY - ph / 2 + 3 * k, ctx.measureText(antes).width, 4 * k); // tachado
      }
      ctx.globalAlpha = 1;
    }
  }
}

export function dibujarPublicacion(canvas: HTMLCanvasElement, o: OpcionesDibujo): void {
  const base = plantillaPorId(o.plantilla);
  const pl = o.escena ? { ...base, texto: '#ffffff' } : base; // sobre una escena el texto va en blanco
  const fm = formatoPorId(o.formato);
  canvas.width = fm.ancho;
  canvas.height = fm.alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = fm.ancho;
  const H = fm.alto;
  if (W / H >= 1.5) return dibujarHorizontal(ctx, o, pl, W, H);
  const vertical = H > W;
  const margen = 60;
  const ancho = W - margen * 2;

  // Fondo
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pl.fondo[0]);
  g.addColorStop(1, pl.fondo[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (o.escena) pintarEscena(ctx, o.escena, W, H, false);

  // Foto (recortada para llenar el recuadro, o sin fondo flotando sobre un círculo de color)
  const fotoY = vertical ? 110 : margen;
  const fotoH = vertical ? 1020 : 600;
  if (o.foto && o.recortada) {
    dibujarFotoRecortada(ctx, o.foto, margen, fotoY, ancho, fotoH, pl.acento, 1, !o.escena);
  } else {
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
  }

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
