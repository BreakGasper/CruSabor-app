import CategoriasList from "./components/CategoriasList.vue";
import FavoritosList from "./components/FavoritosList.vue";
import HomeView from "./views/Home.vue";
import CartView from '@/modules/home/components/CartView.vue'; 
import PerfilUsuario from "./views/PerfilUsuario.vue";
import Login from "@/modules/home/components/Login.vue"
import Register from "@/modules/home/components/Register.vue"; 
import CartCheckout from "@/modules/home/components/CartCheckout.vue";
import PedidoList from "@/modules/home/components/PedidoList.vue";
import PedidoDetalle from "./components/PedidoDetalle.vue";
import { Component } from "lucide-vue-next";
import ArticulosCategorias from "./components/ArticulosCategorias.vue";

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
  {
    path: '/login',
    name: 'Login',
    component: Login, // aquí registras tu Login
  },{
    path: '/register',
    name: 'register',
    component:Register, // aquí registras tu Login
  },{
    path: '/checkout',
    name: 'checkout',
    component: CartCheckout, // aquí registras tu Checkout
  },{
    path: '/pedidos',
    name: 'pedidos',
    component: PedidoList, // aquí registras tu Checkout
  },
  {
    path: "/pedido/:id",
    name: "PedidoDetallePage", 
    component: PedidoDetalle,
    props: true
  }, {
    path: "/categoriaArticulos/:id/:categoriaNombre",
    name: "categoriaArticulos", 
    component: ArticulosCategorias,
    props: true
  }
];
