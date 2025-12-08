import type { Ref } from "vue";

import { db } from "@/firebase";
import { ref as dbRef, push, set, get , update } from "firebase/database";

export interface MunicipioData {
  id: string;
  municipio: string;
  estado: string;
  pueblos: string[];
}
// Tipo para el objeto completo que viene de Firebase, con IDs como keys y Municipios como valores
type MunicipiosData = Record<string, MunicipioData>;

export async function obtenerMunicipios(): Promise<MunicipioData[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) {
      console.log("No hay municipios registrados.");
      return [];
    }

    const data = snapshot.val() as MunicipiosData;

    // Devuelve el arreglo completo para mantener ID y más info
    return Object.values(data);
  } catch (error) {
    console.error("Error al obtener municipios:", error);
    return [];
  }
}



export async function obtenerPueblosPorMunicipio(municipioBuscado: string): Promise<string[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) {
      console.log("No hay municipios registrados.");
      return [];
    }

    const data = snapshot.val() as MunicipiosData;

    const municipioEncontrado = Object.values(data).find(
      (item) => item.municipio.toLowerCase() === municipioBuscado.toLowerCase()
    );

    if (!municipioEncontrado) {
      console.log(`Municipio "${municipioBuscado}" no encontrado.`);
      return [];
    }

    // Retornamos el arreglo de pueblos con filtro para asegurar que sean strings válidos
    return (municipioEncontrado.pueblos ?? []).filter((p) => typeof p === "string");
  } catch (error) {
    console.error("Error al obtener pueblos:", error);
    return [];
  }
}

export async function insertarPueblosPorMunicipio(
  municipio: string,
  estado: string,
  pueblos: string[]
) {
  try {
    // Referencia al nodo principal donde guardaremos los municipios
    const municipiosRef = dbRef(db, "municipios");

    // Usamos push para crear un nuevo nodo único para este municipio
    const nuevoMunicipioRef = push(municipiosRef);
    const id = nuevoMunicipioRef.key!;

    // Objeto con la estructura que quieres guardar
    const data = {
      id,
      municipio,
      estado,
      pueblos, // arreglo completo de pueblos
    };

    // Insertamos el objeto completo bajo ese nodo
    await set(nuevoMunicipioRef, data);

    console.log(`✅ Municipio ${municipio} insertado correctamente con ID: ${id}`);
  } catch (error) {
    console.error("❌ Error insertando municipios:", error);
  }
}

export async function obtenerTodosPueblos(): Promise<string[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) return [];

    const data = snapshot.val() as Record<string, MunicipioData>;
    // Extraemos todos los pueblos de todos los municipios
    const pueblos: string[] = [];
    Object.values(data).forEach((m) => {
      if (Array.isArray(m.pueblos)) pueblos.push(...m.pueblos);
    });

    // Eliminamos duplicados y ordenamos
    return Array.from(new Set(pueblos)).sort();
  } catch (error) {
    console.error("Error al obtener pueblos:", error);
    return [];
  }
}
