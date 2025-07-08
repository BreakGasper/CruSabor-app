import HomeView from "./views/Home.vue";

export default [
  {
    path: "/",
    name: "Home",
    component: HomeView,
  },
  {
    path: "/producto/:id",
    name: "ProductoDetalle",
    component: () => import("./views/ProductDetailPage.vue"),
    props: true,
  },
];
