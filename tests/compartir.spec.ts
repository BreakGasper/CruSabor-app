/**
 * Compartir el perfil de una tienda: enlaces por destino, menú del sistema en el
 * teléfono y lista de respaldo en escritorio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import {
  urlAbsoluta,
  urlPerfilTienda,
  urlProducto,
  textoCompartirProducto,
  textoCompartirTienda,
  textoConUrl,
  enlaceWhatsApp,
  enlaceFacebook,
  enlaceDestino,
  hayCompartirNativo,
  compartirNativo,
  copiarTexto,
} from '@/composables/useCompartir';
import BotonCompartir from '@/components/BotonCompartir.vue';
import ProductDetail from '@/modules/home/components/ProductDetail.vue';
import StoreProfile from '@/modules/store/views/StoreProfile.vue';
import { __reset } from './mocks/firebaseDb';
import { __setEnvioPorTienda } from '@/composables/useEnvioTienda';
import { sessionUser } from '@/utils/sessionUser';
import { routeMock } from './setup';

vi.mock('@/composables/useAuth', () => ({ fetchUsuarioById: vi.fn(async () => null) }));

const ORIGEN = 'https://mrapp-b8d1e.web.app';

/** navigator.share no existe en jsdom: se pone y se quita en cada prueba */
function ponerShare(impl: ((d: any) => Promise<void>) | null) {
  if (impl) {
    Object.defineProperty(navigator, 'share', { value: impl, configurable: true, writable: true });
  } else {
    delete (navigator as any).share;
  }
}

afterEach(() => ponerShare(null));

describe('enlaces y textos', () => {
  it('arma el enlace del perfil desde la ruta, sin la query del momento', () => {
    expect(urlPerfilTienda('t1', ORIGEN)).toBe(`${ORIGEN}/store/profile/t1`);
    // el origen nunca trae query ni hash, así que ?pago=exito no puede colarse
    expect(urlPerfilTienda('t1', ORIGEN)).not.toContain('?');
  });

  it('tolera origen con diagonal final y ruta sin diagonal inicial', () => {
    expect(urlAbsoluta('store/profile/t1', `${ORIGEN}/`)).toBe(`${ORIGEN}/store/profile/t1`);
  });

  it('el mensaje usa el nombre y, si hay, la categoría', () => {
    expect(textoCompartirTienda('Pastelería Lola')).toBe('Mira Pastelería Lola en MAVI');
    expect(textoCompartirTienda('Pastelería Lola', 'Postres')).toBe('Mira Pastelería Lola (Postres) en MAVI');
    expect(textoCompartirTienda('  ')).toBe('Mira esta tienda en MAVI');
  });

  it('junta texto y enlace en un solo mensaje', () => {
    expect(textoConUrl('Hola', 'https://x.mx')).toBe('Hola\nhttps://x.mx');
    expect(textoConUrl('', 'https://x.mx')).toBe('https://x.mx');
  });

  it('WhatsApp recibe el mensaje codificado y deja elegir contacto', () => {
    const url = `${ORIGEN}/store/profile/t1`;
    const enlace = enlaceWhatsApp('Mira Pastelería Lola en MAVI', url);
    expect(enlace.startsWith('https://wa.me/?text=')).toBe(true);
    // el acento, el salto de línea y los dos puntos van codificados
    expect(enlace).not.toContain(' ');
    expect(decodeURIComponent(enlace.split('text=')[1])).toBe(`Mira Pastelería Lola en MAVI\n${url}`);
  });

  it('cada destino arma su propio enlace', () => {
    const c = { titulo: 'Lola', texto: 'Mira Lola', url: `${ORIGEN}/store/profile/t1` };
    expect(enlaceDestino('whatsapp', c)).toContain('wa.me');
    expect(enlaceDestino('facebook', c)).toBe(enlaceFacebook(c.url));
    expect(enlaceDestino('telegram', c)).toContain('t.me/share');
    expect(enlaceDestino('correo', c)).toContain('mailto:?subject=Lola');
  });
});

describe('menú del sistema', () => {
  it('sin navigator.share avisa que no hay soporte', async () => {
    expect(hayCompartirNativo()).toBe(false);
    expect(await compartirNativo({ titulo: 'a', texto: 'b', url: 'c' })).toBe('sin-soporte');
  });

  it('comparte con el título, el texto y el enlace', async () => {
    const share = vi.fn(async () => {});
    ponerShare(share);
    expect(await compartirNativo({ titulo: 'Lola', texto: 'Mira Lola', url: 'https://x.mx' })).toBe('compartido');
    expect(share).toHaveBeenCalledWith({ title: 'Lola', text: 'Mira Lola', url: 'https://x.mx' });
  });

  it('cerrar la hoja del sistema no es un error', async () => {
    ponerShare(async () => {
      const e: any = new Error('cancelado');
      e.name = 'AbortError';
      throw e;
    });
    expect(await compartirNativo({ titulo: 'a', texto: 'b', url: 'c' })).toBe('cancelado');
  });
});

describe('BotonCompartir', () => {
  const props = { titulo: 'Pastelería Lola', texto: 'Mira Pastelería Lola en MAVI', url: `${ORIGEN}/store/profile/t1` };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('en el teléfono usa el menú del sistema y no muestra la lista propia', async () => {
    const share = vi.fn(async () => {});
    ponerShare(share);
    const w = mount(BotonCompartir, { props, attachTo: document.body });

    await w.get('button.compartir-btn').trigger('click');
    await flushPromises();

    expect(share).toHaveBeenCalledOnce();
    expect(document.querySelector('.cmp-fondo')).toBeNull();
    expect(w.emitted('compartido')).toHaveLength(1);
    w.unmount();
  });

  it('en escritorio abre la lista con el enlace correcto de WhatsApp', async () => {
    const w = mount(BotonCompartir, { props, attachTo: document.body });

    await w.get('button.compartir-btn').trigger('click');
    await flushPromises();

    const hoja = document.querySelector('.cmp-fondo');
    expect(hoja).not.toBeNull();
    const wa = hoja!.querySelector<HTMLAnchorElement>('a[href*="wa.me"]');
    expect(wa).not.toBeNull();
    expect(decodeURIComponent(wa!.href)).toContain(props.url);
    expect(decodeURIComponent(wa!.href)).toContain('Mira Pastelería Lola en MAVI');
    // y los demás destinos
    expect(hoja!.querySelector('a[href*="facebook.com/sharer"]')).not.toBeNull();
    expect(hoja!.querySelector('a[href^="mailto:"]')).not.toBeNull();
    w.unmount();
  });

  it('copiar enlace confirma en el propio botón', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const w = mount(BotonCompartir, { props, attachTo: document.body });

    await w.get('button.compartir-btn').trigger('click');
    await flushPromises();

    const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('.cmp-cuerpo button'));
    const copiar = botones.find((b) => b.textContent?.includes('Copiar enlace'))!;
    expect(copiar).toBeDefined();
    copiar.click();
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(props.url);
    expect(document.querySelector('.cmp-cuerpo')!.textContent).toContain('¡Enlace copiado!');
    w.unmount();
  });

  it('copiarTexto usa el portapapeles cuando existe', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copiarTexto('https://x.mx')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://x.mx');
  });
});

/* =========================================================================
 *  DETALLE DE PRODUCTO
 * ========================================================================= */

describe('compartir un producto', () => {
  it('arma el enlace de la ruta pública del artículo', () => {
    expect(urlProducto('p1', ORIGEN)).toBe(`${ORIGEN}/producto/p1`);
  });

  it('el mensaje nombra el artículo y su tienda, sin precio', () => {
    expect(textoCompartirProducto('Pastel de chocolate', 'Pastelería Lola')).toBe(
      'Mira Pastel de chocolate de Pastelería Lola en MAVI',
    );
    expect(textoCompartirProducto('Pastel de chocolate')).toBe('Mira Pastel de chocolate en MAVI');
    expect(textoCompartirProducto('')).toBe('Mira este producto en MAVI');
    // el precio cambia por variante: dejarlo fuera evita contradecir la pantalla que abre quien recibe
    expect(textoCompartirProducto('Pastel', 'Lola')).not.toMatch(/\d/);
  });
});

describe('ProductDetail: botón de compartir', () => {
  const TIENDA = 'tienda-1';
  const articulo = {
    articuloId: 'p1',
    nombre: 'Pastel de chocolate',
    url: '',
    precio: 120,
    descripcion: 'rico',
    tiendaId: TIENDA,
    tiendaNombre: 'Pastelería Lola',
    categoria: 'Postres',
    variantes: [{ sku: 'S-1', stock: 5, precio: 120, url: '', detalle: 'd' }],
  } as any;

  beforeEach(async () => {
    document.body.innerHTML = '';
    __reset({
      tiendas: { [TIENDA]: { nombreTienda: 'Pastelería Lola', envioDomicilio: true, telefono: '1', metodosPago: ['Efectivo'], horario: {} } },
      articulos: { p1: { ...articulo, articuloId: undefined } },
      pedidos: {},
    });
    __setEnvioPorTienda(null);
    sessionUser.value = { id: 'cliente-1', nombre: 'Cliente' } as any;
  });

  afterEach(() => {
    __setEnvioPorTienda(null);
    sessionUser.value = null as any;
    localStorage.clear();
  });

  it('comparte el enlace del producto, no el de la pantalla actual', async () => {
    const w = mount(ProductDetail, {
      props: { producto: articulo },
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, CartButton: true, transition: false } },
    });
    await flushPromises();

    await w.get('button.compartir-btn').trigger('click');
    await flushPromises();

    const wa = document.querySelector<HTMLAnchorElement>('.cmp-fondo a[href*="wa.me"]');
    expect(wa).not.toBeNull();
    const mensaje = decodeURIComponent(wa!.href);
    expect(mensaje).toContain('/producto/p1');
    expect(mensaje).toContain('Mira Pastel de chocolate de Pastelería Lola en MAVI');
    w.unmount();
  });
});

/* =========================================================================
 *  RAÍZ ÚNICA
 * ========================================================================= */

describe('BotonCompartir hereda el scope del padre', () => {
  /**
   * El componente debe tener UN solo nodo raíz. Con dos (el botón y el Teleport)
   * Vue no le pasa el `data-v-` del padre y cualquier regla scoped del padre
   * —posición, márgenes, centrado— deja de aplicar sin avisar.
   */
  it('el envoltorio lleva también el data-v de la pantalla que lo usa', async () => {
    __reset({
      tiendas: { t1: { nombreTienda: 'Lola', envioDomicilio: true, telefono: '1', metodosPago: ['Efectivo'], horario: {}, blog: 'https://lola.mx' } },
      articulos: {},
      pedidos: {},
    });
    __setEnvioPorTienda(null);
    routeMock.params = { id: 't1' };

    const w = mount(StoreProfile, {
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, CartButton: true, transition: false } },
    });
    await flushPromises();
    await flushPromises();

    const card = document.querySelector('.card-section')!;
    const boton = document.querySelector('.compartir-tienda')!;
    const scopes = (el: Element) => Array.from(el.attributes).map((a) => a.name).filter((n) => n.startsWith('data-v-'));

    expect(boton).toBeTruthy();
    const scopeDeLaPantalla = scopes(card)[0];
    expect(scopes(boton)).toContain(scopeDeLaPantalla);
    w.unmount();
  });
});
