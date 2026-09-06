/**
 * Revisión diaria de membresías (functions/src/vencimientos.js): bloqueo al terminar la
 * gracia, recordatorios sin repetir, textos de aviso y ejecución completa contra un
 * almacén en memoria.
 */
import { describe, it, expect } from 'vitest';
import {
  ymdEnZona,
  diasEntre,
  estadoTienda,
  planificarRevision,
  cambiosParaBloqueo,
  mensajeAviso,
  ejecutarRevision,
} from '../functions/src/vencimientos.js';

const HOY = '2026-09-06';
const base = { nombreTienda: 'T', estatus: 'activa', email: 'duena@tienda.mx' };
const conVigencia = (vigenteHasta: string, extra: any = {}) => ({ ...base, membresia: { vigenteHasta, ...extra } });

describe('fechas', () => {
  it('ymdEnZona respeta la zona horaria de México', () => {
    // 05:30 UTC del 7 de sep = 23:30 del 6 de sep en Ciudad de México
    expect(ymdEnZona(new Date('2026-09-07T05:30:00Z'))).toBe('2026-09-06');
    expect(ymdEnZona(new Date('2026-09-07T06:30:00Z'))).toBe('2026-09-07');
  });

  it('diasEntre cuenta días de calendario con signo', () => {
    expect(diasEntre('2026-09-06', '2026-09-13')).toBe(7);
    expect(diasEntre('2026-09-06', '2026-09-06')).toBe(0);
    expect(diasEntre('2026-09-06', '2026-09-01')).toBe(-5);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('estadoTienda coincide con la regla de la app', () => {
    expect(estadoTienda({}, HOY)).toBe('activa');
    expect(estadoTienda({ estatus: 'pendiente' }, HOY)).toBe('pendiente');
    expect(estadoTienda(conVigencia('2026-09-06'), HOY)).toBe('activa');
    expect(estadoTienda(conVigencia('2026-09-05'), HOY)).toBe('vencida');
    expect(estadoTienda(conVigencia('2026-09-03'), HOY, 3)).toBe('activa');
    expect(estadoTienda(conVigencia('2026-09-02'), HOY, 3)).toBe('vencida');
  });
});

describe('planificarRevision', () => {
  it('bloquea solo a las activas cuya vigencia más gracia ya pasó', () => {
    const plan = planificarRevision(
      {
        vencidaAyer: conVigencia('2026-09-05'),
        vencidaHace10: conVigencia('2026-08-27'),
        vigente: conVigencia('2026-12-31'),
        sinMembresia: { ...base },
        pendienteVencida: { ...conVigencia('2026-01-01'), estatus: 'pendiente' },
        yaBloqueada: { ...conVigencia('2026-01-01'), estatus: 'bloqueada' },
      },
      { hoy: HOY, diasGracia: 0 },
    );
    expect(plan.bloqueos.map((b) => b.tiendaId)).toEqual(['vencidaHace10', 'vencidaAyer']);
    expect(plan.bloqueos[0].diasVencida).toBe(10);
    expect(plan.revisadas).toBe(3);
  });

  it('con días de gracia no bloquea todavía y avisa una sola vez del periodo de gracia', () => {
    const t = conVigencia('2026-09-04'); // venció hace 2 días
    let plan = planificarRevision({ t }, { hoy: HOY, diasGracia: 5 });
    expect(plan.bloqueos).toHaveLength(0);
    expect(plan.recordatorios).toMatchObject([{ tiendaId: 't', clave: 'gracia', diasRestantesGracia: 3 }]);

    // ya avisado para esta vigencia
    plan = planificarRevision({ t: conVigencia('2026-09-04', { avisos: { gracia: '2026-09-04' } }) }, { hoy: HOY, diasGracia: 5 });
    expect(plan.recordatorios).toHaveLength(0);

    // se acabó la gracia
    plan = planificarRevision({ t }, { hoy: '2026-09-10', diasGracia: 5 });
    expect(plan.bloqueos).toHaveLength(1);
  });

  it('recuerda a 7, 3, 1 y 0 días, sin repetir mientras no cambie la vigencia', () => {
    const tiendas = {
      d7: conVigencia('2026-09-13'),
      d3: conVigencia('2026-09-09'),
      d1: conVigencia('2026-09-07'),
      d0: conVigencia('2026-09-06'),
      d5: conVigencia('2026-09-11'),
      d7avisada: conVigencia('2026-09-13', { avisos: { 'recordatorio-7': '2026-09-13' } }),
      d7renovada: conVigencia('2026-09-13', { avisos: { 'recordatorio-7': '2026-08-13' } }), // aviso de la vigencia anterior
    };
    const plan = planificarRevision(tiendas, { hoy: HOY });
    expect(plan.recordatorios.map((r) => [r.tiendaId, r.clave])).toEqual([
      ['d0', 'recordatorio-0'],
      ['d1', 'recordatorio-1'],
      ['d3', 'recordatorio-3'],
      ['d7', 'recordatorio-7'],
      ['d7renovada', 'recordatorio-7'],
    ]);
    expect(plan.bloqueos).toHaveLength(0);
  });
});

describe('cambios y mensajes', () => {
  it('cambiosParaBloqueo escribe estatus, motivo, marca e historial por el sistema', () => {
    const b = { tiendaId: 'x', tienda: base, vigenteHasta: '2026-09-01', dias: -5, diasVencida: 5 };
    const c = cambiosParaBloqueo(b, { ahoraISO: '2026-09-06T12:00:00.000Z', historialId: 'h1', diasGracia: 3 });
    expect(c['tiendas/x/estatus']).toBe('bloqueada');
    expect(c['tiendas/x/motivoBloqueo']).toMatch(/vencida el 1 de septiembre de 2026.*gracia de 3 días/);
    expect(c['tiendas/x/membresia/avisos/bloqueada']).toBe('2026-09-01');
    expect(c['tiendas/x/historialEstatus/h1']).toMatchObject({ de: 'vencida', a: 'bloqueada', por: 'sistema' });
  });

  it('mensajeAviso adapta asunto y cuerpo a cada caso e incluye el contacto', () => {
    const item = { tiendaId: 'x', tienda: { nombreTienda: 'Panadería Lupita' }, vigenteHasta: '2026-09-13', dias: 7, clave: 'recordatorio-7' };
    const r7 = mensajeAviso(item, { tipo: 'recordatorio', contacto: 'WhatsApp 3312345678' });
    expect(r7.asunto).toBe('MAVI · La membresía de Panadería Lupita vence en 7 días');
    expect(r7.texto).toMatch(/13 de septiembre de 2026/);
    expect(r7.texto).toMatch(/WhatsApp 3312345678/);
    expect(r7.html).toContain('<p');

    const hoy = mensajeAviso({ ...item, dias: 0, clave: 'recordatorio-0', vigenteHasta: HOY }, { tipo: 'recordatorio', diasGracia: 3 });
    expect(hoy.asunto).toMatch(/vence hoy/);
    expect(hoy.texto).toMatch(/3 días de gracia/);

    const gracia = mensajeAviso({ ...item, dias: -2, clave: 'gracia', diasRestantesGracia: 3 }, { tipo: 'recordatorio' });
    expect(gracia.texto).toMatch(/Sigues vendiendo 3 días más/);

    const bloqueo = mensajeAviso({ ...item, dias: -6 }, { tipo: 'bloqueo' });
    expect(bloqueo.asunto).toMatch(/quedó bloqueada/);
    expect(bloqueo.texto).toMatch(/realiza el pago/);
  });
});

describe('ejecutarRevision (almacén en memoria)', () => {
  function almacenEnMemoria(datos: any) {
    const tree: any = JSON.parse(JSON.stringify(datos));
    let n = 0;
    const getAt = (ruta: string) => ruta.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
    const setAt = (ruta: string, v: any) => {
      const p = ruta.split('/').filter(Boolean);
      let o = tree;
      for (const k of p.slice(0, -1)) o = o[k] ??= {};
      o[p[p.length - 1]] = v;
    };
    return {
      tree,
      leer: async (ruta: string) => getAt(ruta) ?? null,
      actualizar: async (cambios: Record<string, any>) => Object.entries(cambios).forEach(([k, v]) => setAt(k, v)),
      nuevoId: () => `id${++n}`,
    };
  }
  const AHORA = new Date('2026-09-06T12:00:00Z'); // 06:00 en Ciudad de México

  it('en simulación calcula todo pero no escribe ni envía', async () => {
    const a = almacenEnMemoria({ tiendas: { v: conVigencia('2026-09-01'), r: conVigencia('2026-09-13') }, configuracion: {} });
    const enviados: any[] = [];
    const r = await ejecutarRevision(a, { ahora: AHORA, aplicar: false, enviarCorreo: async (c) => { enviados.push(c); } });
    expect(r.resumen).toMatchObject({ hoy: HOY, bloqueadas: 1, recordatorios: 1, simulacion: true, correosEnviados: 0 });
    expect(r.correos).toHaveLength(2);
    expect(enviados).toHaveLength(0);
    expect(a.tree.tiendas.v.estatus).toBe('activa');
  });

  it('aplica bloqueos y marcas, envía correos, registra el resumen y el log de acciones', async () => {
    const a = almacenEnMemoria({
      tiendas: {
        v: conVigencia('2026-09-01'),
        r: conVigencia('2026-09-13'),
        sinCorreo: { ...conVigencia('2026-09-09'), email: '' },
      },
      configuracion: { membresia: { diasGracia: 0 }, soporte: { whatsapp: '3312345678', email: 'soporte@mavi.mx' } },
    });
    const enviados: any[] = [];
    const r = await ejecutarRevision(a, {
      ahora: AHORA,
      enviarCorreo: async (c) => {
        if (c.para === 'duena@tienda.mx' && c.asunto.includes('bloqueada')) throw new Error('SMTP caído');
        enviados.push(c);
      },
    });

    expect(a.tree.tiendas.v).toMatchObject({ estatus: 'bloqueada' });
    expect(a.tree.tiendas.v.motivoBloqueo).toMatch(/vencida/);
    expect(Object.values(a.tree.tiendas.v.historialEstatus)[0]).toMatchObject({ por: 'sistema', a: 'bloqueada' });
    expect(a.tree.tiendas.r.membresia.avisos['recordatorio-7']).toBe('2026-09-13');
    expect(a.tree.tiendas.sinCorreo.membresia.avisos['recordatorio-3']).toBe('2026-09-09');

    expect(r.resumen).toMatchObject({ bloqueadas: 1, recordatorios: 2, correosEnviados: 1, correosFallidos: 1, simulacion: false });
    expect(enviados[0].texto).toMatch(/WhatsApp 3312345678 · soporte@mavi.mx/);
    expect(a.tree.configuracion.ultimaRevisionMembresias).toMatchObject({ hoy: HOY, bloqueadas: 1 });
    const log = Object.values(a.tree.avisosMembresia)[0] as any;
    expect(log.acciones.map((x: any) => x.accion).sort()).toEqual(['bloqueo', 'recordatorio-3', 'recordatorio-7']);
  });

  it('al día siguiente no repite recordatorios ni vuelve a bloquear', async () => {
    const a = almacenEnMemoria({ tiendas: { v: conVigencia('2026-09-01'), r: conVigencia('2026-09-13') }, configuracion: {} });
    await ejecutarRevision(a, { ahora: AHORA });
    const r2 = await ejecutarRevision(a, { ahora: new Date('2026-09-07T12:00:00Z') });
    expect(r2.resumen).toMatchObject({ bloqueadas: 0, recordatorios: 0 });
    expect(Object.keys(a.tree.tiendas.v.historialEstatus)).toHaveLength(1);
  });

  it('usa los días de gracia configurados', async () => {
    const a = almacenEnMemoria({ tiendas: { v: conVigencia('2026-09-03') }, configuracion: { membresia: { diasGracia: 5 } } });
    const r = await ejecutarRevision(a, { ahora: AHORA });
    expect(r.resumen).toMatchObject({ diasGracia: 5, bloqueadas: 0, recordatorios: 1 });
    expect(a.tree.tiendas.v.estatus).toBe('activa');
    expect(a.tree.tiendas.v.membresia.avisos.gracia).toBe('2026-09-03');
  });
});
