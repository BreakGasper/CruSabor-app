import { ref as vueRef } from "vue";
import type { Ref } from "vue";

import { db } from "@/firebase";
import { ref as dbRef, push, set, onValue, update } from "firebase/database";
import { uploadStoreLogo, uploadStoreGallery, uploadStoreBanner } from "@/composables/useStorage";

export interface Tienda {
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
      
      // Guardar inicialmente sin logoUrl ni galleryUrls
      await set(nuevaTiendaRef, { ...tienda, logoUrl: "", galleryUrls: [] });

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


  return { tiendas, loading, cargarTiendas, crearTienda, obtenerTienda,telefonoExiste ,tiendaLogueada};
}
