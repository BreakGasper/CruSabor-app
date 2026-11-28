/**
 * Sorteo en la pantalla principal: banner en el carrusel (con los logos de las tiendas participantes abajo), diálogo
 * para escribir el código, botón flotante en las tiendas patrocinadoras y el ganador con efecto de texto descifrado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { guardarSesion, cerrarSesion } from '@/utils/sessionUser';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { GLIFOS, crearPlanScramble, fotogramaScramble } from '@/utils/textScramble';
import { participarEnSorteo, sortearGanador, sorteosVisibles, patrocinaTienda } from '@/composables/useSorteos';
import { abrirDialogoSorteo } from '@/composables/dialogoSorteo';
import TextoDescifrado from '@/components/TextoDescifrado.vue';
import BannersCarousel from '@/modules/home/components/BannersCarousel.vue';
import BotonSorteoTienda from '@/modules/home/components/BotonSorteoTienda.vue';
import AdminSorteos from '@/modules/admin/views/AdminSorteos.vue';

const subirImagen = vi.fn(async (_f: File) => 'https://img/nuevo-banner.jpg');
const eliminarImagenes = vi.fn(async (_u: any) => {});
vi.mock('@/composables/useCloudinary', async (original) => ({
  ...(await original<any>()),
  uploadImage: (f: File) => subirImagen(f),
  eliminarImagenes: (u: any) => eliminarImagenes(u),
  eliminarImagenReemplazada: (a: any, b: any) => (a && a !== b ? eliminarImagenes([a]) : undefined),
}));

const sorteo = (extra: Record<string, any> = {}) => ({
  titulo: 'Sorteo de aniversario',
  descripcion: 'Pide tu código',
  premio: 'Una pantalla',
  imagenUrl: 'https://img/banner-sorteo.jpg',
  activo: true,
  fechaInicio: '',
  fechaFin: '',
  creadoEn: '2026-11-01T00:00:00Z',
  codigos: {
    'LOLA-7K3Q': { tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: 'https://img/lola.png', activo: true, usos: 0, limite: 0 },
    'CAFE-2M9P': { tiendaId: 'tB', nombreTienda: 'Café Sol', logoUrl: 'https://img/sol.png', activo: true, usos: 0, limite: 0 },
  },
  ...extra,
});
const cli = (id: string, nombre = 'Ana Pérez') => ({ id, nombre, telefono: '3311111111' });

/** swal que ejecuta el preConfirm como lo haría la librería (con el valor escrito) */
function swalEscribe(codigo: string) {
  swalMock.fire.mockImplementation(async (cfg: any) => {
    if (cfg?.preConfirm) {
      const v = await cfg.preConfirm(codigo);
      return v === false ? { isConfirmed: false } : { isConfirmed: true, value: v };
    }
    return { isConfirmed: true };
  });
}
const mensajesValidacion = vi.fn();

beforeEach(() => {
  __reset({ sorteos: { s1: sorteo() }, tiendas: { tA: { nombreTienda: 'Postres Lola' }, tB: { nombreTienda: 'Café Sol' } }, banners: {} });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  mensajesValidacion.mockReset();
  (swalMock as any).showValidationMessage = mensajesValidacion;
  (swalMock as any).isLoading = () => false;
  subirImagen.mockClear();
  eliminarImagenes.mockClear();
});
afterEach(() => {
  cerrarSesion();
  cerrarSesionAdmin();
  localStorage.clear();
  vi.useRealTimers();
});

describe('efecto Text Scramble (lógica)', () => {
  const secuencia = (...n: number[]) => {
    let i = 0;
    return () => n[i++ % n.length];
  };

  it('al inicio todo es ruido del mismo largo; al final queda el texto correcto', () => {
    const plan = crearPlanScramble('Ana Pérez', secuencia(0.1, 0.5, 0.9, 0.3), 30);
    const inicio = fotogramaScramble(plan, 0, secuencia(0.5));
    expect(inicio).toHaveLength('Ana Pérez'.length);
    expect(inicio).not.toBe('Ana Pérez');
    expect(fotogramaScramble(plan, plan.fotogramas)).toBe('Ana Pérez');
    expect(fotogramaScramble(plan, plan.fotogramas + 50)).toBe('Ana Pérez');
  });

  it('los espacios nunca se barajan y los símbolos salen del conjunto de glifos', () => {
    const plan = crearPlanScramble('Luis Gómez', Math.random, 30);
    for (let f = 0; f <= 30; f += 3) {
      const t = fotogramaScramble(plan, f);
      expect(t[4]).toBe(' ');
      for (let i = 0; i < t.length; i++) if (i !== 4 && t[i] !== 'Luis Gómez'[i] && t[i] !== ' ') expect(GLIFOS).toContain(t[i]);
    }
  });

  it('poco a poco se van acomodando: cada letra, una vez fija, ya no cambia', () => {
    const plan = crearPlanScramble('MARIA', Math.random, 40);
    let aciertosPrevios = new Set<number>();
    for (let f = 0; f <= 40; f++) {
      const t = fotogramaScramble(plan, f);
      for (const i of aciertosPrevios) expect(t[i]).toBe('MARIA'[i]); // fija = fija
      plan.caracteres.forEach((c, i) => { if (f >= c.fin) aciertosPrevios.add(i); });
    }
    expect(aciertosPrevios.size).toBe(5);
  });

  it('con texto vacío no falla', () => {
    expect(fotogramaScramble(crearPlanScramble(''), 3)).toBe('');
  });
});

describe('TextoDescifrado', () => {
  it('arranca barajado y termina en el texto correcto', async () => {
    vi.useFakeTimers();
    const w = mount(TextoDescifrado, { props: { texto: 'María G.', duracionMs: 600 } });
    expect(w.text()).toHaveLength('María G.'.length);
    expect(w.text()).not.toBe('María G.');
    expect(w.attributes('aria-label')).toBe('María G.'); // el lector de pantalla oye el texto real
    await vi.advanceTimersByTimeAsync(1500);
    expect(w.text()).toBe('María G.');
    w.unmount();
  });

  it('con "menos movimiento" aparece directo', () => {
    (window as any).matchMedia = () => ({ matches: true });
    const w = mount(TextoDescifrado, { props: { texto: 'Luis R.' } });
    expect(w.text()).toBe('Luis R.');
    delete (window as any).matchMedia;
    w.unmount();
  });

  it('no corre si no está activo y corre cuando se activa', async () => {
    vi.useFakeTimers();
    const w = mount(TextoDescifrado, { props: { texto: 'Pedro', activo: false, duracionMs: 300 } });
    await vi.advanceTimersByTimeAsync(500);
    expect(w.text()).toBe('Pedro');
    await w.setProps({ activo: true });
    expect(w.text()).not.toBe('Pedro');
    await vi.advanceTimersByTimeAsync(1000);
    expect(w.text()).toBe('Pedro');
    w.unmount();
  });
});

describe('carrusel de la pantalla principal', () => {
  const montar = async () => {
    const w = mount(BannersCarousel, { attachTo: document.body });
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('muestra el banner del sorteo con su imagen, el premio y los logos de las tiendas participantes abajo', async () => {
    const w = await montar();
    const slide = w.find('[data-sorteo="s1"]');
    expect(slide.exists()).toBe(true);
    expect(slide.find('img.sorteo-img').attributes('src')).toBe('https://img/banner-sorteo.jpg');
    expect(slide.text()).toContain('Sorteo de aniversario');
    expect(slide.text()).toContain('Una pantalla');
    expect(slide.text()).toContain('Toca para participar');
    const logos = slide.findAll('[data-testid="logos-sorteo"] img');
    expect(logos.map((l) => l.attributes('alt'))).toEqual(['Café Sol', 'Postres Lola']);
    expect(w.find('[data-testid="logos-sorteo"]').exists()).toBe(true);
    w.unmount();
  });

  it('sin imagen sale con fondo de colores; solo con código desactivado no hay logo de esa tienda', async () => {
    __reset({ sorteos: { s1: sorteo({ imagenUrl: '', codigos: { 'A-1111': { tiendaId: 'tA', nombreTienda: 'Lola', logoUrl: 'https://img/l.png', activo: true, usos: 0, limite: 0 }, 'B-2222': { tiendaId: 'tB', nombreTienda: 'Sol', logoUrl: '', activo: false, usos: 0, limite: 0 } } }) }, banners: {} });
    const w = await montar();
    expect(w.find('.sorteo-fondo').exists()).toBe(true);
    expect(w.findAll('[data-testid="logos-sorteo"] img')).toHaveLength(1);
    w.unmount();
  });

  it('con más de 8 tiendas muestra +N', async () => {
    const codigos: Record<string, any> = {};
    for (let i = 0; i < 11; i++) codigos[`TND${i}-1234`] = { tiendaId: `t${i}`, nombreTienda: `Tienda ${i}`, logoUrl: `https://img/${i}.png`, activo: true, usos: 0, limite: 0 };
    __reset({ sorteos: { s1: sorteo({ codigos }) }, banners: {} });
    const w = await montar();
    expect(w.findAll('[data-testid="logos-sorteo"] img')).toHaveLength(8);
    expect(w.find('.mas').text()).toBe('+3');
    w.unmount();
  });

  it('convive con los banners normales: los sorteos van primero y los puntos cuentan todos', async () => {
    __reset({ sorteos: { s1: sorteo() }, banners: { b1: { imagenUrl: 'https://img/b1.jpg', titulo: 'Oferta', activo: true, orden: 0 } } });
    const w = await montar();
    const slides = w.findAll('.banners-scroll > .banner');
    expect(slides).toHaveLength(2);
    expect(slides[0].classes()).toContain('sorteo');
    expect(w.findAll('.dot')).toHaveLength(2);
    w.unmount();
  });

  it('sin sorteos ni banners no ocupa espacio; un sorteo pausado no sale', async () => {
    __reset({ sorteos: { s1: sorteo({ activo: false }) }, banners: {} });
    const w = await montar();
    expect(w.find('section.banners').exists()).toBe(false);
    w.unmount();
  });

  it('al sortear, la diapositiva muestra al ganador con el efecto de texto descifrado', async () => {
    await participarEnSorteo('s1', cli('c1', 'Ana Pérez'), 'LOLA-7K3Q');
    await sortearGanador('s1');
    vi.useFakeTimers();
    const w = await montar();
    const ganador = w.find('[data-testid="ganador-carrusel"]');
    expect(ganador.exists()).toBe(true);
    expect(w.find('[data-sorteo="s1"] [data-testid="texto-descifrado"]').attributes('aria-label')).toBe('Ana P.');
    await vi.advanceTimersByTimeAsync(2500);
    expect(ganador.text()).toContain('Ana P.');
    w.unmount();
  });

  it('al tocar el sorteo se abre el diálogo para escribir el código', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    const w = await montar();
    await w.find('[data-sorteo="s1"]').trigger('click');
    await flushPromises();
    const cfg = swalMock.fire.mock.calls[0][0] as any;
    expect(cfg.input).toBe('text');
    expect(cfg.title).toBe('Sorteo de aniversario');
    expect(cfg.html).toContain('Escribe el código');
    w.unmount();
  });
});

describe('diálogo del código', () => {
  const irALogin = vi.fn();
  beforeEach(() => irALogin.mockReset());
  const sorteoLeido = (extra: Record<string, any> = {}) => ({
    id: 's1', titulo: 'Sorteo de aniversario', descripcion: '', premio: 'Una pantalla', imagenUrl: '', activo: true,
    fechaInicio: '', fechaFin: '', cerradoEn: '', ganadores: [] as any[],
    codigos: [{ codigo: 'LOLA-7K3Q', tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: '', activo: true, usos: 0, limite: 0 }],
    ...extra,
  });

  it('sin sesión ofrece iniciar sesión y, si acepta, lleva al login', async () => {
    await abrirDialogoSorteo(sorteoLeido(), { irALogin });
    expect((swalMock.fire.mock.calls[0][0] as any).title).toBe('Inicia sesión para participar');
    expect(irALogin).toHaveBeenCalledTimes(1);
    swalMock.fire.mockResolvedValueOnce({ isConfirmed: false } as any);
    await abrirDialogoSorteo(sorteoLeido(), { irALogin });
    expect(irALogin).toHaveBeenCalledTimes(1);
  });

  it('con un código válido participa y avisa', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    swalEscribe(' lola-7k3q ');
    const ok = await abrirDialogoSorteo(sorteoLeido(), { irALogin });
    expect(ok).toBe(true);
    expect(__getAt('sorteoParticipantes/s1/c1')).toMatchObject({ codigo: 'LOLA-7K3Q', tiendaId: 'tA' });
    const ultimo = swalMock.fire.mock.calls.at(-1)![0] as any;
    expect(ultimo).toMatchObject({ icon: 'success', title: '¡Ya estás participando!' });
    expect(mensajesValidacion).not.toHaveBeenCalled();
  });

  it('con un código malo muestra el aviso dentro del diálogo y no registra nada', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    swalEscribe('MALO-0000');
    const ok = await abrirDialogoSorteo(sorteoLeido(), { irALogin });
    expect(ok).toBe(false);
    expect(mensajesValidacion).toHaveBeenCalledWith(expect.stringContaining('no es válido'));
    expect(__getAt('sorteoParticipantes/s1')).toBeUndefined();
  });

  it('si ya participa solo lo dice, sin pedir código', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    await abrirDialogoSorteo(sorteoLeido(), { irALogin });
    expect(swalMock.fire).toHaveBeenCalledTimes(1);
    expect(swalMock.fire.mock.calls[0][0]).toMatchObject({ title: 'Ya estás participando' });
    expect((swalMock.fire.mock.calls[0][0] as any).input).toBeUndefined();
  });

  it('sorteo por empezar o ya sorteado: solo informa, sin campo de código', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez' });
    await abrirDialogoSorteo(sorteoLeido({ fechaInicio: '2099-01-01' }), { irALogin });
    expect((swalMock.fire.mock.calls[0][0] as any).html).toContain('2099-01-01');
    await abrirDialogoSorteo(sorteoLeido({ cerradoEn: '2026-11-20T00:00:00Z', ganadores: [{ id: 'g', clienteId: 'x', nombre: 'Luis Ramírez', fecha: '' }] }), { irALogin });
    expect((swalMock.fire.mock.calls[1][0] as any).html).toContain('Luis R.');
    expect(swalMock.fire.mock.calls.every((c: any) => !c[0].input)).toBe(true);
  });

  it('esc: el título del sorteo no inyecta HTML', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana' });
    await abrirDialogoSorteo(sorteoLeido({ premio: '<img src=x onerror=alert(1)>' }), { irALogin });
    expect((swalMock.fire.mock.calls[0][0] as any).html).not.toContain('<img');
  });
});

describe('botón flotante en las tiendas patrocinadoras', () => {
  const montar = async (tiendaId: string) => {
    const w = mount(BotonSorteoTienda, { props: { tiendaId } });
    await flushPromises();
    return w;
  };

  it('aparece en la tienda que patrocina el sorteo y no en otras', async () => {
    expect((await montar('tA')).find('[data-testid="boton-sorteo"]').exists()).toBe(true);
    expect((await montar('tB')).find('[data-testid="boton-sorteo"]').exists()).toBe(true);
    expect((await montar('otra')).find('[data-testid="boton-sorteo"]').exists()).toBe(false);
    expect((await montar('')).find('[data-testid="boton-sorteo"]').exists()).toBe(false);
  });

  it('no aparece con el código desactivado, con el sorteo pausado ni ya sorteado', async () => {
    __reset({ sorteos: { s1: sorteo({ codigos: { 'A-1111': { tiendaId: 'tA', nombreTienda: 'Lola', activo: false, usos: 0, limite: 0 } } }) } });
    expect((await montar('tA')).find('[data-testid="boton-sorteo"]').exists()).toBe(false);
    __reset({ sorteos: { s1: sorteo({ activo: false }) } });
    expect((await montar('tA')).find('[data-testid="boton-sorteo"]').exists()).toBe(false);
    __reset({ sorteos: { s1: sorteo({ cerradoEn: '2026-11-20T00:00:00Z' }) } });
    expect((await montar('tA')).find('[data-testid="boton-sorteo"]').exists()).toBe(false);
  });

  it('al tocarlo abre el diálogo para escribir el código', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    const w = await montar('tA');
    await w.find('[data-testid="boton-sorteo"]').trigger('click');
    await flushPromises();
    await flushPromises();
    expect((swalMock.fire.mock.calls[0][0] as any).input).toBe('text');
  });

  it('reglas: sorteosVisibles y patrocinaTienda', () => {
    const base = { id: 'x', titulo: '', descripcion: '', premio: '', activo: true, codigos: [{ codigo: 'A', tiendaId: 'tA', nombreTienda: '', activo: true, usos: 0, limite: 0 }], ganadores: [] };
    const viejo = { ...base, cerradoEn: '2020-01-01T00:00:00Z' };
    const reciente = { ...base, cerradoEn: new Date().toISOString() };
    expect(sorteosVisibles([base, { ...base, activo: false }, viejo, reciente] as any)).toHaveLength(2);
    expect(patrocinaTienda(base as any, 'tA')).toBe(true);
    expect(patrocinaTienda(base as any, 'tZ')).toBe(false);
  });
});

describe('administrador: banner del sorteo', () => {
  beforeEach(() => guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' }));
  const montar = async () => {
    const w = mount(AdminSorteos, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true } } });
    await flushPromises();
    return w;
  };
  const elegirImagen = async (w: any) => {
    const input = w.find('[data-testid="archivo-banner"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })], configurable: true });
    await input.trigger('change');
    await flushPromises();
  };

  it('sube la imagen y la guarda con el sorteo (se ve en la vista previa)', async () => {
    const w = await montar();
    await elegirImagen(w);
    expect(subirImagen).toHaveBeenCalledTimes(1);
    expect(w.find('[data-testid="banner-sorteo"] img').attributes('src')).toBe('https://img/nuevo-banner.jpg');
    await w.find('[data-testid="titulo"]').setValue('Sorteo con banner');
    await w.find('[data-testid="guardar-sorteo"]').trigger('click');
    await flushPromises();
    expect(Object.values(__getAt('sorteos')).some((x: any) => x.titulo === 'Sorteo con banner' && x.imagenUrl === 'https://img/nuevo-banner.jpg')).toBe(true);
    w.unmount();
  });

  it('al reemplazar el banner al editar, borra el anterior; al eliminar el sorteo borra su imagen', async () => {
    const w = await montar();
    await w.find('[data-sorteo="s1"] .btn-mini:nth-child(2)').trigger('click'); // Editar
    await flushPromises();
    await elegirImagen(w);
    await w.find('[data-testid="guardar-sorteo"]').trigger('click');
    await flushPromises();
    expect(__getAt('sorteos/s1/imagenUrl')).toBe('https://img/nuevo-banner.jpg');
    expect(eliminarImagenes).toHaveBeenCalledWith(['https://img/banner-sorteo.jpg']);

    eliminarImagenes.mockClear();
    const { eliminarSorteo } = await import('@/composables/useSorteos');
    await eliminarSorteo('s1');
    await flushPromises();
    expect(eliminarImagenes).toHaveBeenCalledWith(['https://img/nuevo-banner.jpg']);
    w.unmount();
  });
});
