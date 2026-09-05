<template>
  <div class="direcciones">
    <p class="contador">
      {{ direcciones.length }} de {{ MAX_DIRECCIONES }} ubicaciones
    </p>

    <p v-if="cargando" class="empty">Cargando direcciones...</p>
    <p v-else-if="direcciones.length === 0" class="empty">No hay direcciones registradas.</p>

    <ul v-else class="lista">
      <li
        v-for="d in direcciones"
        :key="d.id"
        class="dir-card"
        :class="{ activa: predeterminada?.id === d.id }"
      >
        <div class="dir-icono">{{ d.principal ? '🏠' : '📍' }}</div>
        <div class="dir-info">
          <p class="dir-alias">
            {{ d.alias }}
            <span v-if="predeterminada?.id === d.id" class="tag">Predeterminada</span>
            <span v-else-if="d.principal" class="tag suave">Del registro</span>
          </p>
          <p class="dir-texto">{{ direccionTexto(d) }}</p>
        </div>
        <div class="dir-acciones">
          <button
            v-if="predeterminada?.id !== d.id"
            class="link"
            title="Usar como predeterminada"
            @click="marcarPredeterminada(d.principal ? '' : d.id)"
          >
            Predeterminar
          </button>
          <button v-if="!d.principal" class="link peligro" title="Eliminar" @click="confirmarEliminar(d)">
            Eliminar
          </button>
        </div>
      </li>
    </ul>

    <DireccionForm
      v-if="mostrarForm"
      class="form-nueva"
      :guardando="guardando"
      @save="guardarNueva"
      @cancel="mostrarForm = false"
    />
    <button v-else-if="puedeAgregar" class="btn-agregar" @click="mostrarForm = true">
      ＋ Agregar dirección
    </button>
    <p v-else class="limite">
      Llegaste al límite de {{ MAX_DIRECCIONES }} ubicaciones. Elimina una para agregar otra.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Swal from 'sweetalert2';
import DireccionForm from '@/components/DireccionForm.vue';
import {
  useDirecciones,
  direccionTexto,
  MAX_DIRECCIONES,
  type Direccion,
  type DireccionInput,
} from '@/composables/useDirecciones';

const {
  direcciones,
  predeterminada,
  cargando,
  puedeAgregar,
  agregar,
  eliminar,
  marcarPredeterminada,
} = useDirecciones();

const mostrarForm = ref(false);
const guardando = ref(false);

async function guardarNueva(d: DireccionInput) {
  guardando.value = true;
  try {
    await agregar(d);
    mostrarForm.value = false;
    Swal.fire({ toast: true, position: 'bottom', timer: 1600, showConfirmButton: false, icon: 'success', title: 'Dirección guardada' });
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: e?.message || String(e) });
  } finally {
    guardando.value = false;
  }
}

async function confirmarEliminar(d: Direccion) {
  const { isConfirmed } = await Swal.fire({
    title: `¿Eliminar "${d.alias}"?`,
    text: direccionTexto(d),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#e74c3c',
  });
  if (isConfirmed) await eliminar(d.id);
}
</script>

<style scoped>
.direcciones {
  text-align: left;
}
.empty {
  text-align: center;
  color: #777;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}
.contador {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #666;
  text-align: right;
}
.limite {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff4e5;
  color: #8a5a00;
  font-size: 0.85rem;
  text-align: center;
}
.lista {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dir-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.7rem 0.8rem;
  background: #f7f9fc;
  border: 1px solid transparent;
  border-radius: 12px;
}
.dir-card.activa {
  border-color: var(--color-bg-blue-ligth);
  background: #eef5ff;
}
.dir-icono {
  font-size: 1.3rem;
  flex-shrink: 0;
}
.dir-info {
  flex: 1;
  min-width: 0;
}
.dir-alias {
  margin: 0;
  font-weight: 700;
  font-size: 0.92rem;
  color: #222;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-bg-blue-ligth);
  color: #fff;
}
.tag.suave {
  background: #e3e8ef;
  color: #555;
}
.dir-texto {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: #555;
  line-height: 1.3;
}
.dir-acciones {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.link {
  background: none;
  border: none;
  padding: 2px 4px;
  color: var(--color-bg-blue-ligth);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}
.link.peligro {
  color: #c0392b;
}
.link:hover {
  text-decoration: underline;
}
.form-nueva {
  background: #f7f9fc;
  padding: 0.85rem;
  border-radius: 12px;
}
.btn-agregar {
  width: 100%;
  height: 40px;
  border: 2px dashed #c9d3e0;
  border-radius: 10px;
  background: #fff;
  color: var(--color-bg-blue-dark);
  font-weight: 700;
  cursor: pointer;
}
.btn-agregar:hover {
  background: #eef5ff;
}
@media (max-width: 480px) {
  .dir-card {
    align-items: flex-start;
  }
  .dir-acciones {
    flex-direction: row;
    gap: 8px;
  }
}
</style>
