import { generarDecor, burst, poligono, type Borrador } from './decor';
import { orientacionDe, type DatosProducto, type DecorId, type Elem, type Estilo, type LayoutId, type Paleta } from './tipos';
import { ajustarTexto, crearRng, esClaro, formatearPrecio, porcentajeOferta, type Medir } from './util';

/**
 * Motores de composición. Cada layout reparte el lienzo en ZONAS que no se tocan (cabecera, título, producto,
 * precio, datos, descripción) y coloca cada bloque dentro de la suya, ajustando el tamaño del texto para que
 * quepa: por construcción nada se encima ni se sale. `verificar()` (util.ts) lo comprueba en las pruebas.
 */

export interface EntradaLayout {
  w: number;
  h: number;
  datos: DatosProducto;
  /** Medidas reales de la foto */
  prod: { w: number; h: number };
  estilo: Estilo;
  paleta: Paleta;
  layout: LayoutId;
  semilla: number;
  medir: Medir;
  decor: DecorId[];
}

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface OpTxt {
  tamMax: number;
  tamMin?: number;
  maxLineas?: number;
  peso?: number;
  fuente: string;
  fill: string;
  alinear?: 'left' | 'center' | 'right';
  interlineado?: number;
  valign?: 'top' | 'middle' | 'bottom';
  sombra?: Elem['sombra'];
  rot?: number;
  permiteSolape?: boolean;
  espaciado?: number;
  opacidad?: number;
  mayus?: boolean;
  tachado?: boolean;
}

type FormaPrecio = 'chapa' | 'burst' | 'plano';

export function construirLayout(e: EntradaLayout): Elem[] {
  const { w, h, datos, estilo, paleta, medir } = e;
  const out: Elem[] = [];
  let n = 0;
  const add = (b: Borrador): Elem => {
    const el = { ...b, id: `e${++n}` } as Elem;
    out.push(el);
    return el;
  };
  const rng = crearRng(e.semilla);
  const m = Math.round(Math.min(w, h) * 0.05);
  const g = Math.round(m * 0.6);
  const ori = orientacionDe(w, h);
  const sombraTitulo = estilo.id === 'minimalista' || estilo.id === 'catalogo' ? undefined : { color: 'rgba(0,0,0,0.35)', blur: 14, x: 0, y: 5 };
  // Si hay papel picado arriba, el contenido empieza debajo para no tapar el nombre de la tienda
  const reservaSup = e.decor.includes('papel-picado') ? Math.round(h * 0.1) : 0;
  const precioTxt = formatearPrecio(datos.precio);
  const antesTxt = datos.precioAntes && datos.precio && datos.precioAntes > datos.precio ? formatearPrecio(datos.precioAntes) : '';
  const pct = porcentajeOferta(datos.precio, datos.precioAntes);

  /* ---------- fondo y recursos ---------- */
  add({ tipo: 'rect', rol: 'fondo', nombre: 'Fondo', x: 0, y: 0, w, h, degradado: { tipo: 'lineal', colores: [paleta.fondoA, paleta.fondoB] } });
  for (const d of e.decor) for (const b of generarDecor(d, { w, h, rng, paleta })) add(b);

  /* ---------- bloques ---------- */
  const txt = (rol: string, nombre: string, caja: Caja, contenido: string, o: OpTxt): Elem | null => {
    const t = (o.mayus ? contenido.toUpperCase() : contenido).trim();
    if (!t || caja.w < 24 || caja.h < 12) return null;
    const interl = o.interlineado ?? 1.12;
    const aj = ajustarTexto(medir, t, caja.w, caja.h, { tamMax: o.tamMax, tamMin: o.tamMin, maxLineas: o.maxLineas ?? 2, peso: o.peso ?? 700, fuente: o.fuente, interlineado: interl, espaciado: o.espaciado });
    const y = o.valign === 'middle' ? caja.y + (caja.h - aj.alto) / 2 : o.valign === 'bottom' ? caja.y + caja.h - aj.alto : caja.y;
    return add({
      tipo: 'texto', rol, nombre, x: caja.x, y, w: caja.w, h: aj.alto, texto: aj.lineas.join('\n'), fuente: o.fuente, tam: aj.tam, peso: o.peso ?? 700,
      alinear: o.alinear ?? 'left', fill: o.fill, interlineado: interl, espaciado: o.espaciado, sombra: o.sombra, rot: o.rot, permiteSolape: o.permiteSolape, opacidad: o.opacidad, tachado: o.tachado,
    });
  };

  const cabecera = (caja: Caja) => {
    let x = caja.x;
    if (datos.conLogo) {
      add({ tipo: 'imagen', rol: 'logo', nombre: 'Logo de la tienda', x, y: caja.y, w: caja.h, h: caja.h, imagen: 'logo', ajuste: 'contener' });
      x += caja.h + g;
    }
    txt('tienda', 'Nombre de la tienda', { x, y: caja.y, w: caja.x + caja.w - x, h: caja.h }, datos.tienda, { tamMax: caja.h * 0.62, tamMin: 14, maxLineas: 1, peso: 800, fuente: estilo.fuenteTexto, fill: paleta.titulo, valign: 'middle', mayus: true, espaciado: 0.04 });
  };

  /** Foto del producto: tarjeta redondeada, o libre; cubre la caja si la foto se parece a ella, y si no, entra completa */
  const producto = (caja: Caja, o: { modo: 'tarjeta' | 'libre' | 'sangrado'; rot?: number; rx?: number; mascara?: 'circulo' | 'arco' | 'capsula'; anillo?: string }): Elem => {
    const asp = e.prod.w / e.prod.h;
    const caspect = caja.w / caja.h;
    const cubrir = !!o.mascara || o.modo === 'sangrado' || Math.abs(Math.log(caspect / asp)) < 0.5;
    let b = { ...caja };
    if (o.mascara) {
      // La forma fija la caja: círculo = cuadrado; arco y cápsula = alargadas hacia arriba
      const ancho = o.mascara === 'circulo' ? Math.min(caja.w, caja.h) : Math.min(caja.w, caja.h * (o.mascara === 'arco' ? 0.78 : 0.62));
      const alto = o.mascara === 'circulo' ? ancho : caja.h;
      b = { x: caja.x + (caja.w - ancho) / 2, y: caja.y + (caja.h - alto) / 2, w: ancho, h: alto };
    }
    if (o.rot) b = { x: caja.x + caja.w * 0.03, y: caja.y + caja.h * 0.03, w: caja.w * 0.94, h: caja.h * 0.94 };
    if (!cubrir && !o.mascara) {
      const aspB = b.w / b.h;
      const pw = asp > aspB ? b.w : b.h * asp;
      const ph = asp > aspB ? b.w / asp : b.h;
      b = { x: b.x + (b.w - pw) / 2, y: b.y + (b.h - ph) / 2, w: pw, h: ph };
    }
    const rx = o.mascara === 'capsula' ? Math.round(b.w / 2) : o.rx ?? (o.modo === 'sangrado' ? 0 : Math.round(Math.min(b.w, b.h) * 0.05));
    if (o.modo === 'tarjeta' || o.modo === 'libre') {
      add({ tipo: o.mascara === 'circulo' ? 'circle' : 'rect', rol: 'decor-sombra', nombre: 'Sombra del producto', x: b.x, y: b.y, w: b.w, h: b.h, rx, fill: 'rgba(0,0,0,0.001)', rot: o.rot, sombra: { color: 'rgba(0,0,0,0.38)', blur: 40, x: 0, y: 18 } });
    }
    return add({
      tipo: 'imagen', rol: 'producto', nombre: 'Foto del producto', x: b.x, y: b.y, w: b.w, h: b.h, imagen: 'producto', ajuste: cubrir ? 'cubrir' : 'contener', rx, rot: o.rot, mascara: o.mascara,
      ...(o.anillo && o.mascara !== 'arco' ? { stroke: o.anillo, strokeW: Math.max(6, Math.round(b.w * 0.014)) } : o.modo === 'tarjeta' ? { stroke: '#ffffff', strokeW: Math.max(4, Math.round(b.w * 0.006)) } : {}),
    });
  };

  /** Etiqueta del precio (con "antes" tachado si hay) en la forma del estilo */
  const etiquetaPrecio = (caja: Caja, forma: FormaPrecio, o: { solape: boolean; alinear?: 'left' | 'center' | 'right'; rot?: number }) => {
    if (!precioTxt) return;
    let dentro = caja;
    let fill = paleta.sobreAcento;
    if (forma === 'chapa') {
      add({ tipo: 'rect', rol: 'precio-fondo', nombre: 'Etiqueta de precio', x: caja.x, y: caja.y, w: caja.w, h: caja.h, rx: Math.round(Math.min(caja.h * 0.5, 60)), fill: paleta.acento, permiteSolape: o.solape, sombra: { color: 'rgba(0,0,0,0.3)', blur: 18, x: 0, y: 6 } });
      const p = caja.h * 0.1;
      dentro = { x: caja.x + p * 1.4, y: caja.y + p, w: caja.w - p * 2.8, h: caja.h - p * 2 };
    } else if (forma === 'burst') {
      const s = Math.min(caja.w, caja.h);
      const cx = caja.x + caja.w / 2;
      const cy = caja.y + caja.h / 2;
      add(poligono(burst(cx, cy, s / 2, 18), { rol: 'precio-fondo', nombre: 'Explosión de precio', fill: paleta.acento, permiteSolape: o.solape, rot: o.rot, sombra: { color: 'rgba(0,0,0,0.3)', blur: 18, x: 0, y: 6 } }));
      const l = s * 0.66;
      dentro = { x: cx - l / 2, y: cy - l / 2, w: l, h: l };
    } else {
      fill = paleta.acento;
    }
    const alinear = forma === 'plano' ? o.alinear ?? 'left' : 'center';
    if (antesTxt) {
      txt('precio-antes', 'Precio anterior', { x: dentro.x, y: dentro.y, w: dentro.w, h: dentro.h * 0.28 }, `antes ${antesTxt}`, { tamMax: dentro.h * 0.2, tamMin: 12, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill, alinear, valign: 'middle', tachado: true, opacidad: 0.85, permiteSolape: o.solape });
      txt('precio', 'Precio', { x: dentro.x, y: dentro.y + dentro.h * 0.3, w: dentro.w, h: dentro.h * 0.7 }, precioTxt, { tamMax: dentro.h * 0.62, tamMin: 18, maxLineas: 1, peso: 900, fuente: estilo.fuentePrecio, fill, alinear, valign: 'middle', permiteSolape: o.solape });
    } else {
      txt('precio', 'Precio', dentro, precioTxt, { tamMax: dentro.h * 0.72, tamMin: 18, maxLineas: 1, peso: 900, fuente: estilo.fuentePrecio, fill, alinear, valign: 'middle', permiteSolape: o.solape });
    }
  };

  /** Etiqueta de descuento (-30%) sobre una esquina de la foto */
  const etiquetaOferta = (pb: Caja, lado: 'izq' | 'der') => {
    if (!pct) return;
    const s = Math.min(pb.w, pb.h) * 0.2;
    const caja = { x: lado === 'izq' ? pb.x + pb.w * 0.03 : pb.x + pb.w - s - pb.w * 0.03, y: pb.y + pb.h * 0.03, w: s, h: s };
    const fondoTag = paleta.acento2 === '#ffffff' ? paleta.acento : paleta.acento2;
    add(poligono(burst(caja.x + s / 2, caja.y + s / 2, s / 2, 14), { rol: 'oferta-fondo', nombre: 'Etiqueta de descuento', fill: fondoTag, permiteSolape: true }));
    const l = s * 0.7;
    txt('oferta', 'Descuento', { x: caja.x + (s - l) / 2, y: caja.y + (s - l) / 2, w: l, h: l }, `-${pct}%`, { tamMax: l * 0.55, tamMin: 12, maxLineas: 1, peso: 900, fuente: estilo.fuentePrecio, fill: esClaro(fondoTag) ? '#1c1d21' : '#ffffff', alinear: 'center', valign: 'middle', permiteSolape: true });
  };

  const items = (max: number) =>
    ([['Disponibilidad', datos.disponibilidad], ['Medidas', datos.medidas], ['Categoría', datos.categoria], ['Color', datos.color]] as [string, string][]).filter(([, v]) => String(v ?? '').trim()).slice(0, max);

  /** Datos en barras (cada uno con su etiqueta y valor) */
  const chips = (caja: Caja, lista: [string, string][], cols: number) => {
    if (!lista.length) return;
    const c = Math.min(cols, lista.length);
    const filas = Math.ceil(lista.length / c);
    const gap = Math.round(g * 0.7);
    const cw = (caja.w - gap * (c - 1)) / c;
    const ch = (caja.h - gap * (filas - 1)) / filas;
    lista.forEach(([k, v], i) => {
      const x = caja.x + (i % c) * (cw + gap);
      const y = caja.y + Math.floor(i / c) * (ch + gap);
      add({ tipo: 'rect', rol: 'barra', nombre: `Dato: ${k}`, x, y, w: cw, h: ch, rx: Math.round(ch * 0.22), fill: paleta.barra });
      const p = ch * 0.12;
      txt('info-etiqueta', `Etiqueta ${k}`, { x: x + p * 1.3, y: y + p, w: cw - p * 2.6, h: ch * 0.3 }, k, { tamMax: ch * 0.24, tamMin: 10, maxLineas: 1, peso: 700, fuente: estilo.fuenteTexto, fill: paleta.textoBarra, opacidad: 0.7, valign: 'middle', mayus: true, espaciado: 0.03 });
      txt('info', `Valor ${k}`, { x: x + p * 1.3, y: y + p + ch * 0.32, w: cw - p * 2.6, h: ch - p * 2 - ch * 0.32 }, v, { tamMax: ch * 0.34, tamMin: 11, maxLineas: 1, peso: 800, fuente: estilo.fuenteTexto, fill: paleta.textoBarra, valign: 'middle' });
    });
  };

  const descripcion = (caja: Caja, o: { sobreBarra?: boolean; alinear?: 'left' | 'center' } = {}) => {
    if (!datos.descripcion.trim()) return;
    let dentro = caja;
    let fill = paleta.texto;
    if (o.sobreBarra !== false) {
      add({ tipo: 'rect', rol: 'barra', nombre: 'Descripción (fondo)', x: caja.x, y: caja.y, w: caja.w, h: caja.h, rx: Math.round(Math.min(caja.h * 0.25, 28)), fill: paleta.barra });
      const p = caja.h * 0.14;
      dentro = { x: caja.x + p * 1.5, y: caja.y + p, w: caja.w - p * 3, h: caja.h - p * 2 };
      fill = paleta.textoBarra;
    }
    txt('descripcion', 'Descripción', dentro, datos.descripcion, { tamMax: Math.min(dentro.h * 0.42, w * 0.04), tamMin: 11, maxLineas: 3, peso: 500, fuente: estilo.fuenteTexto, fill, alinear: o.alinear ?? 'left', valign: 'middle', interlineado: 1.2 });
  };

  const bullets = (caja: Caja) => {
    const lista = datos.caracteristicas.map((c) => c.trim()).filter(Boolean).slice(0, 4);
    if (!lista.length) return;
    const fila = caja.h / lista.length;
    lista.forEach((c, i) => {
      const y = caja.y + i * fila;
      const d = Math.min(fila * 0.28, 14);
      add({ tipo: 'circle', rol: 'barra', nombre: 'Viñeta', x: caja.x, y: y + fila / 2 - d / 2, w: d, h: d, fill: paleta.acento });
      txt('caracteristica', `Característica ${i + 1}`, { x: caja.x + d + g, y, w: caja.w - d - g, h: fila }, c, { tamMax: fila * 0.6, tamMin: 11, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill: paleta.texto, valign: 'middle' });
    });
  };

  /* ---------- composición vertical / cuadrada ---------- */

  interface CfgApilado {
    tituloH: number;
    tituloAlinear: 'left' | 'center';
    precio: 'sobre-producto' | 'banda' | 'linea';
    modoProducto: 'tarjeta' | 'libre';
    rotProducto?: number;
    rotTitulo?: number;
    chips: boolean;
    ladoOferta: 'izq' | 'der';
    tituloMayus?: boolean;
  }

  const apilado = (cfg: CfgApilado) => {
    const x0 = m;
    const W = w - 2 * m;
    let y = m + reservaSup;
    const bottom = h - m;
    const cabH = datos.tienda || datos.conLogo ? Math.max(Math.round(h * 0.04), 44) : 0;
    if (cabH) {
      cabecera({ x: x0, y, w: W, h: cabH });
      y += cabH + g;
    }
    const lista = items(ori === 'v' ? 3 : 3);
    let tituloH = Math.round(h * cfg.tituloH);
    let descH = datos.descripcion.trim() ? Math.round(h * (ori === 'v' ? 0.085 : 0.11)) : 0;
    let chipsH = cfg.chips && lista.length ? Math.round(h * (ori === 'v' ? 0.075 : 0.1)) : 0;
    const bandaH = cfg.precio === 'banda' && precioTxt ? Math.round(h * (antesTxt ? 0.15 : 0.13)) : 0;
    const lineaH = cfg.precio === 'linea' && precioTxt ? Math.round(h * 0.075) : 0;
    const necesario = () => tituloH + descH + chipsH + bandaH + lineaH + g * (1 + (descH ? 1 : 0) + (chipsH ? 1 : 0) + (bandaH ? 1 : 0) + (lineaH ? 1 : 0));
    // La foto manda: si no queda al menos el 30 % del alto, primero se quita la descripción y luego los datos
    if (bottom - y - necesario() < h * 0.3) descH = 0;
    if (bottom - y - necesario() < h * 0.3) chipsH = 0;
    const prodH = Math.max(h * 0.2, bottom - y - necesario());

    // Título
    const tt = txt('titulo', 'Título', { x: x0, y, w: W, h: tituloH }, datos.nombre, {
      tamMax: Math.min(tituloH * 0.72, w * 0.13), tamMin: 22, maxLineas: tituloH > h * 0.15 ? 3 : 2, peso: 900, fuente: estilo.fuenteTitulo, fill: paleta.titulo,
      alinear: cfg.tituloAlinear, valign: 'middle', sombra: sombraTitulo, rot: cfg.rotTitulo, mayus: cfg.tituloMayus, interlineado: 1.05,
    });
    if (cfg.rotTitulo && tt) {
      // El texto inclinado necesita aire a los lados
      tt.x += W * 0.03;
      tt.w = W * 0.94;
    }
    y += tituloH + g;

    // Producto
    const pb = producto({ x: x0, y, w: W, h: prodH }, { modo: cfg.modoProducto, rot: cfg.rotProducto });
    etiquetaOferta(pb, cfg.ladoOferta);
    if (cfg.precio === 'sobre-producto' && precioTxt) {
      // Un precio sin fondo encima de la foto no se lee: ahí siempre va en etiqueta
      const forma: FormaPrecio = estilo.precioForma === 'plano' ? 'chapa' : estilo.precioForma;
      if (forma === 'burst') {
        const s = Math.min(pb.w, pb.h) * 0.34;
        etiquetaPrecio({ x: pb.x + pb.w - s - pb.w * 0.02, y: pb.y + pb.h - s - pb.h * 0.02, w: s, h: s }, 'burst', { solape: true, rot: cfg.rotProducto ? -8 : 0 });
      } else {
        const pw = Math.min(pb.w * 0.4, pb.h * 0.9);
        const ph = pw * (antesTxt ? 0.5 : 0.36);
        etiquetaPrecio({ x: pb.x + pb.w - pw - pb.w * 0.03, y: pb.y + pb.h - ph - pb.h * 0.03, w: pw, h: ph }, forma, { solape: true });
      }
    }
    y += prodH + g;

    // Precio en banda o en línea
    if (bandaH) {
      const forma: FormaPrecio = estilo.precioForma === 'plano' ? 'plano' : 'chapa';
      etiquetaPrecio({ x: x0, y, w: W, h: bandaH }, forma, { solape: false, alinear: 'center' });
      y += bandaH + g;
    }
    if (lineaH) {
      etiquetaPrecio({ x: x0, y, w: W, h: lineaH }, 'plano', { solape: false, alinear: cfg.tituloAlinear });
      y += lineaH + g;
    }
    if (chipsH) {
      chips({ x: x0, y, w: W, h: chipsH }, lista, lista.length);
      y += chipsH + g;
    }
    if (descH) descripcion({ x: x0, y: Math.min(y, bottom - descH), w: W, h: descH }, { sobreBarra: estilo.id !== 'minimalista', alinear: cfg.tituloAlinear });
  };

  /* ---------- composición horizontal (banner) ---------- */

  const lateral = (cfg: { lado: 'izq' | 'der'; precio: FormaPrecio; modoProducto: 'tarjeta' | 'libre'; rotProducto?: number; mascara?: 'circulo' }) => {
    const mitad = Math.round((w - 3 * m) * 0.5);
    const xProd = cfg.lado === 'izq' ? m : w - m - mitad;
    const xTxt = cfg.lado === 'izq' ? m * 2 + mitad : m;
    const pb = producto({ x: xProd, y: m + reservaSup, w: mitad, h: h - 2 * m - reservaSup }, { modo: cfg.modoProducto, rot: cfg.rotProducto, mascara: cfg.mascara, anillo: cfg.mascara ? paleta.acento : undefined });
    etiquetaOferta(pb, cfg.lado === 'izq' ? 'izq' : 'der');
    let y = m + reservaSup;
    const colH = h - 2 * m - reservaSup;
    const cabH = datos.tienda || datos.conLogo ? Math.max(Math.round(h * 0.06), 44) : 0;
    if (cabH) {
      cabecera({ x: xTxt, y, w: mitad, h: cabH });
      y += cabH + g;
    }
    const lista = items(4);
    const precioH = precioTxt ? Math.round(colH * (antesTxt ? 0.2 : 0.16)) : 0;
    const chipsH = lista.length ? Math.round(colH * (lista.length > 2 ? 0.24 : 0.12)) : 0;
    const descH = datos.descripcion.trim() ? Math.round(colH * 0.14) : 0;
    const resto = h - m - y - (precioH ? precioH + g : 0) - (chipsH ? chipsH + g : 0) - (descH ? descH + g : 0) - g;
    const tituloH = Math.max(h * 0.2, resto);
    txt('titulo', 'Título', { x: xTxt, y, w: mitad, h: tituloH }, datos.nombre, { tamMax: Math.min(tituloH * 0.5, h * 0.17), tamMin: 22, maxLineas: 3, peso: 900, fuente: estilo.fuenteTitulo, fill: paleta.titulo, valign: 'middle', sombra: sombraTitulo, interlineado: 1.05 });
    y += tituloH + g;
    if (precioH) {
      etiquetaPrecio({ x: xTxt, y, w: Math.min(mitad, precioH * 3.4), h: precioH }, cfg.precio === 'burst' ? 'chapa' : cfg.precio, { solape: false, alinear: 'left' });
      y += precioH + g;
    }
    if (chipsH) {
      chips({ x: xTxt, y, w: mitad, h: chipsH }, lista, lista.length > 2 ? 2 : lista.length);
      y += chipsH + g;
    }
    if (descH) descripcion({ x: xTxt, y, w: mitad, h: descH });
  };

  /* ---------- editorial: foto a sangre arriba y texto debajo ---------- */

  const editorial = () => {
    const prodH = Math.round(h * (ori === 'v' ? 0.54 : 0.5));
    const pb = producto({ x: 0, y: 0, w, h: prodH }, { modo: 'sangrado' });
    etiquetaOferta(pb, 'der');
    let y = prodH + g * 1.4;
    const x0 = m;
    const W = w - 2 * m;
    const filaH = Math.round(h * 0.15);
    const precioW = precioTxt ? Math.round(W * 0.36) : 0;
    txt('titulo', 'Título', { x: x0, y, w: W - precioW - (precioW ? g : 0), h: filaH }, datos.nombre, { tamMax: Math.min(filaH * 0.55, w * 0.1), tamMin: 22, maxLineas: 3, peso: 700, fuente: estilo.fuenteTitulo, fill: paleta.titulo, valign: 'middle', interlineado: 1.05, sombra: sombraTitulo });
    if (precioW) etiquetaPrecio({ x: x0 + W - precioW, y, w: precioW, h: filaH }, estilo.precioForma === 'plano' ? 'plano' : 'chapa', { solape: false, alinear: 'right' });
    y += filaH + g;
    add({ tipo: 'rect', rol: 'barra', nombre: 'Línea', x: x0, y, w: W, h: 3, fill: paleta.acento, opacidad: 0.8 });
    y += g;
    const descH = datos.descripcion.trim() ? Math.round(h * 0.09) : 0;
    const lista = items(3);
    const chipsH = lista.length ? Math.round(h * 0.07) : 0;
    const pie = datos.tienda ? Math.round(h * 0.03) : 0;
    if (descH) {
      descripcion({ x: x0, y, w: W, h: descH }, { sobreBarra: false });
      y += descH + g;
    }
    if (chipsH && y + chipsH <= h - m - (pie ? pie + g : 0)) {
      chips({ x: x0, y, w: W, h: chipsH }, lista, lista.length);
      y += chipsH + g;
    }
    if (pie) txt('tienda', 'Nombre de la tienda', { x: x0, y: h - m - pie, w: W, h: pie }, datos.tienda, { tamMax: pie * 0.8, tamMin: 12, maxLineas: 1, peso: 700, fuente: estilo.fuenteTexto, fill: paleta.texto, valign: 'middle', mayus: true, espaciado: 0.06, alinear: 'center', opacidad: 0.8 });
  };

  /* ---------- catálogo: encabezado, foto, tabla técnica y precio abajo ---------- */

  const catalogo = () => {
    const x0 = m;
    const W = w - 2 * m;
    const encH = Math.round(h * 0.075);
    add({ tipo: 'rect', rol: 'barra', nombre: 'Encabezado', x: 0, y: 0, w, h: encH, fill: paleta.acento });
    const cab = datos.tienda || datos.conLogo;
    if (cab) {
      let x = x0;
      if (datos.conLogo) {
        add({ tipo: 'imagen', rol: 'logo', nombre: 'Logo de la tienda', x, y: encH * 0.12, w: encH * 0.76, h: encH * 0.76, imagen: 'logo', ajuste: 'contener' });
        x += encH * 0.76 + g;
      }
      txt('tienda', 'Nombre de la tienda', { x, y: encH * 0.1, w: W * 0.6 - (x - x0), h: encH * 0.8 }, datos.tienda, { tamMax: encH * 0.5, tamMin: 14, maxLineas: 1, peso: 800, fuente: estilo.fuenteTexto, fill: paleta.sobreAcento, valign: 'middle', mayus: true, espaciado: 0.04 });
    }
    txt('categoria', 'Categoría', { x: x0 + W * 0.62, y: encH * 0.1, w: W * 0.38, h: encH * 0.8 }, datos.categoria, { tamMax: encH * 0.42, tamMin: 12, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill: paleta.sobreAcento, valign: 'middle', alinear: 'right', mayus: true });
    let y = encH + g;
    const pieH = precioTxt ? Math.round(h * 0.1) : 0;
    const tituloH = Math.round(h * 0.1);
    const filas = [['Medidas', datos.medidas], ['Color', datos.color], ['Disponibilidad', datos.disponibilidad]].filter(([, v]) => String(v).trim()) as [string, string][];
    const bulletsH = datos.caracteristicas.filter((c) => c.trim()).length ? Math.round(h * 0.03) * Math.min(4, datos.caracteristicas.filter((c) => c.trim()).length) + g : 0;
    const filaH = Math.round(h * 0.04);
    const tablaH = filas.length * filaH + bulletsH;
    const descH = datos.descripcion.trim() ? Math.round(h * 0.08) : 0;
    const reservado = tituloH + g + (descH ? descH + g : 0) + (tablaH ? tablaH + g : 0) + (pieH ? pieH + g : 0) + m;
    const prodH = Math.max(h * 0.25, h - y - reservado);
    txt('titulo', 'Título', { x: x0, y, w: W, h: tituloH }, datos.nombre, { tamMax: Math.min(tituloH * 0.62, w * 0.075), tamMin: 20, maxLineas: 2, peso: 800, fuente: estilo.fuenteTitulo, fill: paleta.titulo, valign: 'middle', interlineado: 1.05 });
    y += tituloH + g;
    const pb = producto({ x: x0, y, w: W, h: prodH }, { modo: 'tarjeta' });
    etiquetaOferta(pb, 'izq');
    y += prodH + g;
    if (descH) {
      descripcion({ x: x0, y, w: W, h: descH }, { sobreBarra: false });
      y += descH + g;
    }
    if (tablaH) {
      // Panel detrás de la tabla: se lee igual aunque debajo haya colinas, rayos u otro recurso
      const claro = esClaro(paleta.fondoA);
      add({ tipo: 'rect', rol: 'barra', nombre: 'Fondo de la tabla', x: x0 - g * 0.6, y: y - g * 0.4, w: W + g * 1.2, h: tablaH + g * 0.8, rx: 18, fill: claro ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.38)' });
    }
    filas.forEach(([k, v]) => {
      txt('info-etiqueta', `Etiqueta ${k}`, { x: x0, y, w: W * 0.4, h: filaH }, k, { tamMax: filaH * 0.62, tamMin: 11, maxLineas: 1, peso: 700, fuente: estilo.fuenteTexto, fill: paleta.texto, opacidad: 0.7, valign: 'middle', mayus: true });
      txt('info', `Valor ${k}`, { x: x0 + W * 0.4, y, w: W * 0.6, h: filaH }, v, { tamMax: filaH * 0.7, tamMin: 11, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill: paleta.texto, valign: 'middle', alinear: 'right' });
      add({ tipo: 'rect', rol: 'barra', nombre: 'Línea de tabla', x: x0, y: y + filaH - 1, w: W, h: 2, fill: paleta.acento, opacidad: 0.25 });
      y += filaH;
    });
    if (bulletsH) {
      y += g * 0.5;
      bullets({ x: x0, y, w: W, h: bulletsH - g });
      y += bulletsH;
    }
    if (pieH) {
      add({ tipo: 'rect', rol: 'barra', nombre: 'Pie de precio', x: 0, y: h - pieH - m * 0.5, w, h: pieH + m * 0.5, fill: paleta.acento });
      const caja = { x: x0, y: h - pieH - m * 0.5 + pieH * 0.1, w: W, h: pieH * 0.8 };
      if (antesTxt) txt('precio-antes', 'Precio anterior', { x: caja.x, y: caja.y, w: caja.w * 0.4, h: caja.h }, `antes ${antesTxt}`, { tamMax: caja.h * 0.4, tamMin: 12, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill: paleta.sobreAcento, valign: 'middle', tachado: true, opacidad: 0.8 });
      txt('precio', 'Precio', { x: caja.x + caja.w * 0.4, y: caja.y, w: caja.w * 0.6, h: caja.h }, precioTxt, { tamMax: caja.h * 0.86, tamMin: 18, maxLineas: 1, peso: 900, fuente: estilo.fuentePrecio, fill: paleta.sobreAcento, valign: 'middle', alinear: 'right' });
    }
  };


  /* ---------- familia "cartel": tipografía enorme y foto con forma ---------- */

  /** Reparte `total` px entre bloques según su peso, respetando un mínimo; devuelve el alto de cada uno */
  const repartir = (total: number, bloques: { peso: number; min: number }[]): number[] => {
    const suma = bloques.reduce((s, b) => s + b.peso, 0) || 1;
    return bloques.map((b) => Math.max(b.min, Math.round((total * b.peso) / suma)));
  };

  /** Título en dos niveles: lo de antes de la última palabra va chico y la última palabra, enorme ("NOCHE DE" / "PIZZAS") */
  const tituloCartel = (caja: Caja, o: { alinear: 'center' | 'left'; color: string; sombra?: Elem['sombra'] }) => {
    const palabras = datos.nombre.trim().split(/\s+/).filter(Boolean);
    if (!palabras.length) return;
    const base = { peso: 900, fuente: estilo.fuenteTitulo, fill: o.color, alinear: o.alinear, mayus: true, interlineado: 0.95, sombra: o.sombra, valign: 'middle' as const };
    if (palabras.length === 1 || datos.nombre.trim().length < 9) {
      txt('titulo', 'Título', caja, datos.nombre, { ...base, tamMax: caja.h * 0.85, tamMin: 22, maxLineas: 2 });
      return;
    }
    const ultima = palabras.pop() as string;
    const alto1 = Math.round(caja.h * 0.4);
    txt('titulo', 'Título (primera línea)', { x: caja.x, y: caja.y, w: caja.w, h: alto1 }, palabras.join(' '), { ...base, tamMax: alto1 * 0.72, tamMin: 18, maxLineas: 2, valign: 'bottom' });
    txt('titulo-2', 'Título (palabra grande)', { x: caja.x, y: caja.y + alto1, w: caja.w, h: caja.h - alto1 }, ultima, { ...base, tamMax: (caja.h - alto1) * 1.0, tamMin: 22, maxLineas: 1, valign: 'top' });
  };

  const textoCta = (caja: Caja, color: string, alinear: 'center' | 'left' = 'center') => {
    const cta = datos.cta.trim();
    const tel = datos.telefono.trim();
    if (!cta && !tel) return;
    if (cta && tel) {
      txt('cta', 'Llamada a la acción', { x: caja.x, y: caja.y, w: caja.w, h: caja.h * 0.42 }, cta, { tamMax: caja.h * 0.34, tamMin: 14, maxLineas: 1, peso: 500, fuente: estilo.fuenteTexto, fill: color, alinear, valign: 'middle' });
      txt('telefono', 'Teléfono', { x: caja.x, y: caja.y + caja.h * 0.44, w: caja.w, h: caja.h * 0.56 }, tel, { tamMax: caja.h * 0.46, tamMin: 16, maxLineas: 1, peso: 800, fuente: estilo.fuenteTexto, fill: color, alinear, valign: 'middle', espaciado: 0.03 });
    } else {
      txt(cta ? 'cta' : 'telefono', cta ? 'Llamada a la acción' : 'Teléfono', caja, cta || tel, { tamMax: caja.h * 0.5, tamMin: 16, maxLineas: 1, peso: cta ? 500 : 800, fuente: estilo.fuenteTexto, fill: color, alinear, valign: 'middle' });
    }
  };

  const cartel = () => {
    const sq = ori === 's';
    const x0 = m;
    const W = w - 2 * m;
    const kick = datos.kicker.trim() || datos.tienda.trim();
    const hayCta = !!(datos.cta.trim() || datos.telefono.trim());
    let usar = { desc: !!datos.descripcion.trim(), cta: hayCta };
    const alturas = () => ({
      k: kick ? Math.round(h * (sq ? 0.05 : 0.04)) : 0,
      t: Math.round(h * (sq ? 0.27 : 0.2)),
      d: usar.desc ? Math.round(h * (sq ? 0.085 : 0.07)) : 0,
      p: precioTxt ? Math.round(h * (sq ? 0.11 : 0.095)) : 0,
      c: usar.cta ? Math.round(h * (sq ? 0.12 : 0.105)) : 0,
    });
    const foto = () => {
      const a = alturas();
      const n = (a.k ? 1 : 0) + 1 + 1 + (a.d ? 1 : 0) + (a.p ? 1 : 0) + (a.c ? 1 : 0);
      return h - 2 * m - reservaSup - (a.k + a.t + a.d + a.p + a.c) - g * n;
    };
    // La foto manda: si queda chica, primero se quita la descripción y luego el pedido
    if (foto() < h * 0.28) usar = { ...usar, desc: false };
    if (foto() < h * 0.28) usar = { ...usar, cta: false };
    const a = alturas();
    let y = m + reservaSup;
    if (a.k) {
      txt('kicker', 'Texto superior', { x: x0, y, w: W, h: a.k }, kick, { tamMax: a.k * 0.78, tamMin: 14, maxLineas: 1, peso: 500, fuente: estilo.fuenteTexto, fill: paleta.texto, alinear: 'center', valign: 'middle', mayus: true, espaciado: 0.12 });
      y += a.k + g;
    }
    tituloCartel({ x: x0, y, w: W, h: a.t }, { alinear: 'center', color: paleta.titulo, sombra: sombraTitulo });
    y += a.t + g;
    const fh = Math.max(h * 0.2, foto());
    const pb = producto({ x: x0, y, w: W, h: fh }, { modo: 'libre', mascara: 'circulo', anillo: paleta.acento });
    etiquetaOferta(pb, 'der');
    y += fh + g;
    if (a.d) {
      txt('descripcion', 'Descripción', { x: x0, y, w: W, h: a.d }, datos.descripcion, { tamMax: a.d * 0.46, tamMin: 12, maxLineas: 2, peso: 500, fuente: estilo.fuenteTexto, fill: paleta.texto, alinear: 'center', valign: 'middle', mayus: true, interlineado: 1.1 });
      y += a.d + g;
    }
    if (a.p) {
      etiquetaPrecio({ x: x0, y, w: W, h: a.p }, 'plano', { solape: false, alinear: 'center' });
      y += a.p + g;
    }
    if (a.c) textoCta({ x: x0, y: Math.min(y, h - m - a.c), w: W, h: a.c }, paleta.titulo);
  };

  const bloques = () => {
    const sq = ori === 's';
    const x0 = m;
    const W = w - 2 * m;
    const colorBloque = paleta.acento2;
    const sobre = esClaro(colorBloque) ? '#1c1d21' : '#ffffff';
    const bloqueH = Math.round(h * (sq ? 0.55 : 0.5));
    add({ tipo: 'rect', rol: 'decor-bloque', nombre: 'Bloque de color', x: 0, y: 0, w, h: bloqueH, fill: colorBloque });
    let y = m + reservaSup;
    const kick = datos.kicker.trim() || datos.tienda.trim();
    const kH = kick ? Math.round(h * (sq ? 0.05 : 0.04)) : 0;
    if (kH) {
      txt('kicker', 'Texto superior', { x: x0, y, w: W, h: kH }, kick, { tamMax: kH * 0.78, tamMin: 14, maxLineas: 1, peso: 600, fuente: estilo.fuenteTexto, fill: sobre, alinear: 'center', valign: 'middle', mayus: true, espaciado: 0.12 });
      y += kH + g;
    }
    // La foto cruza el borde del bloque: un 22 % de ella queda sobre el fondo claro
    const d = Math.min(W * 0.86, (bloqueH - y) / 0.78);
    const pb = producto({ x: x0, y, w: W, h: d }, { modo: 'libre', mascara: 'circulo', anillo: '#ffffff' });
    etiquetaOferta(pb, 'izq');
    y = pb.y + pb.h + g;
    const quedan = h - m - y;
    const tiene = { d: !!datos.descripcion.trim(), p: !!precioTxt, c: !!(datos.cta.trim() || datos.telefono.trim()) };
    const [tH, dH, pH, cH] = repartir(quedan - g * (1 + (tiene.d ? 1 : 0) + (tiene.p ? 1 : 0) + (tiene.c ? 1 : 0)), [
      { peso: 0.42, min: 60 }, { peso: tiene.d ? 0.14 : 0, min: 0 }, { peso: tiene.p ? 0.22 : 0, min: 0 }, { peso: tiene.c ? 0.22 : 0, min: 0 },
    ]);
    tituloCartel({ x: x0, y, w: W, h: tH }, { alinear: 'center', color: paleta.titulo });
    y += tH + g;
    if (dH && tiene.d) {
      txt('descripcion', 'Descripción', { x: x0, y, w: W, h: dH }, datos.descripcion, { tamMax: dH * 0.5, tamMin: 12, maxLineas: 2, peso: 500, fuente: estilo.fuenteTexto, fill: paleta.texto, alinear: 'center', valign: 'middle', interlineado: 1.1 });
      y += dH + g;
    }
    if (pH && tiene.p) {
      etiquetaPrecio({ x: x0, y, w: W, h: pH }, 'plano', { solape: false, alinear: 'center' });
      y += pH + g;
    }
    if (cH && tiene.c) textoCta({ x: x0, y, w: W, h: cH }, paleta.titulo);
  };

  const arco = () => {
    const sq = ori === 's';
    const x0 = m;
    const W = w - 2 * m;
    const kick = datos.kicker.trim() || datos.tienda.trim();
    const hayCta = !!(datos.cta.trim() || datos.telefono.trim());
    let y = m + reservaSup;
    const kH = kick ? Math.round(h * (sq ? 0.05 : 0.04)) : 0;
    if (kH) {
      txt('kicker', 'Texto superior', { x: x0, y, w: W, h: kH }, kick, { tamMax: kH * 0.78, tamMin: 14, maxLineas: 1, peso: 500, fuente: estilo.fuenteTexto, fill: paleta.texto, alinear: 'center', valign: 'middle', mayus: true, espaciado: 0.12 });
      y += kH + g;
    }
    const tH = Math.round(h * (sq ? 0.25 : 0.19));
    tituloCartel({ x: x0, y, w: W, h: tH }, { alinear: 'center', color: paleta.titulo, sombra: sombraTitulo });
    y += tH + g;
    const dH = datos.descripcion.trim() ? Math.round(h * (sq ? 0.07 : 0.055)) : 0;
    if (dH) {
      txt('descripcion', 'Descripción', { x: x0, y, w: W, h: dH }, datos.descripcion, { tamMax: dH * 0.5, tamMin: 12, maxLineas: 2, peso: 500, fuente: estilo.fuenteTexto, fill: paleta.texto, alinear: 'center', valign: 'middle', interlineado: 1.1 });
      y += dH + g;
    }
    // Barra inferior a todo lo ancho con el pedido
    const cH = hayCta ? Math.round(h * (sq ? 0.14 : 0.115)) : 0;
    const barraY = h - cH;
    const fh = Math.max(h * 0.25, barraY - y - g * 1.5);
    const pb = producto({ x: x0, y, w: W, h: fh }, { modo: 'libre', mascara: 'arco' });
    etiquetaOferta(pb, 'izq');
    if (precioTxt) {
      const pw = Math.min(pb.w * 0.62, W * 0.5);
      const ph = pw * (antesTxt ? 0.46 : 0.32);
      etiquetaPrecio({ x: Math.min(pb.x + pb.w - pw * 0.78, w - m - pw), y: pb.y + pb.h - ph * 1.05, w: pw, h: ph }, 'chapa', { solape: true });
    }
    if (cH) {
      add({ tipo: 'rect', rol: 'barra', nombre: 'Barra de pedido', x: 0, y: barraY, w, h: cH, fill: paleta.acento });
      textoCta({ x: x0, y: barraY + cH * 0.12, w: W, h: cH * 0.76 }, paleta.sobreAcento);
    }
  };

  /* ---------- reglas por layout ---------- */

  const l = e.layout;
  if (l === 'cartel' && ori !== 'h') cartel();
  else if (l === 'bloques' && ori !== 'h') bloques();
  else if (l === 'arco' && ori !== 'h') arco();
  else if (l === 'catalog' && ori !== 'h') catalogo();
  else if (l === 'editorial' && ori !== 'h') editorial();
  else if (ori === 'h') {
    const lado = l === 'editorial' || l === 'price-focus' ? 'der' : 'izq';
    lateral({ lado, precio: l === 'minimal' || l === 'catalog' || l === 'editorial' || l === 'cartel' || l === 'bloques' || l === 'arco' ? 'plano' : estilo.precioForma, modoProducto: l === 'minimal' || l === 'cartel' || l === 'bloques' || l === 'arco' ? 'libre' : 'tarjeta', rotProducto: l === 'playful' ? -3 : undefined, mascara: l === 'cartel' || l === 'bloques' || l === 'arco' ? 'circulo' : undefined });
  } else if (l === 'price-focus') {
    apilado({ tituloH: 0.12, tituloAlinear: 'center', precio: 'banda', modoProducto: 'tarjeta', chips: true, ladoOferta: 'izq', tituloMayus: true });
  } else if (l === 'playful') {
    apilado({ tituloH: 0.16, tituloAlinear: 'center', precio: 'sobre-producto', modoProducto: 'tarjeta', rotProducto: 3, rotTitulo: -3, chips: true, ladoOferta: 'izq' });
  } else if (l === 'minimal') {
    apilado({ tituloH: 0.11, tituloAlinear: 'center', precio: 'linea', modoProducto: 'libre', chips: false, ladoOferta: 'der' });
  } else {
    // hero-product (y catálogo/editorial como respaldo)
    apilado({ tituloH: 0.17, tituloAlinear: 'center', precio: 'sobre-producto', modoProducto: 'tarjeta', chips: true, ladoOferta: 'izq' });
  }
  return out;
}
