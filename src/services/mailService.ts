import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface CorreoOptions {
  to: string;
  subject: string;
  html: string;
}

export async function enviarCorreo({ to, subject, html }: CorreoOptions) {
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
