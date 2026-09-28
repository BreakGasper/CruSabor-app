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
  iconosSubidos,
  validarArchivoIcono,
  cargarIconosDe,
  tematicasQueUsan,
  __resetIconos,
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
  piezas: [{ imagen: 'arana.svg', animacion: 'colgando', posicion: 'derecha', tamano: 'mediano' }],
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
  __resetIconos();
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

  it('normaliza valores raros y exige al menos una imagen', () => {
    expect(normalizarTematica({ nombre: 'x' })).toBeNull();
    expect(normalizarTematica({ nombre: 'x', piezas: [{ animacion: 'flotando' }] })).toBeNull();
    const t = normalizarTematica({
      piezas: [{ imagen: 'a.gif', animacion: 'bailando' }, { imagen: 'b.gif', posicion: 'arriba' }],
      pantallas: ['cocina'],
      desde: 'mañana',
    })!;
    expect(t.piezas[0].animacion).toBe('colgando');
    expect(t.piezas[1].posicion).toBe('derecha');
    expect(t.pantallas).toEqual(['login']);
    expect(t.desde).toBe('');
  });

  it('las temáticas del formato anterior (una sola imagen) se convierten en una decoración', () => {
    const t = normalizarTematica({ nombre: 'Vieja', imagen: 'calavera.svg', animacion: 'caminando', posicion: 'izquierda', tamano: 'grande' })!;
    expect(t.piezas).toEqual([{ imagen: 'calavera.svg', animacion: 'caminando', posicion: 'izquierda', tamano: 'grande' }]);
  });

  it('Firebase puede devolver las piezas como objeto {0:…, 2:…}', () => {
    const t = normalizarTematica({ piezas: { 0: { imagen: 'a.gif' }, 2: { imagen: 'b.gif' } } })!;
    expect(t.piezas.map((p) => p.imagen)).toEqual(['a.gif', 'b.gif']);
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

  it('pinta cada decoración con su animación, sin estorbar los toques; omite las que no tienen imagen', () => {
    const w = mount(TematicaDecoracion, {
      props: {
        piezas: [
          { imagen: 'arana.svg', animacion: 'colgando', posicion: 'derecha', tamano: 'mediano' },
          { imagen: 'calavera.svg', animacion: 'caminando', posicion: 'izquierda', tamano: 'grande' },
          { imagen: 'no-existe.gif', animacion: 'flotando', posicion: 'centro', tamano: 'chico' },
        ],
      },
    });
    expect(w.find('[data-testid="tematica"]').attributes('aria-hidden')).toBe('true');
    const piezas = w.findAll('[data-testid="pieza"]');
    expect(piezas).toHaveLength(2);
    expect(piezas[0].classes()).toContain('anim-colgando');
    expect(piezas[1].classes()).toEqual(expect.arrayContaining(['anim-caminando', 'pos-izquierda']));
    expect(piezas[0].find('.hilo').exists()).toBe(true);
  });
});

describe('iconos subidos desde el admin', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  it('solo acepta imágenes de hasta 300 KB', () => {
    expect(validarArchivoIcono({ type: 'image/gif', size: 200 * 1024 })).toBeNull();
    expect(validarArchivoIcono({ type: 'image/gif', size: 301 * 1024 })).toContain('300 KB');
    expect(validarArchivoIcono({ type: 'application/pdf', size: 10 })).toContain('Formato');
  });

  it('se guardan fuera de configuracion y los clientes descargan solo los que usa la temática', async () => {
    __reset({
      configuracion: {},
      iconosTematica: { i1: { nombre: 'vela.gif', datos: PNG, bytes: 10 }, i2: { nombre: 'otro.gif', datos: PNG, bytes: 10 } },
    });
    await cargarIconosDe([{ imagen: 'subido:i1', animacion: 'flotando', posicion: 'centro', tamano: 'chico' }]);
    expect(Object.keys(iconosSubidos.value)).toEqual(['i1']);
    const w = mount(TematicaDecoracion, {
      props: { piezas: [{ imagen: 'subido:i1', animacion: 'flotando', posicion: 'centro', tamano: 'chico' }] },
    });
    expect(w.find('img').attributes('src')).toBe(PNG);
  });

  it('avisa qué temáticas usan un icono', () => {
    const t = tematica({ nombre: 'Muertos', piezas: [{ imagen: 'subido:i1', animacion: 'flotando', posicion: 'centro', tamano: 'chico' }] });
    expect(tematicasQueUsan({ a: t, b: tematica() }, 'subido:i1')).toEqual(['Muertos']);
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
      piezas: [{ imagen: 'arana.svg', animacion: 'colgando' }],
      pantallas: ['login', 'login-tienda'],
      paleta: 'naranja-cacao',
      activa: true,
    });
  });

  it('varias decoraciones: agregar una segunda con otra imagen y guardarla', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    await w.find('#tem-nombre').setValue('Día de Muertos');
    await w.find('[data-testid="img-calavera.svg"]').setValue(true);
    await w.findAll('button').find((b) => b.text().includes('Agregar otra decoración'))!.trigger('click');
    // La nueva queda seleccionada y sin imagen: no se puede guardar hasta elegirle una
    expect(w.findAll('button').find((b) => b.text() === 'Guardar temática')!.attributes('disabled')).toBeDefined();
    await w.find('[data-testid="img-arana.svg"]').setValue(true);
    await w.find('#pz-anim-1').setValue('asomandose');
    await w.findAll('button').find((b) => b.text() === 'Guardar temática')!.trigger('click');
    await flushPromises();

    const [t] = Object.values<any>(__getAt('configuracion/apariencia/tematicas'));
    expect(t.piezas).toEqual([
      { imagen: 'calavera.svg', animacion: 'colgando', posicion: 'derecha', tamano: 'mediano' },
      { imagen: 'arana.svg', animacion: 'asomandose', posicion: 'izquierda', tamano: 'mediano' },
    ]);
  });

  it('subir un icono lo guarda en iconosTematica y lo asigna a la decoración seleccionada', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    const archivo = new File([new Uint8Array([71, 73, 70, 56])], 'vela.gif', { type: 'image/gif' });
    const input = w.find('[data-testid="subir-icono"]');
    Object.defineProperty(input.element, 'files', { value: [archivo] });
    await input.trigger('change');
    await new Promise((r) => setTimeout(r, 20));
    await flushPromises();

    const iconos = __getAt('iconosTematica');
    const [id] = Object.keys(iconos);
    expect(iconos[id]).toMatchObject({ nombre: 'vela.gif', bytes: 4 });
    expect(iconos[id].datos).toMatch(/^data:image\/gif;base64,/);
    const radio = w.find('[data-testid="img-vela.gif"]');
    expect(radio.exists()).toBe(true);
    expect((radio.element as HTMLInputElement).checked).toBe(true);
    expect(__getAt('configuracion/apariencia')).toBeUndefined();
  });

  it('un archivo muy pesado no se sube y explica por qué', async () => {
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs } });
    await flushPromises();
    const grande = new File([new Uint8Array(400 * 1024)], 'enorme.gif', { type: 'image/gif' });
    const input = w.find('[data-testid="subir-icono"]');
    Object.defineProperty(input.element, 'files', { value: [grande] });
    await input.trigger('change');
    await flushPromises();
    expect(__getAt('iconosTematica')).toBeUndefined();
    expect(w.find('[role="alert"]').text()).toContain('300 KB');
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
