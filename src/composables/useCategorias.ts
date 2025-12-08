import { db } from "@/firebase";
import { ref as dbRef, push, set, get, update, remove } from "firebase/database";

// Tipo de categoría
export interface CategoriaData {
  id: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  padreId?: string;
}

// Tipo para el objeto completo de categorías
type CategoriasData = Record<string, CategoriaData>;

// Obtener todas las categorías
export async function obtenerCategorias(): Promise<CategoriaData[]> {
  try {
    const categoriasRef = dbRef(db, "categorias");
    const snapshot = await get(categoriasRef);

    if (!snapshot.exists()) {
      console.log("No hay categorías registradas.");
      return [];
    }

    const data = snapshot.val() as CategoriasData;
    return Object.values(data);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return [];
  }
}

// Obtener una categoría por ID
export async function obtenerCategoriaPorId(id: string): Promise<CategoriaData | null> {
  try {
    const categoriaRef = dbRef(db, `categorias/${id}`);
    const snapshot = await get(categoriaRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as CategoriaData;
  } catch (error) {
    console.error("Error al obtener la categoría:", error);
    return null;
  }
}

// Insertar una nueva categoría
export async function insertarCategoria(data: Omit<CategoriaData, "id">): Promise<string | null> {
  try {
    const categoriasRef = dbRef(db, "categorias");
    const nuevaCategoriaRef = push(categoriasRef);
    const id = nuevaCategoriaRef.key!;

    // Creas el objeto nuevo con id + resto de datos sin id
    const nuevaCategoria: CategoriaData = {
      id,       // agregas el id generado
      ...data,  // resto de propiedades (sin id)
    };

    await set(nuevaCategoriaRef, nuevaCategoria);

    console.log(`✅ Categoría '${data.nombre}' insertada con ID: ${id}`);
    return id;
  } catch (error) {
    console.error("❌ Error insertando categoría:", error);
    return null;
  }
}


// Actualizar una categoría existente
export async function actualizarCategoria(id: string, data: Partial<CategoriaData>): Promise<void> {
  try {
    const categoriaRef = dbRef(db, `categorias/${id}`);
    await update(categoriaRef, data);
    console.log(`✅ Categoría ${id} actualizada.`);
  } catch (error) {
    console.error("❌ Error actualizando categoría:", error);
  }
}

// Eliminar una categoría
export async function eliminarCategoria(id: string): Promise<void> {
  try {
    const categoriaRef = dbRef(db, `categorias/${id}`);
    await remove(categoriaRef);
    console.log(`🗑️ Categoría ${id} eliminada.`);
  } catch (error) {
    console.error("❌ Error eliminando categoría:", error);
  }
}
