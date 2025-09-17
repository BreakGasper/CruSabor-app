import { db } from "@/firebase";
import { ref as dbRef, push, set, get, child } from "firebase/database";
import { sessionUser } from "@/utils/sessionUser";

// Interfaz de Pedido con items en lugar de 1 producto plano
export interface Pedido {
  id_pedido?: string;
  id_usuario: string;
  metodo_pago: string;
  total_compra: number;
  estatus: string;
  fecha_hora: string;
  fechaEntrega?: string;

  // Domicilio
  domicilio: {
    calleNumero: string;
    lugar: string;
    municipio: string;
    estado: string;
    codigoPostal: string;
  };

  // Lista de productos
  items: {
    id_articulo: string;
    nombreProducto: string;
    precio: number;
    cantidad: number;
    categoria?: string;
    proveedor?: string;
    sku_code?: string;
    url_image?: string;
    almacen?: string;
    anticipo?: number | null;
    descuentoCupon?: number | null;
  }[];
}

/**
 * Obtener un pedido por su id
 */
export async function getPedidoById(idPedido: string): Promise<Pedido | null> {
  if (!sessionUser.value?.id) return null;

  try {
    const snapshot = await get(
      child(
        dbRef(db),
        `usuarios/${sessionUser.value.id}/pedidos/${idPedido}`
      )
    );

    if (snapshot.exists()) {
      return {
        id_pedido: idPedido,
        ...snapshot.val(),
      } as Pedido;
    }

    return null;
  } catch (error) {
    console.error("Error al traer pedido:", error);
    return null;
  }
}

/**
 * Obtener todos los pedidos del usuario logueado
 */
export async function getPedidosByUser(): Promise<Pedido[]> {
  if (!sessionUser.value?.id) return [];

  try {
    const snapshot = await get(
      child(dbRef(db), `usuarios/${sessionUser.value.id}/pedidos`)
    );

    if (snapshot.exists()) {
      const data = snapshot.val();

      // Función para convertir "15/5/2025" o "15/5/2025, 14:32" a Date
      function parseDateDMY(dateStr?: string): Date | null {
        if (!dateStr) return null;
        const onlyDate = dateStr.split(",")[0].trim(); // quitamos hora si existe
        const parts = onlyDate.split("/");
        if (parts.length < 3) return null;

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // JS months 0-11
        const year = parseInt(parts[2], 10);

        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
      }

      return Object.keys(data)
        .map((key) => ({
          id_pedido: key,
          ...data[key],
        }))
        .sort((a, b) => {
          const ta = parseDateDMY(a.fecha_hora)?.getTime() ?? 0;
          const tb = parseDateDMY(b.fecha_hora)?.getTime() ?? 0;
          return tb - ta; // más reciente arriba
        }) as Pedido[];
    }

    return [];
  } catch (error) {
    console.error("Error al traer pedidos:", error);
    return [];
  }
}

export async function getPedidosByUser2(): Promise<Pedido[]> {
  if (!sessionUser.value?.id) return [];

  try {
    const snapshot = await get(
      child(dbRef(db), `usuarios/${sessionUser.value.id}/pedidos`)
    );

    if (snapshot.exists()) {
      const data = snapshot.val();

      // Convertimos el objeto a array con sus claves como id_pedido
      return Object.keys(data).map((key) => ({
        id_pedido: key,
        ...data[key],
      })) as Pedido[];
    }

    return [];
  } catch (error) {
    console.error("Error al traer pedidos:", error);
    return [];
  }
}

/**
 * Guardar un pedido único con múltiples items
 */
export async function guardarPedidos(
  carrito: any[],
  metodoPago: string,
  domicilioForm: any
) {
  if (!sessionUser.value?.id) throw new Error("Usuario no autenticado");

  const pedidosRef = dbRef(db, `usuarios/${sessionUser.value.id}/pedidos`);
  const nuevoPedidoRef = push(pedidosRef);

  const fecha_hora = new Date().toLocaleString();

  // Calcular el total del pedido
  const total_compra = carrito.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );

  const pedido: Pedido = {
    id_pedido: nuevoPedidoRef.key!,
    id_usuario: sessionUser.value.id,
    metodo_pago: metodoPago,
    estatus: "Preparacion",
    fecha_hora,
    total_compra,

    // domicilio agrupado
    domicilio: {
      calleNumero: domicilioForm.calle + " #" + domicilioForm.numero,
      lugar: domicilioForm.colonia,
      municipio: domicilioForm.municipio,
      estado: domicilioForm.estado,
      codigoPostal: domicilioForm.cp,
    },

    // lista de productos
    items: carrito.map((item) => ({
      id_articulo: item.id_articulo,
      nombreProducto: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad,
      categoria: item.categoria || "",
      proveedor: item.proveedor || "",
      sku_code: item.sku_code || "",
      url_image: item.url || "",
      almacen: item.almacen || "",
      anticipo: item.anticipo ?? null,
      descuentoCupon: item.descuentoCupon ?? null,
    })),
  };

  await set(nuevoPedidoRef, pedido);
  console.log("Pedido único guardado correctamente");
}
