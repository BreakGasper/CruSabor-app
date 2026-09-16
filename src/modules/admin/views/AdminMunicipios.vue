<template>
  <div class="admin-container">
    <AdminTopbar titulo="Municipios" />

    <main class="admin-main">
      <p class="ayuda">
        Marca los municipios donde <strong>hay alcance</strong> (cobertura). Solo esos aparecen al registrar o editar una tienda.
        Las colonias se autocompletan por código postal en los formularios.
      </p>

      <div class="barra">
        <input v-model="busqueda" type="search" class="search" placeholder="Buscar municipio..." aria-label="Buscar" />
        <button type="button" class="btn btn-sembrar" :disabled="sembrando" @click="sembrar">
          {{ sembrando ? 'Cargando...' : 'Cargar municipios de Jalisco' }}
        </button>
      </div>
      <div v-if="municipios.length" class="barra">
        <button type="button" class="btn btn-sec" @click="marcarTodos(true)">Marcar todos</button>
        <button type="button" class="btn btn-sec" @click="marcarTodos(false)">Desmarcar todos</button>
      </div>

      <div class="resumen">
        <span>{{ municipios.length }} municipios</span>
        <span>·</span>
        <span>{{ conAlcance }} con alcance</span>
      </div>

      <p v-if="cargando" class="ayuda">Cargando...</p>
      <p v-else-if="!municipios.length" class="ayuda">
        Aún no hay municipios. Usa "Cargar municipios de Jalisco" para agregar los 125.
      </p>

      <ul v-else class="lista">
        <li v-for="m in filtrados" :key="m.id" class="fila">
          <label class="check">
            <input type="checkbox" :checked="m.alcance" @change="alternar(m)" />
            <span class="nombre">{{ m.municipio }}</span>
          </label>
          <span class="etq" :class="m.alcance ? 'on' : 'off'">{{ m.alcance ? 'Con alcance' : 'Sin alcance' }}</span>
          <span class="cols">{{ (m.pueblos?.length || 0) }} colonias</span>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import {
  useMunicipiosEnVivo,
  sembrarMunicipiosJalisco,
  setAlcanceMunicipio,
  marcarTodosAlcance,
  type MunicipioData,
} from '@/composables/useLugar';

const { municipios, cargando } = useMunicipiosEnVivo();
const busqueda = ref('');
const sembrando = ref(false);

const conAlcance = computed(() => municipios.value.filter((m) => m.alcance).length);
const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  return q ? municipios.value.filter((m) => m.municipio.toLowerCase().includes(q)) : municipios.value;
});

async function alternar(m: MunicipioData) {
  await setAlcanceMunicipio(m.id, !m.alcance);
}

async function marcarTodos(alcance: boolean) {
  await marcarTodosAlcance(alcance);
}

async function sembrar() {
  sembrando.value = true;
  try {
    const n = await sembrarMunicipiosJalisco();
    Swal.fire({
      toast: true,
      position: 'bottom',
      timer: 2200,
      showConfirmButton: false,
      icon: 'success',
      title: n ? `${n} municipio(s) agregado(s)` : 'Ya estaban todos',
    });
  } catch {
    Swal.fire({ icon: 'error', title: 'No se pudieron cargar los municipios' });
  } finally {
    sembrando.value = false;
  }
}
</script>

<style scoped>
.admin-container { min-height: 100vh; background: var(--bg-page); }
.admin-main { max-width: 800px; margin: 0 auto; padding: 1rem; }
.ayuda { color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0 1rem; }
.barra { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.search {
  flex: 1; min-width: 180px; padding: 8px 12px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit;
}
.btn {
  padding: 8px 14px; border-radius: 10px; border: 1px solid transparent;
  font-weight: 600; font-size: 0.85rem; cursor: pointer; font-family: inherit;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sembrar { background: #059669; color: #fff; }
.btn-sec { background: var(--surface); color: var(--text); border-color: var(--border); }
.resumen { display: flex; gap: 8px; color: var(--text-muted); font-size: 0.82rem; margin: 10px 0; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.fila {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 10px 12px;
}
.check { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; min-width: 0; }
.check input { width: 18px; height: 18px; flex: none; }
.nombre { color: var(--text); font-size: 0.9rem; font-weight: 600; }
.etq { font-size: 0.75rem; font-weight: 700; flex: none; }
.etq.on { color: #059669; }
.etq.off { color: var(--text-muted); }
.cols { font-size: 0.75rem; color: var(--text-muted); flex: none; }
@media (max-width: 520px) {
  .cols { display: none; }
}
</style>
