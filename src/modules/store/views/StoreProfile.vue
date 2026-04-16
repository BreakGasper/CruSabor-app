<template>
  <div class="store-detail-container" v-if="store">
    <div class="store-card">
      <!-- Banner / Galería principal -->
      <div class="store-banner">
        <div v-if="store.bannerUrl" class="banner-carousel">
          <img :src="store.bannerUrl" class="banner-img" alt="Gallery" />
        </div>
        <img v-else :src="placeholderImg" alt="Banner" class="banner-img" />
      </div>

      <!-- Logo y Nombre -->
      <div class="store-header">
        <img
          :src="store.logoUrl || placeholderLogo"
          alt="Logo"
          class="store-logo"
        />
        <h1 class="store-name">{{ store.nombreTienda }}</h1>
        <p class="store-category">{{ store.categoria }}</p>
      </div>
      <!-- Sección: Otros datos -->
      <div class="card-section">
        <div v-if="store.descripcion" class="info-row vertical">
          <strong>Descripción</strong><br />
          <span>{{ store.descripcion }}</span>
        </div>
        <div v-if="store.faq" class="info-row vertical">
          <strong>FAQ:</strong> <span>{{ store.faq }}</span>
        </div>
        <div v-if="store.certificaciones" class="info-row vertical">
          <strong>Certificaciones:</strong>
          <span>{{ store.certificaciones }}</span>
        </div>
        <div v-if="store.blog" class="info-row vertical">
          <strong>Blog</strong> <br />
          <span v-html="linkifyShort(store.blog)"></span>
        </div>
      </div>

      <!-- Sección: Datos de la empresa -->
      <div class="card-section">
        <h2>Datos de la empresa</h2>
        <div class="info-row telefono-row">
          <!-- Icono WhatsApp al lado del teléfono -->
          <a
            v-if="store.incluyeWhatsapp"
            :href="`https://wa.me/${store.telefono}`"
            target="_blank"
            class="whatsapp-icon"
          >
            <img src="@/assets/icons/whatsapp.png" alt="WhatsApp" />
          </a>
          <strong> {{ store.telefono }} </strong>
        </div>

        <div v-if="store.email" class="info-row email-row">
          <!-- Icono Email al lado -->
          <a class="email-icon" target="_blank">
            <img src="@/assets/icons/email.png" alt="Email" />
          </a>

          <strong>{{ store.email }}</strong>
        </div>

        <div class="info-row">
          <span
            ><strong>Calle: </strong>{{ store.calle }} <strong>#</strong
            >{{ store.numero }}</span
          >

          <span><strong>C.P: </strong>{{ store.cp }}</span>
        </div>

        <div class="info-row">
          <!-- Icono Email al lado -->
          <a @click="abrirMaps" class="email-icon" target="_blank">
            <img src="@/assets/icons/location.png" alt="street" />
          </a>
          {{ store.colonia }}, {{ store.municipio }}, {{ store.estado }}.
        </div>

        <!-- Redes Sociales dentro de Datos de la empresa -->
        <div
          v-if="store.facebook || store.instagram || store.incluyeWhatsapp"
          class="info-row social-row"
        >
          <strong>Redes Sociales:</strong>
          <div class="menu-icons">
            <div v-if="store.facebook" class="icon-with-label">
              <a target="_blank">
                <img src="@/assets/icons/facebook.png" alt="Facebook" />
              </a>
              <span>{{ store.facebook }}</span>
            </div>

            <div v-if="store.instagram" class="icon-with-label">
              <a target="_blank">
                <img src="@/assets/icons/instagram.png" alt="Instagram" />
              </a>
              <span>{{ store.instagram }}</span>
            </div>
          </div>
        </div>
        <!-- Sección: Métodos de pago -->
        <div
          class="info-row social-row"
          v-if="store.metodosPago && store.metodosPago.length"
        >
          <hr class="divider" />
          <strong>Métodos de pago</strong>
          <div class="payments">
            <div
              v-for="(mp, i) in store.metodosPago"
              :key="i"
              class="payment-item"
            >
              <img
                v-if="paymentIcons[mp]"
                :src="paymentIcons[mp]"
                :alt="mp"
                class="payment-icon"
              />
              {{ mp }}
            </div>
          </div>
        </div>

        <!-- Sección: Envíos a domicilio -->
        <div
          class="info-row social-row"
          v-if="
            store.envioDomicilio &&
            store.zonasEntrega &&
            store.zonasEntrega.length
          "
        >
          <hr class="divider" />
          <p><strong>Zonas de entrega:</strong></p>
          <ul class="zona-list">
            <li
              v-for="(zona, i) in store.zonasEntrega"
              :key="i"
              class="zona-item"
            >
              {{ zona }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Sección: Horario -->
      <div class="card-section horario-section">
        <h2>Horario de atención</h2>
        <div class="horario-grid">
          <div v-for="dia in diasSemana" :key="dia" class="horario-item">
            <div class="dia">{{ dia }}</div>
            <div
              class="hora"
              :class="{
                cerrado:
                  !store.horario ||
                  !store.horario[dia] ||
                  !store.horario[dia].inicio,
              }"
            >
              {{
                store.horario &&
                store.horario[dia] &&
                store.horario[dia].inicio &&
                store.horario[dia].fin
                  ? `${formato12h(store.horario[dia].inicio)} - ${formato12h(
                      store.horario[dia].fin,
                    )}`
                  : "Cerrado"
              }}
            </div>
          </div>
        </div>
      </div>
      <!-- Sección: Galería -->
      <div
        class="card-section"
        v-if="store.galleryUrls && store.galleryUrls.length"
      >
        <h2>Galería</h2>
        <div class="gallery-grid">
          <img
            v-for="(img, i) in store.galleryUrls"
            :key="i"
            :src="img"
            alt="Galería"
          />
        </div>
      </div>

      <!-- Sección: Productos -->
      <div class="card-section" v-if="store.productos">
        <h2>Productos</h2>
        <p>{{ store.productos }}</p>
        <button class="btn-outline-blue">Ver Productos</button>
      </div>

      <!-- Botones principales -->
      <div class="store-actions">
        <button @click="goBack" class="btn-primary">Volver</button>
        <button @click="abrirMaps" class="btn-outline-blue">Cómo llegar</button>
        <button @click="llamar" class="btn-outline-blue">Llamar</button>
        <button @click="irAArticulos" class="btn-outline-blue">
          Ver Lista de Artículos
        </button>
      </div>
    </div>

    <!-- Menú flotante lateral -->
    <div class="floating-menu">
      <img
        src="@/assets/icons/menu.png"
        alt="Menu"
        class="menu-icon"
        @click="toggleMenu"
      />
      <transition name="slide">
        <div v-if="menuOpen" class="menu-content">
          <h3>Opciones</h3>
          <ul>
            <li
              v-if="store.facebook || store.instagram || store.incluyeWhatsapp"
            >
              <div class="menu-icons">
                <a v-if="store.facebook" :href="store.facebook" target="_blank">
                  <img src="@/assets/icons/facebook.png" alt="Facebook" />
                </a>
                <a
                  v-if="store.instagram"
                  :href="store.instagram"
                  target="_blank"
                >
                  <img src="@/assets/icons/instagram.png" alt="Instagram" />
                </a>
                <a
                  v-if="store.incluyeWhatsapp"
                  :href="`https://wa.me/${store.telefono}`"
                  target="_blank"
                >
                  <img src="@/assets/icons/whatsapp.png" alt="WhatsApp" />
                </a>
              </div>
            </li>
            <li v-if="esDuenoTienda">
              <button class="btn-menu" @click="artsTienda">Agregar Productos</button>
            </li>
            <li>
              <button class="btn-menu" @click="abrirMaps">Cómo llegar</button>
            </li>
            <li>
              <button class="btn-menu" @click="llamar">Llamar</button>
            </li>
            <li>
              <button class="btn-menu" @click="irAArticulos">
                ver Productos
              </button>
            </li>
          </ul>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted,computed  } from "vue";
import { useRouter } from "vue-router";
import { useTiendas, type Tienda } from "@/composables/useTiendas";
import cashIcon from "@/assets/icons/money.png";
import cardIcon from "@/assets/icons/card.png";
import transferIcon from "@/assets/icons/trasfer.png";

const router = useRouter();
const { tiendaLogueada } = useTiendas();
const store = ref<Tienda | null>(null);
const menuCollapsed = ref(true);
const tiendaLocal = JSON.parse(localStorage.getItem("tiendas") || "{}");

const placeholderImg = "https://via.placeholder.com/600x250";
const placeholderLogo = "https://via.placeholder.com/100";
function formato12h(hora24: string) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${m.toString().padStart(2, "0")} ${periodo}`;
}

const diasSemana = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const esDuenoTienda = computed(() => {
  return store.value?.tiendaId === tiendaLocal.id;
});

async function loadStore() {
  const stored = localStorage.getItem("tiendas");
  const telefono = stored ? JSON.parse(stored)?.telefono : null;
  if (!telefono) return;

  const tienda = await tiendaLogueada(telefono);
  if (tienda) store.value = tienda;
}

const menuOpen = ref(false);

const paymentIcons: Record<string, string> = {
  Efectivo: cashIcon,
  Tarjeta: cardIcon,
  Transferencia: transferIcon,
};

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function goBack() {
  router.back();
}

function artsTienda() {
  const tienda = JSON.parse(localStorage.getItem("tiendas") || "{}");

  router.push({
    name: "storeProducts",
    params: { id: tienda.id, nombre: tienda.nombreTienda },
  });
}

function abrirMaps() {
  if (!store.value) return;
  const direccion = encodeURIComponent(
    `${store.value.calle} ${store.value.numero}, ${store.value.colonia}, ${store.value.municipio}, ${store.value.estado}`,
  );
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${direccion}`,
    "_blank",
  );
}
function llamar() {
  if (!store.value) return;
  window.location.href = `tel:${store.value.telefono}`;
}

function irAArticulos() {
  if (!store.value) return;
  router.push({
    name: "storeArticles", // nombre de la ruta que definiste
    params: { id: store.value.tiendaId }, // id de la tienda
  });
}

function linkifyShort(text: string) {
  if (!text) return "";
  // Regex para URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return text.replace(urlRegex, (url) => {
    // Recortar hasta el dominio principal
    // Busca el primer "/", después del dominio, y corta ahí
    const domainMatch = url.match(/https?:\/\/[^\/]+/);
    const shortUrl = domainMatch ? domainMatch[0] : url;
    return `<a href="${url}" target="_blank" rel="noopener">${shortUrl}</a>`;
  });
}

onMounted(() => loadStore());
</script>

<style scoped>
html, body {
  height: auto;
  min-height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.divider {
  border: none;
  border-bottom: 1px solid #ccc;
  margin: 12px 0; /* espacio arriba y abajo */
  width: 100%;
}

/* Contenedor principal */
.store-detail-container {
  display: flex;
  justify-content: center;
  padding: 30px 20px;
  font-family: "Poppins", sans-serif;
  background: #f5f7fa;
  min-height: 100vh;
}
.store-card {
  width: 100%;
  max-width: 700px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
  overflow: visible;
  transition: all 0.3s;
}
.store-banner {
  width: 100%;
  height: 250px;
  position: relative;
  max-width: 100%; /* no se desborde */
  overflow: hidden; /* recorta cualquier exceso */
  border-radius: 20px;
  border: #1f70b2 solid 1px;
}
.banner-carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.banner-carousel::-webkit-scrollbar {
  display: none;
}
.banner-img {
  width: 100%; /* imagen ocupa todo el ancho del contenedor */
  height: auto; /* mantiene proporción */
  display: block; /* elimina espacios debajo de la imagen */
  object-fit: cover; /* opcional: recorta imagen si no cabe perfectamente */
  border-radius: 8px; /* opcional: esquinas redondeadas */
}

.store-header {
  text-align: center;
  margin-top: -60px;
  position: relative;
  z-index: 10;
}
.store-logo {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid #fff;
  object-fit: cover;
  background: #fff;
  position: relative;
  z-index: 11;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.store-name {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 12px 0 5px;
  color: #1f70b2;
}
.store-category {
  font-size: 1rem;
  color: #666;
}

/* Cards */
.card-section {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  margin: 15px 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.card-section h2 {
  font-weight: 600;
  margin-bottom: 10px;
  color: #1f70b2;
}
.info-row {
  display: flex;
  gap: 10px;
  font-size: 0.95rem;
  color: #333;
  margin-bottom: 15px;
}
.info-row.vertical {
  display: block; /* 🔹 coloca los elementos uno debajo del otro */
}
.info-row.whatsapp {
  color: #25d366;
  font-weight: 600;
}

/* Galería */
.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.gallery-grid img {
  width: calc(50% - 5px);
  height: 100px;
  object-fit: cover;
  border-radius: 10px;
}

/* Métodos de pago */
.payments {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  justify-content: center; /* 🔹 centra horizontalmente */
  align-items: center; /* centra verticalmente si hay varias filas */
}
.payment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #e3f2fd;
  color: #1f70b2;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  justify-content: center; /* 🔹 centra icono y texto dentro de cada item */
}
.payment-icon {
  width: 20px;
  height: 20px;
}

/* Botones */
.store-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 20px;
}
.btn-primary {
  flex: 1;
  background: #1f70b2;
  color: #fff;
  border: none;
  padding: 14px 0;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: 0.3s;
}
.btn-primary:hover {
  background: #105a8b;
}
.btn-outline-blue {
  flex: 1;
  border: 2px solid #1f70b2;
  background: #fff;
  color: #1f70b2;
  padding: 14px 0;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}
.btn-outline-blue:hover {
  background: #1f70b2;
  color: #fff;
}

/* Menú flotante lateral */
.floating-menu {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: white; /*#1f70b2;*/
  border: 1px solid #1f70b2;
  border-radius: 0 10px 10px 0;
  padding: 10px;
  cursor: pointer;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s;
}
.floating-menu.collapsed {
  transform: translate(-80%, -50%);
}
.menu-icon {
  width: 30px;
  height: 30px;
}
.menu-content {
  margin-top: 10px;
  background: #fff;
  padding: 10px;
  border-radius: 10px;
  width: 180px;
  color: #333;
}
.menu-content h3 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #1f70b2;
  text-align: center;
}
.menu-icons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 5px;
}
.menu-icons img {
  width: 25px;
  height: 25px;
  cursor: pointer;
}
.btn-menu {
  width: 100%;
  padding: 6px 0;
  margin-top: 5px;
  background: #e3f2fd;
  border: none;
  border-radius: 5px;
  color: #1f70b2;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.btn-menu:hover {
  background: #bbdefb;
}

/* Animación */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.slide-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Iconos sociales */
/* Redes dentro de Datos de la empresa con nombres */
.social-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.menu-icons {
  display: flex;
  gap: 20px;
  margin-top: 8px;
  justify-content: center;
}

.icon-with-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.icon-with-label img {
  width: 35px;
  height: 35px;
  align-items: center;
  transition: transform 0.2s ease;
}

.icon-with-label img:hover {
  transform: scale(1.1);
}

.icon-with-label span {
  font-size: 0.8rem;
  color: #333;
  margin-top: 5px;
  font-weight: 500;
}

.telefono-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.whatsapp-icon img {
  width: 22px;
  height: 22px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.whatsapp-icon img:hover {
  transform: scale(1.2);
}

.email-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.email-icon img {
  width: 22px;
  height: 22px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.email-icon img:hover {
  transform: scale(1.2);
}

.horario-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.horario-item {
  background: #e3f2fd;
  padding: 12px 15px;
  border-radius: 12px;
  display: flex;
  flex-direction: column; /* ✅ vertical: día arriba, hora abajo */
  align-items: center;
  font-size: 0.8rem;
  font-weight: 500;
  color: #1f70b2;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.horario-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
}

.horario-item .dia {
  font-weight: 600;
  margin-bottom: 5px;
}

.horario-item .hora {
  font-weight: 500;
}

.horario-item .hora.cerrado {
  color: #ff4d4f; /* rojo para cerrado */
  font-style: italic;
}

/*Evio a domicilio */

.envio-section {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  margin: 15px 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.zona-list {
  list-style: none;
  padding: 0;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.zona-item {
  background: #eef6fd;
  padding: 6px 12px;
  border-radius: 12px;
  color: #1f70b2;
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
