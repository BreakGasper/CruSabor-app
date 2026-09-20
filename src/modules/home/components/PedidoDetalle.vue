<template>
  <div class="pedido-detalle-container">
    <!-- Header -->
    <PageHeader title="Detalle del Pedido" fallback="/pedidos" />

    <div v-if="pedido" class="pedido-detalle-content">
      <!-- Datos del pedido -->
      <div class="pedido-info-card">
        <div class="info-left">
          <p style="font-size: 12px; margin-left: 5px">
            <strong>ID:</strong> {{ pedido.id_pedido }}
          </p>
          <p class="fecha">📅 {{ formatDate(pedido.fecha_hora) }}</p>
          <p>
            <span :class="['badge', getEstatusClass(pedido.estatus)]">
              {{ ESTATUS_LABEL[pedido.estatus] || pedido.estatus }}
            </span>
          </p>
          <p class="metodo-pago">
            <img
              loading="lazy"
              v-if="pedido.metodo_pago === 'Efectivo'"
              src="@/assets/icons/money.png"
              alt="Efectivo"
              class="metodo-icon"
            />
            <img
              loading="lazy"
              v-else-if="pedido.metodo_pago === 'Tarjeta'"
              src="@/assets/icons/trasfer.png"
              alt="Tarjeta"
              class="metodo-icon"
            />
            {{ pedido.metodo_pago }}
          </p>
        </div>
        <!-- El total sigue al pedido: lo que falta por llegar mientras haya algo
             en proceso, y lo realmente entregado una vez cerrado -->
        <div class="info-right">
          <p class="total-label">{{ etiquetaTotal }}</p>
          <p class="total-amount">${{ totalMostrado.toFixed(2) }}</p>
        </div>
      </div>

      <!-- Seguimiento -->
      <div class="seguimiento-card">
        <h3>Seguimiento</h3>

        <div v-if="pedido.estatus !== 'Cancelado'" class="steps">
          <div
            v-for="(paso, i) in PASOS"
            :key="paso"
            class="step"
            :class="{ done: i <= pasoActual, current: i === pasoActual }"
          >
            <span class="step-dot">{{ i < pasoActual ? '✓' : i + 1 }}</span>
            <span class="step-label">{{ ESTATUS_LABEL[paso] }}</span>
          </div>
        </div>
        <p v-else class="cancelado-msg">
          ✖ Pedido cancelado
          <span v-if="motivoDe()" class="motivo">· {{ motivoDe() }}</span>
        </p>

        <p v-if="pedido.estatus === 'Atendiendo'" class="atendiendo-msg">
          👨‍🍳 La tienda ya está atendiendo tu pedido{{ tieneArticulosPorPedido(pedido) ? ': tus artículos bajo pedido se están elaborando' : '' }}.
          Te avisaremos cuando vaya en camino.
        </p>

        <!-- Estatus por tienda cuando hay varias -->
        <ul v-if="tiendas.length > 1" class="por-tienda">
          <li v-for="t in tiendas" :key="t">
            <span>{{ nombreTienda(t) }}</span>
            <span :class="['badge', getEstatusClass(estatusDeTienda(pedido, t))]">
              {{ ESTATUS_LABEL[estatusDeTienda(pedido, t)] }}
            </span>
            <em v-if="estatusDeTienda(pedido, t) === 'Cancelado' && motivoDe(t)" class="motivo-tienda">{{ motivoDe(t) }}</em>
          </li>
        </ul>
        <!-- Una sola tienda cancelada dentro de un pedido que sigue vivo -->
        <p
          v-else-if="pedido.estatus !== 'Cancelado' && tiendas.length === 1 && estatusDeTienda(pedido, tiendas[0]) === 'Cancelado'"
          class="cancelado-msg"
        >
          ✖ {{ motivoDe(tiendas[0]) }}
        </p>

        <!-- Historial -->
        <details v-if="pedido.historial?.length" class="historial">
          <summary>Ver historial ({{ pedido.historial.length }})</summary>
          <ul>
            <li v-for="(h, i) in [...pedido.historial].reverse()" :key="i">
              <strong>{{ ESTATUS_LABEL[h.estatus] }}</strong>
              <span class="hist-meta">
                {{ h.por === 'cliente' ? 'Tú' : ACTOR_LABEL[h.por] || 'Sistema' }}
                · {{ formatFechaISO(h.fecha) }}
              </span>
              <em v-if="h.nota">{{ h.nota }}</em>
            </li>
          </ul>
        </details>

        <button
          v-if="puedeCancelar"
          class="btn-cancelar"
          :disabled="cancelando"
          @click="cancelar"
        >
          {{ cancelando ? 'Cancelando...' : 'Cancelar pedido' }}
        </button>
        <p v-if="puedeCancelar" class="hint aviso-cancelacion">
          ⏱ {{ MENSAJE_LIMITE_CANCELACION }}
          <span v-if="minutosParaCancelar"> Te quedan {{ minutosParaCancelar }} min.</span>
        </p>
        <p v-else-if="cancelacionVencida" class="hint aviso-cancelacion">
          ⏱ {{ MENSAJE_CANCELACION_VENCIDA }}
        </p>
        <p v-else-if="pedido.estatus === 'Enviado'" class="hint">
          Tu pedido ya va en camino. Para cancelarlo contacta a la tienda.
        </p>
        <p v-else-if="pedido.estatus === 'Atendiendo'" class="hint">
          La tienda ya está preparando tu pedido. Para cancelarlo contacta a la tienda.
        </p>
      </div>

      <!-- Domicilio -->
      <div class="domicilio-card">
        <h3>Domicilio</h3>
        <p>{{ pedido.domicilio.calleNumero }}</p>
        <p>{{ pedido.domicilio.codigoPostal }}, {{ pedido.domicilio.lugar }}</p>
        <p>{{ pedido.domicilio.municipio }}, {{ pedido.domicilio.estado }}</p>
      </div>

      <!-- Items: un bloque por tienda, con su estatus y su total.
           Un pedido puede repartirse entre varias tiendas y cada una avanza a su
           ritmo, así que el cliente necesita ver qué le compró a quién. -->
      <div class="pedido-items">
        <h3>Artículos</h3>

        <section
          v-for="grupo in gruposPorTienda"
          :key="grupo.tiendaId"
          class="grupo-tienda"
        >
          <header class="grupo-header">
            <button
              class="grupo-tienda-nombre"
              type="button"
              :disabled="!grupo.tiendaId"
              :title="grupo.tiendaId ? 'Ver tienda' : ''"
              @click="verTienda(grupo.tiendaId)"
            >
              🏪 {{ grupo.nombre }}
            </button>
            <span :class="['badge', getEstatusClass(grupo.estatus)]">
              {{ ESTATUS_LABEL[grupo.estatus] || grupo.estatus }}
            </span>
          </header>

          <p v-if="grupo.motivo" class="grupo-motivo">✖ {{ grupo.motivo }}</p>

          <div
            v-for="item in grupo.items"
            :key="item.id_articulo + '-' + (item.sku_code || '')"
            class="pedido-item-card"
          >
            <img
              loading="lazy"
              :src="imagenUrl(item.url_image) || defaultImage"
              @error="onImgError"
              class="producto-img"
            />
            <div>
              <p class="nombre">
                {{ item.nombreProducto }}
                <span v-if="item.porPedido" class="tag-bajo-pedido">bajo pedido</span>
              </p>
              <p class="cantidad">Cantidad: {{ item.cantidad }}</p>
              <p class="precio">Precio: ${{ item.precio }}</p>
            </div>
          </div>

          <p class="grupo-total">
            <span>
              {{ grupo.cantidad }} {{ grupo.cantidad === 1 ? "artículo" : "artículos" }}
            </span>
            <strong>${{ grupo.subtotal.toFixed(2) }}</strong>
          </p>
        </section>

        <!-- Con una sola tienda su subtotal ya lo dice todo. Con varias, la suma
             usa la misma regla que el total de arriba para no contradecirlo. -->
        <p v-if="gruposPorTienda.length > 1" class="total-tiendas">
          <span>{{ pedidoCerrado ? "Total entregado" : "Total por llegar" }}</span>
          <strong>${{ totalMostrado.toFixed(2) }}</strong>
        </p>
      </div>
    </div>

    <p v-else>Cargando pedido...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import Swal from "sweetalert2";
import {
  getPedidoById,
  cancelarPedidoCliente,
  tiendasDelPedido,
  estatusDeTienda,
  puedeTransicionar,
  motivoCancelacion,
  textoCancelacion,
  tieneArticulosPorPedido,
  clientePuedeCancelar,
  tiempoRestanteCancelacionCliente,
  MENSAJE_LIMITE_CANCELACION,
  MENSAJE_CANCELACION_VENCIDA,
  ESTATUS_LABEL,
  ACTOR_LABEL,
  type EstatusPedido,
} from "@/composables/usePedidos";
import type { Pedido, PedidoItem } from "@/composables/usePedidos";
import { useTiendas } from "@/composables/useTiendas";
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from "@/constants/firebase_util";
import PageHeader from "@/components/PageHeader.vue";
import userDefaultImage from "@/assets/icons/user_back_profile.png";
import moneyIcon from "@/assets/icons/money.png";
import cardIcon from "@/assets/icons/trasfer.png";

const route = useRoute();
const router = useRouter();
const pedido = ref<Pedido | null>(null);
const defaultImage = userDefaultImage;

const PASOS: EstatusPedido[] = ["Preparacion", "Atendiendo", "Enviado", "Entregado"];
const pasoActual = computed(() =>
  pedido.value ? Math.max(0, PASOS.indexOf(pedido.value.estatus)) : 0
);

/** Motivo de cancelación, del pedido completo o de la parte de una tienda, en palabras para el cliente */
const motivoDe = (tiendaId?: string) =>
  pedido.value ? textoCancelacion(motivoCancelacion(pedido.value, tiendaId), "cliente") : null;

const tiendas = computed(() => (pedido.value ? tiendasDelPedido(pedido.value) : []));
const nombresTienda = ref<Record<string, string>>({});
const { obtenerTienda } = useTiendas();
const nombreTienda = (id: string) => nombresTienda.value[id] || "Tienda";

interface GrupoPedido {
  tiendaId: string;
  nombre: string;
  estatus: EstatusPedido;
  motivo: string | null;
  items: PedidoItem[];
  cantidad: number;
  subtotal: number;
}

/**
 * Artículos del pedido agrupados por tienda, cada uno con su estatus y su total.
 *
 * Un pedido puede repartirse entre varias tiendas y cada una avanza por su
 * cuenta (`estatusPorTienda`), así que una lista plana con un solo total no
 * dejaba ver qué se le compró a quién ni cuánto le toca a cada una.
 *
 * El nombre sale del mapa vivo y, si no llegó, del que quedó guardado en el
 * pedido (`item.nombreTienda`): un pedido es un registro y conserva el nombre
 * que la tienda tenía ese día.
 */
const gruposPorTienda = computed<GrupoPedido[]>(() => {
  const p = pedido.value;
  if (!p) return [];
  const grupos = new Map<string, GrupoPedido>();
  for (const item of p.items || []) {
    const id = String(item.proveedor || "");
    if (!grupos.has(id)) {
      const estatus = id ? estatusDeTienda(p, id) : p.estatus;
      grupos.set(id, {
        tiendaId: id,
        nombre: nombresTienda.value[id] || item.nombreTienda || (id ? "Tienda" : "Sin tienda"),
        estatus,
        motivo: estatus === "Cancelado" ? motivoDe(id || undefined) : null,
        items: [],
        cantidad: 0,
        subtotal: 0,
      });
    }
    const g = grupos.get(id)!;
    g.items.push(item);
    g.cantidad += item.cantidad;
    g.subtotal += item.precio * item.cantidad;
  }
  return [...grupos.values()];
});

/**
 * El total sigue al pedido, no se queda en lo que se pidió el primer día.
 *
 * `total_compra` es lo que se pidió al principio; si una tienda cancela su parte
 * o ya entregó, ese número deja de decir la verdad. Aquí se muestra:
 *
 *  - Pedido **abierto** (alguna tienda todavía en proceso): lo que falta por
 *    llegar. Lo ya entregado y lo cancelado no se suman.
 *  - Pedido **cerrado** (ninguna en proceso: todo entregado o cancelado): lo
 *    que realmente se entregó.
 *
 * Todo sale de los mismos grupos, así que el total nunca contradice a los
 * subtotales de cada tienda.
 */
const ESTATUS_EN_PROCESO: EstatusPedido[] = ["Preparacion", "Atendiendo", "Enviado"];

const suma = (grupos: GrupoPedido[]) => grupos.reduce((acc, g) => acc + g.subtotal, 0);

/** Tiendas que aún deben algo: ni entregaron ni cancelaron */
const gruposEnProceso = computed(() =>
  gruposPorTienda.value.filter((g) => ESTATUS_EN_PROCESO.includes(g.estatus)),
);
const gruposEntregados = computed(() =>
  gruposPorTienda.value.filter((g) => g.estatus === "Entregado"),
);

/** Ya no queda nada en proceso: el pedido se cerró */
const pedidoCerrado = computed(
  () => gruposPorTienda.value.length > 0 && gruposEnProceso.value.length === 0,
);

const totalMostrado = computed(() =>
  pedidoCerrado.value ? suma(gruposEntregados.value) : suma(gruposEnProceso.value),
);
const etiquetaTotal = computed(() => (pedidoCerrado.value ? "TOTAL ENTREGADO" : "POR LLEGAR"));

const verTienda = (tiendaId: string) => {
  if (tiendaId) router.push(`/store/profile/${tiendaId}`);
};

/**
 * El reloj avanza solo: la ventana para cancelar dura pocos minutos y el botón
 * debe desaparecer aunque la pantalla lleve rato abierta.
 */
const ahora = ref(new Date());
let reloj: ReturnType<typeof setInterval> | undefined;
onMounted(() => { reloj = setInterval(() => (ahora.value = new Date()), 10_000); });
onUnmounted(() => clearInterval(reloj));

/** Ninguna tienda empezó a atender: lo único que faltaría es que no se venza el tiempo */
const nadieAtendioAun = computed(() => {
  const p = pedido.value;
  if (!p) return false;
  return (
    puedeTransicionar(p.estatus, "Cancelado", "cliente") &&
    tiendas.value.every((t) => puedeTransicionar(estatusDeTienda(p, t), "Cancelado", "cliente"))
  );
});

const puedeCancelar = computed(() =>
  pedido.value ? clientePuedeCancelar(pedido.value, ahora.value) : false,
);

/** Se acabaron los minutos, pero la tienda todavía no lo atiende: toca llamarle */
const cancelacionVencida = computed(() => nadieAtendioAun.value && !puedeCancelar.value);

/** Minutos que quedan para poder cancelar (null si la regla no aplica) */
const minutosParaCancelar = computed(() => {
  const p = pedido.value;
  if (!p || !puedeCancelar.value) return null;
  const ms = tiempoRestanteCancelacionCliente(p, ahora.value);
  return ms === null ? null : Math.max(1, Math.ceil(ms / 60_000));
});

const cancelando = ref(false);
async function cancelar() {
  if (!pedido.value) return;
  const { isConfirmed, value } = await Swal.fire({
    title: "¿Cancelar tu pedido?",
    text: "Los artículos volverán a estar disponibles en la tienda.",
    input: "text",
    inputPlaceholder: "Motivo (opcional)",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, cancelar",
    cancelButtonText: "Volver",
    confirmButtonColor: "#e74c3c",
  });
  if (!isConfirmed) return;
  cancelando.value = true;
  try {
    pedido.value = await cancelarPedidoCliente(pedido.value, value || undefined);
    Swal.fire({ icon: "success", title: "Pedido cancelado", timer: 1800, showConfirmButton: false });
  } catch (e: any) {
    Swal.fire({ icon: "error", title: "No se pudo cancelar", text: e?.message || String(e) });
  } finally {
    cancelando.value = false;
  }
}

function formatFechaISO(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

onMounted(async () => {
  const idPedido = route.params.id as string;
  pedido.value = await getPedidoById(idPedido);
  for (const t of tiendas.value) {
    obtenerTienda(t).then((tienda) => {
      if (tienda) nombresTienda.value[t] = tienda.nombreTienda;
    });
  }
});

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const parts = dateStr.split(",");
  return parts[0].trim();
}

function getEstatusClass(estatus: string) {
  switch (estatus.toLowerCase()) {
    case "preparacion":
      return "estatus-preparacion";
    case "atendiendo":
      return "estatus-atendiendo";
    case "enviado":
      return "estatus-enviado";
    case "entregado":
      return "estatus-entregado";
    case "cancelado":
      return "estatus-cancelado";
    default:
      return "";
  }
}

/** Si la imagen no carga, se muestra la imagen por defecto */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultImage;
}
</script>

<style scoped>
.pedido-detalle-container {
  width: 95%;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.header-bar {
  display: flex;
  align-items: center;
  background: var(--color-bg-blue-dark);
  color: white;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  margin-bottom: 1.2rem;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.back-button {
  width: 28px;
  height: 28px;
  cursor: pointer;
  margin-right: 0.5rem;
}

.pedido-info-card {
  display: flex;
  justify-content: space-between; /* mantiene el total a la derecha */
  align-items: center; /* centra verticalmente todo el contenido */
  background: var(--surface);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.info-left {
  display: flex;
  flex-direction: column;
  justify-content: center; /* centra verticalmente las líneas */
  gap: 0.3rem;
}

.info-left p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: var(--text);
  display: flex; /* para que iconos y texto estén alineados */
  align-items: center; /* centra verticalmente icono y texto */
  gap: 0.4rem;
}

.info-right {
  text-align: center;
  background: #f0f4ff;
  padding: 0.7rem 1.2rem;
  border-radius: 10px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center; /* <-- centra verticalmente */
  align-items: center;
}

.fecha {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.metodo-pago {
  display: flex;
  align-items: center;
  gap: 0.4rem; /* separación entre icono y texto */
  margin: 0.25rem 0;
}

.metodo-icon {
  width: 20px;
  height: 20px;
}

.total-label {
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 0.2rem;
}

.total-amount {
  font-size: 1.3rem;
  font-weight: bold;
  color: #1a73e8;
}

/* Estilos de estatus */
.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: capitalize;
}

.estatus-preparacion {
  background: #e3f2fd;
  color: var(--brand-blue-text);
}

.estatus-atendiendo {
  background: #e0e7ff;
  color: #3730a3;
}

.estatus-enviado {
  background: #fff4e5;
  color: #b9770e;
}

.atendiendo-msg {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.85rem;
  line-height: 1.4;
}

.cancelado-msg .motivo,
.motivo-tienda {
  display: block;
  margin-top: 4px;
  font-size: 0.8rem;
  font-weight: normal;
  color: #9b1c1c;
}

.tag-bajo-pedido {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.65rem;
  font-weight: 600;
  vertical-align: middle;
}

.estatus-entregado {
  background: #e8f5e9;
  color: #2e7d32;
}

.estatus-cancelado {
  background: #ffebee;
  color: #c62828;
}

/* Seguimiento */
.seguimiento-card {
  background: var(--surface);
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}
.seguimiento-card h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--brand-navy-text);
}
.steps {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  margin: 0.5rem 0 1rem;
}
.steps::before {
  content: "";
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: #e3e8ef;
  z-index: 0;
}
.step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  text-align: center;
}
.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid #cfd6df;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}
.step.done .step-dot {
  background: var(--color-bg-blue-ligth);
  border-color: var(--color-bg-blue-ligth);
  color: #fff;
}
.step.current .step-dot {
  box-shadow: 0 0 0 4px rgba(1, 101, 216, 0.18);
}
.step-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.step.done .step-label {
  color: var(--text);
  font-weight: 600;
}
.cancelado-msg {
  color: #c62828;
  font-weight: 600;
  margin: 0.25rem 0 0.75rem;
}
.por-tienda {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}
.por-tienda li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--surface-2);
  padding: 6px 10px;
  border-radius: 8px;
}
.historial {
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.historial summary {
  cursor: pointer;
  color: var(--brand-blue-text);
  font-weight: 600;
}
.historial ul {
  list-style: none;
  padding: 0.5rem 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.historial li {
  display: flex;
  flex-direction: column;
  padding-left: 10px;
  border-left: 2px solid var(--border);
}
.hist-meta {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.historial em {
  color: var(--text-muted);
}
.btn-cancelar {
  width: 100%;
  padding: 0.7rem;
  border: 2px solid #e74c3c;
  border-radius: 10px;
  background: var(--surface);
  color: #e74c3c;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancelar:hover:not(:disabled) {
  background: #e74c3c;
  color: #fff;
}
.btn-cancelar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.domicilio-card {
  background: var(--surface-2);
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.domicilio-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--brand-navy-text);
}

.pedido-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ---------- Un bloque por tienda ---------- */
.grupo-tienda {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-2);
}
.grupo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.grupo-tienda-nombre {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--brand-blue-text);
  text-align: left;
  cursor: pointer;
}
.grupo-tienda-nombre:disabled {
  color: var(--text);
  cursor: default;
}
.grupo-motivo {
  margin: 0;
  font-size: 0.85rem;
  color: #c62828;
}
/* Total de la tienda: separado de sus artículos por una línea */
.grupo-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border);
  font-size: 0.9rem;
  color: var(--text-muted);
}
.grupo-total strong {
  font-size: 1rem;
  color: var(--text);
}
/* Suma de todas las tiendas; solo aparece cuando hay más de una */
.total-tiendas {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.25rem 0 0;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  font-size: 0.95rem;
}
.total-tiendas strong {
  font-size: 1.1rem;
  color: var(--brand-navy-text);
}

.pedido-item-card {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.pedido-item-card:hover {
  transform: translateY(-3px);
}

.producto-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 8px;
}

.nombre {
  font-weight: bold;
  margin: 0;
}
.cantidad,
.precio {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* Aviso de la ventana para cancelar, junto al botón */
.aviso-cancelacion {
  margin-top: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.35;
}
</style>
