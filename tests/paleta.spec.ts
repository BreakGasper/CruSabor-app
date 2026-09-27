/**
 * Apariencia (`configuracion/apariencia`): paletas fijas y personalizadas (contraste
 * calculado), <html data-paleta> + localStorage, temáticas de temporada (fechas,
 * pantallas, una activa a la vez) y la pantalla Admin › Apariencia.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import {
  normalizarConfiguracion,
  __setConfiguracion,
  activarTematica,
  eliminarPaletaPersonalizada,
} from '@/composables/useConfiguracion';
import {
  aplicarPaleta,
  esPaleta,
  contraste,
  tokensPersonalizados,
  PALETA_DEFAULT,
  type PaletaPersonalizada,
} from '@/composables/usePaleta';
import {
  IMAGENES_TEMATICA,
  tematicaEnCurso,
  tematicaVigente,
  pantallaDeRuta,
  normalizarTematica,
  type Tematica,
} from '@/composables/useTematicas';
import AdminApariencia from '@/modules/admin/views/AdminApariencia.vue';
import TematicaDecoracion from '@/components/TematicaDecoracion.vue';

const stubs = { AdminTopbar: true };

const tematica = (extra: Partial<Tematica> = {}): Tematica => ({
  nombre: 'Halloween',
  imagen: 'arana.svg',
  animacion: 'colgando',
  posicion: 'derecha',
  tamano: 'mediano',
  pantallas: ['login'],
  paleta: '',
  activa: true,
  desde: '',
  hasta: '',
  ...extra,
});

beforeEach(() => {
  __reset({ configuracion: {} });
  __setConfiguracion(null);
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
  delete document.documentElement.dataset.paleta;
  document.getElementById('paleta-personalizada')?.remove();
});
afterEach(() => {
  __setConfiguracion(null);
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('paletas en la configuración', () => {
  it('por defecto es carbón y lima, sin paletas propias ni temáticas', () => {
    expect(PALETA_DEFAULT).toBe('carbon-lima');
    expect(normalizarConfiguracion(null).apariencia).toEqual({ paleta: 'carbon-lima', personalizadas: {}, tematicas: {} });
  });

  it('acepta las cuatro fijas y las propias que existen; ignora ids desconocidos y colores inválidos', () => {
    for (const id of ['rosa-negro', 'naranja-cacao', 'azul-anil']) {
      expect(normalizarConfiguracion({ apariencia: { paleta: id } }).apariencia.paleta).toBe(id);
    }
    const a = normalizarConfiguracion({
      apariencia: {
        paleta: 'mia',
        personalizadas: {
          mia: { nombre: 'Mía', cabecera: '#112233', boton: '#AA0000', resaltado: '#ffcc00' },
          rota: { nombre: 'Rota', cabecera: 'rojo', boton: '#000000', resaltado: '#ffffff' },
        },
      },
    }).apariencia;
    expect(a.paleta).toBe('mia');
    expect(a.personalizadas.mia.boton).toBe('#aa0000');
    expect(a.personalizadas.rota).toBeUndefined();
    expect(normalizarConfiguracion({ apariencia: { paleta: 'no-existe' } }).apariencia.paleta).toBe('carbon-lima');
    expect(esPaleta('mia', a.personalizadas)).toBe(true);
  });
});

describe('paleta personalizada: colores calculados', () => {
  const clara: PaletaPersonalizada = { nombre: 'Clarita', cabecera: '#a0d8ef', boton: '#ffe066', resaltado: '#ffd6e8' };

  it('el texto sobre botones y el texto de marca siempre se leen (≥ 4.5:1), en claro y en oscuro', () => {
    const { claro, oscuro } = tokensPersonalizados(clara);
    expect(contraste(claro['--color-bg-blue-ligth'], claro['--on-primary'])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(claro['--brand-blue-text'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(claro['--color-bg-blue-dark'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(oscuro['--brand-blue-text'], '#1a1a1a')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(oscuro['--color-bg-blue-dark'], '#ffffff')).toBeGreaterThanOrEqual(7);
  });

  it('aplicarPaleta inyecta su CSS, marca data-paleta="personalizada" y lo recuerda', () => {
    aplicarPaleta('p1', { p1: clara });
    expect(document.documentElement.dataset.paleta).toBe('personalizada');
    expect(document.getElementById('paleta-personalizada')?.textContent).toContain('--on-primary');
    expect(localStorage.getItem('paleta')).toBe('personalizada');
    expect(localStorage.getItem('paleta-css')).toContain(':root[data-paleta="personalizada"]');

    aplicarPaleta('azul-anil');
    expect(document.documentElement.dataset.paleta).toBe('azul-anil');
    expect(document.getElementById('paleta-personalizada')).toBeNull();
    expect(localStorage.getItem('paleta-css')).toBeNull();
  });

  it('un id que ya no existe cae en la de por defecto', () => {
    aplicarPaleta('borrada', {});
    expect(document.documentElement.dataset.paleta).toBe('carbon-lima');
  });

  it('borrar la paleta en uso regresa a la de por defecto y la quita de las temáticas', async () => {
    __reset({
      configuracion: {
        apariencia: {
          paleta: 'p1',
          personalizadas: { p1: clara },
          tematicas: { t1: tematica({ paleta: 'p1' }) },
        },
      },
    });
    __setConfiguracion(__getAt('configuracion'));
    await eliminarPaletaPersonalizada('p1');
    expect(__getAt('configuracion/apariencia/personalizadas/p1')).toBeUndefined();
    expect(__getAt('configuracion/apariencia/paleta')).toBe('carbon-lima');
    expect(__getAt('configuracion/apariencia/tematicas/t1/paleta')).toBe('');
  });
});

describe('temáticas', () => {
  it('las imágenes de ejemplo de src/assets/tematicas están disponibles', () => {
    expect(Object.keys(IMAGENES_TEMATICA)).toEqual(expect.arrayContaining(['arana.svg', 'calavera.svg']));
  });

  it('respeta activa y fechas', () => {
    expect(tematicaVigente(tematica(), '2026-10-31')).toBe(true);
    expect(tematicaVigente(tematica({ activa: false }), '2026-10-31')).toBe(false);
    const muertos = tematica({ desde: '2026-10-28', hasta: '2026-11-02' });
    expect(tematicaVigente(muertos, '2026-10-27')).toBe(false);
    expect(tematicaVigente(muertos, '2026-11-01')).toBe(true);
    expect(tematicaVigente(muertos, '2026-11-03')).toBe(false);
    expect(tematicaEnCurso({ a: tematica({ activa: false }), b: muertos }, '2026-11-01')?.[0]).toBe('b');
  });

  it('normaliza valores raros y exige imagen', () => {
    expect(normalizarTematica({ nombre: 'x' })).toBeNull();
    const t = normalizarTematica({ imagen: 'a.gif', animacion: 'bailando', pantallas: ['cocina'], desde: 'mañana' })!;
    expect(t.animacion).toBe('colgando');
    expect(t.pantallas).toEqual(['login']);
    expect(t.desde).toBe('');
  });

  it('cada pantalla corresponde a sus rutas', () => {
    expect(pantallaDeRuta('/login')).toBe('login');
    expect(pantallaDeRuta('/register')).toBe('login');
    expect(pantallaDeRuta('/store/login')).toBe('login-tienda');
    expect(pantallaDeRuta('/admin/login')).toBe('login-admin');
    expect(pantallaDeRuta('/')).toBe('inicio');
    expect(pantallaDeRuta('/cart')).toBeNull();
  });

  it('activar una temática apaga las demás', async () => {
    __reset({ configuracion: { apariencia: { tematicas: { a: tematica(), b: tematica({ activa: false }) } } } });
    __setConfiguracion(__getAt('configuracion'));
    await activarTematica('b');
    expect(__getAt('configuracion/apariencia/tematicas/a/activa')).toBe(false);
    expect(__getAt('configuracion/apariencia/tematicas/b/activa')).toBe(true);
    await activarTematica(null);
    expect(__getAt('configuracion/apariencia/tematicas/b/activa')).toBe(false);
  });

  it('la decoración no estorba los toques y usa la animación elegida', () => {
    const w = mount(TematicaDecoracion, { props: { tematica: tematica({ animacion: 'caminando' }), url: '/x.gif' } });
    const el = w.find('[data-testid="tematica"]');
    expect(el.classes()).toContain('anim-caminando');
    expect(el.attributes('aria-hidden')).toBe('true');
    expect(w.find('img').attributes('src')).toBe('/x.gif');
    expect(mount(TematicaDecoracion, { props: { tematica: tematica(), url: undefined } }).html()).not.toContain('img');
  });
});

describe('Admin › Apariencia', () => {
  it('"Usar" cambia la paleta de toda la app', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    expect(w.find('[data-testid="paleta-carbon-lima"]').text()).toContain('En uso');
    await w.find('[data-testid="paleta-naranja-cacao"] .btn-primary').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/apariencia/paleta')).toBe('naranja-cacao');
  });

  it('crear una paleta con "Guardar y usar" la guarda y la pone en uso', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    await w.find('#pal-nombre').setValue('Verde nopal');
    await w.find('#pal-boton').setValue('#2F7A3A');
    const [guardarYUsar] = w.findAll('button').filter((b) => b.text() === 'Guardar y usar');
    await guardarYUsar.trigger('click');
    await flushPromises();

    const propias = __getAt('configuracion/apariencia/personalizadas');
    const [id] = Object.keys(propias);
    expect(propias[id]).toMatchObject({ nombre: 'Verde nopal', boton: '#2f7a3a' });
    expect(__getAt('configuracion/apariencia/paleta')).toBe(id);
  });

  it('sin nombre no se puede guardar la paleta', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    const boton = w.findAll('button').find((b) => b.text() === 'Guardar paleta')!;
    expect(boton.attributes('disabled')).toBeDefined();
  });

  it('crear una temática de Halloween y activarla', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    await w.find('#tem-nombre').setValue('Halloween');
    await w.find('[data-testid="img-arana.svg"]').setValue(true);
    await w.find('[data-testid="pant-login-tienda"]').setValue(true);
    await w.find('#tem-paleta').setValue('naranja-cacao');
    const boton = w.findAll('button').find((b) => b.text() === 'Guardar y activar')!;
    await boton.trigger('click');
    await flushPromises();

    const tematicas = __getAt('configuracion/apariencia/tematicas');
    const [id] = Object.keys(tematicas);
    expect(tematicas[id]).toMatchObject({
      nombre: 'Halloween',
      imagen: 'arana.svg',
      pantallas: ['login', 'login-tienda'],
      paleta: 'naranja-cacao',
      activa: true,
    });
  });

  it('fechas al revés bloquean el guardado', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    await w.find('#tem-nombre').setValue('Muertos');
    await w.find('#tem-desde').setValue('2026-11-02');
    await w.find('#tem-hasta').setValue('2026-10-28');
    expect(w.text()).toContain('"Hasta" no puede ser antes de "Desde"');
    const boton = w.findAll('button').find((b) => b.text() === 'Guardar temática')!;
    expect(boton.attributes('disabled')).toBeDefined();
  });
});
