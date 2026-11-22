// CG-Rat Promo Studio: se carga bajo demanda (incluye Fabric.js) para no engordar el resto de la app
export default [
  {
    path: '/studio',
    name: 'studio',
    component: () => import('./views/EstudioView.vue'),
  },
];
