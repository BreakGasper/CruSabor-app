<template>
  <Teleport to="body">
    <div v-if="visible" class="vp-overlay" role="dialog" aria-modal="true" aria-label="Vista previa del artículo" @click.self="$emit('cerrar')" @keydown.escape="$emit('cerrar')">
      <div class="vp-telefono">
        <header class="vp-cabeza">
          <span>👁️ Vista previa · así lo verá tu cliente</span>
          <button type="button" class="vp-x" aria-label="Cerrar vista previa" data-testid="vp-cerrar" @click="$emit('cerrar')">✕</button>
        </header>

        <div class="vp-cuerpo">
          <div class="vp-imagen">
            <img :src="imagen" :alt="nombre" data-testid="vp-imagen" @error="onImgError" />
          </div>

          <div class="vp-info">
            <div class="vp-precio-fila">
              <p v-if="precio > 0" class="vp-precio" data-testid="vp-precio">${{ precio.toFixed(2) }}<small v-if="unidad"> / {{ unidad }}</small></p>
              <p v-else class="vp-precio sin" data-testid="vp-precio">Sin precio<small> (captúralo en el paso 2)</small></p>
              <p class="vp-estrellas" aria-label="Sin calificaciones todavía">☆☆☆☆☆ <small>Sin calificaciones</small></p>
            </div>

            <div class="vp-tienda">
              <strong>{{ articulo.tiendaNombre || 'Tu tienda' }}</strong>
              <img v-if="logoTienda" :src="logoTienda" alt="" class="vp-logo" />
            </div>

            <h2 class="vp-titulo" data-testid="vp-titulo">{{ nombre }}</h2>

            <div v-if="variantes.length > 1" class="vp-colores">
              <p class="vp-etiqueta">Opciones</p>
              <div class="vp-puntos">
                <button
                  v-for="(v, i) in variantes"
                  :key="v.sku || i"
                  type="button"
                  class="vp-punto"
                  :class="{ activo: i === seleccion }"
                  :style="{ backgroundColor: v.colorCodigo || '#cccccc' }"
                  :title="v.detalle || v.color || `Opción ${i + 1}`"
                  :aria-label="v.detalle || v.color || `Opción ${i + 1}`"
                  data-testid="vp-variante"
                  @click="seleccion = i"
                ></button>
              </div>
            </div>

            <p class="vp-etiqueta">Disponibilidad</p>
            <p v-if="articulo.porPedido" class="vp-badge pedido">
              🛠️ Se elabora bajo pedido: la tienda lo prepara cuando lo pides
              <small>{{ LEYENDA_BAJO_PEDIDO_CORTA }}</small>
            </p>
            <p v-else class="vp-badge" :class="estado.clase" data-testid="vp-disponibilidad">{{ estado.texto }}</p>

            <template v-if="articulo.categoria">
              <p class="vp-etiqueta">Categoría</p>
              <p class="vp-texto">{{ articulo.categoria }}</p>
            </template>
            <template v-if="detalles.length">
              <p class="vp-etiqueta">Características</p>
              <ul class="vp-detalles">
                <li v-for="d in detalles" :key="d.k"><span>{{ d.k }}</span><strong>{{ d.v }}</strong></li>
              </ul>
            </template>
            <template v-if="articulo.descripcion">
              <p class="vp-etiqueta">Descripción</p>
              <p class="vp-texto vp-desc">{{ articulo.descripcion }}</p>
            </template>
          </div>
        </div>

        <footer class="vp-pie">
          <button type="button" class="vp-agregar" disabled>🛒 Agregar al carrito</button>
          <small>Esto es solo una vista previa: todavía no está publicado.</small>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Vista previa del artículo mientras la tienda llena el formulario: el mismo orden y datos que ve un cliente
 * al abrir el detalle (foto, precio, tienda, título, opciones, disponibilidad, características y descripción).
 */
import { computed, ref, watch } from 'vue';
import defaultImg from '@/assets/icons/default_articulo.png';
import { LEYENDA_BAJO_PEDIDO_CORTA } from '@/constants/bajoPedido';
import { imagenUrl } from '@/constants/firebase_util';

interface VarianteVista {
  sku?: string;
  color?: string;
  colorCodigo?: string;
  tamano?: string;
  tamanoOtro?: string;
  material?: string;
  materialOtro?: string;
  marca?: string;
  detalle?: string;
  precio?: number | string;
  stock?: number;
  tieneStock?: boolean;
  url?: string;
  isDefault?: boolean;
}

export interface ArticuloVista {
  nombre: string;
  descripcion: string;
  precio: number;
  unidadMedida?: string;
  categoria?: string;
  tiendaNombre?: string;
  url?: string;
  porPedido?: boolean;
  variantes: VarianteVista[];
}

const props = defineProps<{ visible: boolean; articulo: ArticuloVista; logoTienda?: string }>();
defineEmits<{ (e: 'cerrar'): void }>();

const seleccion = ref(0);
watch(() => props.visible, (v) => { if (v) seleccion.value = 0; });

const variantes = computed(() => props.articulo.variantes ?? []);
const variante = computed(() => variantes.value[seleccion.value] ?? variantes.value[0]);
const nombre = computed(() => props.articulo.nombre?.trim() || 'Nombre del artículo');
const precio = computed(() => Number(variante.value?.precio) || Number(props.articulo.precio) || 0);
const unidad = computed(() => (props.articulo.unidadMedida && props.articulo.unidadMedida !== 'pz' ? props.articulo.unidadMedida : ''));
const imagen = computed(() => imagenUrl(variante.value?.url || props.articulo.url) || defaultImg);
const onImgError = (e: Event) => ((e.target as HTMLImageElement).src = defaultImg);

/** Mismas reglas que el detalle del cliente: sin control = disponible; hasta 5 = "últimas"; 0 = agotado */
const estado = computed(() => {
  const v = variante.value;
  if (!v || v.tieneStock === false || Number(v.stock) === -1) return { clase: 'disponible', texto: '🟢 Disponible' };
  const n = Number(v.stock) || 0;
  if (n <= 0) return { clase: 'agotado', texto: '🔴 Agotado' };
  if (n <= 5) return { clase: 'poco', texto: `🟡 Últimas ${n} unidades` };
  return { clase: 'normal', texto: `🟢 ${n} disponibles` };
});

/** Características que sí dijo la tienda (lo genérico de la variante base no se muestra) */
const detalles = computed(() => {
  const v = variante.value;
  if (!v) return [];
  const lista: { k: string; v: string }[] = [];
  const tamano = v.tamano === 'Otro' ? v.tamanoOtro : v.tamano;
  const material = v.material === 'Otro' ? v.materialOtro : v.material;
  const generico = !!v.isDefault && variantes.value.length <= 1;
  if (v.marca) lista.push({ k: 'Marca', v: v.marca });
  if (v.color && !generico) lista.push({ k: 'Color', v: v.color });
  if (tamano && !generico) lista.push({ k: 'Tamaño', v: tamano });
  if (material && !generico) lista.push({ k: 'Material', v: material });
  if (v.detalle && v.detalle !== 'Producto Base') lista.push({ k: 'Detalle', v: v.detalle });
  return lista;
});
</script>

<style scoped>
.vp-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(0, 0, 0, 0.7); display: grid; place-items: center; padding: 10px; }
.vp-telefono { width: min(420px, 100%); max-height: 100%; display: flex; flex-direction: column; background: var(--bg-page); color: var(--text); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
.vp-cabeza { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--color-bg-blue-dark); color: #fff; font-size: 0.85rem; }
.vp-x { border: 0; background: transparent; color: #fff; font-size: 1.1rem; cursor: pointer; width: 30px; height: 30px; }
.vp-cuerpo { overflow-y: auto; flex: 1; min-height: 0; }
.vp-imagen { background: var(--surface-2); }
.vp-imagen img { width: 100%; max-height: 300px; object-fit: cover; display: block; }
.vp-info { padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.vp-precio-fila { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vp-precio { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--brand-blue-text); }
.vp-precio.sin { font-size: 1.1rem; color: var(--text-muted); }
.vp-precio small { font-size: 0.8rem; font-weight: 500; color: var(--text-muted); }
.vp-estrellas { margin: 0; color: #f5a623; font-size: 1rem; }
.vp-estrellas small { color: var(--text-muted); font-size: 0.72rem; }
.vp-tienda { display: flex; align-items: center; gap: 8px; margin-top: 4px; color: var(--text-muted); font-size: 0.9rem; }
.vp-logo { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.vp-titulo { margin: 4px 0 6px; font-size: 1.25rem; line-height: 1.25; }
.vp-etiqueta { margin: 10px 0 2px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 700; }
.vp-puntos { display: flex; gap: 8px; flex-wrap: wrap; }
.vp-punto { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #ddd; cursor: pointer; }
.vp-punto.activo { border: 3px solid var(--brand-blue-text); }
.vp-badge { margin: 0; padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; }
.vp-badge small { display: block; margin-top: 3px; font-weight: 400; font-size: 0.76rem; line-height: 1.3; }
.vp-badge.pedido { background: #eef2ff; color: #3730a3; border-radius: 14px; }
.vp-badge.agotado { background: #ffe5e5; color: #e74c3c; }
.vp-badge.poco { background: #fff4e5; color: #b8730a; }
.vp-badge.disponible { background: #e8f8f5; color: #1e8449; }
.vp-badge.normal { background: #eef6ff; color: #1f4bbf; }
.vp-texto { margin: 0; font-size: 0.92rem; line-height: 1.45; }
.vp-desc { white-space: pre-line; }
.vp-detalles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; }
.vp-detalles li { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--border); padding: 4px 0; }
.vp-detalles span { color: var(--text-muted); }
.vp-pie { padding: 10px 14px 14px; background: var(--surface); border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.vp-agregar { border: 0; border-radius: 12px; padding: 12px; font-weight: 700; font-size: 1rem; background: var(--color-bg-blue-ligth); color: var(--on-primary); opacity: 0.55; cursor: not-allowed; }
.vp-pie small { text-align: center; color: var(--text-muted); font-size: 0.75rem; }
</style>
