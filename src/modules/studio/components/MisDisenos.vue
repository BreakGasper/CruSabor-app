<template>
  <section class="mis">
    <h2>{{ soloFavoritos ? 'Favoritos' : 'Mis diseños' }}</h2>
    <p v-if="cargando" class="nota">Cargando…</p>
    <p v-else-if="!visibles.length" class="nota">
      {{ soloFavoritos ? 'Aún no marcaste favoritos. Toca la estrella en un diseño.' : 'Todavía no tienes diseños. Crea el primero desde "Crear promoción".' }}
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <ul class="rejilla">
      <li v-for="d in visibles" :key="d.id" class="tarjeta" :data-testid="`diseno-${d.id}`">
        <button type="button" class="img" :aria-label="`Abrir ${d.nombre}`" @click="$emit('abrir', d.id)"><img :src="d.miniatura" :alt="d.nombre" loading="lazy" /></button>
        <div class="datos">
          <div class="linea">
            <input v-if="editando === d.id" v-model="nombreEdit" class="entrada" maxlength="60" @keydown.enter="guardarNombre(d)" @blur="guardarNombre(d)" />
            <strong v-else class="titulo" :title="d.nombre">{{ d.nombre }}</strong>
            <button type="button" class="ico" :class="{ fav: d.favorito }" :aria-label="d.favorito ? 'Quitar de favoritos' : 'Marcar favorito'" @click="fav(d)"><Star :size="16" :fill="d.favorito ? 'currentColor' : 'none'" /></button>
          </div>
          <small>{{ fecha(d.actualizado) }} · {{ d.formato.w }}×{{ d.formato.h }}</small>
          <div class="acciones">
            <button type="button" class="btn" @click="$emit('abrir', d.id)"><Pencil :size="14" /> Abrir</button>
            <button type="button" class="ico" aria-label="Cambiar nombre" title="Cambiar nombre" @click="empezarNombre(d)"><Type :size="15" /></button>
            <button type="button" class="ico" aria-label="Duplicar" title="Duplicar" @click="duplicar(d)"><Copy :size="15" /></button>
            <button type="button" class="ico peligro" aria-label="Eliminar" title="Eliminar" @click="borrar(d)"><Trash2 :size="15" /></button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Copy, Pencil, Star, Trash2, Type } from 'lucide-vue-next';
import { alternarFavorito, borrarDiseno, duplicarDiseno, listarDisenos, renombrarDiseno, type Diseno } from '../almacen';

const props = defineProps<{ soloFavoritos?: boolean }>();
defineEmits<{ (e: 'abrir', id: string): void }>();

const lista = ref<Diseno[]>([]);
const cargando = ref(true);
const error = ref('');
const editando = ref('');
const nombreEdit = ref('');

const visibles = computed(() => (props.soloFavoritos ? lista.value.filter((d) => d.favorito) : lista.value));

async function cargar() {
  try {
    lista.value = await listarDisenos();
    error.value = '';
  } catch (e: any) {
    error.value = `No se pudieron leer tus diseños: ${e?.message || e}`;
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);

const fecha = (ms: number) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

async function fav(d: Diseno) {
  await alternarFavorito(d.id);
  await cargar();
}
async function duplicar(d: Diseno) {
  await duplicarDiseno(d.id);
  await cargar();
}
async function borrar(d: Diseno) {
  if (!window.confirm(`¿Eliminar "${d.nombre}"? No se puede deshacer.`)) return;
  await borrarDiseno(d.id);
  await cargar();
}
function empezarNombre(d: Diseno) {
  editando.value = d.id;
  nombreEdit.value = d.nombre;
}
async function guardarNombre(d: Diseno) {
  if (editando.value !== d.id) return;
  editando.value = '';
  await renombrarDiseno(d.id, nombreEdit.value);
  await cargar();
}
</script>

<style scoped>
.mis { max-width: 1100px; margin: 0 auto; padding: 20px 16px; }
h2 { margin: 0 0 14px; font-size: 1.05rem; font-weight: 600; }
.nota { color: var(--e-muted); font-size: 0.9rem; }
.error { color: #e5484d; }
.rejilla { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
.tarjeta { background: var(--e-panel); border: 1px solid var(--e-borde); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.img { padding: 0; border: 0; background: #000; cursor: pointer; display: block; }
.img img { width: 100%; aspect-ratio: 4 / 5; object-fit: contain; display: block; }
.datos { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.linea { display: flex; align-items: center; gap: 6px; }
.titulo { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
.entrada { flex: 1; background: var(--e-fondo2); border: 1px solid var(--e-lima); border-radius: 6px; color: var(--e-texto); padding: 4px 6px; font: inherit; min-width: 0; }
small { color: var(--e-muted); font-size: 0.75rem; }
.acciones { display: flex; align-items: center; gap: 4px; }
.btn { display: inline-flex; align-items: center; gap: 5px; background: var(--e-panel2); border: 1px solid var(--e-borde); color: var(--e-texto); border-radius: 8px; padding: 5px 10px; cursor: pointer; font: inherit; font-size: 0.8rem; margin-right: auto; }
.btn:hover { border-color: var(--e-lima); }
.ico { display: inline-grid; place-items: center; width: 28px; height: 28px; background: transparent; border: 1px solid transparent; border-radius: 6px; color: var(--e-muted); cursor: pointer; }
.ico:hover { background: var(--e-panel2); color: var(--e-texto); }
.ico.fav { color: var(--e-ambar); }
.ico.peligro:hover { color: #e5484d; }
</style>
