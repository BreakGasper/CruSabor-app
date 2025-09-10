<template>
  <div class="profile-container">
    <ArrowBack class="back-button" @click="$router.back()" />

    <!-- Menú lateral fijo tipo botones redondeados -->
    <div class="menu-tabs-floating" :class="{ hidden: menuHidden }">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        @click="handleTabClick(tab.id)"
        :class="[
          'tab-button',
          { active: activeTab === tab.id && tab.id !== 'hide' },
        ]"
        :title="tab.id === 'hide' ? 'Ocultar menú' : ''"
      >
        {{ tab.label }}
      </div>
    </div>

    <!-- Pestaña para mostrar menú cuando está oculto -->
    <div
      v-if="menuHidden"
      class="show-tab"
      @click="menuHidden = false"
      title="Mostrar menú"
    >
      ➤
    </div>

    <!-- Encabezado del perfil -->
    <div class="profile-header">
      <div class="avatar-container">
        <img
          :src="avatarUrl"
          :label="usuario?.nombre?.charAt(0) || 'U'"
          size="xlarge"
          shape="circle"
          class="avatar"
          @error="onImageError"
          alt="Avatar"
        />
      </div>
      <p class="name">MAVI - CAMENDIOLA</p>
      <p class="email">{{ usuario?.email }}</p>
    </div>

    <!-- Contenido de las secciones -->
    <div class="sections">
      <div ref="yoRef" class="section-card">
        <h3>🧾 Yo</h3>
        <ul class="list">
          <li>{{ usuario?.nombre }}</li>
          <li>
            Sexo:
            {{ obtenerGenero(usuario?.genero) }} Edad:
            {{ CalcularEdadPerfil(usuario?.fechaNacimiento) }}
          </li>
          <li>Calle: {{ usuario?.calleNumero }}</li>
          <li>
            {{
              usuario?.lugar +
              ", \n" +
              usuario?.municipio +
              ", " +
              usuario?.estado
            }}.
          </li>
        </ul>
      </div>

      <div ref="pedidosRef" class="section-card">
        <h3>🛒 Mis Pedidos</h3>
        <ul class="list">
          <li>01/08/2025 - Laptop Dell - Entregado - $1200</li>
          <li>10/08/2025 - Audífonos Sony - Enviado - $200</li>
          <li>20/08/2025 - Mouse Logitech - Pendiente - $50</li>
        </ul>
      </div>

      <div ref="favoritosRef" class="section-card">
        <h3>❤️ Favoritos</h3>
        <FavoritosList :limit="5" horizontal :showHeader="false" />
      </div>

      <div ref="direccionesRef" class="section-card">
        <h3>📍 Direcciones</h3>
      </div>

      <div ref="configRef" class="section-card">
        <h3>⚙️ Configuración</h3>
        <div class="config-buttons">
          <Button
            label="🧾 Datos personales"
            class="modern-button mb-2 p-button-info"
          />
          <Button
            label="🔒 Cambiar contraseña"
            class="modern-button mb-2 p-button-secondary"
          />
          <Button
            label="🚪 Cerrar sesión"
            class="modern-button p-button-danger"
            @click="CerrarSessionPerfil()"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import FavoritosList from "@/modules/home/components/FavoritosList.vue";
import ArrowBack from "@/components/ArrowBack.vue";
import { cerrarSesion, sessionUser } from "@/utils/sessionUser";
import { getUserById } from "@/composables/useAuth";
import { calcularEdad, obtenerGenero } from "@/utils/toolsUtils";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { useRouter } from "vue-router";

const router = useRouter();
const yoRef = ref<HTMLElement | null>(null);
const pedidosRef = ref<HTMLElement | null>(null);
const favoritosRef = ref<HTMLElement | null>(null);
const direccionesRef = ref<HTMLElement | null>(null);
const configRef = ref<HTMLElement | null>(null);
// Reactive donde vamos a guardar los datos del usuario
const usuario = ref<any | null>(null);

const sectionRefs: Record<string, any> = {
  yo: yoRef,
  pedidos: pedidosRef,
  favoritos: favoritosRef,
  direcciones: direccionesRef,
  config: configRef,
};

function scrollTo(section: string) {
  sectionRefs[section]?.value?.scrollIntoView({ behavior: "smooth" });
}

const tabs = [
  { id: "hide", label: "🡰" },
  { id: "yo", label: "👤" },
  { id: "pedidos", label: "🛒" },
  { id: "favoritos", label: "❤️" },
  { id: "direcciones", label: "📍" },
  { id: "config", label: "⚙️" },
];

const activeTab = ref("pedidos");
const menuHidden = ref(false);

const avatarUrl = computed(() => {
  if (!usuario.value?.id) return userDefaultImage.toString();
  return `${FIREBASE_STORAGE_BASE_URL}${
    "Usuarios%2F" + usuario.value.id + ".png"
  }?alt=media&token=6255f15a-d081-4add-98b1-2a46f9a89b48`;
});

function CerrarSessionPerfil() {
  cerrarSesion();
  router.push("/");
}
function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = userDefaultImage;
}
function handleTabClick(id: string) {
  if (id === "hide") {
    menuHidden.value = true;
  } else {
    activeTab.value = id;
    scrollTo(id);
  }
}

function CalcularEdadPerfil(fecha: string | undefined) {
  if (!fecha) return "-";
  return calcularEdad(fecha);
}

onMounted(async () => {
  if (sessionUser.value?.id) {
    const data = await getUserById(sessionUser.value?.id);
    if (data) usuario.value = data;
  }
});
console.log("ID del usuario:", sessionUser.value?.id);
console.log("Nombre:", sessionUser.value?.nombre);
console.log("Correo:", sessionUser.value?.email);
</script>

<style scoped>
.profile-container {
  background: #f8f9fb;
  min-height: 100vh;
  position: relative;
  padding-left: 0;
}

.menu-tabs-floating {
  position: fixed;
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 9999;
  pointer-events: auto;
  transition: opacity 0.3s ease, transform 0.3s ease;
  background: transparent;
}

.menu-tabs-floating.hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(-150%);
}

.tab-button {
  background: white;
  padding: 0.6rem 1rem;
  border-radius: 50px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  font-weight: 600;
  color: #333;
  transition: all 0.3s ease;
  white-space: nowrap;
  border: 2px solid transparent;
  user-select: none;
}

.tab-button.active {
  background: var(--color-bg-blue-dark);
  color: white;
  border-color: var(--color-bg-blue-dark);
}

.tab-button:hover {
  background: #eef3ff;
}

/* Pestaña para mostrar menú */
.show-tab {
  position: fixed;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  background: var(--color-bg-blue-dark);
  color: white;
  font-weight: bold;
  padding: 0.8rem 1rem;
  border-radius: 0 50px 50px 0;
  cursor: pointer;
  z-index: 10000;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.15);
  user-select: none;
  transition: background-color 0.3s ease;
  font-size: 1.4rem;
  line-height: 1;
}

.show-tab:hover {
  background: #0f1f7c;
}

.profile-header {
  width: 100%;
  padding: 2rem 1rem;
  text-align: center;
  background: linear-gradient(
    135deg,
    var(--color-bg-blue-ligth),
    var(--color-bg-blue-dark)
  );
  color: white;
  border-radius: 0 0 40px 40px;
  margin-bottom: 1rem;
}

.avatar-container {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.name {
  font-size: 1.4rem;
  font-weight: bold;
}

.email {
  font-size: 0.9rem;
  color: #f1f1f1;
}

.sections {
  width: 90%;
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 3rem;
}

.section-card {
  background: white;
  border-radius: 15px;
  padding: 1rem;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

/* Botones modernos */
.modern-button {
  width: 100%;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px !important;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: left;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.modern-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}
.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10001;
  background: white;
  border-radius: 50%;
  padding: 0.4rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: background 0.3s ease;
}

.back-button:hover {
  background: #f0f0f0;
}
</style>
