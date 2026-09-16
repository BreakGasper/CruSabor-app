import nodemailer from "nodemailer";

/**
 * Envío de correo con dos caminos:
 *   1. Si hay BREVO_API_KEY → API HTTP de Brevo (viaja por 443). Se usa en producción
 *      (Render), donde el SMTP directo a Gmail está bloqueado y da "Connection timeout".
 *   2. Si no → SMTP de Gmail con Nodemailer. Se usa en local, donde el SMTP sí sale.
 *
 * El remitente es SMTP_USER (o EMAIL_FROM). En Brevo ese correo debe estar verificado
 * como remitente. Ambos caminos tienen timeout para no dejar la petición colgada.
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Sin estos límites, si el SMTP no responde el envío se cuelga y la petición nunca vuelve.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

interface CorreoOptions {
  to: string;
  subject: string;
  html: string;
}

const remitente = () => process.env.SMTP_USER || process.env.EMAIL_FROM || "";

/** Camino producción: API HTTP de Brevo (https, no lo bloquea el hosting) */
async function enviarPorBrevo(
  { to, subject, html }: CorreoOptions,
  apiKey: string,
): Promise<{ success: boolean; error?: any }> {
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: remitente(), name: "CRUSTORE" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const texto = await r.text().catch(() => "");
      return { success: false, error: new Error(`Brevo ${r.status}: ${texto}`) };
    }
    console.log("Correo enviado por Brevo a", to);
    return { success: true };
  } catch (error) {
    console.error("Error al enviar correo (Brevo):", error);
    return { success: false, error };
  }
}

export async function enviarCorreo(
  { to, subject, html }: CorreoOptions,
): Promise<{ success: boolean; error?: any; info?: any }> {
  // Producción: Brevo por HTTP
  const brevo = process.env.BREVO_API_KEY;
  if (brevo) return enviarPorBrevo({ to, subject, html }, brevo);

  // Local: SMTP de Gmail
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const error = new Error(
      "Correo no configurado en el servidor (falta BREVO_API_KEY, o SMTP_USER / SMTP_PASS)",
    );
    console.error(error.message);
    return { success: false, error };
  }
  try {
    const info = await transporter.sendMail({
      from: `"CRUSTORE" <${remitente()}>`,
      to,
      subject,
      html,
    });
    console.log("Correo enviado:", info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error("Error al enviar correo:", error);
    return { success: false, error };
  }
}
