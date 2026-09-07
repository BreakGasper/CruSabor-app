export interface Producto {
  articuloId: string;
  nombre: string;
  url: string;
  subcategoria?: string;
  precio: number;
  almacen?: string;
  anticipo?: number;
  categoria?: string;
  descuentoCupon?: number;
  fechaEntrega?: string;
  fecha_hora?: string;
  id_usuario?: string;
  metodo_pago?: string;
  categoriaId?: string;
  descripcion: string;
  unidadMedida?: string;
  icono?: string;
  puntuacion?: number;
  tiendaId: string;
  tiendaNombre?: string;
  /**
   * Producto bajo pedido: la tienda lo elabora cuando el cliente lo pide.
   * No controla stock (siempre se puede agregar al carrito) y el pedido se
   * muestra como "Atendiendo tu pedido" mientras la tienda lo prepara.
   */
  porPedido?: boolean;
  /** Venta pausada por la tienda (p. ej. para resurtir): se ve en el catálogo pero no se puede comprar */
  ventaPausada?: boolean;
  /** Dado de baja por la tienda: no aparece en el catálogo público; la tienda puede reactivarlo */
  baja?: boolean;
  variantes: Array<{
    color: string;
    colorCodigo: string; // Nuevo campo para el código del color
    tamano: string;
    material: string;
    marca: string;
    stock: number;
    estatus: boolean;
    tieneStock: boolean;
    tamanoOtro?: string;
    materialOtro?: string;
    almacen: string;
    precio: number;
    sku: string;
    url: string;
    _file?: File;
    detalle: string;
    isDefault?: boolean;
  }>;

  //características adicionales pueden ser añadidas aquí
  //sku
}
