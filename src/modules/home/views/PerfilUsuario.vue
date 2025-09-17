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
        <template v-if="tab.id === 'hide'">
          <component :is="tab.label" :size="20" />
        </template>
        <template v-else>
          {{ tab.label }}
        </template>
      </div>
    </div>

    <!-- Pestaña para mostrar menú cuando está oculto -->
    <div
      v-if="menuHidden"
      class="show-tab"
      @click="menuHidden = false"
      title="Mostrar menú"
    >
      <Eye />
    </div>

    <!-- Encabezado del perfil -->
    <div class="profile-header">
      <div class="avatar-container">
        <img
          loading="lazy"
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
        <div class="header-row">
          <span>Yo</span>
          <!-- fondo azul, pegado al círculo -->
          <h3>🧾</h3>
          <!-- círculo con icono -->
        </div>
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
        <div class="header-row">
          <span>Compras</span>
          <!-- fondo azul, pegado al círculo -->
          <h3>🛒</h3>
          <!-- círculo con icono -->
        </div>
        <PedidoList :limit="3" :showHeader="false" :showVerTodos="true" />

        <p v-if="!pedidos.length">No tienes pedidos registrados.</p>

        <!-- Después del v-for de pedidos -->
        <button class="ver-todos-btn" @click="irAMisPedidos">
          ➤ Ver todos mis pedidos...
        </button>
      </div>

      <div ref="favoritosRef" class="section-card">
        <div class="header-row">
          <span>Favoritos</span>
          <!-- fondo azul, pegado al círculo -->
          <h3>❤️</h3>
          <!-- círculo con icono -->
        </div>
        <FavoritosList :limit="5" horizontal :showHeader="false" />
        <!-- Botón "Ver todos mis favoritos" al final -->
        <div class="ver-todos-btn" @click="irAFavoritos">
          ➤ Ver todos mis favoritos...
        </div>
      </div>

      <div ref="direccionesRef" class="section-card">
        <div class="header-row">
          <span>Ubicaciones</span>
          <!-- fondo azul, pegado al círculo -->
          <h3>📍</h3>
          <!-- círculo con icono -->
        </div>
        <span>No hay direcciones registradas</span>
      </div>

      <div ref="configRef" class="section-card">
        <div class="header-row">
          <span>Configuración</span>
          <!-- fondo azul, pegado al círculo -->
          <h3>⚙️</h3>
          <!-- círculo con icono -->
        </div>
        <div class="config-buttons">
          <Button
            label="🧾 Datos personales"
            class="modern-button mb-2 p-button-info"
            @click="openEditModal"
          />
          <Button
            label="🔒 Cambiar contraseña"
            class="modern-button mb-2 p-button-secondary"
            @click="showChangePasswordModal = true"
          />
          <Button
            label="🚪 Cerrar sesión"
            class="modern-button p-button-danger"
            @click="CerrarSessionPerfil()"
          />
        </div>
      </div>
    </div>

    <CustomToast
      v-if="showToast"
      message="Contraseña Cambiada con Exito"
      type="success"
      :duration="2500"
      @close="showToast = false"
    />
    <transition name="fade">
      <div v-if="showChangePasswordModal" class="modal-overlay">
        <div class="modal-content">
          <button class="modal-close" @click="showChangePasswordModal = false">
            ✖
          </button>

          <h3>Cambiar contraseña</h3>

          <!-- Input nueva contraseña -->
          <div class="password-wrapper">
            <input
              :type="showNewPassword ? 'text' : 'password'"
              v-model="nuevaContrasena"
              placeholder="Nueva contraseña"
              maxlength="8"
            />
            <button
              type="button"
              class="eye-btn"
              @click="showNewPassword = !showNewPassword"
            >
              <component
                :is="showNewPassword ? Eye : EyeOff"
                class="eye-icon"
              />
            </button>
          </div>

          <!-- Input confirmar contraseña -->
          <div class="password-wrapper">
            <input
              :type="showConfirmPassword ? 'text' : 'password'"
              v-model="confirmarContrasena"
              placeholder="Confirmar contraseña"
              maxlength="8"
            />
            <button
              type="button"
              class="eye-btn"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <component
                :is="showConfirmPassword ? Eye : EyeOff"
                class="eye-icon"
              />
            </button>
          </div>

          <span v-if="errorContrasena" class="error-text">
            {{ errorContrasena }}
          </span>

          <button
            class="modal-save"
            :disabled="!!errorContrasena"
            @click="cambiarContrasena"
          >
            Guardar
          </button>
        </div>
      </div>
    </transition>
  </div>

  <ConfirmModal
    :visible="showConfirmLogout"
    mensaje="¿Estás seguro de cerrar tu sesión?"
    @confirm="confirmLogout"
    @cancel="cancelLogout"
  />
  <EditUserModal
    :visible="showEditModal"
    :userData="usuario"
    @save="saveUserChanges"
    @cancel="showEditModal = false"
  />
</template>

<script setup lang="ts">
import { Eye, EyeOff } from "lucide-vue-next";

import { computed, onMounted, ref, watch } from "vue";
import Button from "primevue/button";
import FavoritosList from "@/modules/home/components/FavoritosList.vue";
import ArrowBack from "@/components/ArrowBack.vue";
import { cerrarSesion, sessionUser } from "@/utils/sessionUser";
import { getUserById, updateUserPassword } from "@/composables/useAuth";
import { calcularEdad, obtenerGenero } from "@/utils/toolsUtils";
import { FIREBASE_STORAGE_BASE_URL } from "@/constants/firebase_util";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import { useRouter } from "vue-router";
import { getPedidosByUser } from "@/composables/usePedidos";
import PedidoList from "../components/PedidoList.vue";
import CustomToast from "@/components/CustomToast.vue";
import { hashPassword } from "@/composables/usePassword";
import ConfirmModal from "@/components/ConfirmModal.vue";
import EditUserModal from "../components/EditUserModal.vue";
import { updateUserData } from "@/composables/useAuth"; // función real para actualizar
import type { Usuario } from "@/composables/useAuth"; // solo tipo

const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const router = useRouter();
const yoRef = ref<HTMLElement | null>(null);
const pedidosRef = ref<HTMLElement | null>(null);
const favoritosRef = ref<HTMLElement | null>(null);
const direccionesRef = ref<HTMLElement | null>(null);
const configRef = ref<HTMLElement | null>(null);
const pedidos = ref<any[]>([]);
// Reactive donde vamos a guardar los datos del usuario
const usuario = ref<any | null>(null);
const showConfirmLogout = ref(false);
const sectionRefs: Record<string, any> = {
  yo: yoRef,
  pedidos: pedidosRef,
  favoritos: favoritosRef,
  direcciones: direccionesRef,
  config: configRef,
};
const showChangePasswordModal = ref(false);
const nuevaContrasena = ref("");
const confirmarContrasena = ref("");
const errorContrasena = ref("");
const showToast = ref(false);

const showEditModal = ref(false);

function openEditModal() {
  showEditModal.value = true;
}
function irAFavoritos() {
  router.push("/favoritos");
}

async function saveUserChanges(updatedData: Partial<Usuario>) {
  if (!usuario.value) return;

  try {
    // Actualiza en Firebase
    await updateUserData(usuario.value.id, updatedData);

    // Actualiza localmente
    usuario.value = { ...usuario.value, ...updatedData };
    sessionUser.value = usuario.value; // actualizar sesión si existe

    showEditModal.value = false;
  } catch (err) {
    console.error("Error al actualizar usuario:", err);
  }
}

// Watcher individual para evitar problemas de tipo
watch(nuevaContrasena, () => validarContrasena());
watch(confirmarContrasena, () => validarContrasena());

function validarContrasena() {
  if (!nuevaContrasena.value && !confirmarContrasena.value) {
    errorContrasena.value = "";
    return;
  }
  if (nuevaContrasena.value.length > 8) {
    errorContrasena.value = "La contraseña no puede exceder 8 caracteres";
  } else if (nuevaContrasena.value !== confirmarContrasena.value) {
    errorContrasena.value = "Las contraseñas no coinciden";
  } else {
    errorContrasena.value = "";
  }
}

async function cambiarContrasena() {
  if (nuevaContrasena.value.length < 6) {
    errorContrasena.value = "La contraseña debe ser mas de 6 caracteres";
  }
  if (errorContrasena.value) return;

  try {
    // Al crear o cambiar contraseña
    const encrypted = await hashPassword(nuevaContrasena.value);
    await updateUserPassword(sessionUser.value.id, encrypted);

    // Mostrar toast de éxito
    showToast.value = true;

    // Limpiar modal
    showChangePasswordModal.value = false;
    nuevaContrasena.value = "";
    confirmarContrasena.value = "";
  } catch (err) {
    console.error(err);
    errorContrasena.value = "No se pudo cambiar la contraseña";
  }
}
function scrollTo(section: string) {
  sectionRefs[section]?.value?.scrollIntoView({ behavior: "smooth" });
}

const tabs = [
  { id: "hide", label: EyeOff },
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

function irAMisPedidos() {
  router.push("/pedidos");
}

function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = userDefaultImage;
}
function handleTabClick(id: string) {
  if (id === "hide") {
    menuHidden.value = true;
  } else {
    activeTab.value = id; // marcamos inmediatamente la pestaña
    ignoreObserver = true; // ignoramos el observer temporalmente
    scrollTo(id);

    // reactivamos el observer después del scroll
    setTimeout(() => {
      ignoreObserver = false;
    }, 500); // 500ms depende de la velocidad del scroll
  }
}
function CalcularEdadPerfil(fecha: string | undefined) {
  if (!fecha) return "-";
  return calcularEdad(fecha);
}
function CerrarSessionPerfil() {
  // abrir modal en vez de cerrar directamente
  showConfirmLogout.value = true;
}

function confirmLogout() {
  cerrarSesion();
  router.push("/");
  showConfirmLogout.value = false;
}

function cancelLogout() {
  showConfirmLogout.value = false;
}
let ignoreObserver = false;

const observer = new IntersectionObserver(
  (entries) => {
    if (ignoreObserver) return; // bloqueamos temporalmente el observer
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target as HTMLElement;
        const sectionId = target.dataset.section;
        if (sectionId) activeTab.value = sectionId;
      }
    });
  },
  {
    root: null,
    rootMargin: "-20% 0px -40% 0px",
    threshold: 0.3,
  }
);
onMounted(() => {
  Object.keys(sectionRefs).forEach((key) => {
    const el = sectionRefs[key]?.value;
    if (el) {
      (el as HTMLElement).dataset.section = key;
      observer.observe(el);
    }
  });
});

onMounted(async () => {
  if (!sessionUser.value?.id) return;

  const data = await getUserById(sessionUser.value.id);
  if (data) usuario.value = data;

  pedidos.value = await getPedidosByUser();
});

console.log("ID del usuario:", sessionUser.value?.id);
console.log("Nombre:", sessionUser.value?.nombre);
console.log("Correo:", sessionUser.value?.email);
</script>

<style scoped>
.error-text {
  color: #f44336; /* rojo para error */
  font-size: 0.9rem;
  margin-top: -0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.modal-content {
  position: relative; /* necesario para colocar la X */
  background: white;
  padding: 2rem 1.5rem 2.5rem 1.5rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-close {
  top: 10px;
  left: 10px;
  margin-bottom: -35px;
  text-align: right;
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.modal-content input {
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  width: 100%;
}

.modal-save {
  margin-top: 1rem;
  align-self: center; /* centra el botón */
  padding: 0.6rem 2rem;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-blue-dark);
  color: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
}

.ver-todos-btn {
  background: transparent;
  border: none;
  color: var(--color-bg-blue-ligth);
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.25rem 0;
  transition: color 0.3s ease, transform 0.2s ease;
  text-align: center;
}

.ver-todos-btn:hover {
  color: var(--color-bg-blue-dark); /* color más oscuro al pasar el mouse */
  text-decoration: underline;
  transform: translateX(4px); /* efecto de desplazamiento leve */
}

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
  background: #fff;
  border-radius: 20px; /* cardview con bordes suaves */
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08); /* sombra ligera */
  padding: 1.5rem 1rem;
  margin-bottom: 1rem; /* espacio entre cards */
}

.section-card .header-row {
  display: flex;
  align-items: center; /* centra verticalmente badge y círculo */
  justify-content: center;
  gap: 0; /* sin espacio entre badge y círculo */
  margin-bottom: 1rem;
  margin-top: -30px;
  border-bottom: 1px solid #ccc;
}

.section-card .header-row span {
  background-color: var(--color-bg-blue-dark);
  color: white;
  font-weight: 600;
  font-size: 1rem;
  padding: 0.5rem 0.8rem;
  border-radius: 12px; /* redondeado completo */
  white-space: nowrap;
  margin-right: -15px;
  padding-right: 20px;
}

.section-card .header-row h3 {
  width: 50px;
  height: 50px;
  margin-left: -5px; /* solapamiento para unir badge y círculo */
  border-radius: 50%; /* círculo perfecto */
  background: var(--color-bg-blue-dark);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Contenido interno del card */
.section-card .card-content {
  text-align: left;
  font-size: 0.95rem;
  color: #333;
  line-height: 1.4;
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

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 0.8rem;
}

.password-wrapper input {
  width: 100%;
  padding-right: 2.5rem; /* espacio para el botón del ojo */
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.eye-btn {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-icon {
  width: 1.2rem;
  height: 1.2rem;
  color: #555;
}
</style>
