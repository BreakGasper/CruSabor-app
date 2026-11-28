// Rutas de las tiendas de servicios (catálogo, cotizaciones). Se cargan bajo demanda.
export default [
  { path: '/servicio/:tiendaId/:servicioId', name: 'servicioDetalle', component: () => import('./views/ServicioDetalle.vue') },
  { path: '/cotizar/:tiendaId/:servicioId', name: 'solicitarCotizacion', component: () => import('./views/SolicitarCotizacion.vue') },
  { path: '/mis-cotizaciones', name: 'misCotizaciones', component: () => import('./views/MisCotizaciones.vue') },
  { path: '/store/servicios/:id', name: 'storeServicios', component: () => import('./views/MisServicios.vue') },
  { path: '/store/cotizaciones/:id', name: 'storeCotizaciones', component: () => import('./views/CotizacionesTienda.vue') },
];
