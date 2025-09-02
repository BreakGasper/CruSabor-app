import Dexie from "dexie";
import type { Table } from "dexie";

// Interfaz del carrito
export interface CarritoItem {
  id?: number;
  almacen: string;
  anticipo: number;
  cantidad: number;
  categoria: string;
  descuentoCupon: number;
  estatus: string;
  fechaEntrega: string;
  fecha_hora: string;
  id_articulo: string;
  id_pedido: string;
  id_usuario: string;
  metodo_pago: string;
  nombre: string;
  precio: number;
  url: string;
}

// Interfaz del favorito
export interface FavoritoItem {
  articuloId: string;
  categoriaId: string;
  nombre: string;
  precio: number;
  descripcion: string;
  unidadMedida: string;
  puntuacion: number;
   url?: string;         // URL de la imagen del producto
  almacen?: string;     // opcional, si no tienes info poner vacío
  anticipo?: number;    // opcional, default 0
  subcategoria?: string; // opcional, default vacío
  categoria?: string;  
}

// Clase de la base de datos
class MRAPPDatabase extends Dexie {
  Carrito!: Table<CarritoItem>;
  Favoritos!: Table<FavoritoItem, string>; // clave primaria articuloId

  constructor() {
    super("MRAPP");
    this.version(1).stores({
      Carrito:
        "++id,id_pedido,id_articulo,almacen,cantidad,categoria,anticipo,descuentoCupon,estatus,fechaEntrega,fecha_hora,id_usuario,metodo_pago",
      Favoritos: "articuloId,nombre,precio,categoriaId,descripcion,unidadMedida,puntuacion",
    });
  }
}

// Exportamos la instancia
export const db = new MRAPPDatabase();
