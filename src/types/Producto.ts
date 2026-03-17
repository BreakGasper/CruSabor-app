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
  }>;

  //características adicionales pueden ser añadidas aquí
  //sku
}
