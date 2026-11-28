/**
 * Sorteo patrocinado por tiendas: todos los clientes participan en el mismo sorteo con el código de una tienda.
 * Reglas, participación del cliente (con carrusel de logos) y panel del administrador (códigos, resumen y sorteo).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { guardarSesion, cerrarSesion } from '@/utils/sessionUser';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import {
  normalizarCodigo,
  generarCodigo,
  estadoSorteo,
  patrocinadores,
  participantesPorTienda,
  nombrePublico,
  enteroAlAzar,
  participarEnSorteo,
  yaParticipa,
  crearSorteo,
  agregarCodigo,
  sortearGanador,
  eliminarSorteo,
  ErrorSorteo,
  type Sorteo,
} from '@/composables/useSorteos';
import SorteosCliente from '@/modules/home/components/SorteosCliente.vue';
import AdminSorteos from '@/modules/admin/views/AdminSorteos.vue';

const HOY = '2026-11-28';
const cli = (id: string, nombre = 'Ana Pérez') => ({ id, nombre, telefono: '33' + id.padEnd(8, '0') });

const sorteoBase = (extra: Record<string, any> = {}) => ({
  titulo: 'Sorteo de aniversario',
  descripcion: '',
  premio: 'Una pantalla',
  activo: true,
  fechaInicio: '',
  fechaFin: '',
  creadoEn: '2026-11-01T00:00:00Z',
  codigos: {
    'LOLA-7K3Q': { tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: 'https://img/lola.png', activo: true, usos: 0, limite: 0 },
    'CAFE-2M9P': { tiendaId: 'tB', nombreTienda: 'Café Sol', logoUrl: '', activo: true, usos: 0, limite: 2 },
    'OFF-1111': { tiendaId: 'tC', nombreTienda: 'Tienda Off', logoUrl: 'https://img/off.png', activo: false, usos: 0, limite: 0 },
  },
  ...extra,
});

beforeEach(() => {
  __reset({
    sorteos: { s1: sorteoBase() },
    tiendas: {
      tA: { nombreTienda: 'Postres Lola', logoUrl: 'https://img/lola.png' },
      tB: { nombreTienda: 'Café Sol' },
    },
  });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
});
afterEach(() => {
  cerrarSesion();
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('reglas', () => {
  it('normalizarCodigo: mayúsculas, sin espacios ni símbolos, conserva el guion', () => {
    expect(normalizarCodigo('  lola-7k3q ')).toBe('LOLA-7K3Q');
    expect(normalizarCodigo('ca fé_2#m9')).toBe('CAFE2M9');
    expect(normalizarCodigo(undefined)).toBe('');
    expect(normalizarCodigo('x'.repeat(40))).toHaveLength(24);
  });

  it('generarCodigo: 4 letras de la tienda + 4 sin caracteres confusos', () => {
    const c = generarCodigo('Postres Lola');
    expect(c).toMatch(/^POST-[A-HJKMN-Z2-9]{4}$/);
    expect(generarCodigo('ñ')).toMatch(/^NXXX-/);
    expect(generarCodigo('Café Sol', () => 0)).toBe('CAFE-AAAA');
  });

  it('estadoSorteo: pausado, próximo, abierto, terminado y sorteado', () => {
    const s = { activo: true, fechaInicio: '', fechaFin: '', cerradoEn: '' };
    expect(estadoSorteo(s, HOY)).toBe('abierto');
    expect(estadoSorteo({ ...s, activo: false }, HOY)).toBe('pausado');
    expect(estadoSorteo({ ...s, fechaInicio: '2026-12-01' }, HOY)).toBe('proximo');
    expect(estadoSorteo({ ...s, fechaFin: '2026-11-27' }, HOY)).toBe('terminado');
    expect(estadoSorteo({ ...s, fechaFin: HOY }, HOY)).toBe('abierto'); // el último día aún cuenta
    expect(estadoSorteo({ ...s, cerradoEn: '2026-11-28T00:00:00Z' }, HOY)).toBe('sorteado');
  });

  it('patrocinadores: una vez por tienda y solo con código activo', () => {
    const s = { codigos: [
      { codigo: 'A', tiendaId: 'tA', nombreTienda: 'Lola', logoUrl: '', activo: true, usos: 0, limite: 0 },
      { codigo: 'B', tiendaId: 'tA', nombreTienda: 'Lola', logoUrl: 'https://img/l.png', activo: true, usos: 0, limite: 0 },
      { codigo: 'C', tiendaId: 'tB', nombreTienda: 'Off', logoUrl: 'https://img/o.png', activo: false, usos: 0, limite: 0 },
    ] };
    expect(patrocinadores(s)).toEqual([{ tiendaId: 'tA', nombreTienda: 'Lola', logoUrl: 'https://img/l.png' }]);
  });

  it('participantesPorTienda: cuenta por tienda, incluye las que tienen 0, ordena de mayor a menor', () => {
    const p = (clienteId: string, tiendaId: string) => ({ clienteId, nombre: clienteId, codigo: 'X', tiendaId, nombreTienda: tiendaId, fecha: '' });
    const r = participantesPorTienda([p('1', 'tB'), p('2', 'tB'), p('3', 'tA')], [
      { codigo: 'A', tiendaId: 'tA', nombreTienda: 'Lola', activo: true, usos: 0, limite: 0 },
      { codigo: 'Z', tiendaId: 'tZ', nombreTienda: 'Sin nadie', activo: true, usos: 0, limite: 0 },
    ]);
    expect(r.map((x) => [x.tiendaId, x.participantes])).toEqual([['tB', 2], ['tA', 1], ['tZ', 0]]);
  });

  it('nombrePublico no revela el apellido completo; enteroAlAzar queda en rango', () => {
    expect(nombrePublico('María Guadalupe Gómez')).toBe('María G.');
    expect(nombrePublico('Luis')).toBe('Luis');
    expect(nombrePublico('')).toBe('Participante');
    for (let i = 0; i < 200; i++) expect(enteroAlAzar(5)).toBeLessThan(5);
  });
});

describe('participar', () => {
  it('con un código válido queda registrado con su tienda y suma un uso', async () => {
    const r = await participarEnSorteo('s1', cli('c1'), ' lola-7k3q ');
    expect(r).toEqual({ nombreTienda: 'Postres Lola', codigo: 'LOLA-7K3Q' });
    expect(__getAt('sorteoParticipantes/s1/c1')).toMatchObject({ nombre: 'Ana Pérez', codigo: 'LOLA-7K3Q', tiendaId: 'tA' });
    expect(__getAt('sorteos/s1/codigos/LOLA-7K3Q/usos')).toBe(1);
    expect(await yaParticipa('s1', 'c1')).toBe(true);
    expect(await yaParticipa('s1', 'otro')).toBe(false);
  });

  it('todos participan en el mismo sorteo aunque entren con códigos de tiendas distintas', async () => {
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    await participarEnSorteo('s1', cli('c2'), 'CAFE-2M9P');
    expect(Object.keys(__getAt('sorteoParticipantes/s1'))).toEqual(['c1', 'c2']);
  });

  it('una sola participación por cliente (aunque use otro código)', async () => {
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    await expect(participarEnSorteo('s1', cli('c1'), 'CAFE-2M9P')).rejects.toThrow(/Ya estás participando/);
    expect(__getAt('sorteos/s1/codigos/CAFE-2M9P/usos')).toBe(0);
  });

  it('rechaza: sin sesión, sin código, código inexistente o desactivado', async () => {
    await expect(participarEnSorteo('s1', null, 'LOLA-7K3Q')).rejects.toThrow(/Inicia sesión/);
    await expect(participarEnSorteo('s1', cli('c1'), '   ')).rejects.toThrow(/Escribe el código/);
    await expect(participarEnSorteo('s1', cli('c1'), 'NOEXISTE')).rejects.toBeInstanceOf(ErrorSorteo);
    await expect(participarEnSorteo('s1', cli('c1'), 'OFF-1111')).rejects.toThrow(/no es válido/);
    expect(__getAt('sorteoParticipantes/s1')).toBeUndefined();
  });

  it('respeta el límite de usos del código', async () => {
    await participarEnSorteo('s1', cli('c1'), 'CAFE-2M9P');
    await participarEnSorteo('s1', cli('c2'), 'CAFE-2M9P');
    await expect(participarEnSorteo('s1', cli('c3'), 'CAFE-2M9P')).rejects.toThrow(/límite/);
    expect(__getAt('sorteoParticipantes/s1/c3')).toBeUndefined();
    // otro código del mismo sorteo sigue sirviendo
    await participarEnSorteo('s1', cli('c3'), 'LOLA-7K3Q');
  });

  it('no deja entrar si el sorteo está pausado, no ha empezado, terminó o ya se sorteó', async () => {
    const casos: [Record<string, any>, RegExp][] = [
      [{ activo: false }, /no está recibiendo/],
      [{ fechaInicio: '2099-01-01' }, /empieza el 2099-01-01/],
      [{ fechaFin: '2020-01-01' }, /no está recibiendo/],
      [{ cerradoEn: '2026-11-20T00:00:00Z' }, /no está recibiendo/],
    ];
    for (const [extra, mensaje] of casos) {
      __reset({ sorteos: { s1: sorteoBase(extra) } });
      await expect(participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q')).rejects.toThrow(mensaje);
    }
    __reset({});
    await expect(participarEnSorteo('nada', cli('c1'), 'X')).rejects.toThrow(/ya no existe/);
  });
});

describe('administración', () => {
  it('crear sorteo valida nombre y fechas', async () => {
    await expect(crearSorteo({ titulo: '  ' })).rejects.toThrow(/nombre/);
    await expect(crearSorteo({ titulo: 'X', fechaInicio: '2026-12-02', fechaFin: '2026-12-01' })).rejects.toThrow(/fecha de fin/);
    const id = await crearSorteo({ titulo: ' Mi sorteo ', premio: 'TV' });
    expect(__getAt(`sorteos/${id}`)).toMatchObject({ titulo: 'Mi sorteo', premio: 'TV', activo: true });
  });

  it('agregarCodigo genera uno único, o usa el indicado; no repite', async () => {
    const tienda = { tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: 'https://img/lola.png' };
    const generado = await agregarCodigo('s1', tienda);
    expect(generado).toMatch(/^POST-/);
    expect(__getAt(`sorteos/s1/codigos/${generado}`)).toMatchObject({ tiendaId: 'tA', logoUrl: 'https://img/lola.png', usos: 0, limite: 0, activo: true });
    expect(await agregarCodigo('s1', tienda, { codigo: 'mi codigo 1', limite: 5 })).toBe('MICODIGO1');
    expect(__getAt('sorteos/s1/codigos/MICODIGO1/limite')).toBe(5);
    await expect(agregarCodigo('s1', tienda, { codigo: 'LOLA-7K3Q' })).rejects.toThrow(/ya existe/);
    await expect(agregarCodigo('s1', tienda, { codigo: 'ab' })).rejects.toThrow(/al menos 4/);
    await expect(agregarCodigo('s1', { tiendaId: '', nombreTienda: '' })).rejects.toThrow(/Elige una tienda/);
  });

  it('sortear: elige a un participante, cierra el sorteo y no repite ganador', async () => {
    await participarEnSorteo('s1', cli('c1', 'Ana Pérez'), 'LOLA-7K3Q');
    await participarEnSorteo('s1', cli('c2', 'Beto Ruiz'), 'CAFE-2M9P');
    const g1 = await sortearGanador('s1', 'Admin');
    expect(['c1', 'c2']).toContain(g1.clienteId);
    expect(g1).toMatchObject({ por: 'Admin' });
    expect(g1.nombreTienda).toBeTruthy();
    expect(__getAt('sorteos/s1/cerradoEn')).toBeTruthy();
    const g2 = await sortearGanador('s1');
    expect(g2.clienteId).not.toBe(g1.clienteId);
    await expect(sortearGanador('s1')).rejects.toThrow(/Ya ganaron todos/);
    await expect(participarEnSorteo('s1', cli('c9'), 'LOLA-7K3Q')).rejects.toThrow(/no está recibiendo/);
  });

  it('sortear sin participantes avisa', async () => {
    await expect(sortearGanador('s1')).rejects.toThrow(/Aún no hay participantes/);
  });

  it('eliminar el sorteo borra también a sus participantes', async () => {
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    await eliminarSorteo('s1');
    expect(__getAt('sorteos/s1')).toBeUndefined();
    expect(__getAt('sorteoParticipantes/s1')).toBeUndefined();
  });
});

describe('pantalla del cliente', () => {
  const montar = async () => {
    const w = mount(SorteosCliente, { attachTo: document.body });
    await flushPromises();
    await flushPromises();
    return w;
  };

  it('muestra el carrusel con los logos de las tiendas patrocinadoras (solo con código activo)', async () => {
    const w = await montar();
    const logos = w.findAll('[data-testid="carrusel-patrocinadores"] .logo-item');
    expect(logos.map((l) => l.attributes('data-testid'))).toEqual(['logo-tB', 'logo-tA']); // por nombre de tienda; la de código desactivado no sale
    expect(w.find('[data-testid="logo-tA"] img').attributes('src')).toBe('https://img/lola.png');
    expect(w.text()).toContain('Postres Lola');
    expect(w.text()).toContain('Una pantalla');
    w.unmount();
  });

  it('sin sorteos (o solo pausados) no ocupa espacio', async () => {
    __reset({ sorteos: { s1: sorteoBase({ activo: false }) } });
    const w = await montar();
    expect(w.find('[data-testid="sorteos-cliente"]').exists()).toBe(false);
    w.unmount();
  });

  it('sin sesión pide iniciar sesión; no muestra el campo del código', async () => {
    const w = await montar();
    expect(w.find('[data-testid="entrar-para-participar"]').exists()).toBe(true);
    expect(w.find('[data-testid="codigo-sorteo"]').exists()).toBe(false);
    w.unmount();
  });

  it('con sesión escribe el código, participa y queda como "ya participas"', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    const w = await montar();
    await w.find('[data-testid="codigo-sorteo"]').setValue('lola-7k3q');
    await w.find('form').trigger('submit');
    await flushPromises();
    await flushPromises();
    expect(__getAt('sorteoParticipantes/s1/c1')).toMatchObject({ codigo: 'LOLA-7K3Q', tiendaId: 'tA' });
    expect(swalMock.fire.mock.calls[0][0]).toMatchObject({ icon: 'success' });
    expect(w.find('[data-testid="ya-participas"]').exists()).toBe(true);
    expect(w.find('[data-testid="codigo-sorteo"]').exists()).toBe(false);
    w.unmount();
  });

  it('con un código malo avisa y no registra nada', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3311111111' });
    const w = await montar();
    await w.find('[data-testid="codigo-sorteo"]').setValue('MALO-0000');
    await w.find('form').trigger('submit');
    await flushPromises();
    await flushPromises();
    expect(swalMock.fire.mock.calls[0][0]).toMatchObject({ icon: 'warning', title: 'No se pudo participar' });
    expect(__getAt('sorteoParticipantes/s1')).toBeUndefined();
    w.unmount();
  });

  it('el que ya participaba ve el aviso desde el principio', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez' });
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    const w = await montar();
    expect(w.find('[data-testid="ya-participas"]').exists()).toBe(true);
    w.unmount();
  });

  it('tras el sorteo muestra al ganador con nombre recortado y felicita a quien ganó', async () => {
    guardarSesion({ id: 'c1', nombre: 'Ana Pérez' });
    await participarEnSorteo('s1', cli('c1', 'Ana Pérez'), 'LOLA-7K3Q');
    await sortearGanador('s1');
    const w = await montar();
    expect(w.find('[data-testid="ganador"] [data-testid="texto-descifrado"]').attributes('aria-label')).toBe('Ana P.'); // se descifra al aparecer
    expect(w.find('[data-testid="ganador"]').text()).toContain('¡Eres tú!');
    expect(w.find('[data-testid="codigo-sorteo"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('panel del administrador', () => {
  beforeEach(() => guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' }));
  const montar = async () => {
    const w = mount(AdminSorteos, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true } } });
    await flushPromises();
    return w;
  };

  it('crea un sorteo y lo deja abierto para administrar', async () => {
    const w = await montar();
    await w.find('[data-testid="titulo"]').setValue('Sorteo nuevo');
    await w.find('[data-testid="premio"]').setValue('Bocina');
    await w.find('[data-testid="guardar-sorteo"]').trigger('click');
    await flushPromises();
    const ids = Object.keys(__getAt('sorteos'));
    expect(ids).toHaveLength(2);
    expect(Object.values(__getAt('sorteos')).some((s: any) => s.titulo === 'Sorteo nuevo' && s.premio === 'Bocina')).toBe(true);
    w.unmount();
  });

  it('agrega el código de una tienda y lo muestra', async () => {
    const w = await montar();
    await w.find('[data-sorteo="s1"] [data-testid="administrar"]').trigger('click');
    await flushPromises();
    await w.find('[data-testid="tienda-codigo"]').setValue('tB');
    await w.find('[data-testid="codigo-propio"]').setValue('sol-2026');
    await w.find('[data-testid="agregar-codigo"]').trigger('click');
    await flushPromises();
    await flushPromises();
    expect(__getAt('sorteos/s1/codigos/SOL-2026')).toMatchObject({ tiendaId: 'tB', nombreTienda: 'Café Sol' });
    expect(w.find('[data-codigo="SOL-2026"]').exists()).toBe(true);
    w.unmount();
  });

  it('muestra cuántos participantes trajo cada tienda y sortea', async () => {
    await participarEnSorteo('s1', cli('c1'), 'LOLA-7K3Q');
    await participarEnSorteo('s1', cli('c2'), 'LOLA-7K3Q');
    await participarEnSorteo('s1', cli('c3'), 'CAFE-2M9P');
    const w = await montar();
    await w.find('[data-sorteo="s1"] [data-testid="administrar"]').trigger('click');
    await flushPromises();
    await flushPromises();
    const filas = w.findAll('[data-testid="resumen-tiendas"] li').map((l) => l.text().replace(/\s+/g, ' '));
    expect(filas[0]).toContain('Postres Lola');
    expect(filas[0]).toContain('2');
    expect(filas[1]).toContain('Café Sol');
    await w.find('[data-testid="sortear"]').trigger('click');
    await flushPromises();
    await flushPromises();
    expect(Object.keys(__getAt('sorteos/s1/ganadores') || {})).toHaveLength(1);
    expect(Object.values(__getAt('sorteos/s1/ganadores') as any)[0]).toMatchObject({ por: 'Ana Admin' });
    w.unmount();
  });
});
