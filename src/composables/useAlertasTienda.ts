import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, type Unsubscribe } from 'firebase/database';
import { suscribirPedidosProveedor, estatusDeTienda, tiendasDelPedido, type Pedido } from '@/composables/usePedidos';
import { resumenStock, type ResumenStock } from '@/composables/useArticulos';
import type { Producto } from '@/types/Producto';

/**
 * Avisos para la dueña o dueño de la tienda (campana de notificaciones):
 *  - pedidos nuevos sin atender (su parte sigue en Preparacion),
 *  - artículos agotados o por agotarse (stock ≤ UMBRAL_STOCK_BAJO en alguna variante).
 *
 * Todo en vivo desde Firebase; sin escrituras. Desde la campana la tienda puede
 * pausar la venta o dar de baja un artículo mientras resurte (ver useArticulos).
 */

export interface AlertaStock {
  articulo: Producto;
  stock: ResumenStock;
}

/** Regla pura: artículos que merecen aviso, agotados primero y luego por menor stock */
export function alertasDeStock(articulos: Producto[]): AlertaStock[] {
  return articulos
    .filter((a) => a.baja !== true) // los dados de baja ya no se venden: no molestan
    .map((a) => ({ articulo: a, stock: resumenStock(a) }))
    .filter((x) => x.stock.estado === 'agotado' || x.stock.estado === 'bajo')
    .sort((x, y) => (x.stock.estado === y.stock.estado ? x.stock.minimo - y.stock.minimo : x.stock.estado === 'agotado' ? -1 : 1));
}

/** Regla pura: pedidos con la parte de esta tienda aún sin atender */
export function pedidosSinAtenderDe(pedidos: Pedido[], tiendaId: string): Pedido[] {
  return pedidos.filter((p) => tiendasDelPedido(p).includes(tiendaId) && estatusDeTienda(p, tiendaId) === 'Preparacion');
}

export function useAlertasTienda(tiendaId: string) {
  const pedidos = ref<Pedido[]>([]);
  const articulos = ref<Producto[]>([]);
  let offPedidos: Unsubscribe | null = null;
  let offArticulos: Unsubscribe | null = null;

  onMounted(() => {
    if (!tiendaId) return;
    offPedidos = suscribirPedidosProveedor(tiendaId, (lista) => (pedidos.value = lista));
    offArticulos = onValue(dbRef(db, 'articulos'), (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      articulos.value = Object.entries(data)
        .filter(([, a]) => String(a?.tiendaId) === String(tiendaId))
        .map(([id, a]) => ({ ...a, articuloId: id }) as Producto);
    });
  });
  onUnmounted(() => {
    offPedidos?.();
    offArticulos?.();
  });

  const pedidosSinAtender = computed(() => pedidosSinAtenderDe(pedidos.value, tiendaId));
  const alertasStock = computed(() => alertasDeStock(articulos.value));
  const agotados = computed(() => alertasStock.value.filter((a) => a.stock.estado === 'agotado'));
  const porAgotarse = computed(() => alertasStock.value.filter((a) => a.stock.estado === 'bajo'));
  const total = computed(() => pedidosSinAtender.value.length + alertasStock.value.length);

  return { pedidos, articulos, pedidosSinAtender, alertasStock, agotados, porAgotarse, total };
}
