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
import ToastService from 'primevue/toastservice';

const app = createApp(App);
app.component('FontAwesomeIcon', FontAwesomeIcon);
app.use(PrimeVue);   // 👈 esto es obligatorio
app.use(ToastService);
app.component("Dialog", Dialog);
app.component("Button", Button);
app.use(router);
app.use(createPinia());

app.mount("#app");
