import CategoriasList from "./components/CategoriasList.vue";
import FavoritosList from "./components/FavoritosList.vue";
import HomeView from "./views/Home.vue";
import CartView from '@/modules/home/components/CartView.vue'; 
import PerfilUsuario from "./components/PerfilUsuario.vue";
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
    component: FavoritosList, // aquí registras tu FavoritosList
  },{
    path: '/categoria',
    name: 'Categoria',
    component: CategoriasList, // aquí registras tu CategoriasList
  }
  ,{
    path: '/perfil',
    name: 'Perfil',
    component: PerfilUsuario, // aquí registras tu PerfilUsuario
  },
];
