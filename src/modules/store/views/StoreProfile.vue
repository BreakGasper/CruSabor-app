<template>
  <div class="store-detail-container" v-if="store">
    <div class="store-card">
      <!-- Banner / Galería principal -->
      <div class="store-banner">
        <div class="back-btn" v-if="!esDuenoTienda">
          <arrow-back @click="$router.back()" />
        </div>
        <button
          v-if="!esDuenoTienda"
          class="fav-store-btn"
          :class="{ active: esFavorita(store.tiendaId) }"
          :title="esFavorita(store.tiendaId) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
          @click="toggleFavorita(store)"
        >
          <FontAwesomeIcon :icon="esFavorita(store.tiendaId) ? ['fas', 'heart'] : ['far', 'heart']" />
        </button>
        <div v-if="store.bannerUrl" class="banner-carousel">
          <img :src="store.bannerUrl" class="banner-img" alt="Gallery" />
        </div>
        <img v-else :src="placeholderImg" alt="Banner" class="banner-img" />
      </div>

      <!-- Logo y Nombre -->
      <div class="store-header">
        <img
          :src="store.logoUrl || placeholderLogo"
          alt="Logo"
          class="store-logo"
        />
        <h1 class="store-name">{{ store.nombreTienda }}</h1>
        <p class="store-category">{{ store.categoria }}</p>
        <button v-if="esDuenoTienda" class="btn-editar-tienda" @click="abrirEdicion">
          ✏️ Editar mi tienda
        </button>
      </div>

      <!-- Estado de la tienda (solo lo ve la dueña o dueño), debajo del logo -->
      <div
        v-if="esDuenoTienda && avisoEstado"
        class="aviso-estado"
        :class="'aviso-' + avisoEstado.tipo"
        role="status"
      >
        <strong>{{ avisoEstado.titulo }}</strong>
        <span>{{ avisoEstado.detalle }}</span>
        <span v-if="avisoEstado.tipo !== 'info' && contactoSoporte" class="aviso-contacto">
          Contacto: {{ contactoSoporte }}
        </span>
        <p v-if="solicitudPendiente" class="aviso-solicitud">
          ✅ Avisaste tu pago el {{ fechaCorta(solicitudPendiente.fecha) }}<span v-if="solicitudPendiente.referencia"> (ref. {{ solicitudPendiente.referencia }})</span>.
          El administrador lo está revisando; tu membresía se activará al confirmarlo.
        </p>
        <div v-else-if="pagoEnLineaDisponible && !membresiaVigente(store)" class="aviso-acciones">
          <button type="button" class="btn-pagar-membresia" :disabled="iniciandoPago" @click="pagarMembresia">
            {{ iniciandoPago ? 'Abriendo Mercado Pago...' : '💳 Pagar membresía' }}
          </button>
          <button type="button" class="btn-ya-pague" @click="avisarPago()">Ya pagué</button>
        </div>
      </div>
      <!-- Sección: Otros datos -->
      <div class="card-section">
        <div v-if="store.descripcion" class="info-row vertical">
          <strong>Descripción</strong><br />
          <span>{{ store.descripcion }}</span>
        </div>
        <div v-if="store.faq" class="info-row vertical">
          <strong>FAQ:</strong> <span>{{ store.faq }}</span>
        </div>
        <div v-if="store.certificaciones" class="info-row vertical">
          <strong>Certificaciones:</strong>
          <span>{{ store.certificaciones }}</span>
        </div>
        <div v-if="store.blog" class="info-row vertical">
          <strong>Blog</strong> <br />
          <span v-html="linkifyShort(store.blog)"></span>
        </div>
      </div>

      <!-- Sección: Datos de la empresa -->
      <div class="card-section">
        <h2>Datos de la empresa</h2>
        <div class="info-row telefono-row">
          <!-- Icono WhatsApp al lado del teléfono -->
          <a
            v-if="store.incluyeWhatsapp"
            :href="`https://wa.me/${store.telefono}`"
            target="_blank"
            class="whatsapp-icon"
          >
            <img src="@/assets/icons/whatsapp.png" alt="WhatsApp" />
          </a>
          <strong> {{ store.telefono }} </strong>
        </div>

        <div v-if="store.email" class="info-row email-row">
          <!-- Icono Email al lado -->
          <a class="email-icon" target="_blank">
            <img src="@/assets/icons/email.png" alt="Email" />
          </a>

          <strong>{{ store.email }}</strong>
        </div>

        <div class="info-row">
          <span
            ><strong>Calle: </strong>{{ store.calle }} <strong>#</strong
            >{{ store.numero }}</span
          >

          <span><strong>C.P: </strong>{{ store.cp }}</span>
        </div>

        <div class="info-row">
          <!-- Icono Email al lado -->
          <a @click="abrirMaps" class="email-icon" target="_blank">
            <img src="@/assets/icons/location.png" alt="street" />
          </a>
          {{ store.colonia }}, {{ store.municipio }}, {{ store.estado }}.
        </div>

        <!-- Redes Sociales dentro de Datos de la empresa -->
        <div
          v-if="store.facebook || store.instagram || store.incluyeWhatsapp"
          class="info-row social-row"
        >
          <strong>Redes Sociales:</strong>
          <div class="menu-icons">
            <div v-if="store.facebook" class="icon-with-label">
              <a target="_blank">
                <img src="@/assets/icons/facebook.png" alt="Facebook" />
              </a>
              <span>{{ store.facebook }}</span>
            </div>

            <div v-if="store.instagram" class="icon-with-label">
              <a target="_blank">
                <img src="@/assets/icons/instagram.png" alt="Instagram" />
              </a>
              <span>{{ store.instagram }}</span>
            </div>
          </div>
        </div>
        <!-- Sección: Métodos de pago -->
        <div
          class="info-row social-row"
          v-if="store.metodosPago && store.metodosPago.length"
        >
          <hr class="divider" />
          <strong>Métodos de pago</strong>
          <div class="payments">
            <div
              v-for="(mp, i) in store.metodosPago"
              :key="i"
              class="payment-item"
            >
              <img
                v-if="paymentIcons[mp]"
                :src="paymentIcons[mp]"
                :alt="mp"
                class="payment-icon"
              />
              {{ mp }}
            </div>
          </div>
        </div>

        <!-- Sección: Envíos a domicilio -->
        <div
          class="info-row social-row"
          v-if="
            store.envioDomicilio &&
            store.zonasEntrega &&
            store.zonasEntrega.length
          "
        >
          <hr class="divider" />
          <p><strong>Zonas de entrega:</strong></p>
          <ul class="zona-list">
            <li
              v-for="(zona, i) in store.zonasEntrega"
              :key="i"
              class="zona-item"
            >
              {{ zona }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Sección: Horario -->
      <div class="card-section horario-section">
        <h2>Horario de atención</h2>
        <div class="horario-grid">
          <div v-for="dia in diasSemana" :key="dia" class="horario-item">
            <div class="dia">{{ dia }}</div>
            <div
              class="hora"
              :class="{
                cerrado:
                  !store.horario ||
                  !store.horario[dia] ||
                  !store.horario[dia].inicio,
              }"
            >
              {{
                store.horario &&
                store.horario[dia] &&
                store.horario[dia].inicio &&
                store.horario[dia].fin
                  ? `${formato12h(store.horario[dia].inicio)} - ${formato12h(
                      store.horario[dia].fin,
                    )}`
                  : 'Cerrado'
              }}
            </div>
          </div>
        </div>
      </div>
      <!-- Sección: Galería -->
      <div
        class="card-section"
        v-if="store.galleryUrls && store.galleryUrls.length"
      >
        <h2>Galería</h2>
        <div class="gallery-grid">
          <img
            v-for="(img, i) in store.galleryUrls"
            :key="i"
            :src="img"
            alt="Galería"
          />
        </div>
      </div>

      <!-- Sección: Productos de la tienda -->
      <div class="card-section productos-section">
        <div class="productos-head">
          <h2>Productos</h2>
          <button
            v-if="articulosTienda.length > productosVisibles"
            class="link-btn"
            @click="irAArticulos"
          >
            Ver todos ({{ articulosTienda.length }})
          </button>
        </div>
        <p v-if="store.productos" class="productos-desc">
          {{ store.productos }}
        </p>
        <p v-if="!esDuenoTienda && tiendaNoDisponible" class="aviso-envio">
          🚫 Esta tienda no está disponible por el momento: sus productos no se pueden agregar al carrito.
        </p>
        <p v-else-if="!esDuenoTienda && !store.envioDomicilio" class="aviso-envio">
          🚫 Esta tienda no hace envíos a domicilio: sus productos no se pueden agregar al carrito.
        </p>

        <p v-if="!esDuenoTienda && tiendaNoDisponible" class="productos-empty">
          Los productos de esta tienda no están disponibles por el momento.
        </p>
        <p v-else-if="cargandoArticulos" class="productos-empty">
          Cargando productos...
        </p>
        <p v-else-if="articulosTienda.length === 0" class="productos-empty">
          Esta tienda aún no ha publicado productos.
        </p>

        <div v-else class="productos-grid">
          <div
            v-for="p in articulosTienda.slice(0, productosVisibles)"
            :key="p.articuloId"
            class="producto-mini"
            @click="irADetalleProducto(p)"
          >
            <img
              loading="lazy"
              :src="imagenUrl(p.url) || defaultArticulo"
              :alt="p.nombre"
              class="producto-mini-img"
              @error="onImgError"
            />
            <div class="producto-mini-info">
              <p class="producto-mini-nombre">{{ p.nombre }}</p>
              <p class="producto-mini-precio">${{ p.precio }}</p>
            </div>

            <!-- Carrito: solo clientes (no el dueño) -->
            <div v-if="!esDuenoTienda" class="producto-mini-acciones" @click.stop>
              <button
                v-if="!(cantidadEnCarrito[p.articuloId] > 0)"
                class="mini-add"
                :disabled="sinStock(p) || !store.envioDomicilio"
                :title="!store.envioDomicilio ? 'Esta tienda no envía a domicilio' : sinStock(p) ? 'Sin stock' : 'Agregar al carrito'"
                @click.stop="aumentar(p)"
              >
                <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
                <span>{{ !store.envioDomicilio ? 'Sin envío' : sinStock(p) ? 'Sin stock' : 'Agregar' }}</span>
              </button>
              <div v-else class="mini-contador">
                <button
                  class="mini-btn"
                  :class="cantidadEnCarrito[p.articuloId] > 1 ? 'menos' : 'basura'"
                  @click.stop="disminuir(p)"
                >
                  <FontAwesomeIcon
                    :icon="
                      cantidadEnCarrito[p.articuloId] > 1
                        ? ['fas', 'minus']
                        : ['fas', 'trash-can']
                    "
                  />
                </button>
                <span class="mini-cantidad">{{
                  cantidadEnCarrito[p.articuloId]
                }}</span>
                <button
                  class="mini-btn mas"
                  :disabled="
                    stockDe(p) !== Infinity &&
                    cantidadEnCarrito[p.articuloId] >= stockDe(p)
                  "
                  @click.stop="aumentar(p)"
                >
                  <FontAwesomeIcon :icon="['fas', 'plus']" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Botones principales -->
      <div class="store-actions">
        <button @click="goBack" class="btn-primary">Volver</button>
        <button @click="abrirMaps" class="btn-outline-blue">Cómo llegar</button>
        <button @click="llamar" class="btn-outline-blue">Llamar</button>
        <button @click="irAArticulos" class="btn-outline-blue">
          Ver Lista de Artículos
        </button>
      </div>
    </div>

    <StoreEditModal
      v-if="esDuenoTienda"
      :visible="editando"
      :tienda="store"
      @close="editando = false"
      @saved="onTiendaGuardada"
    />

    <!-- MENÚ FUERA -->
    <!-- MENÚ LATERAL TIPO FLOAT -->
    <div class="side-menu" :class="{ open: menuOpen }">
      <!-- Botón toggle -->
      <div class="menu-toggle" @click="toggleMenu">☰</div>

      <!-- Botones -->
      <div class="menu-items">
        <div class="menu-item-wrapper" v-if="esDuenoTienda">
          <button class="menu-item editar-btn" @click="abrirEdicion">✏️</button>
          <span class="menu-label"> Editar mi tienda</span>
        </div>

        <div class="menu-item-wrapper" v-if="esDuenoTienda">
          <button class="menu-item" @click="onPedidos">🚚</button>
          <span class="menu-label"> Pedidos</span>
        </div>

        <div class="menu-item-wrapper" v-if="esDuenoTienda">
          <button class="menu-item" @click="artsTienda">➕</button>
          <span class="menu-label"> Agregar articulo</span>
        </div>

        <div class="menu-item-wrapper">
          <button class="menu-item" @click="irAArticulos">📋</button>
          <span class="menu-label">Productos</span>
        </div>

        <div class="menu-item-wrapper" v-if="!esDuenoTienda">
          <button class="menu-item cart-menu-item" @click="irAlCarrito">
            🛒
            <span v-if="totalEnCarrito > 0" class="cart-badge">{{
              totalEnCarrito
            }}</span>
          </button>
          <span class="menu-label">Mi carrito</span>
        </div>

        <div class="menu-item-wrapper">
          <button class="menu-item" @click="abrirMaps">📍</button>
          <span class="menu-label">Cómo llegar</span>
        </div>

        <div class="menu-item-wrapper">
          <button class="menu-item" @click="llamar">📞</button>
          <span class="menu-label">Llamar</span>
        </div>

        <div v-if="esDuenoTienda" class="menu-item-wrapper">
          <button class="menu-item danger" @click="closeSesionTienda">
            ⬅️
          </button>
          <span class="menu-label">Cerrar sesión</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTiendas, type Tienda } from '@/composables/useTiendas';
import cashIcon from '@/assets/icons/money.png';
import cardIcon from '@/assets/icons/card.png';
import transferIcon from '@/assets/icons/trasfer.png';
import ArrowBack from '@/components/ArrowBack.vue';
import StoreEditModal from '@/modules/store/components/StoreEditModal.vue';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useArticulos } from '@/composables/useArticulos';
import { useCarritoRapido } from '@/db/composables/useCarritoRapido';
import { useTiendasFavoritas } from '@/db/composables/useTiendasFavoritas';
import { FIREBASE_STORAGE_BASE_URL, imagenUrl } from '@/constants/firebase_util';
import defaultArticulo from '@/assets/icons/default_articulo.png';
import { sessionUsuarioValidation } from '@/utils/sessionUser';
import { avisoEstadoTienda, tiendaPuedeVender, membresiaVigente, MENSAJE_SIN_MEMBRESIA } from '@/composables/useMembresia';
import { useConfiguracion } from '@/composables/useConfiguracion';
import { reportarPago, useSolicitudesPago } from '@/composables/useSolicitudesPago';
import { iniciarPagoMembresia, resultadoPagoDesdeQuery, MENSAJE_RESULTADO_PAGO } from '@/composables/useMercadoPago';
import type { PlanMembresia } from '@/composables/useAdminTiendas';
import type { Producto } from '@/types/Producto';

const router = useRouter();
const route = useRoute();
const { tiendaLogueada, obtenerTienda } = useTiendas();
const store = ref<Tienda | null>(null);

// Productos de la tienda + carrito rápido.
// useArticulos carga todos los artículos; filtramos por tienda para no depender
// de qué suscripción de Firebase responde primero. Se incluyen los de tiendas
// inactivas porque la dueña o dueño debe ver su catálogo aunque no pueda vender.
const { articulos, loading: cargandoArticulos } = useArticulos({ incluirTiendasInactivas: true });

/** Estado de autorización / membresía */
const tiendaNoDisponible = computed(() => !!store.value && !tiendaPuedeVender(store.value));
const avisoEstado = computed(() => avisoEstadoTienda(store.value));
const { configuracion, contactoSoporte, pagoEnLineaDisponible, pagoAutomatico } = useConfiguracion();

/** Pago de membresía con links de Mercado Pago + aviso "Ya pagué" (sin servidor) */
const formatoMXN = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const { solicitudes: solicitudesTienda } = useSolicitudesPago({
  soloPendientes: true,
  tiendaId: () => store.value?.tiendaId,
});
const solicitudPendiente = computed(() => solicitudesTienda.value[0] ?? null);

function fechaCorta(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Planes con link de pago configurado, con su etiqueta y precio */
function planesDisponibles(): Record<string, string> {
  const { linkMensual, linkAnual } = configuracion.value.pagos;
  const { precioMensual, precioAnual } = configuracion.value.membresia;
  const op: Record<string, string> = {};
  if (pagoAutomatico.value) {
    // Modo automático: los planes con precio configurado
    if (precioMensual > 0) op.mensual = `Mensual · ${formatoMXN(precioMensual)}`;
    if (precioAnual > 0) op.anual = `Anual · ${formatoMXN(precioAnual)}`;
    return op;
  }
  if (linkMensual) op.mensual = precioMensual > 0 ? `Mensual · ${formatoMXN(precioMensual)}` : 'Mensual';
  if (linkAnual) op.anual = precioAnual > 0 ? `Anual · ${formatoMXN(precioAnual)}` : 'Anual';
  return op;
}

async function elegirPlan(titulo: string, confirmar: string): Promise<PlanMembresia | null> {
  const opciones = planesDisponibles();
  const planes = Object.keys(opciones) as PlanMembresia[];
  if (!planes.length) return null;
  if (planes.length === 1) return planes[0];
  const r = await Swal.fire({
    title: titulo,
    input: 'radio',
    inputOptions: opciones,
    inputValue: planes[0],
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0165d8',
  });
  return r.isConfirmed && r.value ? (r.value as PlanMembresia) : null;
}

/**
 * Modo automático: el servidor crea el pago en Mercado Pago y redirige a la tienda.
 * Al volver (?pago=exito|pendiente|error) se avisa; la membresía la activa el webhook.
 */
const iniciandoPago = ref(false);
async function pagarAutomatico(plan: PlanMembresia) {
  if (!store.value?.tiendaId || iniciandoPago.value) return;
  iniciandoPago.value = true;
  try {
    const inicio = await iniciarPagoMembresia({ tiendaId: store.value.tiendaId, plan });
    window.location.assign(inicio.url);
  } catch (e: any) {
    iniciandoPago.value = false;
    const r = await Swal.fire({
      icon: 'error',
      title: 'No se pudo iniciar el pago',
      text: `${e?.message || 'Intenta de nuevo en unos minutos.'} Si ya pagaste por otro medio, puedes avisarnos.`,
      showCancelButton: true,
      confirmButtonText: 'Ya pagué',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#0165d8',
    });
    if (r.isConfirmed) await avisarPago(plan);
  }
}

function avisarResultadoPago() {
  const resultado = resultadoPagoDesdeQuery(route.query as Record<string, unknown>);
  if (!resultado) return;
  const m = MENSAJE_RESULTADO_PAGO[resultado];
  Swal.fire({ icon: m.icon, title: m.titulo, text: m.texto, confirmButtonColor: '#0165d8' });
  const { pago: _pago, ...resto } = route.query;
  router.replace({ query: resto });
}

/** Abre el link de pago del plan elegido y luego ofrece avisar (o, en modo automático, redirige a Mercado Pago) */
async function pagarMembresia() {
  if (!store.value?.tiendaId) return;
  const plan = await elegirPlan('Elige tu plan', 'Ir a pagar');
  if (!plan) return;
  if (pagoAutomatico.value) {
    await pagarAutomatico(plan);
    return;
  }
  const link = plan === 'anual' ? configuracion.value.pagos.linkAnual : configuracion.value.pagos.linkMensual;
  const precio = plan === 'anual' ? configuracion.value.membresia.precioAnual : configuracion.value.membresia.precioMensual;
  const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

  // El link se abre con un enlace real dentro del diálogo: así el navegador no lo bloquea
  // como ventana emergente (window.open después de un diálogo suele bloquearse).
  const r = await Swal.fire({
    icon: 'info',
    title: 'Paga tu membresía en Mercado Pago',
    html: `
      <p style="margin:0 0 10px;color:#374151;font-size:0.95rem">
        Plan <strong>${plan === 'anual' ? 'anual' : 'mensual'}</strong>${precio > 0 ? ` · <strong>${escapar(formatoMXN(precio))}</strong>` : ''}
      </p>
      <a href="${escapar(link)}" target="_blank" rel="noopener"
         style="display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#0165d8,#011f41);color:#fff;font-weight:700;text-decoration:none">
        Abrir Mercado Pago
      </a>
      <p style="margin:14px 0 0;color:#5b6472;font-size:0.85rem;line-height:1.4">${escapar(configuracion.value.pagos.instrucciones)}</p>
    `,
    showCancelButton: true,
    confirmButtonText: 'Ya pagué',
    cancelButtonText: 'Después',
    confirmButtonColor: '#0165d8',
  });
  if (r.isConfirmed) await avisarPago(plan);
}

/** La tienda avisa que ya pagó: se crea una solicitud que el administrador atiende */
async function avisarPago(planElegido?: PlanMembresia) {
  if (!store.value?.tiendaId) return;
  const plan = planElegido ?? (await elegirPlan('¿Qué plan pagaste?', 'Continuar'));
  if (!plan) return;
  const r = await Swal.fire({
    title: 'Avisar de mi pago',
    text: 'Escribe el número de operación o referencia de Mercado Pago (opcional) para que el administrador lo ubique.',
    input: 'text',
    inputPlaceholder: 'Ej. 1234567890',
    showCancelButton: true,
    confirmButtonText: 'Enviar aviso',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0165d8',
  });
  if (!r.isConfirmed) return;
  try {
    await reportarPago({
      tiendaId: store.value.tiendaId,
      nombreTienda: store.value.nombreTienda,
      plan,
      referencia: r.value,
    });
    Swal.fire({
      icon: 'success',
      title: 'Aviso enviado',
      text: 'El administrador confirmará tu pago y activará tu membresía. Te avisaremos en tu perfil.',
      confirmButtonColor: '#0165d8',
    });
  } catch (e: any) {
    Swal.fire({ icon: 'error', title: 'No se pudo enviar el aviso', text: e?.message || 'Intenta de nuevo.', confirmButtonColor: '#0165d8' });
  }
}
const articulosTienda = computed<Producto[]>(() =>
  store.value?.tiendaId
    ? articulos.value.filter((a) => a.tiendaId === store.value?.tiendaId)
    : [],
);
const { cantidadEnCarrito, aumentar, disminuir, stockDe, sinStock } =
  useCarritoRapido();
const productosVisibles = 6;
const { esFavorita, toggle: toggleFavorita, sincronizar: sincronizarFavorita } = useTiendasFavoritas();

const totalEnCarrito = computed(() =>
  Object.values(cantidadEnCarrito).reduce((a, b) => a + b, 0),
);

function irAlCarrito() {
  if (sessionUsuarioValidation()) router.push('/cart');
  else router.push('/login');
}

function irADetalleProducto(p: Producto) {
  router.push({
    path: `/producto/${p.articuloId}`,
    query: { fromStore: 'true', storeId: store.value?.tiendaId || '' },
  });
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = defaultArticulo;
}
const menuCollapsed = ref(true);
const tiendaLocal = JSON.parse(localStorage.getItem('tiendas') || '{}');

const placeholderImg = 'https://via.placeholder.com/600x250';
const placeholderLogo = 'https://via.placeholder.com/100';
function formato12h(hora24: string) {
  if (!hora24) return '';
  const [h, m] = hora24.split(':').map(Number);
  const periodo = h >= 12 ? 'PM' : 'AM';
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${m.toString().padStart(2, '0')} ${periodo}`;
}

const diasSemana = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const esDuenoTienda = computed(() => {
  return store.value?.tiendaId === tiendaLocal.id;
});

async function loadStore() {
  const tiendaId = route.params.id as string;
  if (tiendaId) {
    const tienda = await obtenerTienda(tiendaId);
    if (tienda) store.value = tienda;
  } else {
    const stored = localStorage.getItem('tiendas');
    const telefono = stored ? JSON.parse(stored)?.telefono : null;
    if (!telefono) return;

    const tienda = await tiendaLogueada(telefono);
    if (tienda) store.value = tienda;
  }

  // Si el cliente la tiene en favoritos, la copia local se pone al día con los datos reales
  if (store.value) await sincronizarFavorita(store.value);
}

const menuOpen = ref(false);

/* ---------- Edición de la tienda (solo dueño) ---------- */
const editando = ref(false);
function abrirEdicion() {
  menuOpen.value = false;
  editando.value = true;
}
function onTiendaGuardada(cambios: Partial<Tienda>) {
  if (store.value) {
    store.value = { ...store.value, ...cambios };
    sincronizarFavorita(store.value);
  }
  // La sesión guarda algunos datos de la tienda: se mantienen al día
  try {
    const sesion = JSON.parse(localStorage.getItem('tiendas') || '{}');
    if (sesion.id === store.value?.tiendaId) {
      localStorage.setItem(
        'tiendas',
        JSON.stringify({
          ...sesion,
          nombre: cambios.nombreTienda ?? sesion.nombre,
          nombreTienda: cambios.nombreTienda ?? sesion.nombreTienda,
          telefono: cambios.telefono ?? sesion.telefono,
          email: cambios.email ?? sesion.email,
          domicilio: cambios.calle ?? sesion.domicilio,
          colonia: cambios.colonia ?? sesion.colonia,
          municipio: cambios.municipio ?? sesion.municipio,
          codigpostal: cambios.cp ?? sesion.codigpostal,
          estado: cambios.estado ?? sesion.estado,
        }),
      );
    }
  } catch { /* sesión ilegible: se ignora */ }
  editando.value = false;
  Swal.fire({ toast: true, position: 'bottom', timer: 1800, showConfirmButton: false, icon: 'success', title: 'Tienda actualizada' });
}

const paymentIcons: Record<string, string> = {
  Efectivo: cashIcon,
  Tarjeta: cardIcon,
  Transferencia: transferIcon,
};

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function goBack() {
  router.back();
}

function closeSesionTienda() {
  // 🔥 Eliminar sesión
  localStorage.removeItem('tiendas');

  // 🔁 Redirigir al login
  router.push('/store/login');
}

function artsTienda() {
  // Registrar productos exige membresía vigente
  if (store.value && !membresiaVigente(store.value)) {
    Swal.fire({
      icon: 'warning',
      title: 'Activa tu membresía para publicar',
      text: MENSAJE_SIN_MEMBRESIA,
      confirmButtonColor: '#0165d8',
    });
    return;
  }
  const tienda = JSON.parse(localStorage.getItem('tiendas') || '{}');

  router.push({
    name: 'storeProducts',
    params: { id: tienda.id, nombre: tienda.nombreTienda },
  });
}

function onPedidos() {
  const tienda = JSON.parse(localStorage.getItem('tiendas') || '{}');

  router.push({
    name: 'storePedidos',
    params: {
      id_tienda: tienda.id || '', // Asegúrate de pasar el ID correcto
    },
  });
}

function abrirMaps() {
  if (!store.value) return;
  const direccion = encodeURIComponent(
    `${store.value.calle} ${store.value.numero}, ${store.value.colonia}, ${store.value.municipio}, ${store.value.estado}`,
  );
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${direccion}`,
    '_blank',
  );
}
function llamar() {
  if (!store.value) return;
  window.location.href = `tel:${store.value.telefono}`;
}

function irAArticulos() {
  if (!store.value) return;
  router.push({
    name: 'storeArticles', // nombre de la ruta que definiste
    params: { id: store.value.tiendaId }, // id de la tienda
  });
}

function linkifyShort(text: string) {
  if (!text) return '';
  // Regex para URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return text.replace(urlRegex, (url) => {
    // Recortar hasta el dominio principal
    // Busca el primer "/", después del dominio, y corta ahí
    const domainMatch = url.match(/https?:\/\/[^\/]+/);
    const shortUrl = domainMatch ? domainMatch[0] : url;
    return `<a href="${url}" target="_blank" rel="noopener">${shortUrl}</a>`;
  });
}

onMounted(() => {
  loadStore();
  avisarResultadoPago();
});
</script>

<style scoped>
html,
body {
  height: auto;
  min-height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.divider {
  border: none;
  border-bottom: 1px solid #ccc;
  margin: 12px 0; /* espacio arriba y abajo */
  width: 100%;
}

/* Contenedor principal */
.store-detail-container {
  display: flex;
  justify-content: center;
  padding: 30px 20px;
  font-family: 'Poppins', sans-serif;
  background: #f5f7fa;
  min-height: 100vh;
}
.store-card {
  width: 100%;
  max-width: 700px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
  overflow: visible;
  transition: all 0.3s;
}
.store-banner {
  width: 100%;
  height: 250px;
  position: relative;
  max-width: 100%; /* no se desborde */
  overflow: hidden; /* recorta cualquier exceso */
  border-radius: 20px;
  border: #1f70b2 solid 1px;
}
.banner-carousel {
  width: 100%;
  height: 100%;
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.banner-carousel::-webkit-scrollbar {
  display: none;
}
.banner-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 0;
}
.back-btn {
  margin-left: 5px;
  position: absolute;
  top: 12px;
  left: 12px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  z-index: 12;
  cursor: pointer;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 1);
}

.store-header {
  text-align: center;
  margin-top: -60px;
  position: relative;
  z-index: 10;
}
.store-logo {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid #fff;
  object-fit: cover;
  background: #fff;
  position: relative;
  z-index: 11;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.store-name {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 12px 0 5px;
  color: #1f70b2;
}
.store-category {
  font-size: 1rem;
  color: #666;
}

/* Cards */
.card-section {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  margin: 15px 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.card-section h2 {
  font-weight: 600;
  margin-bottom: 10px;
  color: #1f70b2;
}
.info-row {
  display: flex;
  gap: 10px;
  font-size: 0.95rem;
  color: #333;
  margin-bottom: 15px;
}
.info-row.vertical {
  display: block; /* 🔹 coloca los elementos uno debajo del otro */
}
.info-row.whatsapp {
  color: #25d366;
  font-weight: 600;
}

/* Galería */
.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.gallery-grid img {
  width: calc(50% - 5px);
  height: 100px;
  object-fit: cover;
  border-radius: 10px;
}

/* Métodos de pago */
.payments {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  justify-content: center; /* 🔹 centra horizontalmente */
  align-items: center; /* centra verticalmente si hay varias filas */
}
.payment-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #e3f2fd;
  color: #1f70b2;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  justify-content: center; /* 🔹 centra icono y texto dentro de cada item */
}
.payment-icon {
  width: 20px;
  height: 20px;
}

/* Botones */
.store-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 20px;
}
.btn-primary {
  flex: 1;
  background: #1f70b2;
  color: #fff;
  border: none;
  padding: 14px 0;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: 0.3s;
}
.btn-primary:hover {
  background: #105a8b;
}
.btn-outline-blue {
  flex: 1;
  border: 2px solid #1f70b2;
  background: #fff;
  color: #1f70b2;
  padding: 14px 0;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}
.btn-outline-blue:hover {
  background: #1f70b2;
  color: #fff;
}

/* Menú flotante lateral */
.floating-menu {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: white; /*#1f70b2;*/
  border: 1px solid #1f70b2;
  border-radius: 0 10px 10px 0;
  padding: 10px;
  cursor: pointer;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s;
}
.floating-menu.collapsed {
  transform: translate(-80%, -50%);
}
.menu-icon {
  width: 30px;
  height: 30px;
}
.menu-content {
  margin-top: 10px;
  background: #fff;
  padding: 10px;
  border-radius: 10px;
  width: 180px;
  color: #333;
}
.menu-content h3 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #1f70b2;
  text-align: center;
}
.menu-icons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 5px;
}
.menu-icons img {
  width: 25px;
  height: 25px;
  cursor: pointer;
}
.btn-menu {
  width: 100%;
  padding: 6px 0;
  margin-top: 5px;
  background: #e3f2fd;
  border: none;
  border-radius: 5px;
  color: #1f70b2;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.btn-menu:hover {
  background: #bbdefb;
}

/* Animación */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.slide-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Iconos sociales */
/* Redes dentro de Datos de la empresa con nombres */
.social-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.menu-icons {
  display: flex;
  gap: 20px;
  margin-top: 8px;
  justify-content: center;
}

.icon-with-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.icon-with-label img {
  width: 35px;
  height: 35px;
  align-items: center;
  transition: transform 0.2s ease;
}

.icon-with-label img:hover {
  transform: scale(1.1);
}

.icon-with-label span {
  font-size: 0.8rem;
  color: #333;
  margin-top: 5px;
  font-weight: 500;
}

.telefono-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.whatsapp-icon img {
  width: 22px;
  height: 22px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.whatsapp-icon img:hover {
  transform: scale(1.2);
}

.email-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.email-icon img {
  width: 22px;
  height: 22px;
  cursor: pointer;
  transition: transform 0.2s ease;
  object-fit: contain;
}

.email-icon img:hover {
  transform: scale(1.2);
}

.horario-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.horario-item {
  background: #e3f2fd;
  padding: 12px 15px;
  border-radius: 12px;
  display: flex;
  flex-direction: column; /* ✅ vertical: día arriba, hora abajo */
  align-items: center;
  font-size: 0.8rem;
  font-weight: 500;
  color: #1f70b2;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.horario-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
}

.horario-item .dia {
  font-weight: 600;
  margin-bottom: 5px;
}

.horario-item .hora {
  font-weight: 500;
}

.horario-item .hora.cerrado {
  color: #ff4d4f; /* rojo para cerrado */
  font-style: italic;
}

/*Evio a domicilio */

.envio-section {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  margin: 15px 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.zona-list {
  list-style: none;
  padding: 0;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.zona-item {
  background: #eef6fd;
  padding: 6px 12px;
  border-radius: 12px;
  color: #1f70b2;
  font-weight: 500;
  font-size: 0.9rem;
}
.back-btn {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* Contenedor tipo tarjeta flotante */
/* 🔥 Fondo oscuro tipo modal */ /* CONTENEDOR */
.side-menu {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);

  display: flex;
  flex-direction: column;
  align-items: flex-start;

  z-index: 999;
  /* El contenedor no atrapa toques: solo el botón ☰ y los íconos visibles los reciben.
     Sin esto, en móvil tapaba los botones del aviso de membresía que quedan debajo. */
  pointer-events: none;
}

/* BOTÓN PRINCIPAL */
.menu-toggle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #0d1b2a;
  color: white;
  margin-left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 10px;
  pointer-events: auto;
}

/* CONTENEDOR DE BOTONES */
.menu-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-20px);
  transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
}

/* CUANDO ESTÁ ABIERTO */
.side-menu.open .menu-items {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(0);
}

/* BOTONES */
.menu-item {
  width: 50px;
  height: 50px;
  border-radius: 50%;

  border: none;
  background: #f1f1f1;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 18px;
  cursor: pointer;

  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.menu-item:hover {
  transform: scale(1.1);
}

/* BOTÓN ACTIVO (como el azul de tu imagen) */
.menu-item:nth-child(2) {
  background: #0d1b2a;
  color: white;
}

/* BOTÓN PELIGRO */
.menu-item.danger {
  color: red;
}

/* WRAPPER PARA ALINEAR */
.menu-item-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 5px;
}

/* LABEL */
.menu-label {
  background: white;
  padding: 6px 12px;
  border-radius: 10px;

  font-size: 0.85rem;
  font-weight: 500;
  color: #333;

  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s ease;
  white-space: nowrap;
}

/* CUANDO EL MENÚ ESTÁ ABIERTO */
.side-menu.open .menu-label {
  opacity: 1;
  transform: translateX(0);
}


/* Tienda sin envío a domicilio */
.aviso-envio {
  margin: 0 0 0.75rem;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff4e5;
  color: #8a5a00;
  font-size: 0.85rem;
  text-align: center;
}

/* ===== Aviso de estado de la tienda (dueña/o) ===== */
.aviso-estado {
  margin: 14px 16px 0;
  text-align: left;
  padding: 12px 14px;
  border-radius: 12px;
  border-left: 4px solid;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
  line-height: 1.35;
}
.aviso-estado strong {
  font-size: 0.95rem;
}
.aviso-contacto {
  font-size: 0.83rem;
  opacity: 0.9;
}
.aviso-acciones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  position: relative;
  z-index: 1;
}
@media (max-width: 480px) {
  .aviso-acciones {
    flex-direction: column;
  }
  .aviso-acciones button {
    width: 100%;
    padding: 13px 16px;
    font-size: 0.95rem;
  }
}
.aviso-solicitud {
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}
.btn-ya-pague {
  padding: 10px 16px;
  border-radius: 10px;
  border: 2px solid #0165d8;
  background: #fff;
  color: #0165d8;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  font-family: inherit;
}
.btn-pagar-membresia {
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #0165d8, #011f41);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 12px rgba(1, 101, 216, 0.3);
}
.btn-pagar-membresia:hover:not(:disabled) {
  filter: brightness(1.08);
}

.aviso-info {
  background: #eaf2fc;
  border-color: #0165d8;
  color: #0b3d7a;
}
.aviso-warning {
  background: #fff4e5;
  border-color: #f59e0b;
  color: #7a4a00;
}
.aviso-error {
  background: #fdecea;
  border-color: #d9534f;
  color: #8a1f1b;
}

/* ===== Editar tienda ===== */
.btn-editar-tienda {
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #1f70b2;
  background: #fff;
  color: #1f70b2;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-editar-tienda:hover {
  background: #1f70b2;
  color: #fff;
}

/* ===== Favorita ===== */
.fav-store-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: #b5bcc6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 12;
  padding: 0;
  font-size: 1.05rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s, color 0.2s;
}
.fav-store-btn:hover,
.fav-store-btn.active {
  color: #e74c3c;
}
.fav-store-btn:hover {
  transform: scale(1.08);
}

/* ===== Productos de la tienda ===== */
.productos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.productos-head h2 {
  margin-bottom: 0;
}
.link-btn {
  border: none;
  background: transparent;
  color: #1f70b2;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px 0;
}
.link-btn:hover {
  text-decoration: underline;
}
.productos-desc {
  color: #555;
  font-size: 0.9rem;
  margin: 8px 0 0;
}
.productos-empty {
  color: #777;
  text-align: center;
  padding: 1rem 0;
  font-size: 0.9rem;
}
.productos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.producto-mini {
  background: #f7f9fc;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.producto-mini:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}
.producto-mini-img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  background: #fff;
}
.producto-mini-info {
  padding: 8px 10px 4px;
  text-align: left;
}
.producto-mini-nombre {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.producto-mini-precio {
  margin: 2px 0 0;
  color: #e74c3c;
  font-weight: 700;
  font-size: 0.9rem;
}
.producto-mini-acciones {
  padding: 6px 10px 10px;
  margin-top: auto;
}
.mini-add {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border: none;
  border-radius: 10px;
  background: #1f70b2;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}
.mini-add:hover {
  background: #105a8b;
}
.mini-add:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.mini-contador {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 999px;
  padding: 3px;
  border: 1px solid #e3e8ef;
}
.mini-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
}
.mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mini-btn.mas {
  background: #27ae60;
}
.mini-btn.menos {
  background: #1f70b2;
}
.mini-btn.basura {
  background: #e74c3c;
}
.mini-cantidad {
  font-weight: 700;
  color: #333;
  min-width: 22px;
  text-align: center;
}
.cart-menu-item {
  position: relative;
}
.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e74c3c;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* ===== Responsive ===== */
.store-actions {
  flex-wrap: wrap;
}
.store-actions button {
  flex: 1 1 45%;
  min-width: 140px;
}
.info-row {
  flex-wrap: wrap;
  word-break: break-word;
}
@media (min-width: 768px) {
  .horario-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  .gallery-grid img {
    width: calc(33.333% - 7px);
    height: 140px;
  }
}
@media (max-width: 480px) {
  .store-detail-container {
    padding: 12px 8px 90px;
  }
  .store-banner {
    height: 190px;
  }
  .store-logo {
    width: 100px;
    height: 100px;
  }
  .store-header {
    margin-top: -50px;
  }
  .store-name {
    font-size: 1.4rem;
  }
  .card-section {
    margin: 12px 10px;
    padding: 16px;
  }
  .side-menu {
    flex-direction: column-reverse;
    align-items: flex-start;
    top: auto;
    bottom: 16px;
    transform: none;
  }
}
</style>
