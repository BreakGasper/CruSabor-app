import { ref, watch } from 'vue';
import { liveQuery, type Subscription } from 'dexie';
import { ref as dbRef, get, set } from 'firebase/database';
import { db as firebase } from '@/firebase';
import { db, type CarritoItem, type FavoritoItem, type TiendaFavoritaItem } from './index';
import { adoptarCarritoInvitado } from './carritoInvitado';
import { sessionUser } from '@/utils/sessionUser';

/**
 * Sincroniza carrito, favoritos y tiendas favoritas del cliente con Firebase
 * en `usuarios/{id}/sync`, para que no se pierdan al cambiar de dispositivo.
 *
 * Modelo:
 *  - Dexie (IndexedDB) sigue siendo la fuente local: rápida y funciona sin red.
 *  - Al iniciar sesión se BAJA la copia remota (si existe) y reemplaza la local
 *    del usuario; si no existe, se SUBE la local.
 *  - Después, cada cambio local se sube completo (con un pequeño debounce).
 *    Como se sube el estado entero, las eliminaciones también se propagan.
 */

type Remoto = {
  carrito?: Record<string, Omit<CarritoItem, 'id'>>;
  favoritos?: Record<string, FavoritoItem>;
  tiendasFavoritas?: Record<string, Omit<TiendaFavoritaItem, 'id'>>;
  actualizado?: string;
};

/** Firebase no admite . # $ [ ] / en las claves */
const claveSegura = (s: string) => String(s).replace(/[.#$\[\]\/]/g, '_');

const rutaSync = (uid: string) => dbRef(firebase, `usuarios/${uid}/sync`);

/**
 * true mientras se acomoda el carrito al iniciar sesión (bajar la copia remota
 * y adoptar lo del invitado). Las pantallas lo usan para no anunciar "carrito
 * vacío" en ese hueco: todavía no se sabe qué tiene el cliente.
 */
export const sincronizando = ref(false);

let subs: Subscription[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let usuarioActivo: string | null = null;
let pausado = false; // evita subir mientras estamos bajando
let iniciado = false;

async function leerLocal(uid: string) {
  const [carrito, favoritos, tiendas] = await Promise.all([
    db.Carrito.where('id_usuario').equals(uid).toArray(),
    db.Favoritos.where('idUsuario').equals(uid).toArray(),
    db.TiendasFavoritas.where('idUsuario').equals(uid).toArray(),
  ]);
  return { carrito, favoritos, tiendas };
}

function aRemoto(local: Awaited<ReturnType<typeof leerLocal>>): Remoto {
  const carrito: Remoto['carrito'] = {};
  for (const { id, ...c } of local.carrito) carrito[claveSegura(`${c.id_articulo}__${c.sku || 'default'}`)] = c;
  const favoritos: Remoto['favoritos'] = {};
  for (const f of local.favoritos) favoritos[claveSegura(f.articuloId)] = f;
  const tiendasFavoritas: Remoto['tiendasFavoritas'] = {};
  for (const { id, ...t } of local.tiendas) tiendasFavoritas[claveSegura(t.tiendaId)] = t;
  return { carrito, favoritos, tiendasFavoritas, actualizado: new Date().toISOString() };
}

/** Sube el estado local completo del usuario */
export async function subir(uid: string) {
  if (pausado || usuarioActivo !== uid) return;
  const local = await leerLocal(uid);
  await set(rutaSync(uid), aRemoto(local));
}

/** Reemplaza lo local del usuario con la copia remota */
async function reemplazarLocal(uid: string, remoto: Remoto) {
  await db.transaction('rw', db.Carrito, db.Favoritos, db.TiendasFavoritas, async () => {
    await db.Carrito.where('id_usuario').equals(uid).delete();
    await db.Favoritos.where('idUsuario').equals(uid).delete();
    await db.TiendasFavoritas.where('idUsuario').equals(uid).delete();

    const carrito = Object.values(remoto.carrito || {}).map((c) => ({ ...c, id_usuario: uid }));
    if (carrito.length) await db.Carrito.bulkAdd(carrito as CarritoItem[]);

    const favoritos = Object.values(remoto.favoritos || {}).map((f) => ({ ...f, idUsuario: uid }));
    if (favoritos.length) await db.Favoritos.bulkPut(favoritos);

    const tiendas = Object.values(remoto.tiendasFavoritas || {}).map((t) => ({ ...t, idUsuario: uid }));
    if (tiendas.length) await db.TiendasFavoritas.bulkAdd(tiendas as TiendaFavoritaItem[]);
  });
}

/** Al iniciar sesión: baja si hay copia remota, si no sube la local */
export async function bajar(uid: string) {
  pausado = true;
  try {
    const snap = await get(rutaSync(uid));
    if (snap.exists()) {
      await reemplazarLocal(uid, snap.val() as Remoto);
    } else {
      const local = await leerLocal(uid);
      if (local.carrito.length || local.favoritos.length || local.tiendas.length) {
        await set(rutaSync(uid), aRemoto(local));
      }
    }
  } catch (e) {
    console.error('Sync: no se pudo bajar la copia remota', e);
  } finally {
    pausado = false;
  }
}

function programarSubida(uid: string) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    subir(uid).catch((e) => console.error('Sync: no se pudo subir', e));
  }, 400);
}

function observar(uid: string) {
  detener();
  const tablas: Array<() => Promise<unknown[]>> = [
    () => db.Carrito.where('id_usuario').equals(uid).toArray(),
    () => db.Favoritos.where('idUsuario').equals(uid).toArray(),
    () => db.TiendasFavoritas.where('idUsuario').equals(uid).toArray(),
  ];
  let primeras = tablas.length; // liveQuery emite el estado inicial: no lo subimos
  subs = tablas.map((q) =>
    liveQuery(q).subscribe({
      next: () => {
        if (primeras > 0) { primeras--; return; }
        if (!pausado) programarSubida(uid);
      },
      error: (e) => console.error('Sync liveQuery:', e),
    }),
  );
}

export function detener() {
  subs.forEach((s) => s.unsubscribe());
  subs = [];
  if (timer) { clearTimeout(timer); timer = null; }
}

/** Llamar una vez al arrancar la app (App.vue). Reacciona a inicio y cierre de sesión. */
export function iniciarSincronizacion() {
  if (iniciado) return;
  iniciado = true;
  watch(
    () => sessionUser.value?.id as string | undefined,
    async (uid) => {
      detener();
      usuarioActivo = uid ?? null;
      if (!uid) {
        sincronizando.value = false;
        return;
      }
      sincronizando.value = true;
      try {
        await bajar(uid);
        // Después de bajar, nunca antes: `bajar` reemplaza lo local del usuario
        // con la copia remota, así que adoptar primero borraría lo del invitado.
        // Aquí el carrito remoto ya está puesto y lo del invitado se le suma.
        const adoptados = await adoptarCarritoInvitado(uid).catch((e) => {
          console.error('Sync: no se pudo adoptar el carrito del invitado', e);
          return 0;
        });
        if (usuarioActivo !== uid) return;
        observar(uid);
        // `observar` se salta la primera emisión de cada tabla, así que lo adoptado
        // no viajaría solo: se sube a mano para que quede respaldado de inmediato.
        if (adoptados) subir(uid).catch((e) => console.error('Sync: no se pudo subir', e));
      } finally {
        if (usuarioActivo === uid) sincronizando.value = false;
      }
    },
    { immediate: true },
  );
}

/** Solo para pruebas */
export function __resetSync() {
  detener();
  usuarioActivo = null;
  pausado = false;
  iniciado = false;
  sincronizando.value = false;
}
