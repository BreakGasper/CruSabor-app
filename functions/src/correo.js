import nodemailer from 'nodemailer';

/**
 * Envío de correos con la misma cuenta SMTP (Gmail) que usa el resto del proyecto.
 * Devuelve null si no hay credenciales: la revisión sigue funcionando sin avisos.
 */
export function crearEnviador({ usuario, password, remitente = 'MAVI' }) {
  if (!usuario || !password) return null;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: usuario, pass: password },
  });
  return async ({ para, asunto, texto, html }) => {
    await transporter.sendMail({ from: `"${remitente}" <${usuario}>`, to: para, subject: asunto, text: texto, html });
  };
}
