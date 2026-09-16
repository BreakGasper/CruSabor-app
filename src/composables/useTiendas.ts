import { ref as vueRef } from "vue";
import type { Ref } from "vue";

import { db } from "@/firebase";
import { ref as dbRef, push, set, get, onValue, update } from "firebase/database";
import { uploadStoreLogo, uploadStoreGallery, uploadStoreBanner } from "@/composables/useStorage";
import type { ControlTienda } from "@/composables/useMembresia";

export interface Tienda extends ControlTienda {
  tiendaId?: string;
  nombreTienda: string;
  categoria: string;
  descripcion: string;
  logoUrl?: string;
  calle: string;
  numero: string;
  colonia: string;
  cp: string;
  municipio: string;
  estado: string;
  pais?: string;
  email: string;
  telefono: string;
  incluyeWhatsapp: boolean;
  facebook?: string;
  instagram?: string;
  metodosPago: string[];
  envioDomicilio: boolean;
  zonasEntrega: string[];
  horario: Record<string, { inicio: string; fin: string }>;
  faq?: string;
  certificaciones?: string;
  blog?: string;
  galleryUrls?: string[];
  productos?: string;
  password?:string;
  categoriaId?:string;
  bannerUrl?:string;
}

export function useTiendas() {
  const tiendas: Ref<Tienda[]> = vueRef([]);
  const loading: Ref<boolean> = vueRef(true);

  function cargarTiendas() {
    loading.value = true;
    const tiendasRef = dbRef(db, "tiendas");

    onValue(
      tiendasRef,
      (snapshot) => {
        const data = snapshot.val();
        tiendas.value = data
          ? Object.entries(data).map(([id, val]: any) => ({ ...val, tiendaId: id }))
          : [];
        loading.value = false;
      },
      (error) => {
        console.error("❌ Error leyendo tiendas:", error);
        loading.value = false;
      }
    );
  }

  async function telefonoExiste(telefono: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tiendasRef = dbRef(db, "tiendas");
    onValue(
      tiendasRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve(false);
          return;
        }
        const existe = Object.values(data).some(
          (tienda: any) => tienda.telefono === telefono
        );
        resolve(existe);
      },
      { onlyOnce: true }
    );
  });
}



  async function crearTienda(tienda: Tienda & { logoFile?: File; galleryFiles?: File[] ; bannerFile?: File }) {
    try {
      // 1️⃣ Crear el nodo en Realtime Database primero para obtener el ID
      const tiendasRef = dbRef(db, "tiendas");
      const nuevaTiendaRef = push(tiendasRef);
      const tiendaId = nuevaTiendaRef.key!;
      
      // Guardar inicialmente sin logoUrl ni galleryUrls.
      // Toda tienda nueva nace 'pendiente': no vende hasta que un administrador la apruebe.
      await set(nuevaTiendaRef, {
        ...tienda,
        logoUrl: "",
        galleryUrls: [],
        estatus: "pendiente",
        creadaEn: new Date().toISOString(),
      });

      // 2️⃣ Subir logo si existe
      let logoUrl = "";
      if (tienda.logoFile) {
        logoUrl = await uploadStoreLogo(tienda.logoFile, tiendaId);
      }

       let bannerUrl = "";
      if (tienda.bannerFile) {
        bannerUrl = await uploadStoreBanner(tienda.bannerFile, tiendaId);
      }

      // 3️⃣ Subir galería si existe
      let galleryUrls: string[] = [];
      if (tienda.galleryFiles?.length) {
        galleryUrls = await uploadStoreGallery(tienda.galleryFiles, tiendaId);
      }

      // 4️⃣ Actualizar la tienda con las URLs finales
      await update(nuevaTiendaRef, { logoUrl, galleryUrls,bannerUrl });

      return tiendaId;
    } catch (error) {
      console.error("❌ Error creando tienda:", error);
      throw error;
    }
  }

  async function obtenerTienda(tiendaId: string) {
    return new Promise<Tienda | null>((resolve) => {
      const tiendaRef = dbRef(db, `tiendas/${tiendaId}`);
      onValue(
        tiendaRef,
        (snapshot) => {
          const data = snapshot.val();
          resolve(data ? { ...data, tiendaId } : null);
        },
        { onlyOnce: true }
      );
    });
  }

async function tiendaLogueada(telefono: string): Promise<Tienda | null> {
  return new Promise((resolve) => {
    const tiendasRef = dbRef(db, "tiendas");
    onValue(
      tiendasRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve(null);
          return;
        }

        const encontrado = Object.entries(data).find(
          ([id, t]: [string, any]) => t?.telefono === telefono
        );

        if (encontrado) {
          const [id, t] = encontrado;
          if (typeof t === "object" && t !== null) {
            // ✅ asegura que t es un objeto antes de hacer spread
            resolve({ ...(t as Tienda), tiendaId: id });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      },
      { onlyOnce: true }
    );
  });
}


  /** Actualiza solo los campos indicados de una tienda (la dueña o dueño edita su perfil). */
  async function actualizarTienda(tiendaId: string, cambios: Partial<Tienda>) {
    if (!tiendaId) throw new Error("Tienda sin id");
    // Nunca se tocan desde aquí: contraseña, id, control de admin (estado/membresía) ni campos undefined
    const {
      password,
      tiendaId: _id,
      estatus: _estatus,
      motivoBloqueo: _motivo,
      membresia: _membresia,
      aprobadaEn: _aprobadaEn,
      aprobadaPor: _aprobadaPor,
      ...resto
    } = cambios as any;
    const limpio: Record<string, any> = {};
    for (const [k, v] of Object.entries(resto)) if (v !== undefined) limpio[k] = v;
    if (!Object.keys(limpio).length) return;
    await update(dbRef(db, `tiendas/${tiendaId}`), limpio);

    // El nombre viaja copiado en cada artículo (tiendaNombre): si cambió, se actualiza en todos
    if (typeof limpio.nombreTienda === "string") {
      await sincronizarNombreEnArticulos(tiendaId, limpio.nombreTienda);
    }
  }

  /**
   * Copia el nombre actual de la tienda en `articulos/{id}/tiendaNombre` de todos sus
   * artículos, en una sola escritura multi-ruta. Devuelve cuántos artículos cambió.
   */
  async function sincronizarNombreEnArticulos(tiendaId: string, nombre: string): Promise<number> {
    const snap = await get(dbRef(db, "articulos"));
    if (!snap.exists()) return 0;
    const data = snap.val() as Record<string, any>;
    const cambios: Record<string, string> = {};
    for (const [id, a] of Object.entries(data)) {
      if (String(a?.tiendaId) === String(tiendaId) && a?.tiendaNombre !== nombre) {
        cambios[`${id}/tiendaNombre`] = nombre;
      }
    }
    const n = Object.keys(cambios).length;
    if (n) await update(dbRef(db, "articulos"), cambios);
    return n;
  }

  return {
    sincronizarNombreEnArticulos,
    tiendas,
    loading,
    cargarTiendas,
    crearTienda,
    obtenerTienda,
    telefonoExiste,
    tiendaLogueada,
    actualizarTienda,
  };
}
