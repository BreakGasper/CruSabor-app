import { ref } from "vue";

export const sessionPedidoId = ref<string | null>(null);

// Función para generar nuevo pedido
export function generarNuevoPedidoId(usuarioId: string) {
  const nuevoId = `${usuarioId}_${Date.now()}`;
  sessionPedidoId.value = nuevoId;
  return nuevoId;
}
