import Dexie from 'dexie';
import type { Table } from 'dexie';

// Interfaz del carrito
export interface CarritoItem {
  id?: number;
  sku: string;
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
  detalle: string;
  id_tienda?: string;
}

// Interfaz del favorito
export interface FavoritoItem {
  articuloId: string;
  idUsuario?: string; // <-- agregado para filtrar por usuario
  categoriaId: string;
  nombre: string;
  precio: number;
  descripcion: string;
  unidadMedida: string;
  puntuacion: number;
  url?: string;
  almacen?: string;
  anticipo?: number;
  subcategoria?: string;
  categoria?: string;
}

// Tienda favorita (por usuario)
export interface TiendaFavoritaItem {
  id?: number;
  tiendaId: string;
  idUsuario: string;
  nombreTienda: string;
  logoUrl?: string;
  categoria?: string;
  colonia?: string;
  municipio?: string;
  telefono?: string;
  fecha_hora: string;
}

// Clase de la base de datos
class MRAPPDatabase extends Dexie {
  Carrito!: Table<CarritoItem>;
  Favoritos!: Table<FavoritoItem, string>; // clave primaria articuloId
  TiendasFavoritas!: Table<TiendaFavoritaItem, number>;

  constructor() {
    super('MRAPP');
    this.version(1).stores({
      Carrito:
        '++id,id_pedido,id_articulo,id_usuario,almacen,cantidad,categoria,anticipo,descuentoCupon,estatus,fechaEntrega,fecha_hora,metodo_pago,id_tienda,[id_articulo+id_usuario+sku]',
      Favoritos:
        'articuloId,idUsuario,nombre,precio,categoriaId,descripcion,unidadMedida,puntuacion',
      // Solo se indexa idUsuario y articuloId, el resto se guarda sin índice
    });

    // v2: tiendas favoritas por usuario
    this.version(2).stores({
      Carrito:
        '++id,id_pedido,id_articulo,id_usuario,almacen,cantidad,categoria,anticipo,descuentoCupon,estatus,fechaEntrega,fecha_hora,metodo_pago,id_tienda,[id_articulo+id_usuario+sku]',
      Favoritos:
        'articuloId,idUsuario,nombre,precio,categoriaId,descripcion,unidadMedida,puntuacion',
      TiendasFavoritas: '++id,tiendaId,idUsuario,[tiendaId+idUsuario]',
    });
  }
}

// Exportamos la instancia
export const db = new MRAPPDatabase();
