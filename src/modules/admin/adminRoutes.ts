// modules/admin/adminRoutes.ts
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { isAdminLoggedIn } from '@/utils/sessionAdmin';
import AdminLogin from './views/AdminLogin.vue';
import AdminDashboard from './views/AdminDashboard.vue';
import AdminTiendas from './views/AdminTiendas.vue';
import AdminTiendaDetalle from './views/AdminTiendaDetalle.vue';
import AdminConfiguracion from './views/AdminConfiguracion.vue';
import AdminCategorias from './views/AdminCategorias.vue';

export const RUTA_ADMIN_LOGIN = '/admin/login';
export const RUTA_ADMIN_HOME = '/admin';

const adminRoutes: RouteRecordRaw[] = [
  { path: RUTA_ADMIN_LOGIN, component: AdminLogin, name: 'adminLogin' },
  {
    path: RUTA_ADMIN_HOME,
    component: AdminDashboard,
    name: 'adminDashboard',
    meta: { requiereAdmin: true },
  },
  {
    path: '/admin/tiendas',
    component: AdminTiendas,
    name: 'adminTiendas',
    meta: { requiereAdmin: true },
  },
  {
    path: '/admin/tiendas/:id',
    component: AdminTiendaDetalle,
    name: 'adminTiendaDetalle',
    meta: { requiereAdmin: true },
  },
  {
    path: '/admin/configuracion',
    component: AdminConfiguracion,
    name: 'adminConfiguracion',
    meta: { requiereAdmin: true },
  },
  {
    path: '/admin/categorias',
    component: AdminCategorias,
    name: 'adminCategorias',
    meta: { requiereAdmin: true },
  },
];

/**
 * Guard de rutas del panel de administración.
 * - Sin sesión de admin no se entra a rutas con `meta.requiereAdmin`.
 * - Con sesión, el login redirige al tablero.
 * Devuelve la ruta a la que hay que redirigir o `true` para continuar.
 */
export function guardAdmin(to: RouteLocationNormalized): true | string {
  const logueado = isAdminLoggedIn();
  if (to.meta?.requiereAdmin && !logueado) return RUTA_ADMIN_LOGIN;
  if (to.path === RUTA_ADMIN_LOGIN && logueado) return RUTA_ADMIN_HOME;
  return true;
}

export default adminRoutes;
