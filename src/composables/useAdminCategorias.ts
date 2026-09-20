import { ref, computed, onUnmounted } from 'vue';
import { db } from '@/firebase';
import { ref as dbRef, onValue, push, update, get } from 'firebase/database';
import type { CategoriaData } from '@/composables/useCategorias';
import { uploadCategoriaIcon } from '@/composables/useStorage';
import { eliminarImagenes } from '@/composables/useCloudinary';

/**
 * Catálogo de categorías para el panel de administración.
 *
 * Las categorías viven en `categorias/{id}` y se referencian desde tiendas y
 * artículos de dos formas: por `categoriaId` (lo nuevo) y por el nombre en
 * `categoria` (dato desnormalizado que se muestra al público). Por eso:
 *   - al renombrar se propaga el nombre a tiendas y artículos que la usan;
 *   - no se puede eliminar una categoría en uso.
 */

export interface UsoCategoria {
  tiendas: number;
  articulos: number;
}

const normalizar = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Categorías en vivo, ordenadas por nombre */
export function useCategoriasEnVivo() {
  const categorias = ref<CategoriaData[]>([]);
  const cargando = ref(true);
  const off = onValue(
    dbRef(db, 'categorias'),
    (snap) => {
      const data = (snap.val() || {}) as Record<string, any>;
      categorias.value = Object.entries(data)
        .map(([id, c]) => ({ ...c, id }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
      cargando.value = false;
    },
    (e) => {
      console.error('❌ Error leyendo categorias:', e);
      cargando.value = false;
    },
  );
  onUnmounted(off);
  return { categorias, cargando };
}

/** Cuántas tiendas y artículos usan cada categoría (por id o por nombre) */
export function useUsoCategorias(categorias: () => CategoriaData[]) {
  const tiendas = ref<Record<string, any>>({});
  const articulos = ref<Record<string, any>>({});
  const offs = [
    onValue(dbRef(db, 'tiendas'), (s) => (tiendas.value = s.val() || {})),
    onValue(dbRef(db, 'articulos'), (s) => (articulos.value = s.val() || {})),
  ];
  onUnmounted(() => offs.forEach((f) => f()));

  const uso = computed<Record<string, UsoCategoria>>(() => {
    const r: Record<string, UsoCategoria> = {};
    for (const c of categorias()) {
      const n = normalizar(c.nombre);
      const cuenta = (coleccion: Record<string, any>) =>
        Object.values(coleccion).filter((x: any) => x?.categoriaId === c.id || (!x?.categoriaId && normalizar(x?.categoria) === n)).length;
      r[c.id] = { tiendas: cuenta(tiendas.value), articulos: cuenta(articulos.value) };
    }
    return r;
  });
  return { uso };
}

function validarNombre(nombre: string, existentes: CategoriaData[], propioId?: string) {
  const limpio = (nombre || '').trim();
  if (limpio.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
  if (limpio.length > 40) throw new Error('El nombre no puede pasar de 40 caracteres');
  const repetida = existentes.find((c) => c.id !== propioId && normalizar(c.nombre) === normalizar(limpio));
  if (repetida) throw new Error(`Ya existe la categoría "${repetida.nombre}"`);
  return limpio;
}

export interface DatosCategoria {
  nombre: string;
  descripcion?: string;
  iconoFile?: File | null;
  /** URL ya existente (al editar sin cambiar el ícono) */
  icono?: string;
}

async function leerCategorias(): Promise<CategoriaData[]> {
  const snap = await get(dbRef(db, 'categorias'));
  const data = (snap.exists() ? snap.val() : {}) as Record<string, any>;
  return Object.entries(data).map(([id, c]) => ({ ...c, id }));
}

export async function crearCategoria(datos: DatosCategoria): Promise<string> {
  const nombre = validarNombre(datos.nombre, await leerCategorias());
  const id = push(dbRef(db, 'categorias')).key!;
  const icono = datos.iconoFile ? await uploadCategoriaIcon(datos.iconoFile, id) : datos.icono || '';
  const categoria: CategoriaData = { id, nombre, descripcion: (datos.descripcion || '').trim(), icono };
  await update(dbRef(db), { [`categorias/${id}`]: categoria });
  return id;
}

/**
 * Edita una categoría. Si cambia el nombre, lo propaga a las tiendas y artículos
 * que la usan para que el catálogo público siga coincidiendo.
 * Devuelve cuántos registros se actualizaron.
 */
export async function editarCategoria(id: string, datos: DatosCategoria): Promise<{ tiendas: number; articulos: number }> {
  const existentes = await leerCategorias();
  const actual = existentes.find((c) => c.id === id);
  if (!actual) throw new Error('La categoría ya no existe');
  const nombre = validarNombre(datos.nombre, existentes, id);
  const icono = datos.iconoFile ? await uploadCategoriaIcon(datos.iconoFile, id) : (datos.icono ?? actual.icono ?? '');
  const iconoAnterior = actual.icono ?? '';

  const cambios: Record<string, any> = {
    [`categorias/${id}/nombre`]: nombre,
    [`categorias/${id}/descripcion`]: (datos.descripcion || '').trim(),
    [`categorias/${id}/icono`]: icono,
  };

  const propagados = { tiendas: 0, articulos: 0 };
  if (normalizar(nombre) !== normalizar(actual.nombre) || nombre !== actual.nombre) {
    const anterior = normalizar(actual.nombre);
    for (const coleccion of ['tiendas', 'articulos'] as const) {
      const snap = await get(dbRef(db, coleccion));
      const data = (snap.exists() ? snap.val() : {}) as Record<string, any>;
      for (const [rid, r] of Object.entries(data)) {
        if (r?.categoriaId === id || (!r?.categoriaId && normalizar(r?.categoria) === anterior)) {
          cambios[`${coleccion}/${rid}/categoria`] = nombre;
          if (!r?.categoriaId) cambios[`${coleccion}/${rid}/categoriaId`] = id;
          propagados[coleccion]++;
        }
      }
    }
  }
  await update(dbRef(db), cambios);

  // Ya guardado el icono nuevo: el viejo deja de usarse y se pide borrar
  if (iconoAnterior && iconoAnterior !== icono) void eliminarImagenes([iconoAnterior]);

  return propagados;
}

/** Elimina una categoría que no esté en uso */
export async function eliminarCategoriaAdmin(id: string, uso: UsoCategoria): Promise<void> {
  if (uso.tiendas || uso.articulos) {
    const partes = [];
    if (uso.tiendas) partes.push(`${uso.tiendas} tienda${uso.tiendas === 1 ? '' : 's'}`);
    if (uso.articulos) partes.push(`${uso.articulos} artículo${uso.articulos === 1 ? '' : 's'}`);
    throw new Error(`No se puede eliminar: la usan ${partes.join(' y ')}. Reasigna primero esos registros.`);
  }
  await update(dbRef(db), { [`categorias/${id}`]: null });
}
