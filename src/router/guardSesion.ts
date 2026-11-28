import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { sessionUser } from '@/utils/sessionUser';
import { leerSesionTienda } from '@/composables/cuentaTienda';

/**
 * La sesión dura hasta que se pulsa «Cerrar sesión». Si alguien con sesión abierta llega a una pantalla
 * de acceso (por ejemplo al deslizar hacia atrás), se le devuelve a su inicio en lugar de pedirle otra vez la contraseña.
 */
export function guardSesion(to: Pick<RouteLocationNormalized, 'path' | 'query'>): true | RouteLocationRaw {
  if (to.path === '/store/login' && leerSesionTienda()) return { path: '/store/profile', replace: true };
  if (to.path === '/login') {
    if (leerSesionTienda()) return { path: '/store/profile', replace: true };
    if (sessionUser.value?.id) {
      const r = to.query?.redirect;
      return { path: typeof r === 'string' && /^\/(?!\/)/.test(r) ? r : '/', replace: true };
    }
  }
  return true;
}
