// Rutas de las tiendas de servicios (catálogo, cotizaciones). Se cargan bajo demanda.
export default [
  { path: '/servicio/:tiendaId/:servicioId', name: 'servicioDetalle', component: () => import('./views/ServicioDetalle.vue') },
  { path: '/cotizar/:tiendaId/:servicioId', name: 'solicitarCotizacion', component: () => import('./views/SolicitarCotizacion.vue') },
  { path: '/mis-cotizaciones', name: 'misCotizaciones', component: () => import('./views/MisCotizaciones.vue') },
  { path: '/servicios', name: 'serviciosDirectorio', component: () => import('./views/ServiciosDirectorio.vue') },
  { path: '/reservar/:tiendaId/:servicioId', name: 'reservarCita', component: () => import('./views/ReservarCita.vue') },
  { path: '/mis-citas', name: 'misCitas', component: () => import('./views/MisCitas.vue') },
  { path: '/store/panel/:id', name: 'storePanelServicios', component: () => import('./views/PanelServicios.vue') },
  { path: '/store/citas/:id', name: 'storeCitas', component: () => import('./views/CitasTienda.vue') },
  { path: '/store/horarios/:id', name: 'storeHorarios', component: () => import('./views/HorariosDisponibilidad.vue') },
  { path: '/store/clientes/:id', name: 'storeClientes', component: () => import('./views/ClientesServicio.vue') },
  { path: '/store/servicios/:id', name: 'storeServicios', component: () => import('./views/MisServicios.vue') },
  { path: '/store/cotizaciones/:id', name: 'storeCotizaciones', component: () => import('./views/CotizacionesTienda.vue') },
];
