import { db, type CarritoItem } from './index';
import { sessionUser } from '@/utils/sessionUser';

/**
 * Carrito de invitado: comprar sin haber iniciado sesión todavía.
 *
 * Quien entra por primera vez puede llenar su carrito sin registrarse. Esos
 * artículos se guardan en Dexie con `id_usuario = ID_INVITADO`, igual que los de
 * cualquier cliente, así todas las pantallas siguen leyendo la misma tabla con
 * la misma forma; lo único que cambia es de quién es el carrito.
 *
 * Al iniciar sesión en ese mismo dispositivo, `adoptarCarritoInvitado` pasa esos
 * artículos al cliente y los junta con los que ya tuviera. A partir de ahí el
 * carrito es suyo: se respalda en Firebase y el pedido sale a su nombre.
 *
 * La compra sí exige sesión: un pedido pertenece a un cliente (`guardarPedidos`
 * lo exige). El invitado puede llenar el carrito y se le pide entrar al pagar.
 */

/** Dueño del carrito mientras no hay sesión de cliente */
export const ID_INVITADO = '__invitado__';

/** De quién es el carrito ahora mismo: del cliente si entró, del invitado si no */
export function idCarritoActual(): string {
  return sessionUser.value?.id || ID_INVITADO;
}

/** ¿El carrito de ahora es el de un invitado (sin sesión)? */
export function esCarritoInvitado(): boolean {
  return !sessionUser.value?.id;
}

/** Misma clave que usa el índice compuesto: un artículo con una variante concreta */
const claveItem = (i: Pick<CarritoItem, 'id_articulo' | 'sku'>) =>
  `${i.id_articulo}__${i.sku || 'default'}`;

/**
 * Pasa el carrito del invitado al cliente que acaba de entrar.
 *
 * Si el cliente ya tenía ese mismo artículo y variante (por ejemplo, de su copia
 * en Firebase), se suman las cantidades en vez de duplicar la línea. El stock no
 * se valida aquí a propósito: `guardarPedidos` ya lo revisa contra la base al
 * confirmar, que es el único momento en que el dato es confiable.
 *
 * @returns cuántas líneas del invitado se adoptaron
 */
export async function adoptarCarritoInvitado(uid: string): Promise<number> {
  if (!uid || uid === ID_INVITADO) return 0;

  return db.transaction('rw', db.Carrito, async () => {
    const delInvitado = await db.Carrito.where('id_usuario').equals(ID_INVITADO).toArray();
    if (!delInvitado.length) return 0;

    const delCliente = await db.Carrito.where('id_usuario').equals(uid).toArray();
    const porClave = new Map(delCliente.map((i) => [claveItem(i), i]));

    for (const item of delInvitado) {
      const yaTiene = porClave.get(claveItem(item));
      if (yaTiene) {
        // mismo artículo y variante: se suman las cantidades y se quita el duplicado
        await db.Carrito.update(yaTiene.id!, { cantidad: yaTiene.cantidad + item.cantidad });
        await db.Carrito.delete(item.id!);
      } else {
        // no lo tenía: la línea simplemente cambia de dueño
        await db.Carrito.update(item.id!, { id_usuario: uid });
      }
    }
    return delInvitado.length;
  });
}

/** Tira el carrito del invitado (al cerrar sesión no se hereda al siguiente) */
export async function vaciarCarritoInvitado(): Promise<void> {
  await db.Carrito.where('id_usuario').equals(ID_INVITADO).delete();
}
