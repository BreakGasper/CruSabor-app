/*// src/composables/useStorage.ts
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";*/

// src/composables/useStorage.ts
import { uploadImage } from "./useCloudinary";

export async function uploadUserImage(
  file: File,
  userId: string,
): Promise<string> {
  return await uploadImage(file);
}

export async function uploadStoreLogo(
  file: File,
  storeId: string,
): Promise<string> {
  return await uploadImage(file);
}

export async function uploadArticuloImagen(file: File): Promise<string> {
  return await uploadImage(file);
}

export async function uploadArticuloImagenX2(
  file: File,
  articuloId: string,
): Promise<string> {
  return await uploadImage(file);
}

export async function uploadStoreGallery(
  files: File[],
  storeId: string,
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const url = await uploadImage(file);
    urls.push(url);
  }

  return urls;
}

export async function uploadStoreBanner(
  file: File,
  storeId: string,
): Promise<string> {
  return await uploadImage(file);
}

export async function uploadCategoriaIcon(
  file: File,
  categoriaId: string,
): Promise<string> {
  return await uploadImage(file);
}
/*
const storage = getStorage();

export async function uploadUserImage(
  file: File,
  userId: string
): Promise<string> {
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

/**
 * Sube el logotipo de una tienda y devuelve la URL pública
 */

/*
export async function uploadStoreLogo(
  file: File,
  storeId: string
): Promise<string> {
  try {
    const logoRef = storageRef(storage, `Tiendas/${storeId}/logo.png`);
    await uploadBytes(logoRef, file);
    const url = await getDownloadURL(logoRef);
    return url;
  } catch (error) {
    console.error("Error subiendo el logo de la tienda:", error);
    throw error;
  }
}

export async function uploadArticuloImagen(file: File): Promise<string> {
  try {
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || "jpg";

    // Ejemplo: Articulos/1738895000000.jpg
    const imageRef = storageRef(storage, `Articulos/${timestamp}.${extension}`);

    await uploadBytes(imageRef, file);

    const url = await getDownloadURL(imageRef);

    return url;
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    throw error;
  }
}


export async function uploadArticuloImagenX2(
  file: File,
  articuloId: string
): Promise<string> {
  try {
    // Ruta en Firebase Storage
    const imageRef = storageRef(storage, `TArticulos/${articuloId}/imagen.png`);

    // Subir archivo
    await uploadBytes(imageRef, file);

    // Obtener URL pública
    const url = await getDownloadURL(imageRef);
    return url;
  } catch (error) {
    console.error("Error subiendo la imagen del artículo:", error);
    throw error;
  }
}

/**
 * Sube la galería de una tienda y devuelve un array de URLs públicas
 */

/*
export async function uploadStoreGallery(
  files: File[],
  storeId: string
): Promise<string[]> {
  try {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const galleryRef = storageRef(
        storage,
        `Tiendas/${storeId}/gallery/${i}.png`
      );
      await uploadBytes(galleryRef, file);
      const url = await getDownloadURL(galleryRef);
      urls.push(url);
    }
    return urls;
  } catch (error) {
    console.error("Error subiendo la galería de la tienda:", error);
    throw error;
  }
}
export async function uploadStoreBanner(
  file: File,
  storeId: string
): Promise<string> {
  try {
    const bannerRef = storageRef(storage, `Tiendas/${storeId}/banner.png`); // carpeta y nombre del archivo
    await uploadBytes(bannerRef, file); // sube el archivo, reemplazando si ya existe
    const url = await getDownloadURL(bannerRef); // obtiene la URL pública
    return url;
  } catch (error) {
    console.error("Error subiendo el banner de la tienda:", error);
    throw error;
  }
}
export async function uploadCategoriaIcon(
  file: File,
  categoriaId: string
): Promise<string> {
  try {
    const iconRef = storageRef(storage, `categorias/${categoriaId}/icon.png`);
    await uploadBytes(iconRef, file);
    const url = await getDownloadURL(iconRef);
    return url;
  } catch (error) {
    console.error("Error subiendo el ícono de la categoría:", error);
    throw error;
  }
}
 */
