/**
 * Enlaces a las redes de la tienda.
 *
 * La tienda escribe la dirección de su perfil y, si marca la casilla, en el
 * perfil público el icono lleva a esa red en una pestaña nueva (o en la app del
 * teléfono). Lo que se teclea acaba en un `href` que ven todos los clientes, así
 * que solo se aceptan http y https.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset } from './mocks/firebaseDb';
import { routeMock } from './setup';
import { normalizarEnlace, esEnlaceValido, textoEnlace } from '@/utils/enlaces';
import { __setEnvioPorTienda } from '@/composables/useEnvioTienda';

vi.mock('@/composables/useAuth', () => ({ fetchUsuarioById: vi.fn(async () => null) }));

import StoreProfile from '@/modules/store/views/StoreProfile.vue';

describe('normalizarEnlace (regla pura)', () => {
  it('completa con https lo que se copia sin esquema', () => {
    expect(normalizarEnlace('facebook.com/lola')).toBe('https://facebook.com/lola');
    expect(normalizarEnlace('  instagram.com/lola  ')).toBe('https://instagram.com/lola');
  });

  it('respeta http y https tal cual', () => {
    expect(normalizarEnlace('https://instagram.com/lola')).toBe('https://instagram.com/lola');
    expect(normalizarEnlace('http://facebook.com/lola')).toBe('http://facebook.com/lola');
  });

  it('RECHAZA esquemas peligrosos: acaban en un href que ven los clientes', () => {
    expect(normalizarEnlace('javascript:alert(1)')).toBeNull();
    expect(normalizarEnlace('JavaScript:alert(1)')).toBeNull();
    expect(normalizarEnlace('data:text/html,<script>x</script>')).toBeNull();
    expect(normalizarEnlace('file:///etc/passwd')).toBeNull();
  });

  it('rechaza lo que no es una dirección', () => {
    expect(normalizarEnlace('')).toBeNull();
    expect(normalizarEnlace('   ')).toBeNull();
    expect(normalizarEnlace('hola')).toBeNull(); // sin punto no es un dominio
    expect(normalizarEnlace(null)).toBeNull();
  });

  it('esEnlaceValido responde lo mismo, en booleano', () => {
    expect(esEnlaceValido('facebook.com/lola')).toBe(true);
    expect(esEnlaceValido('javascript:alert(1)')).toBe(false);
  });

  it('textoEnlace lo deja legible, sin esquema ni barra final', () => {
    expect(textoEnlace('https://facebook.com/lola/')).toBe('facebook.com/lola');
  });
});

describe('Perfil de tienda · redes', () => {
  const T = 't1';
  const base = {
    nombreTienda: 'Lola',
    telefono: '1',
    metodosPago: ['Efectivo'],
    horario: {},
    envioDomicilio: true,
  };

  const montar = async (tienda: Record<string, unknown>) => {
    __reset({ tiendas: { [T]: { ...base, ...tienda } }, articulos: {}, pedidos: {} });
    __setEnvioPorTienda(null);
    routeMock.params = { id: T };
    const w = mount(StoreProfile, {
      attachTo: document.body,
      global: { stubs: { FontAwesomeIcon: true, ArrowBack: true, PageHeader: true, CartButton: true, transition: false } },
    });
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('con enlace: el nombre es un <a> que abre en pestaña nueva y protegido con rel', async () => {
    const w = await montar({ facebook: 'Pastelería Lola', facebookUrl: 'https://facebook.com/lola' });

    const a = document.querySelector('a.red-enlace-perfil') as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute('href')).toBe('https://facebook.com/lola');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.textContent).toContain('Pastelería Lola');
    w.unmount();
  });

  it('sin enlace: se muestra el nombre pero NO es un <a>', async () => {
    const w = await montar({ facebook: 'Pastelería Lola' });

    expect(document.querySelector('a.red-enlace-perfil')).toBeNull();
    const span = document.querySelector('span.red-enlace-perfil');
    expect(span).not.toBeNull();
    expect(span!.textContent).toContain('Pastelería Lola');
    w.unmount();
  });

  it('un enlace peligroso guardado en la base no llega a ser href', async () => {
    const w = await montar({ facebook: 'Lola', facebookUrl: 'javascript:alert(1)' });

    // se degrada a texto: nunca se pinta el javascript: en un href
    expect(document.querySelector('a.red-enlace-perfil')).toBeNull();
    expect(document.body.innerHTML).not.toContain('javascript:alert');
    w.unmount();
  });

  it('cada red lleva a la suya', async () => {
    const w = await montar({
      facebook: 'Lola FB',
      facebookUrl: 'facebook.com/lola',
      instagram: 'Lola IG',
      instagramUrl: 'instagram.com/lola',
    });

    const enlaces = Array.from(document.querySelectorAll('a.red-enlace-perfil')) as HTMLAnchorElement[];
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute('href')).toBe('https://facebook.com/lola');
    expect(enlaces[1].getAttribute('href')).toBe('https://instagram.com/lola');
    w.unmount();
  });
});
