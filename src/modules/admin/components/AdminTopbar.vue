<template>
  <header class="admin-topbar">
    <div class="brand">
      <ArrowBack v-if="volver" class="btn-back" @click="$router.push(volver)" />
      <router-link v-else to="/admin" class="admin-emblem" aria-label="Tablero">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
          <path d="M9.5 12l2 2 3.5-4" />
        </svg>
      </router-link>
      <div>
        <p class="brand-title">{{ titulo }}</p>
        <p class="brand-sub">MAVI - Admin</p>
      </div>
    </div>

    <nav class="nav">
      <router-link to="/admin" class="nav-link" exact-active-class="active">Tablero</router-link>
      <router-link to="/admin/tiendas" class="nav-link" active-class="active">Tiendas</router-link>
      <router-link to="/admin/categorias" class="nav-link" active-class="active">Categorías</router-link>
      <router-link to="/admin/banners" class="nav-link" active-class="active">Banners</router-link>
      <router-link to="/admin/municipios" class="nav-link" active-class="active">Municipios</router-link>
      <router-link to="/admin/configuracion" class="nav-link" active-class="active">Configuración</router-link>
      <router-link to="/admin/cuentas" class="nav-link" active-class="active">Cuentas</router-link>
    </nav>

    <div class="user">
      <!-- Notificaciones: pagos por confirmar -->
      <div class="notif" @keydown.escape="notifAbierto = false">
        <button
          type="button"
          class="notif-btn"
          :class="{ activo: pendientes.length }"
          :aria-label="`${pendientes.length} pagos por confirmar`"
          :title="pendientes.length ? `${pendientes.length} pago(s) por confirmar` : 'Sin pagos por confirmar'"
          @click="notifAbierto = !notifAbierto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span v-if="pendientes.length" class="notif-badge">{{ pendientes.length > 99 ? '99+' : pendientes.length }}</span>
        </button>

        <!-- El panel se teleporta a <body> para no quedar recortado: en móvil se ve
             centrado, en escritorio arriba a la derecha (como desplegable). -->
        <Teleport to="body">
          <div v-if="notifAbierto" class="notif-overlay" @click.self="notifAbierto = false">
            <div class="notif-panel" role="dialog" aria-label="Pagos por confirmar">
              <div class="notif-head">
                <strong>Pagos por confirmar</strong>
                <button type="button" class="notif-cerrar" aria-label="Cerrar" @click="notifAbierto = false">✕</button>
              </div>
              <p v-if="!pendientes.length" class="notif-vacio">No hay avisos pendientes.</p>
              <ul v-else class="notif-lista">
                <li v-for="s in pendientes.slice(0, 8)" :key="s.id">
                  <router-link :to="`/admin/tiendas/${s.tiendaId}`" class="notif-item" @click="notifAbierto = false">
                    <span class="notif-nombre">{{ s.nombreTienda || s.tiendaId }}</span>
                    <span class="notif-meta">
                      {{ PLAN_LABEL[s.plan] || s.plan }} · {{ fechaCorta(s.fecha) }}
                      <span v-if="s.referencia"> · Ref. <strong>{{ s.referencia }}</strong></span>
                      <span v-else class="sin-ref"> · sin referencia</span>
                    </span>
                  </router-link>
                </li>
              </ul>
              <router-link to="/admin" class="notif-todo" @click="notifAbierto = false">
                Ver todos en el tablero<span v-if="pendientes.length > 8"> ({{ pendientes.length }})</span>
              </router-link>
            </div>
          </div>
        </Teleport>
      </div>

      <span class="user-name">{{ admin?.nombre }}</span>
      <span class="user-rol">{{ admin?.rol }}</span>
      <button type="button" class="btn-logout" @click="salir">Cerrar sesión</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ArrowBack from '@/components/ArrowBack.vue';
import { sessionAdmin, cerrarSesionAdmin } from '@/utils/sessionAdmin';
import { useSolicitudesPago } from '@/composables/useSolicitudesPago';
import { PLAN_LABEL } from '@/composables/useAdminTiendas';

withDefaults(defineProps<{ titulo?: string; volver?: string }>(), { titulo: 'Panel de administración' });

const router = useRouter();
const admin = computed(() => sessionAdmin.value);

/* Campana: avisos "Ya pagué" que faltan por confirmar */
const { solicitudes: pendientes } = useSolicitudesPago({ soloPendientes: true });
const notifAbierto = ref(false);
function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function salir() {
  cerrarSesionAdmin();
  router.replace('/admin/login');
}
</script>

<style scoped>
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(160deg, #1f2937, #111827 70%);
  border-bottom: 3px solid #10b981;
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.admin-emblem {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #34d399, #059669);
  color: #052e16;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.admin-emblem svg {
  width: 24px;
  height: 24px;
}
.btn-back {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.brand-title {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-sub {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.75;
}
.nav {
  display: flex;
  gap: 6px;
}
.nav-link {
  padding: 8px 14px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}
.nav-link:hover {
  background: rgba(255, 255, 255, 0.08);
}
.nav-link.active {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}
.user-name {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Notificaciones */
.notif {
  position: relative;
}
.notif-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.notif-btn svg {
  width: 22px;
  height: 22px;
}
.notif-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.notif-btn.activo {
  border-color: #f59e0b;
  color: #fbbf24;
}
.notif-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: #d9534f;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #111827;
  box-sizing: border-box;
}
/* Overlay del panel (teleportado a <body>). En móvil, centrado con fondo oscuro;
   en escritorio, arriba a la derecha como desplegable, sin fondo. */
.notif-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
}
.notif-panel {
  width: 100%;
  max-width: 360px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  color: var(--text);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  padding: 10px 0 6px;
}
@media (min-width: 721px) {
  .notif-overlay {
    background: transparent;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 66px 18px 0; /* debajo del topbar, alineado a la campana */
  }
  .notif-panel {
    max-width: 340px;
    max-height: 70vh;
  }
}
.notif-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 14px 8px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.95rem;
}
.notif-cerrar {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 4px 6px;
}
.notif-vacio {
  margin: 0;
  padding: 14px;
  color: var(--text-muted);
  font-size: 0.88rem;
  text-align: center;
}
.notif-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 auto;
  overflow-y: auto;
}
.notif-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  text-decoration: none;
  color: inherit;
  border-left: 3px solid #f59e0b;
}
.notif-item:hover {
  background: #fffbeb;
}
.notif-nombre {
  font-weight: 700;
  font-size: 0.9rem;
}
.notif-meta {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.sin-ref {
  color: #b91c1c;
}
.notif-todo {
  display: block;
  padding: 10px 14px 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #047857;
  text-decoration: none;
  border-top: 1px solid #f3f4f6;
}
.user-rol {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.5);
  color: #6ee7b7;
}
.btn-logout {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-logout:hover {
  background: rgba(255, 255, 255, 0.1);
}
@media (max-width: 720px) {
  .admin-topbar {
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
  }
  .nav {
    order: 3;
    width: 100%;
    /* Barra deslizable de lado: caben las 5 secciones (la última es "Cuentas") */
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox: sin barra visible */
    scroll-snap-type: x proximity;
  }
  .nav::-webkit-scrollbar {
    display: none; /* Chrome/Safari: sin barra visible */
  }
  .nav-link {
    flex: 0 0 auto; /* no se encogen: se conserva su ancho y se desliza */
    white-space: nowrap;
    scroll-snap-align: start;
  }
  .brand-sub,
  .user-rol,
  .user-name {
    display: none;
  }
}
</style>
