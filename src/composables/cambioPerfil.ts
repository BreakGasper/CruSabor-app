import { findUserByPhone, type Usuario } from '@/composables/useAuth';
import {
  tiendasDelTelefono,
  sesionDeTienda,
  guardarSesionTienda,
  resumenTienda,
  type TiendaDeCuenta,
} from '@/composables/cuentaTienda';
import { cerrarSesion, guardarSesion, sesionDeCliente } from '@/utils/sessionUser';

/**
 * Cambio de perfil del administrador: con su sesión abierta puede entrar como el
 * cliente o las tiendas registradas con SU MISMO celular, sin escribir contraseña.
 *
 * La sesión de admin se conserva mientras tanto (es la excepción a "una sola sesión
 * activa"), así VolverAdmin.vue puede regresar al panel. Cliente y tienda siguen
 * siendo excluyentes entre sí.
 */

export interface PerfilesDelCelular {
  cliente: Usuario | null;
  tiendas: TiendaDeCuenta[];
}

export async function perfilesDelCelular(telefono: string): Promise<PerfilesDelCelular> {
  const [cliente, tiendas] = await Promise.all([findUserByPhone(telefono), tiendasDelTelefono(telefono)]);
  return { cliente, tiendas };
}

export function cambiarACliente(usuario: Usuario) {
  localStorage.removeItem('tiendas');
  guardarSesion(sesionDeCliente(usuario));
}

export function cambiarATienda(tienda: TiendaDeCuenta, cuenta: TiendaDeCuenta[]) {
  cerrarSesion();
  guardarSesionTienda(sesionDeTienda(tienda, cuenta.map(resumenTienda)));
}

/** Cierra el perfil de cliente o tienda; la sesión de admin ya sigue abierta */
export function volverAAdmin() {
  localStorage.removeItem('tiendas');
  cerrarSesion();
}
