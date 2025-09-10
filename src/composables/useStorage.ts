// src/composables/useStorage.ts
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const storage = getStorage();

export async function uploadUserImage(file: File, userId: string): Promise<string> {
  try {
    // Carpeta "Usuarios" + nombre del archivo = id del usuario
    const imageRef = storageRef(storage, `Usuarios/${userId}.png`);

    // Subir el archivo (si existe, lo reemplaza)
    await uploadBytes(imageRef, file);

    // Obtener URL pública
    const url = await getDownloadURL(imageRef);

    return url; // Devuelve la URL para guardar en la DB
  } catch (error) {
    console.error("Error subiendo la imagen:", error);
    throw error;
  }
}
