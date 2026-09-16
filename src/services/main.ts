import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { crearRouterPagos } from "./pagos/router.ts";
import { crearRouterRecuperacion } from "./recuperacion/router.ts";

console.log(">>> Iniciando main.ts");

// .env (valores generales) y después .env.local (secretos, ignorado por git) que tiene prioridad
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Cargada ✅" : "No cargada ❌");
console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "Cargada ✅ (correo por API HTTP)" : "No cargada (usa SMTP)");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "Cargado ✅" : "No cargado ❌");
console.log("MP_WEBHOOK_SECRET:", process.env.MP_WEBHOOK_SECRET ? "Cargado ✅" : "No cargado ❌");
console.log("API_PUBLIC_URL:", process.env.API_PUBLIC_URL || "(vacía: Mercado Pago no podrá avisar los pagos)");

const app = express();
app.use(express.json());

// La app puede llamar desde su URL publicada y desde el servidor de desarrollo de Vite
const origenes = [process.env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"].filter(Boolean) as string[];
app.use(cors({ origin: origenes }));

app.get("/salud", (_req, res) => res.json({ ok: true }));

// Recuperar contraseña: el código se genera y verifica en el servidor (nunca en el navegador)
app.use("/recuperar-password", crearRouterRecuperacion());

// Pago automático de membresías con Mercado Pago (crear pago + webhook)
app.use("/pagos", crearRouterPagos());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
