<template>
  <div class="admin-container">
    <AdminTopbar titulo="Cuentas" />

    <main class="admin-main">
      <div class="head">
        <div>
          <h1 class="page-title">Cuentas de administrador</h1>
          <p class="page-hint">Quién puede entrar al panel. Solo un superadministrador crea, edita o desactiva cuentas.</p>
        </div>
        <button v-if="soySuper" type="button" class="btn-primary" @click="abrirNueva">+ Nueva cuenta</button>
      </div>

      <p v-if="!soySuper" class="aviso">
        Tu rol es <strong>{{ ROL_LABEL[(sesion?.rol as RolAdmin) || 'admin'] }}</strong>: puedes ver las cuentas pero no modificarlas.
      </p>

      <p v-if="cargando" class="empty">Cargando cuentas...</p>
      <p v-else-if="!admins.length" class="empty">No hay cuentas registradas.</p>

      <ul v-else class="lista">
        <li v-for="a in admins" :key="a.id" class="fila" :class="{ inactiva: !a.activo }" :data-admin="a.id">
          <div class="icono" :class="a.rol">{{ inicial(a.nombre) }}</div>
          <div class="info">
            <p class="nombre">
              {{ a.nombre }}
              <span v-if="a.id === sesion?.id" class="yo">tú</span>
              <span class="rol" :class="a.rol">{{ ROL_LABEL[a.rol] || a.rol }}</span>
              <span v-if="!a.activo" class="estado-inactiva">Desactivada</span>
            </p>
            <p class="desc">📱 {{ formatTelefono(a.telefono) }}</p>
            <p class="uso">
              <span v-if="a.ultimoAcceso">Último acceso {{ fechaCorta(a.ultimoAcceso) }}</span>
              <span v-else>Nunca ha entrado</span>
              <span v-if="a.creadoEn"> · creada {{ fechaCorta(a.creadoEn) }}</span>
            </p>
          </div>
          <div v-if="soySuper" class="acciones">
            <button type="button" class="btn btn-editar" @click="abrirEditar(a)">Editar</button>
            <button
              type="button"
              class="btn"
              :class="a.activo ? 'btn-eliminar' : 'btn-activar'"
              :disabled="!!bloqueo(a, { activo: !a.activo })"
              :title="bloqueo(a, { activo: !a.activo }) || (a.activo ? 'Impedir que entre al panel' : 'Permitir que entre al panel')"
              @click="toggleActivo(a)"
            >
              {{ a.activo ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </li>
      </ul>
    </main>

    <AdminCuentaModal :visible="modalVisible" :admin="adminEdit" :creado-por="sesion?.id" @close="modalVisible = false" @saved="onGuardada" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Swal from 'sweetalert2';
import AdminTopbar from '../components/AdminTopbar.vue';
import AdminCuentaModal from '../components/AdminCuentaModal.vue';
import { sessionAdmin } from '@/utils/sessionAdmin';
import { useAdminsEnVivo, actualizarAdmin, motivoBloqueoCambio, ROL_LABEL, type Admin, type RolAdmin } from '@/composables/useAdmin';

const sesion = computed(() => sessionAdmin.value);
const soySuper = computed(() => sesion.value?.rol === 'superadmin');
const { admins, cargando } = useAdminsEnVivo();

const inicial = (n: string) => (n || '?').trim().charAt(0).toUpperCase();
function formatTelefono(tel: string) {
  const d = String(tel || '').replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : tel;
}
function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const bloqueo = (a: Admin, cambios: Partial<Pick<Admin, 'rol' | 'activo'>>) =>
  motivoBloqueoCambio(sesion.value ? { id: sesion.value.id, rol: sesion.value.rol as RolAdmin } : null, a, cambios, admins.value);

const toast = (title: string, icon: 'success' | 'error' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2400, showConfirmButton: false, icon, title });

const modalVisible = ref(false);
const adminEdit = ref<Admin | null>(null);
function abrirNueva() {
  adminEdit.value = null;
  modalVisible.value = true;
}
function abrirEditar(a: Admin) {
  adminEdit.value = a;
  modalVisible.value = true;
}
function onGuardada(info: { id: string; nombre: string; nuevo: boolean }) {
  modalVisible.value = false;
  toast(info.nuevo ? `Cuenta de ${info.nombre} creada` : `Cuenta de ${info.nombre} actualizada`);
}

async function toggleActivo(a: Admin) {
  const motivo = bloqueo(a, { activo: !a.activo });
  if (motivo) {
    toast(motivo, 'error');
    return;
  }
  if (a.activo) {
    const r = await Swal.fire({
      icon: 'warning',
      title: `¿Desactivar a ${a.nombre}?`,
      text: 'Ya no podrá entrar al panel. Puedes reactivarla cuando quieras.',
      showCancelButton: true,
      confirmButtonText: 'Desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d9534f',
    });
    if (!r.isConfirmed) return;
  }
  try {
    await actualizarAdmin(a.id, { activo: !a.activo });
    toast(a.activo ? 'Cuenta desactivada' : 'Cuenta activada');
  } catch (e: any) {
    toast(e?.message || 'No se pudo actualizar', 'error');
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
.aviso {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff4e5;
  color: #8a5a00;
  font-size: 0.9rem;
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
.fila.inactiva {
  opacity: 0.7;
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
  font-weight: 700;
  font-size: 1.4rem;
}
.icono.superadmin {
  background: #eef2ff;
  color: #3730a3;
}
.info {
  min-width: 0;
}
.nombre {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.yo,
.rol,
.estado-inactiva {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}
.yo {
  background: var(--surface-2);
  color: var(--text-muted);
}
.rol.admin {
  background: #ecfdf5;
  color: #047857;
}
.rol.superadmin {
  background: #eef2ff;
  color: #3730a3;
}
.estado-inactiva {
  background: #fdecea;
  color: #b91c1c;
}
.desc {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.uso {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
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
.btn-activar {
  color: #047857;
  border-color: #a7f3d0;
}
.btn:disabled {
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
