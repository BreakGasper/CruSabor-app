//src/utils/generarQr.ts
import QRCode from "qrcode";
import fs from "fs";

/**
 * Genera un QR y lo guarda como imagen PNG
 * @param texto Texto que quieres codificar en el QR
 * @param rutaArchivo Ruta donde se guardará la imagen (ej: 'qr.png')
 */
async function generarQR(texto: string, rutaArchivo: string) {
  try {
    // Generar QR como DataURL (base64)
    const dataUrl = await QRCode.toDataURL(texto, {
      errorCorrectionLevel: "H",
      type: "image/png",
      margin: 2,
      width: 300,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    // Convertir DataURL a buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Guardar archivo
    fs.writeFileSync(rutaArchivo, buffer);
    console.log(`QR generado en: ${rutaArchivo}`);
  } catch (error) {
    console.error("Error generando QR:", error);
  }
}

// Ejemplo de uso
//const texto = "https://mi-sitio.com/12345";
//generarQR(texto, "qr.png");
