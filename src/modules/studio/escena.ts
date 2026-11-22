import { Canvas, Ellipse, FabricImage, FabricObject, Gradient, Polygon, Rect, Shadow, StaticCanvas, Textbox, ActiveSelection } from 'fabric';
import { generarDecor, type Borrador } from './motor/decor';
import type { DecorId, Elem, Paleta } from './motor/tipos';
import { crearRng, type Medir } from './motor/util';

/**
 * Adaptador entre el motor de diseño (elementos neutros) y Fabric.js (el lienzo editable).
 * Todo local: nada se sube ni se descarga.
 */

/** Propiedades propias que se guardan con cada objeto (además de las de Fabric) */
export const PROPS = ['id', 'nombre', 'rol', 'bloqueado', 'lockMovementX', 'lockMovementY', 'lockRotation', 'lockScalingX', 'lockScalingY', 'selectable', 'evented', 'visible'];

export interface Imagenes {
  producto: string;
  logo?: string;
}

/* ---------- medir texto (misma fuente que se dibuja) ---------- */

let ctxMedir: CanvasRenderingContext2D | null = null;
export const medirTexto: Medir = (texto, tam, peso, fuente) => {
  if (!ctxMedir) ctxMedir = document.createElement('canvas').getContext('2d');
  if (!ctxMedir) return texto.length * tam * 0.55;
  ctxMedir.font = `${peso} ${Math.round(tam)}px ${fuente}`;
  return ctxMedir.measureText(texto).width;
};

export function dimensionesImagen(url: string): Promise<{ w: number; h: number }> {
  return new Promise((ok, mal) => {
    const i = new Image();
    i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => mal(new Error('No se pudo abrir la imagen.'));
    i.src = url;
  });
}

/* ---------- registro de imágenes (blob: ↔ archivo) para poder guardarlas en IndexedDB ---------- */

const blobs = new Map<string, Blob>();
export function registrarBlob(b: Blob): string {
  const url = URL.createObjectURL(b);
  blobs.set(url, b);
  return url;
}
export const blobDeUrl = (url: string) => blobs.get(url);

/** Cambia cada blob: del JSON por una clave @@img:N (para guardar el JSON liviano y las imágenes aparte) */
export function empaquetarJSON(json: string, urlABlob: (u: string) => Blob | undefined): { json: string; imagenes: Blob[] } {
  const imagenes: Blob[] = [];
  const vistos = new Map<string, number>();
  const salida = json.replace(/blob:[^"\\]+/g, (u) => {
    const b = urlABlob(u);
    if (!b) return u;
    if (!vistos.has(u)) {
      vistos.set(u, imagenes.length);
      imagenes.push(b);
    }
    return `@@img:${vistos.get(u)}`;
  });
  return { json: salida, imagenes };
}

export function desempaquetarJSON(json: string, imagenes: Blob[], crearUrl: (b: Blob) => string): string {
  const urls = imagenes.map((b) => crearUrl(b));
  return json.replace(/@@img:(\d+)/g, (_m, i) => urls[Number(i)] ?? '');
}

/* ---------- construir objetos de Fabric a partir de elementos del motor ---------- */

let contadorId = 0;
export const nuevoId = () => `o${Date.now().toString(36)}${(++contadorId).toString(36)}`;

function conRelleno(e: Elem): any {
  if (e.degradado) {
    const cols = e.degradado.colores;
    const stops = cols.map((color, i) => ({ offset: cols.length === 1 ? 0 : i / (cols.length - 1), color }));
    if (e.degradado.tipo === 'radial') {
      return new Gradient({ type: 'radial', gradientUnits: 'pixels', coords: { x1: e.w / 2, y1: e.h / 2, r1: 0, x2: e.w / 2, y2: e.h / 2, r2: e.w / 2 }, colorStops: stops });
    }
    return new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: 0, y2: e.h }, colorStops: stops });
  }
  return e.fill ?? 'rgba(0,0,0,0)';
}

const sombraDe = (s?: Elem['sombra']) => (s ? new Shadow({ color: s.color, blur: s.blur, offsetX: s.x, offsetY: s.y }) : undefined);

export async function construirObjetos(elems: Elem[], imgs: Imagenes): Promise<FabricObject[]> {
  const out: FabricObject[] = [];
  for (const e of elems) {
    const comunes: any = {
      originX: 'center', originY: 'center', left: e.x + e.w / 2, top: e.y + e.h / 2, angle: e.rot ?? 0, opacity: e.opacidad ?? 1,
      id: e.id, nombre: e.nombre, rol: e.rol, shadow: sombraDe(e.sombra),
    };
    let o: FabricObject | null = null;
    if (e.tipo === 'rect') {
      o = new Rect({ ...comunes, width: e.w, height: e.h, rx: e.rx ?? 0, ry: e.rx ?? 0, fill: conRelleno(e), stroke: e.stroke, strokeWidth: e.strokeW ?? (e.stroke ? 2 : 0) });
    } else if (e.tipo === 'circle') {
      o = new Ellipse({ ...comunes, rx: e.w / 2, ry: e.h / 2, fill: conRelleno(e), stroke: e.stroke, strokeWidth: e.strokeW ?? (e.stroke ? 2 : 0) });
    } else if (e.tipo === 'poly') {
      o = new Polygon((e.puntos ?? []).map(([x, y]) => ({ x, y })), { ...comunes, fill: conRelleno(e), stroke: e.stroke, strokeWidth: e.strokeW ?? 0, objectCaching: false });
    } else if (e.tipo === 'texto') {
      o = new Textbox(e.texto ?? '', {
        ...comunes, width: e.w, fontFamily: e.fuente, fontSize: e.tam, fontWeight: e.peso, fill: e.fill, textAlign: e.alinear ?? 'left',
        // Fabric multiplica la altura de línea por 1.13: se compensa para que ocupe lo mismo que midió el motor
        lineHeight: (e.interlineado ?? 1.12) / 1.13, charSpacing: Math.round((e.espaciado ?? 0) * 1000), linethrough: !!e.tachado, splitByGrapheme: false,
      });
    } else if (e.tipo === 'imagen') {
      const url = e.imagen === 'logo' ? imgs.logo : imgs.producto;
      if (!url) continue;
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      const iw = img.width;
      const ih = img.height;
      if (e.ajuste === 'cubrir') {
        const ba = e.w / e.h;
        const cw = iw / ih > ba ? ih * ba : iw;
        const ch = iw / ih > ba ? ih : iw / ba;
        img.set({ cropX: (iw - cw) / 2, cropY: (ih - ch) / 2, width: cw, height: ch, scaleX: e.w / cw, scaleY: e.h / ch });
        if (e.rx) img.set({ clipPath: new Rect({ width: cw, height: ch, rx: e.rx / (e.w / cw), ry: e.rx / (e.h / ch), originX: 'center', originY: 'center' }) });
      } else {
        const k = Math.min(e.w / iw, e.h / ih);
        img.set({ scaleX: k, scaleY: k });
        if (e.rx) img.set({ clipPath: new Rect({ width: iw, height: ih, rx: e.rx / k, ry: e.rx / k, originX: 'center', originY: 'center' }) });
      }
      img.set({ ...comunes });
      o = img;
      if (e.stroke) {
        // El borde de una imagen no sigue las esquinas redondeadas: se dibuja aparte
        out.push(new Rect({ ...comunes, id: `${e.id}-marco`, nombre: 'Marco de la foto', rol: 'producto-marco', width: e.w, height: e.h, rx: e.rx ?? 0, ry: e.rx ?? 0, fill: 'rgba(0,0,0,0)', stroke: e.stroke, strokeWidth: e.strokeW ?? 4, shadow: undefined }));
        out.splice(out.length - 1, 0, o);
        o = null;
      }
    }
    if (o) out.push(o);
  }
  return out;
}

/** Imagen en miniatura de una propuesta (sin abrir el editor) */
export async function miniatura(elems: Elem[], imgs: Imagenes, w: number, h: number, ancho = 360): Promise<string> {
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: w, height: h, renderOnAddRemove: false });
  try {
    for (const o of await construirObjetos(elems, imgs)) sc.add(o);
    sc.renderAll();
    return sc.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: ancho / w });
  } finally {
    sc.dispose();
  }
}

/* ---------- el editor ---------- */

export interface InfoCapa {
  id: string;
  nombre: string;
  tipo: string;
  visible: boolean;
  bloqueado: boolean;
  seleccionada: boolean;
}

export interface Seleccion {
  cantidad: number;
  id: string;
  tipo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  opacidad: number;
  fill: string;
  stroke: string;
  strokeW: number;
  fuente: string;
  tam: number;
  peso: number;
  alinear: string;
  interlineado: number;
  espaciado: number;
  texto: string;
  sombra: boolean;
  bloqueado: boolean;
}

const objId = (o: any): string => String(o?.id ?? '');

export class Escena {
  readonly canvas: Canvas;
  w: number;
  h: number;
  zoom = 1;
  alCambiar: () => void = () => {};
  alSeleccionar: () => void = () => {};
  alHistorial: () => void = () => {};
  private historial: string[] = [];
  private indice = -1;
  private ocupado = false;

  constructor(el: HTMLCanvasElement, w: number, h: number) {
    // Controles con el color del tema de Crustore (y borde claro para que se vean sobre diseños oscuros)
    const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const acento = css?.getPropertyValue('--color-acento').trim() || '#00a9c2';
    const boton = css?.getPropertyValue('--color-bg-blue-ligth').trim() || '#ff2e97';
    Object.assign(FabricObject.ownDefaults, { cornerColor: boton, cornerStrokeColor: '#ffffff', borderColor: acento, cornerStyle: 'circle', transparentCorners: false, cornerSize: 12, borderScaleFactor: 2, padding: 2 });
    this.w = w;
    this.h = h;
    this.canvas = new Canvas(el, { width: w, height: h, preserveObjectStacking: true, selection: true, backgroundColor: '#ffffff', stopContextMenu: true, fireRightClick: false });
    const registrar = () => this.registrar();
    this.canvas.on('object:modified', registrar);
    this.canvas.on('text:changed', registrar);
    this.canvas.on('selection:created', () => this.alSeleccionar());
    this.canvas.on('selection:updated', () => this.alSeleccionar());
    this.canvas.on('selection:cleared', () => this.alSeleccionar());
  }

  destruir() {
    void this.canvas.dispose();
  }

  /* ----- historial (deshacer / rehacer) ----- */

  private instantanea(): string {
    return JSON.stringify(this.canvas.toObject(PROPS));
  }

  /** Guarda el estado actual en el historial (y avisa que cambió) */
  registrar() {
    if (this.ocupado) return;
    const s = this.instantanea();
    if (s === this.historial[this.indice]) return;
    this.historial = this.historial.slice(0, this.indice + 1);
    this.historial.push(s);
    if (this.historial.length > 60) this.historial.shift();
    this.indice = this.historial.length - 1;
    this.alHistorial();
    this.alCambiar();
  }

  get puedeDeshacer() {
    return this.indice > 0;
  }
  get puedeRehacer() {
    return this.indice < this.historial.length - 1;
  }

  private async aplicarInstantanea(s: string) {
    this.ocupado = true;
    try {
      this.canvas.discardActiveObject();
      await this.canvas.loadFromJSON(s);
      this.canvas.renderAll();
    } finally {
      this.ocupado = false;
    }
    this.alHistorial();
    this.alCambiar();
    this.alSeleccionar();
  }

  async deshacer() {
    if (!this.puedeDeshacer) return;
    this.indice--;
    await this.aplicarInstantanea(this.historial[this.indice]);
  }

  async rehacer() {
    if (!this.puedeRehacer) return;
    this.indice++;
    await this.aplicarInstantanea(this.historial[this.indice]);
  }

  /* ----- cargar y guardar ----- */

  /** Reemplaza todo el contenido con los elementos del motor */
  async cargarElementos(elems: Elem[], imgs: Imagenes, w: number, h: number) {
    this.ocupado = true;
    try {
      this.canvas.discardActiveObject();
      this.canvas.clear();
      this.canvas.backgroundColor = '#ffffff';
      this.fijarTamano(w, h);
      for (const o of await construirObjetos(elems, imgs)) this.canvas.add(o);
      this.canvas.renderAll();
    } finally {
      this.ocupado = false;
    }
    this.historial = [];
    this.indice = -1;
    this.registrar();
  }

  /** Restaura un diseño guardado (JSON de Fabric) */
  async cargarJSON(json: string, w: number, h: number) {
    this.ocupado = true;
    try {
      this.canvas.discardActiveObject();
      this.fijarTamano(w, h);
      await this.canvas.loadFromJSON(json);
      this.canvas.renderAll();
    } finally {
      this.ocupado = false;
    }
    this.historial = [];
    this.indice = -1;
    this.registrar();
  }

  serializar(): string {
    return this.instantanea();
  }

  private fijarTamano(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas.setDimensions({ width: w, height: h });
    this.poner(this.zoom);
  }

  /* ----- zoom ----- */

  poner(z: number) {
    this.zoom = Math.min(4, Math.max(0.1, z));
    this.canvas.setDimensions({ width: Math.round(this.w * this.zoom), height: Math.round(this.h * this.zoom) }, { cssOnly: true });
  }

  ajustarA(ancho: number, alto: number) {
    this.poner(Math.min(ancho / this.w, alto / this.h, 1));
  }

  /* ----- capas ----- */

  objetos(): FabricObject[] {
    return this.canvas.getObjects();
  }

  capas(): InfoCapa[] {
    const act = new Set(this.canvas.getActiveObjects().map(objId));
    return [...this.objetos()].reverse().map((o: any) => ({
      id: objId(o), nombre: o.nombre || 'Elemento', tipo: o.type, visible: o.visible !== false, bloqueado: !!o.bloqueado, seleccionada: act.has(objId(o)),
    }));
  }

  porId(id: string): FabricObject | undefined {
    return this.objetos().find((o) => objId(o) === id);
  }

  seleccionar(id: string) {
    const o = this.porId(id);
    if (!o || (o as any).visible === false) return;
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.alSeleccionar();
  }

  deseleccionar() {
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  mover(id: string, donde: 'arriba' | 'abajo' | 'frente' | 'fondo') {
    const o = this.porId(id);
    if (!o) return;
    const lista = this.objetos();
    const i = lista.indexOf(o);
    const destino = donde === 'frente' ? lista.length - 1 : donde === 'fondo' ? 0 : donde === 'arriba' ? Math.min(lista.length - 1, i + 1) : Math.max(0, i - 1);
    this.canvas.moveObjectTo(o, destino);
    this.canvas.requestRenderAll();
    this.registrar();
  }

  alternarVisible(id: string) {
    const o = this.porId(id) as any;
    if (!o) return;
    o.set({ visible: !(o.visible !== false) });
    if (o.visible === false) this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.registrar();
  }

  alternarBloqueo(id: string) {
    const o = this.porId(id) as any;
    if (!o) return;
    const b = !o.bloqueado;
    o.set({ bloqueado: b, lockMovementX: b, lockMovementY: b, lockRotation: b, lockScalingX: b, lockScalingY: b, hasControls: !b });
    this.canvas.requestRenderAll();
    this.registrar();
    this.alSeleccionar();
  }

  renombrar(id: string, nombre: string) {
    const o = this.porId(id) as any;
    if (!o) return;
    o.set({ nombre: nombre.trim().slice(0, 40) || 'Elemento' });
    this.registrar();
  }

  /* ----- selección y propiedades ----- */

  seleccionActual(): Seleccion | null {
    const act = this.canvas.getActiveObjects();
    if (!act.length) return null;
    const o: any = this.canvas.getActiveObject();
    if (!o) return null;
    const multiple = act.length > 1;
    const w = o.getScaledWidth();
    const h = o.getScaledHeight();
    const centro = o.getCenterPoint();
    const esTexto = o.type === 'textbox' || o.type === 'text' || o.type === 'i-text';
    return {
      cantidad: act.length, id: multiple ? '' : objId(o), tipo: multiple ? 'multiple' : String(o.type), nombre: multiple ? `${act.length} elementos` : o.nombre || 'Elemento',
      x: Math.round(centro.x - w / 2), y: Math.round(centro.y - h / 2), w: Math.round(w), h: Math.round(h), rot: Math.round(o.angle || 0), opacidad: Math.round((o.opacity ?? 1) * 100),
      fill: typeof o.fill === 'string' ? o.fill : '#888888', stroke: typeof o.stroke === 'string' ? o.stroke : '', strokeW: o.strokeWidth || 0,
      fuente: o.fontFamily || '', tam: Math.round(o.fontSize || 0), peso: Number(o.fontWeight) || 400, alinear: o.textAlign || 'left',
      interlineado: Math.round((o.lineHeight || 1) * 1.13 * 100) / 100, espaciado: Math.round((o.charSpacing || 0) / 10) / 100, texto: esTexto ? String(o.text ?? '') : '', sombra: !!o.shadow, bloqueado: !!o.bloqueado,
    };
  }

  /** Aplica cambios a lo seleccionado (posición, tamaño, color, tipografía…) */
  aplicar(c: Partial<Seleccion>) {
    const act = this.canvas.getActiveObjects();
    if (!act.length) return;
    const unico: any = this.canvas.getActiveObject();
    const objetos: any[] = act.length > 1 && !('x' in c || 'y' in c || 'w' in c || 'h' in c || 'rot' in c) ? act : [unico];
    for (const o of objetos) {
      const set: any = {};
      if (c.opacidad !== undefined) set.opacity = Math.min(1, Math.max(0, c.opacidad / 100));
      if (c.fill !== undefined && o.type !== 'image') set.fill = c.fill;
      if (c.stroke !== undefined) set.stroke = c.stroke || undefined;
      if (c.strokeW !== undefined) set.strokeWidth = Math.max(0, c.strokeW);
      if (c.fuente !== undefined) set.fontFamily = c.fuente;
      if (c.tam !== undefined) set.fontSize = Math.max(8, c.tam);
      if (c.peso !== undefined) set.fontWeight = c.peso;
      if (c.alinear !== undefined) set.textAlign = c.alinear;
      if (c.interlineado !== undefined) set.lineHeight = Math.max(0.6, c.interlineado) / 1.13;
      if (c.espaciado !== undefined) set.charSpacing = Math.round(c.espaciado * 1000);
      if (c.texto !== undefined && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text')) set.text = c.texto;
      if (c.sombra !== undefined) set.shadow = c.sombra ? new Shadow({ color: 'rgba(0,0,0,0.4)', blur: 14, offsetX: 0, offsetY: 5 }) : undefined;
      o.set(set);
      if (c.w !== undefined && c.w > 0) {
        if (o.type === 'textbox') o.set({ width: c.w });
        else o.set({ scaleX: c.w / (o.width || 1) });
      }
      if (c.h !== undefined && c.h > 0 && o.type !== 'textbox') o.set({ scaleY: c.h / (o.height || 1) });
      if (c.rot !== undefined) o.rotate(c.rot);
      if (c.x !== undefined || c.y !== undefined) {
        const w = o.getScaledWidth();
        const h = o.getScaledHeight();
        const centro = o.getCenterPoint();
        o.setPositionByOrigin({ x: (c.x ?? centro.x - w / 2) + w / 2, y: (c.y ?? centro.y - h / 2) + h / 2 } as any, 'center', 'center');
      }
      o.setCoords();
    }
    this.canvas.requestRenderAll();
    this.registrar();
    this.alSeleccionar();
  }

  /* ----- acciones ----- */

  async duplicar() {
    const act = this.canvas.getActiveObjects();
    if (!act.length) return;
    this.canvas.discardActiveObject();
    const nuevos: FabricObject[] = [];
    for (const o of act) {
      const c: any = await o.clone(PROPS);
      c.set({ left: (o.left ?? 0) + 30, top: (o.top ?? 0) + 30, id: nuevoId(), nombre: `${(o as any).nombre || 'Elemento'} (copia)`, bloqueado: false, lockMovementX: false, lockMovementY: false, lockRotation: false, lockScalingX: false, lockScalingY: false, hasControls: true });
      this.canvas.add(c);
      nuevos.push(c);
    }
    this.canvas.setActiveObject(nuevos.length > 1 ? new ActiveSelection(nuevos, { canvas: this.canvas }) : nuevos[0]);
    this.canvas.requestRenderAll();
    this.registrar();
  }

  eliminar() {
    const act = this.canvas.getActiveObjects().filter((o: any) => !o.bloqueado);
    if (!act.length) return;
    this.canvas.discardActiveObject();
    act.forEach((o) => this.canvas.remove(o));
    this.canvas.requestRenderAll();
    this.registrar();
  }

  alinear(donde: 'izq' | 'centroH' | 'der' | 'arriba' | 'centroV' | 'abajo') {
    const act = this.canvas.getActiveObjects().filter((o: any) => !o.bloqueado);
    if (!act.length) return;
    const cajas = act.map((o) => {
      const w = o.getScaledWidth();
      const h = o.getScaledHeight();
      const c = o.getCenterPoint();
      return { o, w, h, x: c.x - w / 2, y: c.y - h / 2 };
    });
    // Un solo elemento se alinea al lienzo; varios, a la caja que forman
    const marco = cajas.length === 1 ? { x: 0, y: 0, w: this.w, h: this.h } : { x: Math.min(...cajas.map((c) => c.x)), y: Math.min(...cajas.map((c) => c.y)), w: 0, h: 0 };
    if (cajas.length > 1) {
      marco.w = Math.max(...cajas.map((c) => c.x + c.w)) - marco.x;
      marco.h = Math.max(...cajas.map((c) => c.y + c.h)) - marco.y;
    }
    // Se desagrupa para mover cada uno en coordenadas del lienzo
    this.canvas.discardActiveObject();
    for (const c of cajas) {
      let { x, y } = c;
      if (donde === 'izq') x = marco.x;
      if (donde === 'centroH') x = marco.x + (marco.w - c.w) / 2;
      if (donde === 'der') x = marco.x + marco.w - c.w;
      if (donde === 'arriba') y = marco.y;
      if (donde === 'centroV') y = marco.y + (marco.h - c.h) / 2;
      if (donde === 'abajo') y = marco.y + marco.h - c.h;
      c.o.setPositionByOrigin({ x: x + c.w / 2, y: y + c.h / 2 } as any, 'center', 'center');
      c.o.setCoords();
    }
    this.canvas.requestRenderAll();
    this.registrar();
  }

  distribuir(eje: 'h' | 'v') {
    const act = this.canvas.getActiveObjects().filter((o: any) => !o.bloqueado);
    if (act.length < 3) return;
    const cajas = act.map((o) => {
      const w = o.getScaledWidth();
      const h = o.getScaledHeight();
      const c = o.getCenterPoint();
      return { o, w, h, x: c.x - w / 2, y: c.y - h / 2 };
    });
    cajas.sort((a, b) => (eje === 'h' ? a.x - b.x : a.y - b.y));
    const ini = eje === 'h' ? cajas[0].x : cajas[0].y;
    const fin = eje === 'h' ? cajas[cajas.length - 1].x + cajas[cajas.length - 1].w : cajas[cajas.length - 1].y + cajas[cajas.length - 1].h;
    const suma = cajas.reduce((s, c) => s + (eje === 'h' ? c.w : c.h), 0);
    const hueco = (fin - ini - suma) / (cajas.length - 1);
    this.canvas.discardActiveObject();
    let pos = ini;
    for (const c of cajas) {
      if (eje === 'h') c.o.setPositionByOrigin({ x: pos + c.w / 2, y: c.y + c.h / 2 } as any, 'center', 'center');
      else c.o.setPositionByOrigin({ x: c.x + c.w / 2, y: pos + c.h / 2 } as any, 'center', 'center');
      c.o.setCoords();
      pos += (eje === 'h' ? c.w : c.h) + hueco;
    }
    this.canvas.requestRenderAll();
    this.registrar();
  }

  /* ----- agregar cosas ----- */

  private agregar(o: FabricObject, id = nuevoId()) {
    (o as any).set({ id });
    this.canvas.add(o);
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.registrar();
    return o;
  }

  agregarTexto(paleta: { texto: string; fuente: string }, texto = 'Escribe aquí') {
    const t = new Textbox(texto, { originX: 'center', originY: 'center', left: this.w / 2, top: this.h / 2, width: this.w * 0.6, fontFamily: paleta.fuente, fontSize: Math.round(this.w * 0.06), fontWeight: 800, fill: paleta.texto, textAlign: 'center', nombre: 'Texto' } as any);
    return this.agregar(t);
  }

  agregarForma(tipo: 'rect' | 'circulo' | 'linea', color: string) {
    const lado = Math.round(this.w * 0.25);
    const base: any = { originX: 'center', originY: 'center', left: this.w / 2, top: this.h / 2, fill: color };
    if (tipo === 'rect') return this.agregar(new Rect({ ...base, width: lado * 1.4, height: lado, rx: 16, ry: 16, nombre: 'Rectángulo' } as any));
    if (tipo === 'circulo') return this.agregar(new Ellipse({ ...base, rx: lado / 2, ry: lado / 2, nombre: 'Círculo' } as any));
    return this.agregar(new Rect({ ...base, width: lado * 2, height: 6, nombre: 'Línea' } as any));
  }

  /** Agrega un recurso de la biblioteca (confeti, estrellas…) como capas editables */
  async agregarDecor(id: DecorId, paleta: Paleta) {
    const borradores: Borrador[] = generarDecor(id, { w: this.w, h: this.h, rng: crearRng(Date.now() % 100000), paleta });
    const elems: Elem[] = borradores.map((b, i) => ({ ...b, id: nuevoId() + i }));
    const objs = await construirObjetos(elems, { producto: '' });
    this.canvas.discardActiveObject();
    for (const o of objs) this.canvas.add(o);
    this.canvas.requestRenderAll();
    this.registrar();
  }

  async agregarImagen(url: string, nombre = 'Imagen') {
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    const k = Math.min((this.w * 0.5) / img.width, (this.h * 0.5) / img.height);
    img.set({ originX: 'center', originY: 'center', left: this.w / 2, top: this.h / 2, scaleX: k, scaleY: k, nombre } as any);
    return this.agregar(img);
  }

  /** Fondo: color sólido o degradado para el rectángulo "Fondo" (o lo crea si falta) */
  poner_fondo(colores: string[]) {
    let f: any = this.objetos().find((o: any) => o.rol === 'fondo');
    if (!f) {
      f = new Rect({ originX: 'center', originY: 'center', left: this.w / 2, top: this.h / 2, width: this.w, height: this.h, nombre: 'Fondo', rol: 'fondo', id: nuevoId() } as any);
      this.canvas.add(f);
      this.canvas.moveObjectTo(f, 0);
    }
    const stops = colores.map((color, i) => ({ offset: colores.length === 1 ? 0 : i / (colores.length - 1), color }));
    f.set({ fill: colores.length === 1 ? colores[0] : new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: 0, y2: this.h }, colorStops: stops }) });
    this.canvas.requestRenderAll();
    this.registrar();
  }

  /* ----- exportar ----- */

  async exportar(o: { formato: 'png' | 'jpeg'; escala: number; calidad?: number }): Promise<Blob> {
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    const el = this.canvas.toCanvasElement(o.escala);
    return new Promise((ok, mal) => {
      try {
        el.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen.'))), o.formato === 'png' ? 'image/png' : 'image/jpeg', o.calidad ?? 0.92);
      } catch {
        mal(new Error('No se pudo exportar: alguna imagen no permite exportarse. Sube la foto desde tu equipo.'));
      }
    });
  }
}
