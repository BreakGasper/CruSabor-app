import { ref, onMounted, onUnmounted, type Ref } from "vue";

import { db } from "@/firebase";
import { ref as dbRef, push, set, get, update, onValue, type Unsubscribe } from "firebase/database";

export interface MunicipioData {
  id: string;
  municipio: string;
  estado: string;
  pueblos: string[];
  /** true/ausente = la plataforma tiene alcance ahí (se ofrece al registrar tienda). false = no. */
  alcance?: boolean;
}

/** ¿La plataforma da servicio en este municipio? Solo los que el admin marca explícitamente. */
export const tieneAlcance = (m: Pick<MunicipioData, "alcance">) => m.alcance === true;

/** Los 125 municipios de Jalisco (nombres oficiales). Para sembrarlos desde el admin. */
export const MUNICIPIOS_JALISCO: string[] = [
  "Acatic", "Acatlán de Juárez", "Ahualulco de Mercado", "Amacueca", "Amatitán", "Ameca",
  "Arandas", "El Arenal", "Atemajac de Brizuela", "Atengo", "Atenguillo", "Atotonilco el Alto",
  "Atoyac", "Autlán de Navarro", "Ayotlán", "Ayutla", "La Barca", "Bolaños", "Cabo Corrientes",
  "Casimiro Castillo", "Cihuatlán", "Zapotlán el Grande", "Cocula", "Colotlán",
  "Concepción de Buenos Aires", "Cuautitlán de García Barragán", "Cuautla", "Cuquío", "Chapala",
  "Chimaltitán", "Chiquilistlán", "Degollado", "Ejutla", "Encarnación de Díaz", "Etzatlán",
  "El Grullo", "Guachinango", "Guadalajara", "Hostotipaquillo", "Huejúcar", "Huejuquilla el Alto",
  "La Huerta", "Ixtlahuacán de los Membrillos", "Ixtlahuacán del Río", "Jalostotitlán", "Jamay",
  "Jesús María", "Jilotlán de los Dolores", "Jocotepec", "Juanacatlán", "Juchitlán",
  "Lagos de Moreno", "El Limón", "Magdalena", "Santa María del Oro", "La Manzanilla de la Paz",
  "Mascota", "Mazamitla", "Mexticacán", "Mezquitic", "Mixtlán", "Ocotlán", "Ojuelos de Jalisco",
  "Pihuamo", "Poncitlán", "Puerto Vallarta", "Villa Purificación", "Quitupan", "El Salto",
  "San Cristóbal de la Barranca", "San Diego de Alejandría", "San Juan de los Lagos",
  "San Juanito de Escobedo", "San Julián", "San Marcos", "San Martín de Bolaños",
  "San Martín Hidalgo", "San Miguel el Alto", "Gómez Farías", "San Sebastián del Oeste",
  "Santa María de los Ángeles", "Sayula", "Tala", "Talpa de Allende", "Tamazula de Gordiano",
  "Tapalpa", "Tecalitlán", "Tecolotlán", "Techaluta de Montenegro", "Tenamaxtlán", "Teocaltiche",
  "Teocuitatlán de Corona", "Tepatitlán de Morelos", "Tequila", "Teuchitlán", "Tizapán el Alto",
  "Tlajomulco de Zúñiga", "San Pedro Tlaquepaque", "Tolimán", "Tomatlán", "Tonalá", "Tonaya",
  "Tonila", "Totatiche", "Tototlán", "Tuxcacuesco", "Tuxcueca", "Tuxpan", "Unión de San Antonio",
  "Unión de Tula", "Valle de Guadalupe", "Valle de Juárez", "San Gabriel", "Villa Corona",
  "Villa Guerrero", "Villa Hidalgo", "Cañadas de Obregón", "Yahualica de González Gallo",
  "Zacoalco de Torres", "Zapopan", "Zapotiltic", "Zapotitlán de Vadillo", "Zapotlán del Rey",
  "Zapotlanejo", "San Ignacio Cerro Gordo",
];
// Tipo para el objeto completo que viene de Firebase, con IDs como keys y Municipios como valores
type MunicipiosData = Record<string, MunicipioData>;

export async function obtenerMunicipios(): Promise<MunicipioData[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) {
      console.log("No hay municipios registrados.");
      return [];
    }

    const data = snapshot.val() as MunicipiosData;

    // Devuelve el arreglo completo para mantener ID y más info
    return Object.values(data);
  } catch (error) {
    console.error("Error al obtener municipios:", error);
    return [];
  }
}



export async function obtenerPueblosPorMunicipio(municipioBuscado: string): Promise<string[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) {
      console.log("No hay municipios registrados.");
      return [];
    }

    const data = snapshot.val() as MunicipiosData;

    const municipioEncontrado = Object.values(data).find(
      (item) => item.municipio.toLowerCase() === municipioBuscado.toLowerCase()
    );

    if (!municipioEncontrado) {
      console.log(`Municipio "${municipioBuscado}" no encontrado.`);
      return [];
    }

    // Retornamos el arreglo de pueblos con filtro para asegurar que sean strings válidos
    return (municipioEncontrado.pueblos ?? []).filter((p) => typeof p === "string");
  } catch (error) {
    console.error("Error al obtener pueblos:", error);
    return [];
  }
}

export async function insertarPueblosPorMunicipio(
  municipio: string,
  estado: string,
  pueblos: string[]
) {
  try {
    // Referencia al nodo principal donde guardaremos los municipios
    const municipiosRef = dbRef(db, "municipios");

    // Usamos push para crear un nuevo nodo único para este municipio
    const nuevoMunicipioRef = push(municipiosRef);
    const id = nuevoMunicipioRef.key!;

    // Objeto con la estructura que quieres guardar
    const data = {
      id,
      municipio,
      estado,
      pueblos, // arreglo completo de pueblos
    };

    // Insertamos el objeto completo bajo ese nodo
    await set(nuevoMunicipioRef, data);

    console.log(`✅ Municipio ${municipio} insertado correctamente con ID: ${id}`);
  } catch (error) {
    console.error("❌ Error insertando municipios:", error);
  }
}

export async function obtenerTodosPueblos(): Promise<string[]> {
  try {
    const municipiosRef = dbRef(db, "municipios");
    const snapshot = await get(municipiosRef);

    if (!snapshot.exists()) return [];

    const data = snapshot.val() as Record<string, MunicipioData>;
    // Extraemos todos los pueblos de todos los municipios
    const pueblos: string[] = [];
    Object.values(data).forEach((m) => {
      if (Array.isArray(m.pueblos)) pueblos.push(...m.pueblos);
    });

    // Eliminamos duplicados y ordenamos
    return Array.from(new Set(pueblos)).sort();
  } catch (error) {
    console.error("Error al obtener pueblos:", error);
    return [];
  }
}

/* =========================================================================
 *  ADMINISTRACIÓN DE MUNICIPIOS (pantalla /admin/municipios)
 * ========================================================================= */

const norm = (s: string) => String(s || "").trim().toLowerCase();

/** Lista de municipios en vivo (para el admin), ordenada por nombre */
export function useMunicipiosEnVivo(): { municipios: Ref<MunicipioData[]>; cargando: Ref<boolean> } {
  const municipios = ref<MunicipioData[]>([]);
  const cargando = ref(true);
  let off: Unsubscribe | null = null;
  onMounted(() => {
    off = onValue(dbRef(db, "municipios"), (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      municipios.value = Object.entries(data)
        .map(([id, m]) => ({
          id,
          municipio: String(m?.municipio || ""),
          estado: String(m?.estado || "Jalisco"),
          pueblos: Array.isArray(m?.pueblos) ? m.pueblos : [],
          alcance: m?.alcance === true,
        }))
        .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"));
      cargando.value = false;
    });
  });
  onUnmounted(() => off?.());
  return { municipios, cargando };
}

/** Agrega los municipios de Jalisco que aún no estén en la base. Devuelve cuántos agregó. */
export async function sembrarMunicipiosJalisco(): Promise<number> {
  const snap = await get(dbRef(db, "municipios"));
  const data = (snap.val() as Record<string, any>) || {};
  const existentes = new Set(Object.values(data).map((m: any) => norm(m?.municipio)));
  let agregados = 0;
  for (const municipio of MUNICIPIOS_JALISCO) {
    if (existentes.has(norm(municipio))) continue;
    const nuevo = push(dbRef(db, "municipios"));
    // alcance:false por defecto → el admin marca a mano cuáles tienen cobertura
    await set(nuevo, { id: nuevo.key, municipio, estado: "Jalisco", pueblos: [], alcance: false });
    agregados++;
  }
  return agregados;
}

/** Marca o desmarca el alcance de un municipio */
export async function setAlcanceMunicipio(id: string, alcance: boolean): Promise<void> {
  await update(dbRef(db, `municipios/${id}`), { alcance });
}

/** Marca o desmarca el alcance de TODOS los municipios (para limpiar o seleccionar en bloque) */
export async function marcarTodosAlcance(alcance: boolean): Promise<void> {
  const snap = await get(dbRef(db, "municipios"));
  const data = (snap.val() as Record<string, any>) || {};
  await Promise.all(Object.keys(data).map((id) => update(dbRef(db, `municipios/${id}`), { alcance })));
}

/** Reemplaza las colonias (pueblos) de un municipio */
export async function setColoniasMunicipio(id: string, pueblos: string[]): Promise<void> {
  await update(dbRef(db, `municipios/${id}`), { pueblos: Array.from(new Set(pueblos.filter(Boolean))) });
}
