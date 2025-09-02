import { db } from "../index";
import type { FavoritoItem } from "../index";
import { ref, onMounted } from "vue";

export function useFavoritos() {
  // Lista reactiva de IDs de favoritos
  const favoritosIds = ref<string[]>([]);

  // Cargar favoritos desde la BD
  const cargarFavoritos = async () => {
    const favoritos = await db.Favoritos.toArray();
    favoritosIds.value = favoritos.map(f => String(f.articuloId));
  };

  // Agregar o quitar favorito en tiempo real
  const toggleFavorito = async (item: FavoritoItem) => {
    const id = String(item.articuloId);
    const index = favoritosIds.value.indexOf(id);

    if (index >= 0) {
      // Quitar de la lista reactiva inmediatamente
      favoritosIds.value.splice(index, 1);
      // Quitar de la base de datos async
      await db.Favoritos.delete(id);
    } else {
      // Agregar a la lista reactiva inmediatamente
      favoritosIds.value.push(id);
      // Guardar en la base de datos async
      await db.Favoritos.put(item);
    }
  };

  // Revisar si un artículo es favorito
  const estaFavorito = (articuloId: string | number) =>
    favoritosIds.value.includes(String(articuloId));

  onMounted(() => cargarFavoritos());

  return { favoritosIds, toggleFavorito, estaFavorito, cargarFavoritos };
}
