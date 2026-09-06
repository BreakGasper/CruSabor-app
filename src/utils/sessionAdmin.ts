// src/utils/sessionAdmin.ts
// Sesión del administrador. Sigue el mismo esquema que la de cliente (sessionUser)
// y la de tienda (localStorage "tiendas"): un objeto en localStorage + ref reactivo.
import { ref } from "vue";

export interface SesionAdmin {
  id: string;
  nombre: string;
  telefono: string;
  rol: string;
  inicio: string; // ISO
}

const CLAVE = "admin";

export const sessionAdmin = ref<SesionAdmin | null>(null);

export function cargarSesionAdmin() {
  try {
    const data = localStorage.getItem(CLAVE);
    sessionAdmin.value = data ? (JSON.parse(data) as SesionAdmin) : null;
  } catch {
    sessionAdmin.value = null;
  }
}

export function guardarSesionAdmin(admin: SesionAdmin) {
  localStorage.setItem(CLAVE, JSON.stringify(admin));
  sessionAdmin.value = admin;
}

export function cerrarSesionAdmin() {
  localStorage.removeItem(CLAVE);
  sessionAdmin.value = null;
}

export function isAdminLoggedIn(): boolean {
  return !!sessionAdmin.value?.id;
}

// Sincronizar entre pestañas
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CLAVE) cargarSesionAdmin();
  });
}

cargarSesionAdmin();
