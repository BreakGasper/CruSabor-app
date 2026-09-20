export async function uploadImage(file: File): Promise<string> {
  const cloudName = "dswymzhc2";
  const uploadPreset = "mrapp_upload";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  return data.secure_url;
}

/** Base del servidor Express, igual que en el resto de la app */
const API = () =>
  String((import.meta as any).env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Pide al servidor que borre las imágenes que se reemplazaron.
 *
 * Borrar exige la `api_secret` de Cloudinary, que vive solo en el servidor: si
 * estuviera en la app, cualquiera podría borrar las imágenes de todas las
 * tiendas. Por eso se pide, no se hace aquí.
 *
 * **Nunca lanza y nunca bloquea.** Se llama DESPUÉS de guardar la URL nueva, y
 * si falla lo peor que pasa es que la vieja quede huérfana —justo como estaba
 * antes—. Lo contrario sería imperdonable: borrar la imagen y que el guardado
 * falle dejaría al artículo sin foto.
 */
export async function eliminarImagenes(urls: Array<string | null | undefined>): Promise<void> {
  const limpias = urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  if (!limpias.length) return;
  try {
    await fetch(`${API()}/imagenes/eliminar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: limpias }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Sin servidor, sin red o sin credenciales: la imagen vieja se queda y ya
  }
}

/**
 * Borra la imagen anterior solo si de verdad cambió.
 * Comodidad para el caso más común: "guardé una nueva, tira la de antes".
 */
export async function eliminarImagenReemplazada(
  urlAnterior: string | null | undefined,
  urlNueva: string | null | undefined,
): Promise<void> {
  if (!urlAnterior || urlAnterior === urlNueva) return;
  await eliminarImagenes([urlAnterior]);
}
