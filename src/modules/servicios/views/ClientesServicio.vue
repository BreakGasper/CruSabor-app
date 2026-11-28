<template>
  <div class="pantalla">
    <PageHeader title="Clientes" :fallback="`/store/panel/${tiendaId}`" />

    <main v-if="!esDueno" class="contenido" data-testid="no-es-dueno">
      <p class="vacio">Inicia sesión como esta tienda para ver sus clientes.</p>
      <button type="button" class="btn pri" @click="router.push('/store/login')">Iniciar sesión</button>
    </main>

    <main v-else class="contenido">
      <p class="ayuda">Las personas que han agendado una cita o pedido una cotización contigo. Tus notas son privadas.</p>
      <input v-if="clientes.length" v-model="busqueda" type="search" placeholder="Buscar por nombre o teléfono" aria-label="Buscar clientes" data-testid="buscar-cliente" />

      <p v-if="cargando" class="vacio">Cargando…</p>
      <p v-else-if="!clientes.length" class="vacio" data-testid="sin-clientes">Todavía no tienes clientes. Aparecerán aquí cuando alguien agende o cotice.</p>
      <p v-else-if="!visibles.length" class="vacio">Nadie coincide con esa búsqueda.</p>

      <ul v-else class="lista">
        <li v-for="c in visibles" :key="c.clienteId" class="cliente" :data-cliente="c.clienteId">
          <header class="cab">
            <div class="quien"><strong>{{ c.nombre || 'Cliente' }}</strong><a v-if="c.telefono" :href="`tel:${c.telefono}`">📞 {{ c.telefono }}</a></div>
            <div class="cuentas"><span>🗓️ {{ c.citas }}</span><span>💬 {{ c.cotizaciones }}</span></div>
          </header>
          <small class="ultima">Última actividad: {{ fechaHoraCorta(c.ultimaActividad) }}</small>
          <textarea :value="c.notas" rows="2" maxlength="500" placeholder="Notas privadas (preferencias, alergias…)" aria-label="Notas" data-testid="nota" @blur="guardarNota(c, ($event.target as HTMLTextAreaElement).value)"></textarea>
          <a v-if="enlace(c)" :href="enlace(c)" target="_blank" rel="noopener" class="btn wa" data-testid="whatsapp">WhatsApp</a>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { numeroParaWhatsapp } from '@/utils/whatsappCliente';
import { guardarNotaCliente, useClientesServicio } from '../clientes';
import { fechaHoraCorta } from '../formato';
import { esDuenoDeTienda } from '../sesion';
import type { ClienteServicio } from '../tipos';

const route = useRoute();
const router = useRouter();
const tiendaId = computed(() => String(route.params.id ?? ''));
const esDueno = computed(() => esDuenoDeTienda(tiendaId.value));
const { clientes, cargando } = useClientesServicio(() => (esDueno.value ? tiendaId.value : undefined));

const busqueda = ref('');
const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const visibles = computed(() => {
  const q = sinAcentos(busqueda.value.trim());
  return q ? clientes.value.filter((c) => sinAcentos(`${c.nombre} ${c.telefono}`).includes(q)) : clientes.value;
});

const enlace = (c: ClienteServicio) => {
  const n = numeroParaWhatsapp(c.telefono);
  return n ? `https://wa.me/${n}` : '';
};

async function guardarNota(c: ClienteServicio, valor: string) {
  if (valor.trim() === (c.notas ?? '').trim()) return; // sin cambios
  await guardarNotaCliente(tiendaId.value, c.clienteId, valor);
}
</script>

<style scoped>
.pantalla { min-height: 100vh; background: var(--bg-page); }
.contenido { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; text-align: left; color: var(--text); display: flex; flex-direction: column; gap: 12px; }
.ayuda { margin: 0; color: var(--text-muted); font-size: 0.88rem; }
.vacio { color: var(--text-muted); line-height: 1.5; margin: 6px 0; }
input[type='search'], textarea { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-size: 16px; }
.lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cliente { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
.cab { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.quien { display: flex; flex-direction: column; gap: 2px; }
.quien a { color: var(--brand-blue-text); font-size: 0.85rem; text-decoration: none; }
.cuentas { display: flex; gap: 10px; font-weight: 700; font-size: 0.9rem; }
.ultima { color: var(--text-muted); }
.btn { align-self: flex-start; padding: 8px 14px; border-radius: 10px; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.btn.pri { border-color: transparent; background: var(--color-bg-blue-ligth); color: var(--on-primary); }
.btn.wa { border-color: transparent; background: var(--ok-fondo); color: var(--ok-texto); }
</style>
