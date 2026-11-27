import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
// Importar variables CSS globales
import './assets/styles/ColorsVarCss.css';
import { FontAwesomeIcon } from './plugins/fontawesome'; // <--- aquí
import PrimeVue from "primevue/config";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ToastService from "primevue/toastservice";
import { instalarCarga } from "./services/carga";
import { instalarSinZoom } from "./utils/sinZoom";
import { vienesDeRecarga } from "./utils/actualizacion";
import { mostrarCargaYa, ocultarCargaYa } from "./services/carga";
const app = createApp(App);

app.config.devtools = true;
app.component('FontAwesomeIcon', FontAwesomeIcon);
app.use(PrimeVue);   // 👈 esto es obligatorio
app.component("Dialog", Dialog);
app.component("Button", Button);
app.use(ToastService); 
app.use(router);
app.use(createPinia());

// Indicador de carga con el logo: escucha los toques y rastrea las llamadas al servidor
instalarCarga();
// Sin zoom con el pellizco: la app queda fija a las dimensiones del teléfono
instalarSinZoom();

// Si venimos de "deslizar para actualizar", el indicador sigue visible mientras arranca: nunca una pantalla vacía.
// Se esconde cuando la primera pantalla ya está lista (y al menos 700 ms, para que no parpadee).
if (vienesDeRecarga()) {
  const inicio = Date.now();
  mostrarCargaYa(10000);
  void router.isReady().then(() => {
    const falta = Math.max(0, 700 - (Date.now() - inicio));
    setTimeout(() => setTimeout(ocultarCargaYa, 600), falta); // un respiro para que la vista pinte sus datos
  });
}

app.mount("#app");
