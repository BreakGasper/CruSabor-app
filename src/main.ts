import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
// Importar variables CSS globales
import './assets/styles/ColorsVarCss.css';
import { FontAwesomeIcon } from './plugins/fontawesome'; // <--- aquí

const app = createApp(App);
app.component('FontAwesomeIcon', FontAwesomeIcon);

app.use(router);
app.use(createPinia());

app.mount("#app");
