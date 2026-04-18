import { sessionUser } from '@/utils/sessionUser';
import { db } from '../index';
import type { FavoritoItem } from '../index';
import { ref, onMounted, watch } from 'vue';
const favoritosIds = ref<string[]>([]);

export function useFavoritos() {
  // Lista reactiva de IDs de favoritos

  // Cargar favoritos desde la BD
  const cargarFavoritos = async (idUsuario: string) => {
    if (!idUsuario) return;
    const favoritos = await db.Favoritos.where('idUsuario')
      .equals(idUsuario)
      .toArray();
    favoritosIds.value = favoritos.map((f) => String(f.articuloId));
  };
  // Agregar o quitar favorito en tiempo real
  const toggleFavorito2 = async (item: FavoritoItem, idUsuario: string) => {
    const id = String(item.articuloId);

    const existente = await db.Favoritos.where('articuloId')
      .equals(item.articuloId)
      .and((f) => f.idUsuario === idUsuario)
      .first();

    if (existente) {
      // 🔥 quitar visual inmediato
      favoritosIds.value = favoritosIds.value.filter((f) => f !== id);

      // 🔥 eliminar de DB
      await db.Favoritos.delete(item.articuloId);
    } else {
      // 🔥 agregar visual inmediato
      if (!favoritosIds.value.includes(id)) {
        favoritosIds.value.push(id);
      }

      // 🔥 guardar en DB
      await db.Favoritos.put({ ...item, idUsuario });
    }
  };

  const toggleFavorito = async (item: FavoritoItem, idUsuario: string) => {
    const id = String(item.articuloId);

    const isFav = favoritosIds.value.includes(id);

    // 🔥 1. actualizar UI INMEDIATO (sin esperar DB)
    if (isFav) {
      favoritosIds.value = favoritosIds.value.filter((f) => f !== id);
    } else {
      favoritosIds.value.push(id);
    }

    try {
      const existente = await db.Favoritos.where('articuloId')
        .equals(item.articuloId)
        .and((f) => f.idUsuario === idUsuario)
        .first();

      if (existente) {
        await db.Favoritos.delete(item.articuloId);
      } else {
        await db.Favoritos.put({ ...item, idUsuario });
      }
    } catch (err) {
      console.error(err);

      // 🔥 rollback si falla DB
      await cargarFavoritos(idUsuario);
    }
  };

  // Revisar si un artículo es favorito (usando idUsuario)
  const estaFavorito = (articuloId: string | number) => {
    return favoritosIds.value.includes(String(articuloId));
  };

  // NUEVO: Obtener favoritos por idUsuario
  const obtenerFavoritosPorUsuario = async (idUsuario: string) => {
    const favoritos = await db.Favoritos.where('idUsuario')
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
    },
  );
  return {
    favoritosIds,
    toggleFavorito,
    estaFavorito,
    cargarFavoritos,
    obtenerFavoritosPorUsuario,
  };
}
