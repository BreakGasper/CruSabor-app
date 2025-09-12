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
  estatus?: string;
  fechaEntrega?: string;
  fecha_hora?: string;
  id_usuario?: string;
  metodo_pago?: string;
   categoriaId?: string;
  descripcion?: string;
  unidadMedida?: string;
   icono?: string;
  puntuacion?: number;
}
