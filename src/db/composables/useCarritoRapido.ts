import { reactive, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db, type CarritoItem } from '../index';
import type { Producto } from '@/types/Producto';
import { sessionUser, sessionUsuarioValidation } from '@/utils/sessionUser';
import { sessionPedidoId, generarNuevoPedidoId } from '@/utils/sessionPedido';
import Swal from 'sweetalert2';
import { useEnvioTienda, MENSAJE_SIN_ENVIO } from '@/composables/useEnvioTienda';
import { useEstadoTiendas, MENSAJE_TIENDA_NO_DISPONIBLE } from '@/composables/useMembresia';

/**
 * Carrito "rápido" para listas de productos (tienda, categorías, perfil de tienda).
 * Agrega la variante por defecto del artículo y mantiene un mapa reactivo
 * articuloId -> cantidad total en el carrito del usuario logueado.
 *
 * Usa la misma clave compuesta que ProductDetail ([id_articulo+id_usuario+sku])
 * para que las cantidades coincidan entre pantallas.
 */
export function useCarritoRapido() {
  const router = useRouter();
  const cantidadEnCarrito = reactive<Record<string, number>>({});
  const { sinEnvio } = useEnvioTienda();
  const { noPuedeVender } = useEstadoTiendas();

  /** true si la tienda del producto NO hace envíos a domicilio */
  const sinEnvioTienda = (producto: Producto) => sinEnvio(producto.tiendaId);

  /** true si la tienda está pendiente, bloqueada o con membresía vencida */
  const tiendaNoDisponible = (producto: Producto) => noPuedeVender(producto.tiendaId);

  const varianteDefault = (producto: Producto) =>
    producto.variantes?.find((v) => v.isDefault) || producto.variantes?.[0];

  const skuDe = (producto: Producto) =>
    varianteDefault(producto)?.sku || 'default';

  /** Stock de la variante por defecto. -1 en Firebase significa ilimitado. */
  const stockDe = (producto: Producto): number => {
    const v = varianteDefault(producto);
    if (!v) return 0;
    if (v.stock === -1) return Infinity;
    return v.stock ?? 0;
  };

  const sinStock = (producto: Producto) => stockDe(producto) === 0;

  const limpiar = () => {
    for (const key in cantidadEnCarrito) delete cantidadEnCarrito[key];
  };

  const sincronizar = async () => {
    limpiar();
    if (!sessionUser.value?.id) return;
    const items = await db.Carrito.where('id_usuario')
      .equals(sessionUser.value.id)
      .toArray();
    for (const item of items) {
      cantidadEnCarrito[item.id_articulo] =
        (cantidadEnCarrito[item.id_articulo] || 0) + item.cantidad;
    }
  };

  /** Si no hay sesión de cliente, manda al login y devuelve false. */
  const requiereSesion = () => {
    if (sessionUsuarioValidation()) return true;
    router.push('/login');
    return false;
  };

  const buscarItem = (producto: Producto) =>
    db.Carrito.where('[id_articulo+id_usuario+sku]')
      .equals([producto.articuloId, sessionUser.value.id, skuDe(producto)])
      .first();

  const aumentar = async (producto: Producto) => {
    if (!requiereSesion()) return;
    if (tiendaNoDisponible(producto)) {
      Swal.fire({ icon: 'info', title: 'Tienda no disponible', text: MENSAJE_TIENDA_NO_DISPONIBLE, confirmButtonColor: '#0165d8' });
      return;
    }
    if (sinEnvioTienda(producto)) {
      Swal.fire({ icon: 'info', title: 'Sin envío a domicilio', text: MENSAJE_SIN_ENVIO, confirmButtonColor: '#0165d8' });
      return;
    }
    if (!sessionPedidoId.value) generarNuevoPedidoId(sessionUser.value.id);

    const stock = stockDe(producto);
    const actual = cantidadEnCarrito[producto.articuloId] || 0;
    if (stock !== Infinity && actual >= stock) return;

    const item = await buscarItem(producto);
    if (item) {
      await db.Carrito.update(item.id!, { cantidad: item.cantidad + 1 });
    } else {
      const v = varianteDefault(producto);
      const nuevo: CarritoItem = {
        sku: skuDe(producto),
        id_articulo: producto.articuloId,
        id_usuario: sessionUser.value.id,
        id_pedido: sessionPedidoId.value!,
        almacen: v?.almacen || producto.almacen || '',
        anticipo: producto.anticipo || 0,
        categoria: producto.categoria || '',
        descuentoCupon: 0,
        estatus: 'Preparacion',
        fechaEntrega: '',
        fecha_hora: new Date().toLocaleString(),
        metodo_pago: 'Efectivo',
        nombre: producto.nombre,
        precio: v?.precio ?? producto.precio,
        url: v?.url || producto.url,
        cantidad: 1,
        detalle: v?.detalle || '',
        id_tienda: producto.tiendaId || '',
        nombre_tienda: producto.tiendaNombre || '',
      };
      await db.Carrito.add(nuevo);
    }
    cantidadEnCarrito[producto.articuloId] = actual + 1;
  };

  const disminuir = async (producto: Producto) => {
    if (!sessionUser.value?.id) return;
    const item = await buscarItem(producto);
    if (!item) return;

    if (item.cantidad > 1) {
      await db.Carrito.update(item.id!, { cantidad: item.cantidad - 1 });
    } else {
      await db.Carrito.delete(item.id!);
    }
    const actual = cantidadEnCarrito[producto.articuloId] || 0;
    cantidadEnCarrito[producto.articuloId] = Math.max(0, actual - 1);
  };

  onMounted(sincronizar);
  watch(() => sessionUser.value?.id, sincronizar);

  return {
    cantidadEnCarrito,
    aumentar,
    disminuir,
    sincronizar,
    stockDe,
    sinStock,
    sinEnvioTienda,
    tiendaNoDisponible,
  };
}
