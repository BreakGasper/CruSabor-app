import { createRouter, createWebHistory } from "vue-router";
import storeRoutes from '@/modules/store/storeRoutes'
import adminRoutes, { guardAdmin } from '@/modules/admin/adminRoutes'
import homeRoutes from "../modules/home";
import aboutRoutes from "../modules/about";
import studioRoutes from '@/modules/studio/studioRoutes'
import serviciosRoutes from '@/modules/servicios/serviciosRoutes'
import { guardSesion } from './guardSesion'

const routes = [...homeRoutes, ...aboutRoutes, ...storeRoutes, ...studioRoutes, ...serviciosRoutes, ...adminRoutes];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// El panel de administración exige sesión de administrador
router.beforeEach((to) => {
  const destino = guardAdmin(to);
  return destino === true ? true : destino;
});

router.beforeEach(guardSesion);

export default router;
