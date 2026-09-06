/**
 * Funciones de Firebase de MAVI (requieren plan Blaze; mientras no se active, usa
 * scripts/revisar-membresias.mjs para correr la revisión a mano).
 *
 *  - revisarMembresias        programada, todos los días a las 06:00 (hora de Ciudad de México)
 *  - revisarMembresiasManual  HTTPS, para correrla a mano:
 *        GET .../revisarMembresiasManual?token=...&dry=1     (`dry=1` solo simula)
 *
 * Secretos (firebase functions:secrets:set NOMBRE):
 *   SMTP_USER, SMTP_PASS   cuenta Gmail para los avisos (opcionales: sin ellos no se envía correo)
 *   REVISION_TOKEN         llave para el endpoint manual
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { ejecutarRevision, ZONA_HORARIA } from './vencimientos.js';
import { crearEnviador } from './correo.js';

setGlobalOptions({ region: 'us-central1', maxInstances: 2 });

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const REVISION_TOKEN = defineSecret('REVISION_TOKEN');

if (!getApps().length) initializeApp();

/** Adaptador de Realtime Database para ejecutarRevision */
function almacenAdmin() {
  const db = getDatabase();
  return {
    leer: async (ruta) => (await db.ref(ruta).once('value')).val(),
    actualizar: (cambios) => db.ref().update(cambios),
    nuevoId: (ruta) => db.ref(ruta).push().key,
  };
}

async function correr({ aplicar }) {
  const enviarCorreo = crearEnviador({ usuario: SMTP_USER.value(), password: SMTP_PASS.value() });
  if (!enviarCorreo) logger.warn('Sin SMTP_USER/SMTP_PASS: la revisión corre sin enviar correos');
  const r = await ejecutarRevision(almacenAdmin(), { aplicar, enviarCorreo, log: (m) => logger.info(m) });
  logger.info('Revisión de membresías', r.resumen);
  return r;
}

export const revisarMembresias = onSchedule(
  { schedule: 'every day 06:00', timeZone: ZONA_HORARIA, secrets: [SMTP_USER, SMTP_PASS], timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    await correr({ aplicar: true });
  },
);

export const revisarMembresiasManual = onRequest(
  { secrets: [SMTP_USER, SMTP_PASS, REVISION_TOKEN], timeoutSeconds: 300, memory: '256MiB' },
  async (req, res) => {
    const token = req.query.token || req.get('x-revision-token');
    if (!REVISION_TOKEN.value() || token !== REVISION_TOKEN.value()) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    const aplicar = !['1', 'true'].includes(String(req.query.dry || '').toLowerCase());
    try {
      const r = await correr({ aplicar });
      res.json({ resumen: r.resumen, acciones: r.detalle });
    } catch (e) {
      logger.error('Falló la revisión manual', e);
      res.status(500).json({ error: e?.message || String(e) });
    }
  },
);
