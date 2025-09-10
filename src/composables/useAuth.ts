import { db } from "@/firebase";
import { ref as dbRef, query, orderByChild, equalTo, get, set } from "firebase/database";
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
 