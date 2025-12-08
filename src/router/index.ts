import { createRouter, createWebHistory } from "vue-router";
import storeRoutes from '@/modules/store/storeRoutes'
import homeRoutes from "../modules/home";
import aboutRoutes from "../modules/about";

const routes = [...homeRoutes, ...aboutRoutes,...storeRoutes];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
