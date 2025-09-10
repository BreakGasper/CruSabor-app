import bcrypt from "bcryptjs";

// Encripta la contraseña antes de guardarla
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10); // número de rondas (10 es estándar)
  return await bcrypt.hash(password, salt);
}

// Valida si la contraseña ingresada coincide con el hash guardado
export async function validatePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}
/**
 * 
 * import { hashPassword } from "@/utils/passwordUtils";
import { db } from "@/firebase";
import { ref as dbRef, set } from "firebase/database";

async function registerUser(telefono: string, password: string, nombre: string) {
  const hashed = await hashPassword(password);

  const userId = crypto.randomUUID(); // o el id que uses
  await set(dbRef(db, `usuarios/${userId}`), {
    telefono,
    password: hashed, // guardamos el hash
    nombre,
  });

  alert("Usuario registrado con éxito ✅");
}

 * 
 * * */