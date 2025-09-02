import CategoriasList from "./components/CategoriasList.vue";
import FavoritosList from "./components/FavoritosList.vue";
import HomeView from "./views/Home.vue";
import CartView from '@/modules/home/components/CartView.vue'; // importa tu nueva vista

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
  {
    path: '/cart',
    name: 'Cart',
    component: CartView, // aquí registras tu CartView
  },
  {
    path: '/favoritos',
    name: 'Favoritos',
    component: FavoritosList, // aquí registras tu CartView
  },{
    path: '/categoria',
    name: 'Categoria',
    component: CategoriasList, // aquí registras tu CartView
  },
];
