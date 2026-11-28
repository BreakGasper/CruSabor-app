/**
 * Servicios · módulos 4 y 6 (pantallas): calendario, reservar, mis citas, citas y horarios de la tienda,
 * panel de resumen, clientes y el directorio «Encontrar servicios».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { __reset, __getAt } from './mocks/firebaseDb';
import { routeMock, routerMock, swalMock } from './setup';
import { guardarSesion, cerrarSesion } from '@/utils/sessionUser';
import { ahoraEnZona, diaClaveDe, sumarDias } from '@/modules/servicios/disponibilidad';
import { reservarCita } from '@/modules/servicios/agenda';

import CalendarioMes from '@/modules/servicios/components/CalendarioMes.vue';
import SelectorModo from '@/modules/servicios/components/SelectorModo.vue';
import ReservarCita from '@/modules/servicios/views/ReservarCita.vue';
import MisCitas from '@/modules/servicios/views/MisCitas.vue';
import CitasTienda from '@/modules/servicios/views/CitasTienda.vue';
import HorariosDisponibilidad from '@/modules/servicios/views/HorariosDisponibilidad.vue';
import PanelServicios from '@/modules/servicios/views/PanelServicios.vue';
import ClientesServicio from '@/modules/servicios/views/ClientesServicio.vue';
import ServiciosDirectorio from '@/modules/servicios/views/ServiciosDirectorio.vue';

const T = 'tS';
const HOY = ahoraEnZona().fecha;
/** Próxima fecha con ese día de la semana, al menos 2 días adelante (para no chocar con la anticipación mínima) */
function proximo(dia: 'lun' | 'mar' | 'mie'): string {
  let f = sumarDias(HOY, 2);
  while (diaClaveDe(f) !== dia) f = sumarDias(f, 1);
  return f;
}
const LUNES = proximo('lun');
const MARTES = proximo('mar');
const bloques = (inicio: string, id: string, fecha = LUNES) => {
  const [h, m] = inicio.split(':').map(Number);
  return Object.fromEntries([0, 15, 30, 45].map((d) => [`${String(h).padStart(2, '0')}${String((m + d) % 60).padStart(2, '0')}`, id]).map(([k, v]) => [k, v]));
};

const tienda = (extra: Record<string, any> = {}) => ({
  nombreTienda: 'Barbería Lalo',
  estatus: 'activa',
  telefono: '3751241116',
  tipoNegocio: 'servicios',
  categoriaServicio: 'barberia',
  modalidadAtencion: 'ambas',
  municipio: 'Ameca',
  membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' },
  horario: { Lunes: { inicio: '09:00', fin: '18:00' }, Martes: { inicio: '09:00', fin: '14:00' } },
  ...extra,
});
const servicio = (extra: Record<string, any> = {}) => ({ nombre: 'Corte clásico', descripcion: '', fotos: [], categoria: 'barberia', tipoPrecio: 'fijo', precio: 150, duracionMin: 60, modalidad: 'ambas', contratacion: 'cita', activo: true, orden: 1, creadoEn: '2026-11-01T00:00:00Z', ...extra });
const citaDoc = (extra: Record<string, any> = {}) => ({
  tiendaNombre: 'Barbería Lalo', tiendaTelefono: '3751241116', servicioId: 's1', servicioNombre: 'Corte clásico', profesionalId: 'principal', profesionalNombre: 'Barbería Lalo',
  clienteId: 'c1', clienteNombre: 'Ana Pérez', clienteTelefono: '3312345678', fecha: LUNES, inicio: '10:00', fin: '11:00', duracionMin: 60, precio: 150, estado: 'pendiente', creadaEn: new Date().toISOString(), ...extra,
});

let limpiar: Array<() => void> = [];
const stubs = { PageHeader: true };
const montar = (comp: any, props: Record<string, any> = {}) => {
  const w = mount(comp, { props, global: { stubs } });
  limpiar.push(() => w.unmount());
  return w;
};
const listo = async () => { await flushPromises(); await flushPromises(); await flushPromises(); };
const duenio = () => localStorage.setItem('tiendas', JSON.stringify({ id: T }));
const sesionCliente = () => guardarSesion({ id: 'c1', nombre: 'Ana Pérez', telefono: '3312345678', domicilio: 'Calle 5 #10', colonia: 'Centro', municipio: 'Ameca' });

beforeEach(() => {
  __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio() } } });
  swalMock.fire.mockReset();
  swalMock.fire.mockResolvedValue({ isConfirmed: true, value: '' });
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routeMock.params = { id: T, tiendaId: T, servicioId: 's1' };
  routeMock.query = {};
});
afterEach(() => {
  limpiar.forEach((f) => f());
  limpiar = [];
  cerrarSesion();
  localStorage.clear();
});

/** Lleva el calendario al mes de `fecha` (por si cae en el mes que sigue) */
async function irAlMes(w: any, fecha: string) {
  for (let i = 0; i < 3 && !w.find(`[data-fecha="${fecha}"]`).exists(); i++) await w.find('[data-testid="mes-siguiente"]').trigger('click');
}

/* ============================== Calendario ============================== */
describe('CalendarioMes', () => {
  const cal = (props: Record<string, any>) => montar(CalendarioMes, { mes: '2026-12', ...props });

  it('muestra el mes con lunes primero: diciembre 2026 empieza en martes', () => {
    const w = cal({});
    expect(w.find('[data-testid="titulo-mes"]').text().toLowerCase()).toContain('diciembre');
    expect(w.findAll('.dia')).toHaveLength(31);
    expect(w.findAll('.hueco')).toHaveLength(1); // el 1 de diciembre es martes
    expect(w.find('[data-fecha="2026-12-01"]').exists()).toBe(true);
  });

  it('solo se pueden elegir los días habilitados dentro de min y max; emite la fecha', async () => {
    const w = cal({ min: '2026-12-05', max: '2026-12-20', habilitadas: new Set(['2026-12-07', '2026-12-08', '2026-12-25']) });
    expect(w.find('[data-fecha="2026-12-07"]').attributes('disabled')).toBeUndefined();
    expect(w.find('[data-fecha="2026-12-06"]').attributes('disabled')).toBeDefined(); // no habilitado
    expect(w.find('[data-fecha="2026-12-25"]').attributes('disabled')).toBeDefined(); // fuera del máximo
    expect(w.find('[data-fecha="2026-12-01"]').attributes('disabled')).toBeDefined(); // antes del mínimo
    await w.find('[data-fecha="2026-12-07"]').trigger('click');
    expect(w.emitted('seleccionar')![0]).toEqual(['2026-12-07']);
    await w.find('[data-fecha="2026-12-06"]').trigger('click');
    expect(w.emitted('seleccionar')).toHaveLength(1);
  });

  it('marca la elegida y los días con punto; navega entre meses sin pasar de min ni de max', async () => {
    const w = cal({ seleccionada: '2026-12-07', marcadas: new Set(['2026-12-08']), min: '2026-12-01', max: '2027-01-15' });
    expect(w.find('[data-fecha="2026-12-07"]').classes()).toContain('sel');
    expect(w.find('[data-fecha="2026-12-08"] .punto').exists()).toBe(true);
    expect(w.find('[data-testid="mes-anterior"]').attributes('disabled')).toBeDefined(); // no hay nada antes del mínimo
    await w.find('[data-testid="mes-siguiente"]').trigger('click');
    expect(w.emitted('cambiar-mes')![0]).toEqual(['2027-01']);
    const enero = cal({ mes: '2027-01', min: '2026-12-01', max: '2027-01-15' });
    expect(enero.find('[data-testid="mes-siguiente"]').attributes('disabled')).toBeDefined();
    expect(enero.find('[data-testid="mes-anterior"]').attributes('disabled')).toBeUndefined();
  });
});

describe('SelectorModo', () => {
  it('«Encontrar servicios» lleva al directorio; «Comprar productos» a la portada', async () => {
    const productos = montar(SelectorModo, { modo: 'productos' });
    expect(productos.find('[data-testid="modo-productos"]').attributes('aria-pressed')).toBe('true');
    await productos.find('[data-testid="modo-productos"]').trigger('click');
    expect(routerMock.push).not.toHaveBeenCalled(); // ya está ahí
    await productos.find('[data-testid="modo-servicios"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/servicios');
    const servicios = montar(SelectorModo, { modo: 'servicios' });
    await servicios.find('[data-testid="modo-productos"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/');
  });
});

/* ============================== Reservar ============================== */
describe('ReservarCita', () => {
  it('sin sesión pide iniciar sesión', async () => {
    const w = montar(ReservarCita);
    await listo();
    expect(w.find('[data-testid="pide-sesion"]').exists()).toBe(true);
    await w.find('[data-testid="iniciar-sesion"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: `/reservar/${T}/s1` } });
  });

  it('un servicio que no se agenda no muestra la reserva', async () => {
    sesionCliente();
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ contratacion: 'cotizacion' }) } } });
    const w = montar(ReservarCita);
    await listo();
    expect(w.find('[data-testid="no-disponible"]').exists()).toBe(true);
  });

  it('elige día y hora, deja sus datos y solicita la cita: queda pendiente con todos sus bloques', async () => {
    sesionCliente();
    const w = montar(ReservarCita);
    await listo();
    expect(w.find('[data-testid="elegir-profesional"]').exists()).toBe(false); // un solo profesional: no se pregunta
    await irAlMes(w, LUNES);
    await w.find(`[data-fecha="${LUNES}"]`).trigger('click');
    const horas = w.findAll('[data-hora]').map((h) => h.attributes('data-hora'));
    expect(horas[0]).toBe('09:00');
    expect(horas).toContain('17:00');
    expect(horas).not.toContain('17:30'); // terminaría 18:30
    await w.find('[data-hora="10:00"]').trigger('click');
    expect(w.find('[data-testid="cita-elegida"]').text()).toContain('10:00–11:00');
    expect((w.find('[data-testid="nombre"]').element as HTMLInputElement).value).toBe('Ana Pérez'); // de su perfil
    expect((w.find('[data-testid="telefono"]').element as HTMLInputElement).value).toBe('3312345678');
    await w.find('[data-testid="comentarios"]').setValue('Sin máquina, por favor');
    await w.find('[data-testid="datos-cita"]').trigger('submit');
    await listo();

    const [id, c] = Object.entries(__getAt(`citas/${T}`))[0] as [string, any];
    expect(c).toMatchObject({ estado: 'pendiente', clienteId: 'c1', fecha: LUNES, inicio: '10:00', fin: '11:00', comentarios: 'Sin máquina, por favor', servicioId: 's1' });
    expect(Object.keys(__getAt(`ocupacion/${T}/principal/${LUNES}`)).sort()).toEqual(['1000', '1015', '1030', '1045']);
    expect(__getAt(`citasPorCliente/c1/${id}`)).toEqual({ tiendaId: T });
    expect(swalMock.fire.mock.calls[0][0]).toMatchObject({ icon: 'success', title: '¡Cita solicitada!' });
    expect(routerMock.replace).toHaveBeenCalledWith('/mis-citas');
  });

  it('los horarios ya ocupados no se ofrecen', async () => {
    sesionCliente();
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio() } }, ocupacion: { [T]: { principal: { [LUNES]: bloques('10:00', 'x') } } } });
    const w = montar(ReservarCita);
    await listo();
    await irAlMes(w, LUNES);
    await w.find(`[data-fecha="${LUNES}"]`).trigger('click');
    const horas = w.findAll('[data-hora]').map((h) => h.attributes('data-hora'));
    expect(horas).toContain('09:00'); // 09:00–10:00 cabe justo antes
    for (const ocupada of ['09:30', '10:00', '10:30']) expect(horas, ocupada).not.toContain(ocupada);
    expect(horas).toContain('11:00');
  });

  it('si alguien se le adelanta mientras llena sus datos, avisa y vuelve a mostrar lo que sigue libre', async () => {
    sesionCliente();
    const w = montar(ReservarCita);
    await listo();
    await irAlMes(w, LUNES);
    await w.find(`[data-fecha="${LUNES}"]`).trigger('click');
    await w.find('[data-hora="10:00"]').trigger('click');
    // otra persona toma ese horario antes de que se envíe el formulario
    await reservarCita(T, { servicio: { id: 's1', nombre: 'Corte clásico', duracionMin: 60, precio: 150, tipoPrecio: 'fijo', modalidad: 'ambas', contratacion: 'cita', profesionalIds: [] }, profesionalId: 'principal', fecha: LUNES, inicio: '10:00', cliente: { id: 'c2', nombre: 'Beto', telefono: '3300000002' }, adomicilio: false });
    await w.find('[data-testid="datos-cita"]').trigger('submit');
    await listo();
    expect(swalMock.fire.mock.calls.at(-1)![0]).toMatchObject({ icon: 'warning', title: 'No se pudo agendar' });
    expect(Object.values(__getAt(`citas/${T}`)).filter((c: any) => c.clienteId === 'c1')).toHaveLength(0);
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(w.find('[data-testid="datos-cita"]').exists()).toBe(false); // se limpió la selección
  });

  it('con varios profesionales se pregunta con quién; cada uno trae su propia agenda', async () => {
    sesionCliente();
    __reset({
      tiendas: { [T]: tienda() },
      servicios: { [T]: { s1: servicio() } },
      profesionales: { [T]: { marco: { nombre: 'Marco', activo: true }, ines: { nombre: 'Inés', activo: false } } },
    });
    const w = montar(ReservarCita);
    await listo();
    const opciones = w.findAll('[data-testid="elegir-profesional"] input').map((i) => i.attributes('data-testid'));
    expect(opciones.sort()).toEqual(['prof-marco', 'prof-principal']); // Inés está desactivada
    expect(w.find('[data-testid="selector-horario"]').exists()).toBe(false); // hasta elegir
    await w.find('[data-testid="prof-marco"]').setValue(true);
    await listo();
    expect(w.find('[data-testid="selector-horario"]').exists()).toBe(true);
  });

  it('un servicio ofrecido solo por algunos profesionales no muestra a los demás', async () => {
    sesionCliente();
    __reset({ tiendas: { [T]: tienda() }, servicios: { [T]: { s1: servicio({ profesionalIds: ['marco'] }) } }, profesionales: { [T]: { marco: { nombre: 'Marco', activo: true } } } });
    const w = montar(ReservarCita);
    await listo();
    expect(w.find('[data-testid="elegir-profesional"]').exists()).toBe(false); // solo Marco: va directo
    expect(w.find('[data-testid="selector-horario"]').exists()).toBe(true);
  });
});

/* ============================== Mis citas ============================== */
describe('MisCitas', () => {
  beforeEach(() => {
    sesionCliente();
    __reset({
      tiendas: { [T]: tienda() },
      citas: { [T]: { k1: citaDoc(), k2: citaDoc({ servicioNombre: 'Barba', estado: 'confirmada', fecha: MARTES, inicio: '09:00', fin: '10:00' }), k3: citaDoc({ servicioNombre: 'Vieja', estado: 'completada', fecha: '2026-01-05' }), k4: citaDoc({ clienteId: 'c9', servicioNombre: 'De otra persona' }) } },
      citasPorCliente: { c1: { k1: { tiendaId: T }, k2: { tiendaId: T }, k3: { tiendaId: T } }, c9: { k4: { tiendaId: T } } },
      ocupacion: { [T]: { principal: { [LUNES]: bloques('10:00', 'k1') } } },
    });
  });

  it('sin sesión pide entrar; sin citas lo explica', async () => {
    cerrarSesion();
    expect(montar(MisCitas).find('[data-testid="pide-sesion"]').exists()).toBe(true);
    sesionCliente();
    __reset({ citasPorCliente: {} });
    const w = montar(MisCitas);
    await listo();
    expect(w.find('[data-testid="sin-citas"]').exists()).toBe(true);
  });

  it('separa próximas y anteriores, solo las del cliente, con estado, fecha, hora y aviso de confirmación', async () => {
    const w = montar(MisCitas);
    await listo();
    const prox = w.findAll('[data-grupo="proximas"] [data-cita]').map((c) => c.attributes('data-cita'));
    expect(prox.sort()).toEqual(['k1', 'k2']);
    expect(w.findAll('[data-grupo="anteriores"] [data-cita]').map((c) => c.attributes('data-cita'))).toEqual(['k3']);
    expect(w.text()).not.toContain('De otra persona');
    const k1 = w.find('[data-cita="k1"]');
    expect(k1.find('[data-testid="insignia-estado"]').text()).toBe('Pendiente');
    expect(k1.text()).toContain('10:00–11:00');
    expect(k1.text()).toContain('debe confirmar');
    expect(w.find('[data-cita="k2"] [data-testid="insignia-estado"]').text()).toBe('Confirmada');
  });

  it('cancelar libera el horario y la cita queda cancelada', async () => {
    const w = montar(MisCitas);
    await listo();
    await w.find('[data-cita="k1"] [data-accion="cancelar"]').trigger('click');
    await listo();
    expect(__getAt(`citas/${T}/k1/estado`)).toBe('cancelada');
    expect(Object.keys(__getAt(`ocupacion/${T}/principal/${LUNES}`) ?? {})).toEqual([]);
    expect(w.find('[data-grupo="anteriores"] [data-cita="k1"]').exists()).toBe(true); // pasa a «anteriores»
  });

  it('no ofrece cancelar lo que ya pasó; hay botón de WhatsApp a la tienda en las vigentes', async () => {
    const w = montar(MisCitas);
    await listo();
    expect(w.find('[data-cita="k3"] [data-accion="cancelar"]').exists()).toBe(false);
    expect(w.find('[data-cita="k1"] [data-testid="whatsapp"]').attributes('href')).toMatch(/^https:\/\/wa\.me\/523751241116/);
    expect(w.find('[data-cita="k3"] [data-testid="whatsapp"]').exists()).toBe(true); // completada: aún puede escribirle
  });

  it('si la tienda ya la canceló, el aviso es claro y se muestra el estado real', async () => {
    const w = montar(MisCitas);
    await listo();
    __reset({ ...{ tiendas: { [T]: tienda() } }, citas: { [T]: { k1: citaDoc({ estado: 'rechazada' }) } }, citasPorCliente: { c1: { k1: { tiendaId: T } } } });
    await w.find('[data-cita="k1"] [data-accion="cancelar"]').trigger('click');
    await listo();
    expect(swalMock.fire.mock.calls.at(-1)![0]).toMatchObject({ icon: 'warning', title: 'No se pudo cancelar' });
    expect(__getAt(`citas/${T}/k1/estado`)).toBe('rechazada');
  });
});

/* ============================== Citas de la tienda ============================== */
describe('CitasTienda', () => {
  beforeEach(() => {
    duenio();
    __reset({
      tiendas: { [T]: tienda() },
      servicios: { [T]: { s1: servicio() } },
      citas: { [T]: { k1: citaDoc(), k2: citaDoc({ clienteNombre: 'Beto', estado: 'confirmada', fecha: MARTES, inicio: '09:00', fin: '10:00', clienteId: 'c2' }), k3: citaDoc({ clienteNombre: 'Vieja', estado: 'completada', fecha: '2026-01-05', clienteId: 'c3' }) } },
      ocupacion: { [T]: { principal: { [LUNES]: bloques('10:00', 'k1'), [MARTES]: bloques('09:00', 'k2') } } },
    });
  });

  it('quien no es la tienda no ve nada', async () => {
    localStorage.clear();
    const w = montar(CitasTienda);
    await listo();
    expect(w.find('[data-testid="no-es-dueno"]').exists()).toBe(true);
  });

  it('calendario con puntos en los días con citas, y filtros con su cuenta', async () => {
    const w = montar(CitasTienda);
    await listo();
    await irAlMes(w, LUNES);
    expect(w.find(`[data-fecha="${LUNES}"] .punto`).exists()).toBe(true);
    expect(w.find(`[data-fecha="${MARTES}"] .punto`).exists() || MARTES.slice(0, 7) !== LUNES.slice(0, 7)).toBe(true);
    expect(w.findAll('.filtro').map((f) => f.text().replace(/\s+/g, ' '))).toEqual(['Por confirmar1', 'Próximas2', 'Historial1']);
  });

  it('al tocar un día muestra solo sus citas', async () => {
    const w = montar(CitasTienda);
    await listo();
    await irAlMes(w, LUNES);
    await w.find(`[data-fecha="${LUNES}"]`).trigger('click');
    expect(w.findAll('[data-cita]').map((c) => c.attributes('data-cita'))).toEqual(['k1']);
    expect(w.find('[data-filtro="dia"]').exists()).toBe(true);
  });

  it('cada estado muestra solo sus acciones', async () => {
    const w = montar(CitasTienda);
    await listo();
    const acciones = (id: string) => w.findAll(`[data-cita="${id}"] [data-accion]`).map((a) => a.attributes('data-accion'));
    await w.find('[data-filtro="confirmar"]').trigger('click');
    expect(acciones('k1')).toEqual(['confirmada', 'rechazada', 'cancelada', 'reprogramar']);
    await w.find('[data-filtro="proximas"]').trigger('click');
    expect(acciones('k2')).toEqual(['cancelada', 'reprogramar']); // confirmada aún no empieza: no se puede completar
    await w.find('[data-filtro="historial"]').trigger('click');
    expect(acciones('k3')).toEqual([]);
  });

  it('confirma una cita', async () => {
    const w = montar(CitasTienda);
    await listo();
    await w.find('[data-filtro="confirmar"]').trigger('click');
    await w.find('[data-cita="k1"] [data-accion="confirmada"]').trigger('click');
    await listo();
    expect(__getAt(`citas/${T}/k1/estado`)).toBe('confirmada');
  });

  it('rechazar con motivo libera el horario', async () => {
    swalMock.fire.mockResolvedValue({ isConfirmed: true, value: 'Ese día no atiendo' });
    const w = montar(CitasTienda);
    await listo();
    await w.find('[data-filtro="confirmar"]').trigger('click');
    await w.find('[data-cita="k1"] [data-accion="rechazada"]').trigger('click');
    await listo();
    expect(__getAt(`citas/${T}/k1/estado`)).toBe('rechazada');
    expect(Object.keys(__getAt(`ocupacion/${T}/principal/${LUNES}`) ?? {})).toEqual([]);
  });

  it('reprograma: elige otra fecha y hora; la cita se mueve y libera lo anterior', async () => {
    const w = montar(CitasTienda);
    await listo();
    await w.find('[data-filtro="confirmar"]').trigger('click');
    await w.find('[data-cita="k1"] [data-accion="reprogramar"]').trigger('click');
    await listo();
    expect(w.find('[data-testid="reprogramar"]').exists()).toBe(true);
    const dentro = w.find('[data-testid="reprogramar"]');
    await irAlMes(dentro as any, LUNES);
    await dentro.find(`[data-fecha="${LUNES}"]`).trigger('click');
    // el horario propio (10:00) cuenta como libre al moverla; elegimos otro
    await dentro.find('[data-hora="14:00"]').trigger('click');
    await dentro.find('[data-testid="confirmar-reprogramar"]').trigger('click');
    await listo();
    expect(__getAt(`citas/${T}/k1`)).toMatchObject({ fecha: LUNES, inicio: '14:00', fin: '15:00' });
    expect(Object.keys(__getAt(`ocupacion/${T}/principal/${LUNES}`)).sort()).toEqual(['1400', '1415', '1430', '1445']);
    expect(w.find('[data-testid="reprogramar"]').exists()).toBe(false);
  });

  it('botón de WhatsApp al cliente', async () => {
    const w = montar(CitasTienda);
    await listo();
    await w.find('[data-filtro="confirmar"]').trigger('click');
    expect(w.find('[data-cita="k1"] [data-testid="whatsapp"]').attributes('href')).toMatch(/^https:\/\/wa\.me\/523312345678/);
  });
});

/* ============================== Horarios y equipo ============================== */
describe('HorariosDisponibilidad', () => {
  beforeEach(duenio);

  it('quien no es la tienda no configura nada', async () => {
    localStorage.clear();
    const w = montar(HorariosDisponibilidad);
    await listo();
    expect(w.find('[data-testid="no-es-dueno"]').exists()).toBe(true);
  });

  it('parte del horario de la tienda: lunes y martes abiertos, el resto cerrado', async () => {
    const w = montar(HorariosDisponibilidad);
    await listo();
    expect((w.find('[data-testid="abre-lun"]').element as HTMLInputElement).checked).toBe(true);
    expect((w.find('[data-testid="desde-lun"]').element as HTMLInputElement).value).toBe('09:00');
    expect((w.find('[data-testid="hasta-mar"]').element as HTMLInputElement).value).toBe('14:00');
    expect((w.find('[data-testid="abre-mie"]').element as HTMLInputElement).checked).toBe(false);
    expect(w.find('[data-dia="mie"]').text()).toContain('Cerrado');
  });

  it('guarda cambios: abre el miércoles, un descanso, un bloqueo y vacaciones', async () => {
    const w = montar(HorariosDisponibilidad);
    await listo();
    await w.find('[data-testid="abre-mie"]').setValue(true);
    await w.find('[data-testid="desde-mie"]').setValue('10:00');
    await w.find('[data-testid="hasta-mie"]').setValue('16:00');
    await w.find('[data-testid="descanso-lun"]').trigger('click');
    await w.find('[data-testid="anticipacion"]').setValue('120');
    await w.find('[data-testid="max-dias"]').setValue('30');
    await w.find('[data-testid="bloqueo-fecha"]').setValue(LUNES);
    await w.find('[data-testid="agregar-bloqueo"]').trigger('click');
    await w.find('[data-testid="vac-desde"]').setValue(MARTES);
    await w.find('[data-testid="vac-hasta"]').setValue(MARTES);
    await w.find('[data-testid="agregar-vacaciones"]').trigger('click');
    expect(w.findAll('[data-testid="bloqueo"]')).toHaveLength(1);
    expect(w.findAll('[data-testid="vacaciones"]')).toHaveLength(1);
    await w.find('[data-testid="guardar-horario"]').trigger('click');
    await listo();
    const d = __getAt(`disponibilidad/${T}/principal`);
    expect(d.semana.mie).toEqual({ abre: '10:00', cierra: '16:00' });
    expect(d.semana.lun).toEqual({ abre: '09:00', cierra: '18:00', descansos: [{ desde: '14:00', hasta: '15:00' }] });
    expect(d).toMatchObject({ anticipacionMin: 120, maxDiasAdelante: 30 });
    expect(Object.values(d.bloqueos)).toEqual([{ fecha: LUNES }]);
    expect(Object.values(d.vacaciones)).toEqual([{ desde: MARTES, hasta: MARTES }]);
  });

  it('no guarda un horario con cierre antes de la apertura', async () => {
    const w = montar(HorariosDisponibilidad);
    await listo();
    await w.find('[data-testid="hasta-lun"]').setValue('08:00');
    await w.find('[data-testid="guardar-horario"]').trigger('click');
    await listo();
    expect(w.find('.error').text()).toMatch(/cierre debe ser después/);
    expect(__getAt(`disponibilidad/${T}`)).toBeUndefined();
  });

  it('agrega profesionales al equipo y cada uno tiene su agenda', async () => {
    const w = montar(HorariosDisponibilidad);
    await listo();
    expect(w.findAll('[data-testid="equipo"] .miembro')).toHaveLength(1);
    await w.find('[data-testid="prof-nombre"]').setValue('Marco');
    await w.find('[data-testid="prof-especialidad"]').setValue('Color');
    await w.find('[data-testid="agregar-prof"]').trigger('click');
    await listo();
    expect(w.findAll('[data-testid="equipo"] .miembro')).toHaveLength(2);
    const marco = Object.entries(__getAt(`profesionales/${T}`)).find(([, p]: any) => p.nombre === 'Marco')!;
    expect(marco[1]).toMatchObject({ especialidad: 'Color', activo: true });
    expect(w.find('[data-testid="agenda-de"]').exists()).toBe(true);
    await w.find('[data-testid="agenda-de"]').setValue(marco[0]);
    await listo();
    await w.find('[data-testid="guardar-horario"]').trigger('click');
    await listo();
    expect(__getAt(`disponibilidad/${T}/${marco[0]}`)).toBeDefined();
  });
});

/* ============================== Panel de resumen ============================== */
describe('PanelServicios', () => {
  beforeEach(() => {
    duenio();
    const reciente = new Date().toISOString();
    __reset({
      tiendas: { [T]: tienda() },
      servicios: { [T]: { s1: servicio(), s2: servicio({ nombre: 'Barba', activo: false }), s3: servicio({ nombre: 'Tinte' }) } },
      citas: { [T]: { k1: citaDoc({ creadaEn: reciente }), k2: citaDoc({ estado: 'confirmada', fecha: MARTES, inicio: '09:00', fin: '10:00', creadaEn: '2026-01-01T00:00:00Z' }), k3: citaDoc({ estado: 'completada', fecha: '2026-01-05', creadaEn: '2026-01-01T00:00:00Z' }) } },
      cotizaciones: { [T]: { q1: { servicioNombre: 'X', clienteNombre: 'Ana', estado: 'pendiente', creadaEn: reciente }, q2: { servicioNombre: 'Y', clienteNombre: 'Ana', estado: 'en_revision', creadaEn: '2026-01-01T00:00:00Z' }, q3: { servicioNombre: 'Z', clienteNombre: 'Ana', estado: 'aceptada', creadaEn: '2026-01-01T00:00:00Z' } } },
      clientesServicio: { [T]: { c1: { nombre: 'Ana', telefono: '3312345678', citas: 2, cotizaciones: 3, ultimaActividad: reciente }, c2: { nombre: 'Beto', telefono: '3300000002', citas: 1, cotizaciones: 0, ultimaActividad: '2026-01-01T00:00:00Z' } } },
    });
  });

  it('muestra los indicadores', async () => {
    const w = montar(PanelServicios);
    await listo();
    const kpi = (k: string) => w.find(`[data-kpi="${k}"] strong`).text();
    expect(kpi('proximas')).toBe('2'); // k1 y k2 (pendiente y confirmada dentro de 7 días)
    expect(kpi('por-confirmar')).toBe('1');
    expect(kpi('cotizaciones')).toBe('2'); // pendiente + en revisión
    expect(kpi('nuevas')).toBe('2'); // la cita y la cotización de hoy
    expect(kpi('servicios')).toBe('2'); // s1 y s3 publicados
    expect(w.find('[data-kpi="servicios"]').text()).toContain('1 ocultos');
    expect(w.find('[data-kpi="por-confirmar"]').classes()).toContain('alerta');
  });

  it('lista las próximas citas y lleva a cada sección con su aviso', async () => {
    const w = montar(PanelServicios);
    await listo();
    expect(w.findAll('[data-testid="proximas-citas"] .cita')).toHaveLength(2);
    expect(w.find('[data-seccion="citas"] .badge').text()).toBe('1');
    expect(w.find('[data-seccion="cotizaciones"] .badge').text()).toBe('2');
    expect(w.find('[data-seccion="clientes"]').text()).toContain('2 registrados');
    await w.find('[data-seccion="horarios"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/horarios/${T}`);
    await w.find('[data-seccion="clientes"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/clientes/${T}`);
    await w.find('[data-seccion="perfil"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith(`/store/profile/${T}`);
  });

  it('quien no es la tienda no ve el panel', async () => {
    localStorage.clear();
    const w = montar(PanelServicios);
    await listo();
    expect(w.find('[data-testid="no-es-dueno"]').exists()).toBe(true);
  });
});

/* ============================== Clientes ============================== */
describe('ClientesServicio', () => {
  beforeEach(() => {
    duenio();
    __reset({ clientesServicio: { [T]: { c1: { nombre: 'Ana Pérez', telefono: '3312345678', citas: 2, cotizaciones: 1, ultimaActividad: '2026-12-02T10:00:00Z', notas: 'Alérgica al tinte' }, c2: { nombre: 'Beto Ruiz', telefono: '3300000002', citas: 1, cotizaciones: 0, ultimaActividad: '2026-12-05T10:00:00Z' } } } });
  });

  it('lista a los clientes (el más reciente primero) con sus cuentas y notas', async () => {
    const w = montar(ClientesServicio);
    await listo();
    expect(w.findAll('[data-cliente]').map((c) => c.attributes('data-cliente'))).toEqual(['c2', 'c1']);
    expect(w.find('[data-cliente="c1"]').text()).toContain('🗓️ 2');
    expect((w.find('[data-cliente="c1"] [data-testid="nota"]').element as HTMLTextAreaElement).value).toBe('Alérgica al tinte');
    expect(w.find('[data-cliente="c1"] [data-testid="whatsapp"]').attributes('href')).toMatch(/^https:\/\/wa\.me\/523312345678/);
  });

  it('busca sin importar acentos y guarda notas privadas al salir del campo', async () => {
    const w = montar(ClientesServicio);
    await listo();
    await w.find('[data-testid="buscar-cliente"]').setValue('perez');
    expect(w.findAll('[data-cliente]').map((c) => c.attributes('data-cliente'))).toEqual(['c1']);
    const nota = w.find('[data-cliente="c1"] [data-testid="nota"]');
    await nota.setValue('Prefiere corte a tijera');
    await nota.trigger('blur');
    await listo();
    expect(__getAt(`clientesServicio/${T}/c1/notas`)).toBe('Prefiere corte a tijera');
    await nota.setValue('   ');
    await nota.trigger('blur');
    await listo();
    expect(__getAt(`clientesServicio/${T}/c1/notas`)).toBeUndefined(); // vacía = se borra
  });

  it('sin clientes lo explica', async () => {
    __reset({});
    const w = montar(ClientesServicio);
    await listo();
    expect(w.find('[data-testid="sin-clientes"]').exists()).toBe(true);
  });
});

/* ============================== Directorio «Encontrar servicios» ============================== */
describe('ServiciosDirectorio', () => {
  beforeEach(() => {
    __reset({
      tiendas: {
        tB: tienda({ nombreTienda: 'Barbería Lalo', categoriaServicio: 'barberia', modalidadAtencion: 'local', especialidades: ['Degradado'] }),
        tU: tienda({ nombreTienda: 'Uñas Marce', categoriaServicio: 'unas', modalidadAtencion: 'domicilio' }),
        tX: tienda({ nombreTienda: 'Mixto Pepe', tipoNegocio: 'mixto', categoriaServicio: 'barberia', modalidadAtencion: 'ambas' }),
        tP: { nombreTienda: 'Panadería', estatus: 'activa', membresia: { plan: 'mensual', vigenteHasta: '2099-12-31' } },
        tV: tienda({ nombreTienda: 'Vencida', membresia: { plan: 'mensual', vigenteHasta: '2020-01-01' } }),
        tK: tienda({ nombreTienda: 'Bloqueada', estatus: 'bloqueada' }),
      },
      servicios: {
        tB: { a: servicio({ nombre: 'Corte clásico', precio: 150 }), b: servicio({ nombre: 'Barba', precio: 90, orden: 2 }) },
        tU: { c: servicio({ nombre: 'Manicura en gel', categoria: 'unas', tipoPrecio: 'desde', precio: 300, modalidad: 'domicilio' }) },
        tX: { d: servicio({ nombre: 'Peinado', categoria: 'peinados', tipoPrecio: 'cotizar', precio: 0 }), e: servicio({ nombre: 'Oculto', activo: false }) },
      },
    });
  });
  const ids = (w: any) => w.findAll('[data-tienda]').map((t: any) => t.attributes('data-tienda'));

  it('solo muestra tiendas de servicios disponibles (no productos, vencidas ni bloqueadas)', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    expect(ids(w).sort()).toEqual(['tB', 'tU', 'tX']);
    expect(w.find('[data-testid="selector-modo"]').exists()).toBe(true);
  });

  it('cada tarjeta dice categoría, modalidad, "desde" y cuántos servicios (los ocultos no cuentan)', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    const b = w.find('[data-tienda="tB"]').text();
    expect(b).toContain('Barbería y peluquería');
    expect(b).toContain('En establecimiento');
    expect(b).toContain('Desde $90');
    expect(b).toContain('2 servicio(s)');
    expect(w.find('[data-tienda="tU"]').text()).toContain('A domicilio');
    const x = w.find('[data-tienda="tX"]').text();
    expect(x).toContain('Cotiza tu servicio');
    expect(x).toContain('1 servicio(s)');
  });

  it('busca por nombre, especialidad o servicio, sin importar acentos', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    await w.find('[data-testid="buscar"]').setValue('degradado');
    expect(ids(w)).toEqual(['tB']);
    await w.find('[data-testid="buscar"]').setValue('MANICURA');
    expect(ids(w)).toEqual(['tU']);
    await w.find('[data-testid="buscar"]').setValue('uñas');
    expect(ids(w)).toEqual(['tU']);
    await w.find('[data-testid="buscar"]').setValue('zzzz');
    expect(w.find('[data-testid="sin-resultados"]').exists()).toBe(true);
  });

  it('filtra por categoría (solo las que tienen profesionales) y por modalidad', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    expect(w.findAll('[data-cat]').map((c) => c.attributes('data-cat')).sort()).toEqual(['barberia', 'unas']);
    await w.find('[data-cat="barberia"]').trigger('click');
    expect(ids(w).sort()).toEqual(['tB', 'tX']);
    await w.find('[data-testid="cat-todas"]').trigger('click');
    await w.find('[data-testid="modalidad"]').setValue('domicilio');
    expect(ids(w).sort()).toEqual(['tU', 'tX']); // tB solo atiende en su local
    await w.find('[data-testid="modalidad"]').setValue('local');
    expect(ids(w).sort()).toEqual(['tB', 'tX']);
  });

  it('abre el perfil de la tienda al tocar una tarjeta', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    await w.find('[data-tienda="tB"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/store/profile/tB');
  });

  it('la pestaña «Servicios» lista los servicios activos y abre su detalle', async () => {
    const w = montar(ServiciosDirectorio);
    await listo();
    await w.find('[data-testid="vista-servicios"]').trigger('click');
    expect(w.findAll('[data-servicio]').map((s) => s.attributes('data-servicio')).sort()).toEqual(['a', 'b', 'c', 'd']); // sin el oculto
    expect(w.find('[data-servicio="c"]').text()).toContain('Desde $300');
    expect(w.find('[data-servicio="a"]').text()).toContain('Barbería Lalo');
    await w.find('[data-testid="buscar"]').setValue('barba');
    expect(w.findAll('[data-servicio]').map((s) => s.attributes('data-servicio'))).toEqual(['b']);
    await w.find('[data-servicio="b"]').trigger('click');
    expect(routerMock.push).toHaveBeenCalledWith('/store/../servicio/tB/b'.replace('/store/..', ''));
  });
});
