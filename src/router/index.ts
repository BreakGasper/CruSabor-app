import { createRouter, createWebHistory } from "vue-router";
import storeRoutes from '@/modules/store/storeRoutes'
import adminRoutes, { guardAdmin } from '@/modules/admin/adminRoutes'
import homeRoutes from "../modules/home";
import aboutRoutes from "../modules/about";

const routes = [...homeRoutes, ...aboutRoutes, ...storeRoutes, ...adminRoutes];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// El panel de administración exige sesión de administrador
router.beforeEach((to) => {
  const destino = guardAdmin(to);
  return destino === true ? true : destino;
});

export default router;
