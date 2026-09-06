/**
 * Acceso del servidor a Realtime Database.
 *
 *  - Con credenciales de servicio (recomendado): firebase-admin, que ignora las reglas
 *    de seguridad. Configura UNA de estas variables en .env:
 *      FIREBASE_SERVICE_ACCOUNT_JSON  contenido del JSON de la cuenta de servicio (una línea)
 *      GOOGLE_APPLICATION_CREDENTIALS ruta al archivo JSON descargado de Firebase
 *    (Consola de Firebase › Configuración del proyecto › Cuentas de servicio › Generar nueva clave privada)
 *
 *  - Sin credenciales: API REST de la base con VITE_FIREBASE_DATABASE_URL (y FIREBASE_AUTH_TOKEN
 *    si tus reglas lo exigen). Funciona mientras las reglas permitan escribir, pero avisa en consola.
 */
export interface Almacen {
  leer: (ruta: string) => Promise<any>;
  actualizar: (cambios: Record<string, any>) => Promise<void>;
  nuevoId: (ruta: string) => string;
}

let cache: Almacen | null = null;

export async function crearAlmacen(): Promise<Almacen> {
  if (cache) return cache;
  const databaseURL = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
  if (!databaseURL) throw new Error('Falta VITE_FIREBASE_DATABASE_URL en .env');

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const ruta = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (json || ruta) {
    const admin = await import('firebase-admin/app');
    const { getDatabase } = await import('firebase-admin/database');
    if (!admin.getApps().length) {
      const credential = json ? admin.cert(JSON.parse(json)) : admin.applicationDefault();
      admin.initializeApp({ credential, databaseURL });
    }
    const db = getDatabase();
    cache = {
      leer: async (r) => (await db.ref(r).once('value')).val(),
      actualizar: (c) => db.ref().update(c),
      nuevoId: (r) => db.ref(r).push().key as string,
    };
    console.log('Pagos: Realtime Database con cuenta de servicio (firebase-admin)');
    return cache;
  }

  console.warn('Pagos: sin cuenta de servicio; se usa la API REST de la base. Configura FIREBASE_SERVICE_ACCOUNT_JSON para producción.');
  const AUTH = process.env.FIREBASE_AUTH_TOKEN ? `?auth=${process.env.FIREBASE_AUTH_TOKEN}` : '';
  let contador = 0;
  cache = {
    async leer(r) {
      const res = await fetch(`${databaseURL}/${r}.json${AUTH}`);
      if (!res.ok) throw new Error(`GET ${r}: ${res.status} ${await res.text()}`);
      return await res.json();
    },
    async actualizar(c) {
      const res = await fetch(`${databaseURL}/.json${AUTH}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error(`PATCH: ${res.status} ${await res.text()}`);
    },
    nuevoId: () => `-${Date.now().toString(36)}${(++contador).toString(36).padStart(3, '0')}${Math.random().toString(36).slice(2, 8)}`,
  };
  return cache;
}

/** Solo para pruebas */
export function __setAlmacen(a: Almacen | null) {
  cache = a;
}
