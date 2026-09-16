import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Sin estos límites, si faltan/estan mal las credenciales SMTP el envío se queda
  // colgado y la petición nunca responde. Con ellos falla en segundos y devuelve error.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

interface CorreoOptions {
  to: string;
  subject: string;
  html: string;
}

export async function enviarCorreo({ to, subject, html }: CorreoOptions) {
  // Sin credenciales no tiene caso intentar: se falla de inmediato con un motivo claro
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const error = new Error("Correo no configurado en el servidor (faltan SMTP_USER / SMTP_PASS)");
    console.error(error.message);
    return { success: false, error };
  }
  try {
    const info = await transporter.sendMail({
      from: `"CRUSTORE" <${process.env.SMTP_USER}>`,
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
