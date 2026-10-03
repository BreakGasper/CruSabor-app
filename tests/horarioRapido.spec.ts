/**
 * Captura rápida del horario (registro y edición de tienda): "mismo horario de lunes
 * a viernes" y "sábado y domingo igual", con el lunes como referencia.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reactive, nextTick, effectScope } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { swalMock } from './setup';
import { detectarModo, useHorarioRapido, type HorarioEditable } from '@/composables/useHorarioRapido';

vi.mock('@/composables/useCategorias', () => ({
  obtenerCategorias: vi.fn(async () => [{ id: 'c1', nombre: 'Alimentos y Bebidas' }]),
}));
vi.mock('@/composables/useStorage', () => ({
  uploadStoreLogo: vi.fn(async () => ''),
  uploadStoreBanner: vi.fn(async () => ''),
  uploadStoreGallery: vi.fn(async () => []),
}));

import StoreEditModal from '@/modules/store/components/StoreEditModal.vue';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const vacio = (): HorarioEditable => Object.fromEntries(DIAS.map((d) => [d, { inicio: '', fin: '' }]));
const conHoras = (dias: string[], inicio = '09:00', fin = '18:00'): HorarioEditable => {
  const h = vacio();
  for (const d of dias) h[d] = { inicio, fin };
  return h;
};
const ENTRE_SEMANA = DIAS.slice(0, 5);

describe('detectarModo (el lunes es la referencia)', () => {
  it('tienda nueva sin horario: arranca con "lunes a viernes" marcado', () => {
    expect(detectarModo(vacio())).toEqual({ mismo: true, incluirFin: false });
  });

  it('lunes a viernes iguales y fin de semana cerrado', () => {
    expect(detectarModo(conHoras(ENTRE_SEMANA))).toEqual({ mismo: true, incluirFin: false });
  });

  it('los siete días iguales marca también el fin de semana', () => {
    expect(detectarModo(conHoras(DIAS))).toEqual({ mismo: true, incluirFin: true });
  });

  it('un día entre semana distinto deja las casillas sin marcar (captura manual)', () => {
    const h = conHoras(ENTRE_SEMANA);
    h.Viernes = { inicio: '09:00', fin: '14:00' };
    expect(detectarModo(h)).toEqual({ mismo: false, incluirFin: false });
  });

  it('sábado con otro horario: lunes a viernes sí, fin de semana a mano', () => {
    const h = conHoras(ENTRE_SEMANA);
    h.Sábado = { inicio: '10:00', fin: '14:00' };
    expect(detectarModo(h)).toEqual({ mismo: true, incluirFin: false });
  });
});

describe('useHorarioRapido', () => {
  let scope: ReturnType<typeof effectScope>;
  beforeEach(() => (scope = effectScope()));
  afterEach(() => scope.stop());

  const crear = (inicial: HorarioEditable) => {
    const form = reactive({ horario: inicial });
    const api = scope.run(() => useHorarioRapido(() => form.horario))!;
    return { form, ...api };
  };

  it('lo que se escribe en la fila del lunes se copia de martes a viernes', async () => {
    const { form, diasVisibles, etiquetaDia } = crear(vacio());
    expect(diasVisibles.value).toEqual(['Lunes', 'Sábado', 'Domingo']);
    expect(etiquetaDia('Lunes')).toBe('Lunes a viernes');

    form.horario.Lunes = { inicio: '08:00', fin: '17:00' };
    await nextTick();
    for (const d of ENTRE_SEMANA) expect(form.horario[d]).toEqual({ inicio: '08:00', fin: '17:00' });
    expect(form.horario.Sábado).toEqual({ inicio: '', fin: '' });
  });

  it('con sábado y domingo incluidos, una sola fila "Lunes a domingo" para los siete días', async () => {
    const { form, mismoEntreSemana, incluirFinDeSemana, diasVisibles, etiquetaDia } = crear(conHoras(['Lunes']));
    expect(mismoEntreSemana.value).toBe(false); // solo el lunes tiene horas: captura manual
    mismoEntreSemana.value = true;
    incluirFinDeSemana.value = true;
    await nextTick();
    expect(diasVisibles.value).toEqual(['Lunes']);
    expect(etiquetaDia('Lunes')).toBe('Lunes a domingo');
    for (const d of DIAS) expect(form.horario[d]).toEqual({ inicio: '09:00', fin: '18:00' });
  });

  it('desmarcar el fin de semana lo deja cerrado para capturarlo a mano', async () => {
    const { form, incluirFinDeSemana, alCambiarFinDeSemana, diasVisibles } = crear(conHoras(DIAS));
    incluirFinDeSemana.value = false;
    alCambiarFinDeSemana();
    await nextTick();
    expect(diasVisibles.value).toEqual(['Lunes', 'Sábado', 'Domingo']);
    expect(form.horario.Sábado).toEqual({ inicio: '', fin: '' });
    expect(form.horario.Viernes).toEqual({ inicio: '09:00', fin: '18:00' });
  });

  it('desmarcar "lunes a viernes" muestra los siete días con lo copiado para ajustarlos', async () => {
    const { form, mismoEntreSemana, incluirFinDeSemana, alCambiarMismo, diasVisibles } = crear(conHoras(DIAS));
    mismoEntreSemana.value = false;
    alCambiarMismo();
    await nextTick();
    expect(incluirFinDeSemana.value).toBe(false);
    expect(diasVisibles.value).toEqual(DIAS);
    form.horario.Viernes = { inicio: '09:00', fin: '14:00' };
    await nextTick();
    expect(form.horario.Lunes).toEqual({ inicio: '09:00', fin: '18:00' }); // ya no se copia
  });

  it('al cargar otro horario (otra tienda) las casillas se recalculan', async () => {
    const { form, mismoEntreSemana } = crear(vacio());
    const h = conHoras(ENTRE_SEMANA);
    h.Miércoles = { inicio: '12:00', fin: '18:00' };
    form.horario = h;
    await nextTick();
    expect(mismoEntreSemana.value).toBe(false);
    expect(form.horario.Miércoles).toEqual({ inicio: '12:00', fin: '18:00' }); // no se pisó
  });
});

describe('Editar tienda › Horario', () => {
  const T = 'tienda-A';
  const tienda = (horario: HorarioEditable) => ({
    tiendaId: T,
    nombreTienda: 'Postres Lola',
    categoria: 'Alimentos y Bebidas',
    telefono: '3751241116',
    email: 'lola@test.com',
    calle: 'Avila Camacho',
    numero: '189',
    colonia: 'El Crucero',
    cp: '46798',
    municipio: 'Ameca',
    estado: 'Jalisco',
    metodosPago: ['Efectivo'],
    horario,
  });
  let w: any;
  beforeEach(() => {
    __reset({ tiendas: { [T]: tienda(vacio()) } });
    swalMock.fire.mockReset();
    swalMock.fire.mockResolvedValue({ isConfirmed: true });
  });
  afterEach(() => {
    w?.unmount();
    localStorage.clear();
  });

  it('con lunes a viernes iguales guardados, la casilla aparece marcada y se edita una sola fila', async () => {
    w = mount(StoreEditModal, { props: { visible: true, tienda: tienda(conHoras(ENTRE_SEMANA)) as any } });
    await flushPromises();
    expect((w.find('[data-testid="horario-mismo"]').element as HTMLInputElement).checked).toBe(true);
    expect((w.find('[data-testid="horario-fin"]').element as HTMLInputElement).checked).toBe(false);
    expect(w.find('[data-testid="dia-Lunes"]').text()).toContain('Lunes a viernes');
    expect(w.find('[data-testid="dia-Martes"]').exists()).toBe(false);

    const [apertura, cierre] = w.find('[data-testid="dia-Lunes"]').findAll('input[type=time]');
    await apertura.setValue('10:00');
    await cierre.setValue('19:00');
    await w.find('form').trigger('submit');
    await flushPromises();

    const guardado = __getAt(`tiendas/${T}/horario`);
    for (const d of ENTRE_SEMANA) expect(guardado[d]).toEqual({ inicio: '10:00', fin: '19:00' });
    expect(guardado.Domingo).toEqual({ inicio: '', fin: '' });
  });

  it('un horario distinto por día se queda en captura manual', async () => {
    const h = conHoras(ENTRE_SEMANA);
    h.Viernes = { inicio: '09:00', fin: '14:00' };
    w = mount(StoreEditModal, { props: { visible: true, tienda: tienda(h) as any } });
    await flushPromises();
    expect((w.find('[data-testid="horario-mismo"]').element as HTMLInputElement).checked).toBe(false);
    expect(w.findAll('.se-dia')).toHaveLength(7);
  });
});
