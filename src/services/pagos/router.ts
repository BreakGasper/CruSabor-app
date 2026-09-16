/**
 * Endpoints del pago automático de membresías con Mercado Pago (Checkout Pro).
 *
 *   POST /pagos/membresia/crear     { tiendaId, plan }  → { url, intentoId, monto, plan }
 *   POST /pagos/membresia/webhook   notificaciones de Mercado Pago (evento "payment")
 *   GET  /pagos/membresia/estado    → { activo, motivo } para saber si el pago en línea está listo
 *
 * Variables en .env:
 *   MP_ACCESS_TOKEN     Access Token de la cuenta de Mercado Pago (TEST-... o APP_USR-...)
 *   MP_WEBHOOK_SECRET   clave secreta del webhook (Mercado Pago › Tus integraciones › Webhooks)
 *   API_PUBLIC_URL      URL pública https de este servidor (para que Mercado Pago pueda avisar)
 *   FRONTEND_URL        URL de la app (a dónde regresa la tienda después de pagar)
 */
import { Router } from 'express';
import type { Almacen } from './almacen.ts';
import { crearAlmacen } from './almacen.ts';
import { crearPreferencia, obtenerPago } from './mercadoPagoApi.ts';
import {
  PLAN_LABEL,
  esPlan,
  precioPlan,
  crearExternalReference,
  parseExternalReference,
  validarFirmaMercadoPago,
  cambiosParaPagoAprobado,
} from './logicaPago.ts';

export interface OpcionesRouter {
  almacen?: () => Promise<Almacen>;
  env?: NodeJS.ProcessEnv;
  ahora?: () => Date;
  mp?: { crearPreferencia: typeof crearPreferencia; obtenerPago: typeof obtenerPago };
  log?: (...a: any[]) => void;
}

export function crearRouterPagos(op: OpcionesRouter = {}) {
  const env = op.env ?? process.env;
  const almacen = op.almacen ?? crearAlmacen;
  const ahora = op.ahora ?? (() => new Date());
  const mp = op.mp ?? { crearPreferencia, obtenerPago };
  const log = op.log ?? console.log;
  const router = Router();

  const token = () => env.MP_ACCESS_TOKEN || '';
  const secreto = () => env.MP_WEBHOOK_SECRET || '';
  const apiPublica = () => (env.API_PUBLIC_URL || '').replace(/\/$/, '');
  const frontend = () => (env.FRONTEND_URL || '').replace(/\/$/, '');

  router.get('/membresia/estado', (_req, res) => {
    const faltan: string[] = [];
    if (!token()) faltan.push('MP_ACCESS_TOKEN');
    if (!secreto()) faltan.push('MP_WEBHOOK_SECRET');
    if (!apiPublica()) faltan.push('API_PUBLIC_URL');
    res.json({ activo: faltan.length === 0, faltan });
  });

  router.post('/membresia/crear', async (req, res) => {
    try {
      const { tiendaId, plan } = req.body || {};
      if (!tiendaId || typeof tiendaId !== 'string' || !/^[\w-]+$/.test(tiendaId)) {
        res.status(400).json({ error: 'tiendaId inválido' });
        return;
      }
      if (!esPlan(plan)) {
        res.status(400).json({ error: 'plan inválido' });
        return;
      }
      if (!token() || !apiPublica()) {
        res.status(503).json({ error: 'Pagos en línea no configurados en el servidor (MP_ACCESS_TOKEN / API_PUBLIC_URL)' });
        return;
      }

      const a = await almacen();
      const [tienda, config] = await Promise.all([a.leer(`tiendas/${tiendaId}`), a.leer('configuracion')]);
      if (!tienda) {
        res.status(404).json({ error: 'La tienda no existe' });
        return;
      }
      if (config?.pagos?.modo !== 'automatico') {
        res.status(403).json({ error: 'El pago automático está desactivado en la configuración' });
        return;
      }
      const monto = precioPlan(config, plan);
      if (!monto) {
        res.status(409).json({ error: `No hay precio configurado para el plan ${plan}` });
        return;
      }

      const intentoId = a.nuevoId('pagosMercadoPago');
      const externalReference = crearExternalReference({ tiendaId, plan, intentoId });
      const origen = typeof req.body?.origen === 'string' && /^https?:\/\//.test(req.body.origen) ? req.body.origen.replace(/\/$/, '') : '';
      const app = origen || frontend() || req.get('origin') || '';
      const volver = `${app}/store/profile/${tiendaId}`;

      const pref = await mp.crearPreferencia(token(), {
        titulo: `Membresía MAVI ${PLAN_LABEL[plan]} · ${tienda.nombreTienda || tiendaId}`,
        descripcion: `Membresía ${PLAN_LABEL[plan].toLowerCase()} para vender en MAVI`,
        monto,
        externalReference,
        notificationUrl: `${apiPublica()}/pagos/membresia/webhook`,
        backUrls: {
          success: `${volver}?pago=exito`,
          pending: `${volver}?pago=pendiente`,
          failure: `${volver}?pago=error`,
        },
        // No se fija el correo del pagador: quien paga es la tienda con SU cuenta de
        // Mercado Pago (o un comprador de prueba). Fijar aquí el email de la tienda
        // anclaba el checkout al modo "Sin cuenta" y rechazaba las tarjetas de prueba.
        idempotencyKey: intentoId,
      });

      await a.actualizar({
        [`pagosMercadoPago/${intentoId}`]: {
          tiendaId,
          nombreTienda: tienda.nombreTienda || '',
          plan,
          monto,
          estado: 'pendiente',
          preferenceId: pref.id,
          externalReference,
          creadoEn: ahora().toISOString(),
        },
      });

      res.json({ intentoId, url: pref.url, sandboxUrl: pref.sandboxUrl, monto, plan });
    } catch (e: any) {
      log('crear pago falló:', e?.message || e);
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  router.post('/membresia/webhook', async (req, res) => {
    try {
      const q = req.query as Record<string, any>;
      const tipo = q.type || req.body?.type || q.topic;
      const dataId = q['data.id'] || req.body?.data?.id || q.id;
      if (tipo !== 'payment' || !dataId) {
        res.status(200).json({ ignorado: true, tipo });
        return;
      }

      const firmaOk = validarFirmaMercadoPago({
        xSignature: req.get('x-signature'),
        xRequestId: req.get('x-request-id'),
        dataId,
        secreto: secreto(),
        ahoraMs: ahora().getTime(),
      });
      if (!firmaOk) {
        log('Webhook de Mercado Pago con firma inválida', { dataId });
        res.status(401).json({ error: 'Firma inválida' });
        return;
      }

      let pago: any;
      try {
        pago = await mp.obtenerPago(token(), dataId);
      } catch (e: any) {
        if (e?.status === 404) {
          // El pago no existe en la cuenta (p. ej. la prueba del simulador de Mercado Pago): nada que reintentar
          log('Webhook: pago no encontrado en Mercado Pago, se ignora', { dataId });
          res.status(200).json({ ignorado: true, motivo: 'pago no encontrado' });
          return;
        }
        throw e;
      }
      const ref = parseExternalReference(pago.external_reference || pago.metadata?.external_reference);
      if (!ref) {
        res.status(200).json({ ignorado: true });
        return;
      }

      const a = await almacen();
      const [intento, tienda, config] = await Promise.all([
        a.leer(`pagosMercadoPago/${ref.intentoId}`),
        a.leer(`tiendas/${ref.tiendaId}`),
        a.leer('configuracion'),
      ]);
      if (!intento || !tienda) {
        res.status(200).json({ ignorado: true });
        return;
      }
      if (intento.estado === 'aprobado') {
        res.status(200).json({ repetido: true });
        return;
      }

      if (pago.status !== 'approved') {
        await a.actualizar({
          [`pagosMercadoPago/${ref.intentoId}/estado`]: pago.status,
          [`pagosMercadoPago/${ref.intentoId}/mpPaymentId`]: String(pago.id),
          [`pagosMercadoPago/${ref.intentoId}/actualizadoEn`]: ahora().toISOString(),
        });
        res.status(200).json({ estado: pago.status });
        return;
      }
      if (Number(pago.transaction_amount) + 0.01 < Number(intento.monto)) {
        await a.actualizar({
          [`pagosMercadoPago/${ref.intentoId}/estado`]: 'monto-insuficiente',
          [`pagosMercadoPago/${ref.intentoId}/mpPaymentId`]: String(pago.id),
        });
        res.status(200).json({ estado: 'monto-insuficiente' });
        return;
      }

      const { cambios, pago: registrado } = cambiosParaPagoAprobado({
        tiendaId: ref.tiendaId,
        tienda,
        intento: { id: ref.intentoId, plan: ref.plan, monto: Number(intento.monto) || 0 },
        mpPago: pago,
        config,
        ahora: ahora(),
        pagoId: a.nuevoId(`tiendas/${ref.tiendaId}/pagosMembresia`),
        historialId: a.nuevoId(`tiendas/${ref.tiendaId}/historialEstatus`),
      });
      await a.actualizar(cambios);
      log('Pago de membresía aprobado', { tiendaId: ref.tiendaId, plan: ref.plan, vigenteHasta: registrado.vigenteHasta });
      res.status(200).json({ ok: true, vigenteHasta: registrado.vigenteHasta });
    } catch (e: any) {
      log('webhook falló:', e?.message || e);
      // 500 para que Mercado Pago reintente
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  return router;
}
