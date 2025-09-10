import { sessionUser } from "@/utils/sessionUser";
import { db } from "../index";
import type { FavoritoItem } from "../index";
import { ref, onMounted,watch  } from "vue";

export function useFavoritos() {
  // Lista reactiva de IDs de favoritos
  const favoritosIds = ref<string[]>([]);

  // Cargar favoritos desde la BD
 const cargarFavoritos = async (idUsuario: string) => {
  if (!idUsuario) return;
  const favoritos = await db.Favoritos.where("idUsuario").equals(idUsuario).toArray();
  favoritosIds.value = favoritos.map(f => String(f.articuloId));
};
  // Agregar o quitar favorito en tiempo real
 const toggleFavorito = async (item: FavoritoItem, idUsuario: string) => {
  const id = String(item.articuloId);

  // Verificar si ya está en favoritos para este usuario
  const existente = await db.Favoritos
  .where("articuloId")
  .equals(item.articuloId)
  .and(f => f.idUsuario === idUsuario)
  .first();

if (existente) {
  favoritosIds.value = favoritosIds.value.filter(f => f !== item.articuloId);
  await db.Favoritos.delete(existente.articuloId); 
} else {
  favoritosIds.value.push(item.articuloId);
  await db.Favoritos.put({ ...item, idUsuario });
}

};

  // Revisar si un artículo es favorito (usando idUsuario)
  const estaFavorito = (articuloId: string | number) => {
  return favoritosIds.value.includes(String(articuloId));
};


  // NUEVO: Obtener favoritos por idUsuario
  const obtenerFavoritosPorUsuario = async (idUsuario: string) => {
    const favoritos = await db.Favoritos
      .where("idUsuario")
      .equals(idUsuario)
      .toArray();
    return favoritos;
  };

  onMounted(() => {
  if (sessionUser.value?.id) {
    cargarFavoritos(sessionUser.value.id);
  }
});

 watch(
    () => sessionUser.value?.id,
    (newId) => {
      if (newId) {
        cargarFavoritos(newId);
      } else {
        favoritosIds.value = []; // si se desloguea, limpiar
      }
    }
  );
  return { favoritosIds, toggleFavorito, estaFavorito, cargarFavoritos, obtenerFavoritosPorUsuario };
}
