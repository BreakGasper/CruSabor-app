import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { db, type TiendaFavoritaItem } from '../index';
import type { Tienda } from '@/composables/useTiendas';
import { sessionUser, sessionUsuarioValidation } from '@/utils/sessionUser';

// Estado compartido entre componentes (misma lista en tiendas, perfil de tienda y perfil de usuario)
const favoritasIds = ref<string[]>([]);
const favoritas = ref<TiendaFavoritaItem[]>([]);

export function useTiendasFavoritas() {
  const router = useRouter();

  const cargar = async (idUsuario?: string) => {
    if (!idUsuario) {
      favoritasIds.value = [];
      favoritas.value = [];
      return;
    }
    const lista = await db.TiendasFavoritas.where('idUsuario')
      .equals(idUsuario)
      .toArray();
    favoritas.value = lista.sort((a, b) =>
      a.nombreTienda.localeCompare(b.nombreTienda),
    );
    favoritasIds.value = lista.map((t) => t.tiendaId);
  };

  const esFavorita = (tiendaId?: string) =>
    !!tiendaId && favoritasIds.value.includes(tiendaId);

  /** Alterna favorita. Si no hay sesión de cliente manda al login. */
  const toggle = async (tienda: Tienda) => {
    if (!sessionUsuarioValidation()) {
      router.push('/login');
      return;
    }
    const idUsuario = sessionUser.value.id as string;
    const tiendaId = tienda.tiendaId!;
    const yaEs = esFavorita(tiendaId);

    // UI inmediata
    favoritasIds.value = yaEs
      ? favoritasIds.value.filter((id) => id !== tiendaId)
      : [...favoritasIds.value, tiendaId];

    try {
      const existente = await db.TiendasFavoritas.where('[tiendaId+idUsuario]')
        .equals([tiendaId, idUsuario])
        .first();

      if (existente) {
        await db.TiendasFavoritas.delete(existente.id!);
      } else {
        await db.TiendasFavoritas.add({
          tiendaId,
          idUsuario,
          nombreTienda: tienda.nombreTienda,
          logoUrl: tienda.logoUrl || '',
          categoria: tienda.categoria || '',
          colonia: tienda.colonia || '',
          municipio: tienda.municipio || '',
          telefono: tienda.telefono || '',
          fecha_hora: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error al guardar tienda favorita:', err);
    } finally {
      await cargar(idUsuario);
    }
  };

  /**
   * Refresca la copia local de una tienda favorita con sus datos actuales
   * (nombre, logo, categoría, ubicación, teléfono). Se llama al entrar a su perfil.
   * Devuelve true si había algo que actualizar.
   */
  const sincronizar = async (tienda: Tienda): Promise<boolean> => {
    const idUsuario = sessionUser.value?.id as string | undefined;
    const tiendaId = tienda?.tiendaId;
    if (!idUsuario || !tiendaId) return false;

    const fav = await db.TiendasFavoritas.where('[tiendaId+idUsuario]')
      .equals([tiendaId, idUsuario])
      .first();
    if (!fav) return false;

    const nuevos = {
      nombreTienda: tienda.nombreTienda || fav.nombreTienda,
      logoUrl: tienda.logoUrl || '',
      categoria: tienda.categoria || '',
      colonia: tienda.colonia || '',
      municipio: tienda.municipio || '',
      telefono: tienda.telefono || '',
    };
    const cambio = (Object.keys(nuevos) as (keyof typeof nuevos)[]).some((k) => (fav as any)[k] !== nuevos[k]);
    if (!cambio) return false;

    await db.TiendasFavoritas.update(fav.id!, nuevos);
    await cargar(idUsuario);
    return true;
  };

  onMounted(() => cargar(sessionUser.value?.id));
  watch(
    () => sessionUser.value?.id,
    (id) => cargar(id),
  );

  return { favoritas, favoritasIds, esFavorita, toggle, cargar, sincronizar };
}
