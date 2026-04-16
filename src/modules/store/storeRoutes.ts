// modules/store/storeRoutes.ts
import StoreLogin from "./views/StoreLogin.vue";
import StoreRegister from "./views/StoreRegister.vue";
import StoreProfile from "./views/StoreProfile.vue";
import ProductManagement from "./views/ProductManagement.vue";
import StoreArticles from "./components/StoreArticles.vue";

export default [
  { path: "/store/login", component: StoreLogin, name: "storeLogin" }, //login para tiendas
  { path: "/store/register", component: StoreRegister, name: "storeRegister" },
  {
  path: "/store/profile/:id?",
  component: StoreProfile,
  name: "storeProfile",
  props: true,
},

  {
    path: "/store/products/:id",//Registrar productos
    component: ProductManagement,
    name: "storeProducts",
  },
   {
    path: "/store/articles/:id", // Nueva ruta para lista de artículos
    component: StoreArticles,
    name: "storeArticles",
  },
];
