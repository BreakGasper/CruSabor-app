import type { RouteRecordRaw } from "vue-router";
import AboutView from "./views/About.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/about",
    name: "About",
    component: AboutView,
  },
];
export default routes;
