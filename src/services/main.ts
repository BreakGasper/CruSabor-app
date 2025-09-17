import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { enviarCorreo } from "./mailService.ts";
import path from "path";

console.log(">>> Iniciando main.ts");

dotenv.config();
//dotenv.config({ path: path.resolve(__dirname, "../../.env") });
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Cargada ✅" : "No cargada ❌");
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL }));

app.post("/recuperar-password", async (req, res) => {
  const { email, codigo } = req.body;  // <-- recibir el código desde el frontend
  if (!email || !codigo) return res.status(400).json({ success: false, message: "Falta correo o código" });

  const html = `
    <p>Saludos! </p>
    <p>Tu código de verificación es: <b>${codigo}</b></p>

    <p>Si tu no solicitaste ningun cambio de contraseña,
      ignora el correo !Porfavor¡</p>

      <p>Como recomendacion valida tu cuenta, de ser necesario cambia tu contraseña</p>
  `;

  const resultado = await enviarCorreo({
    to: email,
    subject: "Recuperar contraseña - CruStore",
    html,
  });

  if (resultado.success) {
    res.json({ success: true }); // ya no hace falta devolver el código
  } else {
    res.status(500).json({ success: false, message: "Error al enviar correo" });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
