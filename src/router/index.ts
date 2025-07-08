import { createRouter, createWebHistory } from "vue-router";

import homeRoutes from "../modules/home";
import aboutRoutes from "../modules/about";

const routes = [...homeRoutes, ...aboutRoutes];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
