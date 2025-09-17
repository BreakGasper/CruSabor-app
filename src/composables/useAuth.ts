import { db } from "@/firebase";
import { ref as dbRef, query, orderByChild, equalTo, get, set,update  } from "firebase/database";
import { getDatabase, ref,  child } from "firebase/database";

export interface Usuario {
  id: string;
  celular: string;
  pass: string;
  nombre?: string;
  email?: string;
  tipo?: string;
  token?: string;
  
  // Datos de domicilio
  calleNumero?: string;
  lugar?: string;
  municipio?: string;
  codigoPostal?: string;
  estado?: string;
 
  genero?: string;
  fechaNacimiento?: string;
  fotoPerfil?: string;

  // Otros datos opcionales
  aceptoTerminos?: boolean;
}


/**
 * Busca un usuario por número de teléfono y devuelve su email, ID y validación
 */
export async function getEmailByPhone(
  phone: string
): Promise<{ email: string | null; valid: boolean; userId?: string }> {
  try {
    const usersRef = dbRef(db, "usuarios");
    const q = query(usersRef, orderByChild("celular"), equalTo(phone));

    const snapshot = await get(q);

    if (snapshot.exists()) {
      const data = snapshot.val();
      const uid = Object.keys(data)[0]; // primer resultado
      const user = data[uid] as Usuario;

      return {
        email: user.email ?? null,
        valid: !!user.email, // true si tiene email registrado
        userId: uid, // <-- agregamos el ID
      };
    }

    return { email: null, valid: false };
  } catch (error) {
    console.error("Error al obtener correo por teléfono:", error);
    return { email: null, valid: false };
  }
}


/**
 * Actualiza cualquier dato del usuario excepto la contraseña
 */
export async function updateUserData(
  userId: string,
  updatedFields: Partial<Usuario>
): Promise<boolean> {
  try {
    const userRef = dbRef(db, `usuarios/${userId}`);
    await update(userRef, updatedFields); // Actualiza solo los campos que vienen en updatedFields
    return true;
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return false;
  }
}
/**
 * Actualiza solo la contraseña de un usuario
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    
    const userRef = dbRef(db, `usuarios/${userId}`);
    await update(userRef, { pass: newPassword }); // Solo actualiza la propiedad "pass"
    return true;
  } catch (error) {
    console.error("Error al actualizar contraseña:", error);
    return false;
  }
}
// Traer datos del usuario por su ID
export async function getUserById(userId: string): Promise<Usuario | null> {
  try {
    const snapshot = await get(child(dbRef(db), `usuarios/${userId}`));
    if (snapshot.exists()) {
      return { id: userId, ...snapshot.val() } as Usuario;
    }
    return null;
  } catch (error) {
    console.error("Error al traer usuario por ID:", error);
    return null;
  }
}
export async function findUserByPhone(phone: string): Promise<Usuario | null> {
  const usersRef = dbRef(db, "usuarios");
  const q = query(usersRef, orderByChild("celular"), equalTo(phone));

  const snapshot = await get(q);
  if (snapshot.exists()) {
    const data = snapshot.val();
    const uid = Object.keys(data)[0]; // primer resultado
    return { id: uid, ...data[uid] } as Usuario;
  }
  return null;
}

export async function saveUser(user: Usuario) {
  const userRef = dbRef(db, "usuarios/" + user.id);
  await set(userRef, user);
  return true;
}
 