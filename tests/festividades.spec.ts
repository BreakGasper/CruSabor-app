/**
 * Festividades del calendario (festividades.ts): fechas fijas y móviles que se
 * repiten cada año, prioridad de las temáticas propias, el icono pequeño que se
 * muestra en cabeceras y carruseles, y los controles de Admin › Apariencia.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { guardarSesionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { __setConfiguracion, normalizarConfiguracion, activarTematica } from '@/composables/useConfiguracion';
import {
  FESTIVIDADES,
  FESTIVAS_DEFAULT,
  domingoDePascua,
  rangoEnAnio,
  festividadVigente,
  festividadEnCurso,
  normalizarFestivas,
  iconoFestividad,
} from '@/composables/festividades';
import { PALETAS_FESTIVAS } from '@/composables/usePaleta';
import IconoFestivo from '@/components/IconoFestivo.vue';
import AdminApariencia from '@/modules/admin/views/AdminApariencia.vue';

const F = FESTIVIDADES;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const enCurso = (hoy: string, cfg = FESTIVAS_DEFAULT) => festividadEnCurso(cfg, hoy)?.[0] ?? null;

function hoyEs(fecha: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${fecha}T12:00:00`));
}

beforeEach(() => {
  __reset({ configuracion: {} });
  __setConfiguracion(null);
  guardarSesionAdmin({ id: 'adm-1', nombre: 'Ana Admin', telefono: '3312345678', rol: 'superadmin', inicio: 'x' });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true });
});
afterEach(() => {
  vi.useRealTimers();
  __setConfiguracion(null);
  cerrarSesionAdmin();
  localStorage.clear();
});

describe('catálogo', () => {
  it('son 18, cada una con su icono del proyecto y su paleta', () => {
    expect(Object.keys(F)).toHaveLength(18);
    for (const f of Object.values(F)) {
      expect(iconoFestividad(f), f.icono).toBeTruthy();
      expect(PALETAS_FESTIVAS[f.paleta], f.paleta).toBeTruthy();
    }
  });
});

describe('fechas', () => {
  it('Domingo de Pascua', () => {
    expect(ymd(domingoDePascua(2025))).toBe('2025-04-20');
    expect(ymd(domingoDePascua(2026))).toBe('2026-04-05');
    expect(ymd(domingoDePascua(2027))).toBe('2027-03-28');
  });

  it('las móviles se calculan para cada año', () => {
    expect(rangoEnAnio(F['fiesta-semana-santa'], 2026)).toEqual(['2026-03-29', '2026-04-05']);
    expect(rangoEnAnio(F['fiesta-carnaval'], 2026)).toEqual(['2026-02-14', '2026-02-17']);
    expect(rangoEnAnio(F['fiesta-dia-padre'], 2026)).toEqual(['2026-06-21', '2026-06-21']);
    expect(rangoEnAnio(F['fiesta-dia-padre'], 2025)).toEqual(['2025-06-15', '2025-06-15']);
    // 16 de julio de 2026 es jueves: lunes 20 y lunes 27
    expect(rangoEnAnio(F['fiesta-guelaguetza'], 2026)).toEqual(['2026-07-20', '2026-07-27']);
    // 16 de julio de 2029 es lunes: cuentan los dos lunes SIGUIENTES
    expect(rangoEnAnio(F['fiesta-guelaguetza'], 2029)).toEqual(['2029-07-23', '2029-07-30']);
  });

  it('las fijas se repiten cada año y Año Nuevo cruza de diciembre a enero', () => {
    expect(festividadVigente(F['fiesta-halloween'], '2026-10-31')).toBe(true);
    expect(festividadVigente(F['fiesta-halloween'], '2031-10-31')).toBe(true);
    expect(festividadVigente(F['fiesta-halloween'], '2026-11-01')).toBe(false);
    expect(festividadVigente(F['fiesta-ano-nuevo'], '2026-12-31')).toBe(true);
    expect(festividadVigente(F['fiesta-ano-nuevo'], '2027-01-01')).toBe(true);
    expect(festividadVigente(F['fiesta-ano-nuevo'], '2027-01-02')).toBe(false);
  });

  it('cada día de fiesta enciende la suya y un día normal ninguna', () => {
    expect(enCurso('2026-10-31')).toBe('fiesta-halloween');
    expect(enCurso('2026-11-02')).toBe('fiesta-dia-muertos');
    expect(enCurso('2026-12-20')).toBe('fiesta-posadas');
    expect(enCurso('2026-12-25')).toBe('fiesta-navidad');
    expect(enCurso('2026-09-16')).toBe('fiesta-independencia');
    expect(enCurso('2026-04-02')).toBe('fiesta-semana-santa');
    expect(enCurso('2026-10-02')).toBeNull();
  });
});

describe('configuración del admin', () => {
  it('por defecto: encendidas, cambian la paleta y patronales sin fechas', () => {
    expect(normalizarConfiguracion(null).apariencia.festivas).toEqual(FESTIVAS_DEFAULT);
    expect(enCurso('2026-06-15')).toBeNull(); // patronales sin fechas no se encienden
  });

  it('respeta el interruptor general, las apagadas y las fechas de las patronales', () => {
    expect(enCurso('2026-10-31', normalizarFestivas({ activas: false }))).toBeNull();
    expect(enCurso('2026-10-31', normalizarFestivas({ apagadas: { 'fiesta-halloween': true } }))).toBeNull();
    const pat = normalizarFestivas({ patronales: { desde: '2026-08-10', hasta: '2026-08-15' } });
    expect(enCurso('2026-08-12', pat)).toBe('fiesta-patronales');
    expect(enCurso('2026-08-16', pat)).toBeNull();
  });

  it('ignora valores raros', () => {
    const n = normalizarFestivas({ activas: 'si', apagadas: { inventada: true, 'fiesta-navidad': 'x' }, patronales: { desde: 'ayer' } });
    expect(n).toEqual(FESTIVAS_DEFAULT);
  });
});

describe('icono en cabeceras y carruseles', () => {
  it('aparece en la fecha de la festividad, sin recibir toques', async () => {
    hoyEs('2026-12-25');
    __setConfiguracion({});
    const w = mount(IconoFestivo, { props: { esquina: 'sup-der' } });
    await flushPromises();
    const img = w.find('[data-testid="icono-festivo"]');
    expect(img.exists()).toBe(true);
    expect(img.attributes('title')).toBe('Navidad');
    expect(img.attributes('aria-hidden')).toBe('true');
    expect(img.classes()).toContain('esquina-sup-der');
  });

  it('un día normal no ocupa espacio', async () => {
    hoyEs('2026-10-02');
    __setConfiguracion({});
    const w = mount(IconoFestivo);
    await flushPromises();
    expect(w.find('[data-testid="icono-festivo"]').exists()).toBe(false);
  });

  it('una temática propia activa tiene prioridad', async () => {
    hoyEs('2026-10-31');
    __setConfiguracion({
      apariencia: {
        tematicas: {
          t1: { nombre: 'Mía', piezas: [{ imagen: 'arana.svg' }], pantallas: ['login'], activa: true },
        },
      },
    });
    const w = mount(IconoFestivo);
    await flushPromises();
    expect(w.find('[data-testid="icono-festivo"]').exists()).toBe(false);
  });
});

describe('Admin › Apariencia › Festividades', () => {
  it('lista las 18 con su estado y permite apagar una', async () => {
    hoyEs('2026-10-31');
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs: { AdminTopbar: true } } });
    await flushPromises();
    expect(w.findAll('[data-testid^="festividad-"]')).toHaveLength(18);
    const fila = w.find('[data-testid="festividad-fiesta-halloween"]');
    expect(fila.text()).toContain('Hoy');
    expect(w.find('[data-testid="festividad-fiesta-navidad"]').text()).toContain('Programada');
    expect(w.find('[data-testid="festividad-fiesta-patronales"]').text()).toContain('Sin fechas');

    await fila.find('[data-testid="apagar-auto"]').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/apariencia/festivas/apagadas/fiesta-halloween')).toBe(true);
  });

  it('guarda las fechas de las fiestas patronales y el interruptor de colores', async () => {
    hoyEs('2026-10-02');
    __setConfiguracion({});
    const w = mount(AdminApariencia, { global: { stubs: { AdminTopbar: true } } });
    await flushPromises();
    await w.find('#fest-pat-desde').setValue('2026-08-10');
    await w.find('#fest-pat-hasta').setValue('2026-08-15');
    await w.find('[data-testid="guardar-patronales"]').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/apariencia/festivas/patronales')).toEqual({ desde: '2026-08-10', hasta: '2026-08-15' });

    await w.find('[data-testid="festivas-paleta"]').setValue(false);
    await flushPromises();
    expect(__getAt('configuracion/apariencia/festivas/cambiarPaleta')).toBe(false);
  });
});

describe('activar una festividad a mano', () => {
  it('manda sobre las fechas, las apagadas y el interruptor general', () => {
    expect(enCurso('2026-10-02', normalizarFestivas({ manual: 'fiesta-navidad' }))).toBe('fiesta-navidad');
    // aunque sea Halloween, la manual gana
    expect(enCurso('2026-10-31', normalizarFestivas({ manual: 'fiesta-navidad' }))).toBe('fiesta-navidad');
    expect(
      enCurso('2026-10-02', normalizarFestivas({ manual: 'fiesta-reyes', activas: false, apagadas: { 'fiesta-reyes': true } })),
    ).toBe('fiesta-reyes');
    expect(normalizarFestivas({ manual: 'inventada' }).manual).toBe('');
  });

  it('el icono aparece en un día normal', async () => {
    hoyEs('2026-10-02');
    __setConfiguracion({ apariencia: { festivas: { manual: 'fiesta-dia-muertos' } } });
    const w = mount(IconoFestivo);
    await flushPromises();
    expect(w.find('[data-testid="icono-festivo"]').attributes('title')).toBe('Día de Muertos');
  });

  it('"Activar ahora" la enciende y apaga las temáticas propias; "Quitar" la retira', async () => {
    hoyEs('2026-10-02');
    __setConfiguracion({
      apariencia: { tematicas: { t1: { nombre: 'Mía', piezas: [{ imagen: 'arana.svg' }], pantallas: ['login'], activa: true } } },
    });
    const w = mount(AdminApariencia, { global: { stubs: { AdminTopbar: true } } });
    await flushPromises();
    await w.find('[data-testid="festividad-fiesta-navidad"] [data-testid="activar-manual"]').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/apariencia/festivas/manual')).toBe('fiesta-navidad');
    expect(__getAt('configuracion/apariencia/tematicas/t1/activa')).toBe(false);

    __setConfiguracion({ apariencia: { festivas: { manual: 'fiesta-navidad' } } });
    await flushPromises();
    expect(w.find('[data-testid="festividad-fiesta-navidad"]').text()).toContain('Activa (a mano)');
    expect(w.find('[data-testid="festividad-manual"]').text()).toContain('Navidad');
    await w.find('[data-testid="festividad-fiesta-navidad"] [data-testid="quitar-manual"]').trigger('click');
    await flushPromises();
    expect(__getAt('configuracion/apariencia/festivas/manual')).toBe('');
  });

  it('activar una temática propia quita la festividad manual', async () => {
    __reset({ configuracion: {} });
    __setConfiguracion({ apariencia: { festivas: { manual: 'fiesta-navidad' } } });
    await activarTematica('t9');
    expect(__getAt('configuracion/apariencia/festivas/manual')).toBe('');
    expect(__getAt('configuracion/apariencia/tematicas/t9/activa')).toBe(true);
  });
});
