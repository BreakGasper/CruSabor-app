/**
 * Borrar de Cloudinary la imagen que se reemplazó.
 *
 *   POST /imagenes/eliminar  { urls: string[] }  → { borradas, omitidas }
 *   GET  /imagenes/estado                        → { activo, faltan }
 *
 * Variables en .env (solo en el servidor; NUNCA en el bundle de la app):
 *   CLOUDINARY_CLOUD_NAME   el nombre de la cuenta (el mismo que usa la app)
 *   CLOUDINARY_API_KEY      Cloudinary › Settings › API Keys
 *   CLOUDINARY_API_SECRET   la secreta del mismo par
 *
 * Sin esas variables el endpoint responde `activo: false` y no borra nada: la
 * app sigue funcionando igual, solo se acumulan huérfanas como hasta ahora.
 */
import { Router } from 'express';
import { crearAlmacen, type Almacen } from '../pagos/almacen.ts';
import {
  COLECCIONES_CON_IMAGEN,
  configDesdeEntorno,
  firmaDestroy,
  idsBorrables,
  publicIdsEnUso,
  type ConfigCloudinary,
} from './logica.ts';

export interface OpcionesRouterImagenes {
  env?: NodeJS.ProcessEnv;
  ahora?: () => Date;
  /** Se inyecta en pruebas para no llamar a Cloudinary de verdad */
  destruir?: (id: string, cfg: ConfigCloudinary, ts: number) => Promise<boolean>;
  almacen?: () => Promise<Almacen>;
  log?: (...a: any[]) => void;
}

/** Llama a la API de Cloudinary para borrar una imagen ya subida */
async function destruirEnCloudinary(
  publicId: string,
  cfg: ConfigCloudinary,
  timestamp: number,
): Promise<boolean> {
  const cuerpo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: cfg.apiKey,
    signature: firmaDestroy(publicId, timestamp, cfg.apiSecret),
  });

  const r = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`, {
    method: 'POST',
    body: cuerpo,
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) return false;
  const data = (await r.json()) as { result?: string };
  // "not found" también se da por bueno: el objetivo es que no quede, y no queda
  return data.result === 'ok' || data.result === 'not found';
}

export function crearRouterImagenes(op: OpcionesRouterImagenes = {}) {
  const env = op.env ?? process.env;
  const ahora = op.ahora ?? (() => new Date());
  const destruir = op.destruir ?? destruirEnCloudinary;
  const almacen = op.almacen ?? crearAlmacen;
  const log = op.log ?? console.log;
  const router = Router();

  /**
   * Imágenes que la base sigue usando. Nada de esto se borra.
   *
   * El endpoint no pide autenticación, así que sin esta comprobación cualquiera
   * con la URL del servidor podría borrar las fotos de todas las tiendas. Con
   * ella solo se pueden borrar huérfanas: lo peor que consigue un atacante es
   * limpiar basura. De paso protege contra un error de la propia app.
   *
   * Si la base no se puede leer se aborta el borrado: ante la duda, no se toca.
   */
  async function enUso(): Promise<Set<string>> {
    const a = await almacen();
    const datos: Record<string, unknown> = {};
    for (const coleccion of COLECCIONES_CON_IMAGEN) {
      datos[coleccion] = await a.leer(coleccion);
    }
    return publicIdsEnUso(datos);
  }

  router.get('/estado', (_req, res) => {
    const cfg = configDesdeEntorno(env);
    const faltan = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter(
      (k) => !env[k],
    );
    res.json({ activo: Boolean(cfg), faltan });
  });

  router.post('/eliminar', async (req, res) => {
    const cfg = configDesdeEntorno(env);
    if (!cfg) {
      // Falta configurar: no es un error del que llama, simplemente no se borra
      return res.json({ borradas: 0, omitidas: 0, activo: false });
    }

    const ids = idsBorrables(req.body?.urls);
    if (!ids.length) return res.json({ borradas: 0, omitidas: 0, activo: true });

    // Solo huérfanas: lo que la base siga referenciando no se toca
    let usadas: Set<string>;
    try {
      usadas = await enUso();
    } catch (e) {
      log('Imágenes: no se pudo revisar la base; no se borra nada', e);
      return res.status(503).json({ borradas: 0, omitidas: ids.length, activo: true, motivo: 'base-no-disponible' });
    }
    const huerfanas = ids.filter((id) => !usadas.has(id));
    const enUsoCount = ids.length - huerfanas.length;

    const timestamp = Math.floor(ahora().getTime() / 1000);
    let borradas = 0;
    let omitidas = enUsoCount;
    for (const id of huerfanas) {
      try {
        if (await destruir(id, cfg, timestamp)) borradas++;
        else omitidas++;
      } catch (e) {
        // Una imagen que no se pudo borrar no puede tumbar la petición: lo peor
        // que pasa es que quede huérfana, que es justo como estaba antes.
        omitidas++;
        log('Imágenes: no se pudo borrar', id, e);
      }
    }
    res.json({ borradas, omitidas, enUso: enUsoCount, activo: true });
  });

  return router;
}
