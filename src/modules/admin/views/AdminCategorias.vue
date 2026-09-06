<template>
  <div class="admin-container">
    <AdminTopbar titulo="Categorías" />

    <main class="admin-main">
      <div class="head">
        <div>
          <h1 class="page-title">Categorías</h1>
          <p class="page-hint">Catálogo que eligen las tiendas al registrarse y al publicar productos.</p>
        </div>
        <button type="button" class="btn-primary" @click="abrirNueva">+ Nueva categoría</button>
      </div>

      <input
        id="buscar-categoria"
        v-model="busqueda"
        type="search"
        class="search-input"
        placeholder="Buscar categoría..."
        aria-label="Buscar categoría"
      />

      <p v-if="cargando" class="empty">Cargando categorías...</p>
      <p v-else-if="!categorias.length" class="empty">Aún no hay categorías. Crea la primera.</p>
      <p v-else-if="!filtradas.length" class="empty">Ninguna categoría coincide con la búsqueda.</p>

      <ul v-else class="lista">
        <li v-for="c in filtradas" :key="c.id" class="fila" :data-categoria="c.id">
          <div class="icono">
            <img v-if="c.icono" :src="c.icono" alt="" @error="onImgError" />
            <span v-else class="icono-letra">{{ inicial(c.nombre) }}</span>
          </div>
          <div class="info">
            <p class="nombre">{{ c.nombre }}</p>
            <p v-if="c.descripcion" class="desc">{{ c.descripcion }}</p>
            <p class="uso">
              <span :class="{ cero: !uso[c.id]?.tiendas }">{{ uso[c.id]?.tiendas ?? 0 }} tienda{{ uso[c.id]?.tiendas === 1 ? '' : 's' }}</span>
              ·
              <span :class="{ cero: !uso[c.id]?.articulos }">{{ uso[c.id]?.articulos ?? 0 }} artículo{{ uso[c.id]?.articulos === 1 ? '' : 's' }}</span>
            </p>
          </div>
          <div class="acciones">
            <button type="button" class="btn btn-editar" @click="abrirEditar(c)">Editar</button>
            <button
              type="button"
              class="btn btn-eliminar"
              :disabled="enUso(c.id)"
              :title="enUso(c.id) ? 'En uso: reasigna las tiendas y artículos antes de eliminarla' : 'Eliminar categoría'"
              @click="eliminar(c)"
            >
              Eliminar
            </button>
          </div>
        </li>
      </ul>
    </main>

    <CategoriaFormModal :visible="modalVisible" :categoria="categoriaEdit" @close="modalVisible = false" @saved="onGuardada" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import CategoriaFormModal from '../components/CategoriaFormModal.vue';
import type { CategoriaData } from '@/composables/useCategorias';
import { useCategoriasEnVivo, useUsoCategorias, eliminarCategoriaAdmin } from '@/composables/useAdminCategorias';

const { categorias, cargando } = useCategoriasEnVivo();
const { uso } = useUsoCategorias(() => categorias.value);

const busqueda = ref('');
const normalizar = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const filtradas = computed(() => {
  const q = normalizar(busqueda.value.trim());
  return categorias.value.filter((c) => !q || normalizar(c.nombre).includes(q) || normalizar(c.descripcion || '').includes(q));
});

const enUso = (id: string) => !!(uso.value[id]?.tiendas || uso.value[id]?.articulos);
const inicial = (n: string) => (n || '?').trim().charAt(0).toUpperCase();
function onImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

const toast = (title: string, icon: 'success' | 'error' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2400, showConfirmButton: false, icon, title });

const modalVisible = ref(false);
const categoriaEdit = ref<CategoriaData | null>(null);
function abrirNueva() {
  categoriaEdit.value = null;
  modalVisible.value = true;
}
function abrirEditar(c: CategoriaData) {
  categoriaEdit.value = c;
  modalVisible.value = true;
}
function onGuardada(info: { id: string; nombre: string; propagados?: { tiendas: number; articulos: number } }) {
  modalVisible.value = false;
  const p = info.propagados;
  const extra = p && (p.tiendas || p.articulos) ? ` · actualizado en ${p.tiendas} tiendas y ${p.articulos} artículos` : '';
  toast(`Categoría "${info.nombre}" guardada${extra}`);
}

async function eliminar(c: CategoriaData) {
  const u = uso.value[c.id] || { tiendas: 0, articulos: 0 };
  const r = await Swal.fire({
    icon: 'warning',
    title: `¿Eliminar "${c.nombre}"?`,
    text: 'Esta acción no se puede deshacer.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d9534f',
  });
  if (!r.isConfirmed) return;
  try {
    await eliminarCategoriaAdmin(c.id, u);
    toast('Categoría eliminada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo eliminar', 'error');
  }
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: var(--surface-2);
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  color: var(--text);
}
.admin-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}
.page-hint {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.btn-primary {
  padding: 11px 18px;
  border-radius: 12px;
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #10b981, #047857);
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.search-input {
  width: 100%;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--surface);
}
.search-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 0;
  margin: 0;
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fila {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
  background: var(--surface);
  border-radius: 16px;
  padding: 0.85rem 1rem;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}
.icono {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #ecfdf5;
  color: #047857;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.icono img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.icono-letra {
  font-weight: 700;
  font-size: 1.4rem;
}
.info {
  min-width: 0;
}
.nombre {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
}
.desc {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.uso {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--text);
  font-weight: 500;
}
.uso .cero {
  color: #9ca3af;
}
.acciones {
  display: flex;
  gap: 6px;
}
.btn {
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.83rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
}
.btn-eliminar {
  color: #b91c1c;
  border-color: #fca5a5;
}
.btn-eliminar:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn:not(:disabled):hover {
  filter: brightness(0.97);
}
@media (max-width: 560px) {
  .fila {
    grid-template-columns: 48px 1fr;
  }
  .icono {
    width: 48px;
    height: 48px;
  }
  .acciones {
    grid-column: 1 / -1;
  }
  .acciones .btn {
    flex: 1;
  }
}
</style>
