/**
 * Admin › Sorteos › «Administrar»: abre un diálogo con el detalle del sorteo (cifras, tiendas participantes,
 * clientes registrados con búsqueda y filtro, códigos y sorteo del ganador), en lugar de desplegar un panel.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { participarEnSorteo } from '@/composables/useSorteos';
import AdminSorteos from '@/modules/admin/views/AdminSorteos.vue';

const sorteo = {
  titulo: 'Inauguración',
  descripcion: '',
  premio: 'Mochila LadyBug',
  activo: true,
  fechaInicio: '',
  fechaFin: '2099-12-31',
  creadoEn: '2026-11-01T00:00:00Z',
  codigos: {
    'LOLA-7K3Q': { tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: '', activo: true, usos: 0, limite: 0 },
    'LOLA-2222': { tiendaId: 'tA', nombreTienda: 'Postres Lola', logoUrl: '', activo: false, usos: 0, limite: 5 },
    'CAFE-2M9P': { tiendaId: 'tB', nombreTienda: 'Café Sol', logoUrl: '', activo: true, usos: 0, limite: 0 },
    'SOLO-0000': { tiendaId: 'tC', nombreTienda: 'Sin nadie', logoUrl: '', activo: true, usos: 0, limite: 0 },
  },
};
const cli = (id: string, nombre: string, telefono = '33' + id.padEnd(8, '0')) => ({ id, nombre, telefono });
let limpiar: Array<() => void> = [];

beforeEach(() => {
  __reset({ sorteos: { s1: sorteo }, tiendas: { tA: { nombreTienda: 'Postres Lola' }, tB: { nombreTienda: 'Café Sol' }, tC: { nombreTienda: 'Sin nadie' } } });
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
});
afterEach(() => {
  limpiar.forEach((f) => f());
  limpiar = [];
  cerrarSesionAdmin();
  localStorage.clear();
});

async function abrir() {
  const w = mount(AdminSorteos, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminTopbar: true } } });
  limpiar.push(() => w.unmount());
  await flushPromises();
  expect(w.find('[data-testid="detalle-sorteo"]').exists()).toBe(false);
  await w.find('[data-sorteo="s1"] [data-testid="administrar"]').trigger('click');
  await flushPromises();
  await flushPromises();
  return w;
}
async function conParticipantes() {
  // con minutos distintos para que "los más recientes primero" no dependa de la velocidad de la prueba
  await participarEnSorteo('s1', cli('c1', 'Ana Pérez', '3311111111'), 'LOLA-7K3Q', new Date('2026-12-01T10:00:00Z'));
  await participarEnSorteo('s1', cli('c2', 'Beto Ruiz', '3322222222'), 'LOLA-7K3Q', new Date('2026-12-01T10:05:00Z'));
  await participarEnSorteo('s1', cli('c3', 'Carla Gómez', '3333333333'), 'CAFE-2M9P', new Date('2026-12-01T10:10:00Z'));
}

describe('«Administrar» abre un diálogo', () => {
  it('muestra el diálogo con el nombre, estado, premio y las cifras; se cierra con la X', async () => {
    await conParticipantes();
    const w = await abrir();
    const d = w.find('[data-testid="detalle-sorteo"]');
    expect(d.attributes('role')).toBe('dialog');
    expect(d.attributes('aria-modal')).toBe('true');
    expect(d.text()).toContain('Inauguración');
    expect(d.text()).toContain('Abierto');
    expect(d.text()).toContain('Mochila LadyBug');
    expect(w.find('[data-testid="n-participantes"]').text()).toBe('3');
    expect(w.find('[data-testid="n-tiendas"]').text()).toBe('3'); // Lola, Café y la que aún no tiene a nadie
    await w.find('[data-testid="cerrar-detalle"]').trigger('click');
    expect(w.find('[data-testid="detalle-sorteo"]').exists()).toBe(false);
  });

  it('también se cierra tocando el fondo, y ya no hay panel desplegado dentro de la lista', async () => {
    const w = await abrir();
    expect(w.find('[data-sorteo="s1"] [data-testid="resumen-tiendas"]').exists()).toBe(false);
    await w.find('.sd-overlay').trigger('click');
    expect(w.find('[data-testid="detalle-sorteo"]').exists()).toBe(false);
  });

  it('tiendas participantes: cuántos clientes trajo cada una (de más a menos), con sus códigos y uso', async () => {
    await conParticipantes();
    const w = await abrir();
    const filas = w.findAll('[data-testid="resumen-tiendas"] > li');
    expect(filas.map((f) => f.attributes('data-tienda'))).toEqual(['tA', 'tB', 'tC']);
    expect(filas[0].find('.tienda-cuenta').text()).toBe('2');
    expect(filas[1].find('.tienda-cuenta').text()).toBe('1');
    expect(filas[2].find('.tienda-cuenta').text()).toBe('0'); // patrocinadora sin clientes todavía
    expect(filas[0].findAll('[data-codigo]').map((c) => c.attributes('data-codigo')).sort()).toEqual(['LOLA-2222', 'LOLA-7K3Q']);
    expect(filas[0].text()).toContain('2 uso(s)');
    expect(filas[0].text()).toContain('desactivado');
  });

  it('clientes registrados: nombre, teléfono, tienda de origen, código y fecha; los más recientes primero', async () => {
    await conParticipantes();
    const w = await abrir();
    const lista = w.findAll('[data-testid="lista-participantes"] .participante');
    expect(lista).toHaveLength(3);
    const ana = w.find('[data-cliente="c1"]');
    expect(ana.text()).toContain('Ana Pérez');
    expect(ana.text()).toContain('3311111111');
    expect(ana.text()).toContain('Postres Lola');
    expect(ana.text()).toContain('LOLA-7K3Q');
    expect(ana.find('a.p-tel').attributes('href')).toBe('tel:3311111111');
    expect(lista[0].attributes('data-cliente')).toBe('c3'); // el último en entrar
  });

  it('busca por nombre, teléfono o código, sin importar acentos, y filtra por tienda', async () => {
    await conParticipantes();
    const w = await abrir();
    const ids = () => w.findAll('.participante').map((p) => p.attributes('data-cliente'));
    await w.find('[data-testid="buscar-participante"]').setValue('gomez');
    expect(ids()).toEqual(['c3']);
    await w.find('[data-testid="buscar-participante"]').setValue('3322');
    expect(ids()).toEqual(['c2']);
    await w.find('[data-testid="buscar-participante"]').setValue('zzz');
    expect(w.text()).toContain('Nadie coincide');
    await w.find('[data-testid="buscar-participante"]').setValue('');
    await w.find('[data-testid="filtro-tienda"]').setValue('tA');
    expect(ids().sort()).toEqual(['c1', 'c2']);
  });

  it('con muchos clientes muestra 50 y permite ver más', async () => {
    const participantes: Record<string, any> = {};
    for (let i = 0; i < 120; i++) participantes[`c${i}`] = { nombre: `Cliente ${i}`, telefono: '3300000000', codigo: 'LOLA-7K3Q', tiendaId: 'tA', nombreTienda: 'Postres Lola', fecha: new Date(2026, 10, 1, 0, 0, i).toISOString() };
    __reset({ sorteos: { s1: sorteo }, sorteoParticipantes: { s1: participantes }, tiendas: {} });
    const w = await abrir();
    expect(w.findAll('.participante')).toHaveLength(50);
    expect(w.find('[data-testid="mostrar-mas"]').text()).toContain('70 restantes');
    await w.find('[data-testid="mostrar-mas"]').trigger('click');
    expect(w.findAll('.participante')).toHaveLength(100);
    await w.find('[data-testid="mostrar-mas"]').trigger('click');
    expect(w.findAll('.participante')).toHaveLength(120);
    expect(w.find('[data-testid="mostrar-mas"]').exists()).toBe(false);
  });

  it('sin clientes lo dice y no ofrece buscador; el botón de sortear queda deshabilitado', async () => {
    const w = await abrir();
    expect(w.text()).toContain('Todavía no participa nadie');
    expect(w.find('[data-testid="buscar-participante"]').exists()).toBe(false);
    expect(w.find('[data-testid="sortear"]').attributes('disabled')).toBeDefined();
  });

  it('desde el diálogo se agregan y quitan códigos, y se sortea', async () => {
    await conParticipantes();
    const w = await abrir();
    await w.find('[data-testid="tienda-codigo"]').setValue('tB');
    await w.find('[data-testid="codigo-propio"]').setValue('sol-2026');
    await w.find('[data-testid="agregar-codigo"]').trigger('click');
    await flushPromises();
    await flushPromises();
    expect(__getAt('sorteos/s1/codigos/SOL-2026')).toMatchObject({ tiendaId: 'tB', nombreTienda: 'Café Sol' });
    expect(w.find('[data-codigo="SOL-2026"]').exists()).toBe(true);

    await w.find('[data-testid="sortear"]').trigger('click');
    await flushPromises();
    await flushPromises();
    const ganadores = Object.values(__getAt('sorteos/s1/ganadores') as any);
    expect(ganadores).toHaveLength(1);
    expect(ganadores[0]).toMatchObject({ por: 'Ana Admin' });
    expect(w.find('[data-testid="ganadores"]').exists()).toBe(true);
  });

  it('abrir otro sorteo empieza limpio (sin la búsqueda del anterior)', async () => {
    await conParticipantes();
    __reset({ sorteos: { s1: sorteo, s2: { ...sorteo, titulo: 'Otro', creadoEn: '2026-12-01T00:00:00Z' } }, sorteoParticipantes: { s1: __getAt('sorteoParticipantes/s1') }, tiendas: {} });
    const w = await abrir();
    await w.find('[data-testid="buscar-participante"]').setValue('ana');
    await w.find('[data-testid="cerrar-detalle"]').trigger('click');
    await w.find('[data-sorteo="s2"] [data-testid="administrar"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="detalle-sorteo"]').text()).toContain('Otro');
    expect(w.text()).toContain('Todavía no participa nadie');
  });
});
