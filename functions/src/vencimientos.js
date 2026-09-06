/**
 * Revisión de membresías de tiendas. Lógica pura, sin Firebase, para poder
 * probarla y reutilizarla desde la función programada y desde scripts/.
 *
 * Refleja la misma regla que src/composables/useMembresia.ts en la app:
 *   - `estatus` ausente = activa (tienda anterior a la regla).
 *   - Una tienda activa con `membresia.vigenteHasta` pasado sigue vendiendo
 *     durante `diasGracia`; después debe quedar bloqueada.
 *
 * Qué hace la revisión diaria:
 *   1. Bloquea (estatus 'bloqueada' + motivo + historial) a las tiendas activas
 *      cuya vigencia + días de gracia ya pasó.
 *   2. Genera recordatorios a 7, 3 y 1 día antes del vencimiento, el día que vence
 *      y una vez al entrar en periodo de gracia.
 *   Cada aviso se marca en `tiendas/{id}/membresia/avisos/{clave} = vigenteHasta`
 *   para no repetirlo; al renovar cambia la vigencia y los avisos vuelven a aplicar.
 */

export const ZONA_HORARIA = 'America/Mexico_City';
/** Días antes del vencimiento en que se avisa (0 = vence hoy) */
export const RECORDATORIOS = [7, 3, 1, 0];

/** Fecha YYYY-MM-DD de un instante en una zona horaria */
export function ymdEnZona(fecha = new Date(), timeZone = ZONA_HORARIA) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

const esYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Días de calendario de `desde` a `hasta` (positivo si `hasta` es después) */
export function diasEntre(desde, hasta) {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Fecha con formato largo en español, p. ej. "6 de septiembre de 2026" */
export function fechaLarga(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/**
 * Estado efectivo de una tienda para una fecha, igual que en la app.
 * @returns {'pendiente'|'activa'|'bloqueada'|'vencida'}
 */
export function estadoTienda(tienda, hoy, diasGracia = 0) {
  const estatus = tienda?.estatus ?? 'activa';
  if (estatus !== 'activa') return estatus;
  const hasta = tienda?.membresia?.vigenteHasta;
  if (!esYMD(hasta)) return 'activa';
  return diasEntre(hoy, hasta) + Math.max(0, diasGracia) < 0 ? 'vencida' : 'activa';
}

/**
 * Decide qué hay que hacer hoy con cada tienda.
 * @param {Record<string, any>} tiendas  mapa id -> tienda
 * @param {{ hoy: string, diasGracia?: number }} opciones
 * @returns {{ bloqueos: Array, recordatorios: Array, revisadas: number }}
 */
export function planificarRevision(tiendas, { hoy, diasGracia = 0 }) {
  const bloqueos = [];
  const recordatorios = [];
  let revisadas = 0;
  const gracia = Math.max(0, Math.trunc(Number(diasGracia) || 0));

  for (const [tiendaId, tienda] of Object.entries(tiendas || {})) {
    if (!tienda || typeof tienda !== 'object') continue;
    if ((tienda.estatus ?? 'activa') !== 'activa') continue;
    const hasta = tienda.membresia?.vigenteHasta;
    if (!esYMD(hasta)) continue;
    revisadas++;

    const dias = diasEntre(hoy, hasta); // >0 faltan, 0 vence hoy, <0 ya venció
    const avisos = tienda.membresia?.avisos || {};
    const base = { tiendaId, tienda, vigenteHasta: hasta, dias };

    if (dias + gracia < 0) {
      bloqueos.push({ ...base, diasVencida: -dias });
      continue;
    }
    if (dias < 0) {
      // En periodo de gracia: un solo aviso por vigencia
      if (avisos.gracia !== hasta) {
        recordatorios.push({ ...base, clave: 'gracia', diasRestantesGracia: gracia + dias });
      }
      continue;
    }
    if (RECORDATORIOS.includes(dias)) {
      const clave = `recordatorio-${dias}`;
      if (avisos[clave] !== hasta) recordatorios.push({ ...base, clave });
    }
  }

  // Los que vencen antes primero
  recordatorios.sort((a, b) => a.dias - b.dias || a.tiendaId.localeCompare(b.tiendaId));
  bloqueos.sort((a, b) => b.diasVencida - a.diasVencida || a.tiendaId.localeCompare(b.tiendaId));
  return { bloqueos, recordatorios, revisadas };
}

/** Escrituras multi-ruta para bloquear una tienda por vencimiento */
export function cambiosParaBloqueo(b, { ahoraISO, historialId, diasGracia = 0 }) {
  const id = b.tiendaId;
  const motivo =
    diasGracia > 0
      ? `Membresía vencida el ${fechaLarga(b.vigenteHasta)}; el periodo de gracia de ${diasGracia} día${diasGracia === 1 ? '' : 's'} terminó.`
      : `Membresía vencida el ${fechaLarga(b.vigenteHasta)}.`;
  return {
    [`tiendas/${id}/estatus`]: 'bloqueada',
    [`tiendas/${id}/motivoBloqueo`]: motivo,
    [`tiendas/${id}/membresia/avisos/bloqueada`]: b.vigenteHasta,
    [`tiendas/${id}/historialEstatus/${historialId}`]: {
      fecha: ahoraISO,
      de: 'vencida',
      a: 'bloqueada',
      por: 'sistema',
      motivo,
    },
  };
}

/** Escrituras para marcar un recordatorio como enviado */
export function cambiosParaRecordatorio(r) {
  return { [`tiendas/${r.tiendaId}/membresia/avisos/${r.clave}`]: r.vigenteHasta };
}

/**
 * Texto del aviso para la dueña o dueño (correo). `contacto` es el texto de soporte
 * configurado por el administrador, si existe.
 */
export function mensajeAviso(item, { tipo, contacto = '', diasGracia = 0 }) {
  const nombre = item.tienda?.nombreTienda || 'tu tienda';
  const fecha = fechaLarga(item.vigenteHasta);
  const pie = contacto ? `\n\nSi ya pagaste o tienes dudas, contáctanos: ${contacto}.` : '';
  let asunto;
  let cuerpo;

  if (tipo === 'bloqueo') {
    asunto = `MAVI · ${nombre} quedó bloqueada por membresía vencida`;
    cuerpo = `Hola,\n\nLa membresía de ${nombre} venció el ${fecha}${diasGracia > 0 ? ` y el periodo de gracia de ${diasGracia} día${diasGracia === 1 ? '' : 's'} terminó` : ''}. Tu tienda dejó de mostrarse a los clientes y no puede recibir pedidos.\n\nPara reactivarla, realiza el pago de tu membresía y el administrador la habilitará de nuevo.${pie}`;
  } else if (item.clave === 'gracia') {
    const restan = item.diasRestantesGracia;
    asunto = `MAVI · La membresía de ${nombre} venció`;
    cuerpo = `Hola,\n\nLa membresía de ${nombre} venció el ${fecha}. Sigues vendiendo ${restan} día${restan === 1 ? '' : 's'} más por periodo de gracia; después tu tienda quedará bloqueada.\n\nRenueva tu membresía cuanto antes para no perder visibilidad.${pie}`;
  } else if (item.dias === 0) {
    asunto = `MAVI · La membresía de ${nombre} vence hoy`;
    cuerpo = `Hola,\n\nLa membresía de ${nombre} vence hoy, ${fecha}.${diasGracia > 0 ? ` Tendrás ${diasGracia} día${diasGracia === 1 ? '' : 's'} de gracia, pero te recomendamos renovar hoy mismo.` : ' A partir de mañana tu tienda dejará de mostrarse a los clientes.'}${pie}`;
  } else {
    asunto = `MAVI · La membresía de ${nombre} vence en ${item.dias} día${item.dias === 1 ? '' : 's'}`;
    cuerpo = `Hola,\n\nLa membresía de ${nombre} vence el ${fecha} (en ${item.dias} día${item.dias === 1 ? '' : 's'}). Renueva a tiempo para que tu tienda siga visible y pueda recibir pedidos.${pie}`;
  }

  const html = cuerpo
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 12px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.5">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return { asunto, texto: cuerpo, html };
}

/**
 * Ejecuta la revisión completa contra un "almacén" mínimo, para que sirva igual con
 * firebase-admin (función programada), con la API REST (script) o en memoria (pruebas).
 *
 * @param {{
 *   leer: (ruta: string) => Promise<any>,
 *   actualizar: (cambios: Record<string, any>) => Promise<void>,
 *   nuevoId: (ruta: string) => string,
 * }} almacen
 * @param {{
 *   ahora?: Date,
 *   aplicar?: boolean,               // false = solo simula
 *   enviarCorreo?: (correo: { para: string, asunto: string, texto: string, html: string }) => Promise<void>,
 *   log?: (msg: string) => void,
 * }} opciones
 */
export async function ejecutarRevision(almacen, opciones = {}) {
  const ahora = opciones.ahora ?? new Date();
  const aplicar = opciones.aplicar !== false;
  const log = opciones.log ?? (() => {});
  const hoy = ymdEnZona(ahora);

  const [tiendas, config] = await Promise.all([almacen.leer('tiendas'), almacen.leer('configuracion')]);
  const diasGracia = Math.max(0, Math.trunc(Number(config?.membresia?.diasGracia) || 0));
  const soporte = config?.soporte || {};
  const contacto = [
    soporte.whatsapp && String(soporte.whatsapp).length === 10 ? `WhatsApp ${soporte.whatsapp}` : '',
    soporte.email || '',
  ].filter(Boolean).join(' · ');

  const plan = planificarRevision(tiendas || {}, { hoy, diasGracia });
  const ahoraISO = ahora.toISOString();
  const cambios = {};
  const correos = [];
  const detalle = [];

  for (const b of plan.bloqueos) {
    Object.assign(cambios, cambiosParaBloqueo(b, { ahoraISO, historialId: almacen.nuevoId(`tiendas/${b.tiendaId}/historialEstatus`), diasGracia }));
    detalle.push({ tiendaId: b.tiendaId, nombre: b.tienda.nombreTienda || '', accion: 'bloqueo', vigenteHasta: b.vigenteHasta });
    if (b.tienda.email) correos.push({ para: b.tienda.email, ...mensajeAviso(b, { tipo: 'bloqueo', contacto, diasGracia }) });
    log(`BLOQUEA   ${b.tiendaId}  "${b.tienda.nombreTienda}"  venció ${b.vigenteHasta} (hace ${b.diasVencida} días)`);
  }
  for (const r of plan.recordatorios) {
    Object.assign(cambios, cambiosParaRecordatorio(r));
    detalle.push({ tiendaId: r.tiendaId, nombre: r.tienda.nombreTienda || '', accion: r.clave, vigenteHasta: r.vigenteHasta });
    if (r.tienda.email) correos.push({ para: r.tienda.email, ...mensajeAviso(r, { tipo: 'recordatorio', contacto, diasGracia }) });
    log(`RECUERDA  ${r.tiendaId}  "${r.tienda.nombreTienda}"  ${r.clave}  vence ${r.vigenteHasta}`);
  }

  const resumen = {
    fecha: ahoraISO,
    hoy,
    diasGracia,
    revisadas: plan.revisadas,
    bloqueadas: plan.bloqueos.length,
    recordatorios: plan.recordatorios.length,
    correosEnviados: 0,
    correosFallidos: 0,
    simulacion: !aplicar,
  };

  if (aplicar) {
    if (opciones.enviarCorreo) {
      for (const c of correos) {
        try {
          await opciones.enviarCorreo(c);
          resumen.correosEnviados++;
        } catch (e) {
          resumen.correosFallidos++;
          log(`Correo a ${c.para} falló: ${e?.message || e}`);
        }
      }
    }
    cambios['configuracion/ultimaRevisionMembresias'] = resumen;
    if (detalle.length) {
      cambios[`avisosMembresia/${almacen.nuevoId('avisosMembresia')}`] = { fecha: ahoraISO, hoy, acciones: detalle };
    }
    await almacen.actualizar(cambios);
  }

  return { resumen, detalle, correos, cambios };
}
