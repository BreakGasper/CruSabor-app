// src/utils/sessionUser.ts
import { ref, watch } from "vue";

export const sessionUser = ref<any | null>(null);

/**
 * Cargar sesión desde localStorage al iniciar
 */
export function cargarSesion() {
  const data = localStorage.getItem("usuario");
  sessionUser.value = data ? JSON.parse(data) : null;
}

/**
 * Guardar sesión y notificar cambios
 */
export function guardarSesion(user: any) {
  localStorage.setItem("usuario", JSON.stringify(user));
  sessionUser.value = user;
}

/** Datos del cliente que viajan en la sesión (nunca su contraseña) */
export function sesionDeCliente(user: any) {
  return {
    id: user.id,
    nombre: user.nombre,
    telefono: user.celular,
    email: user.email,
    domicilio: user.calleNumero,
    colonia: user.lugar,
    municipio: user.municipio,
    codigpostal: user.codigoPostal,
    estado: user.estado,
  };
}

export function sessionUsuarioValidation(): boolean {
  return sessionUser.value && sessionUser.value.id;
}
/**
 * Cerrar sesión
 */
export function cerrarSesion() {
  localStorage.removeItem("usuario");
  sessionUser.value = null;
}

/**
 * Detectar si está logueado
 */
export function isLoggedIn(): boolean {
  return sessionUser.value !== null;
}

/**
 * 🔄 Sincronizar entre pestañas/ventanas y refrescos
 */
window.addEventListener("storage", (e) => {
  if (e.key === "usuario") {
    cargarSesion();
  }
});

// 👉 Cargar la sesión la primera vez
cargarSesion();
