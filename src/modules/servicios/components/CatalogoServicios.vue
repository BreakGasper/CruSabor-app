<template>
  <section class="catalogo" data-testid="catalogo-servicios" aria-label="Catálogo de servicios">
    <p v-if="cargando" class="vacio">Cargando servicios…</p>

    <div v-else-if="!servicios.length" class="vacio" data-testid="catalogo-vacio">
      <template v-if="esDueno">
        <p>Aún no publicas servicios. Agrega el primero para que tus clientes vean tu trabajo y puedan cotizar.</p>
        <button type="button" class="btn-pri" data-testid="agregar-primer-servicio" @click="irAMisServicios">Agregar servicio</button>
      </template>
      <p v-else>Esta tienda todavía no publica servicios.</p>
    </div>

    <ul v-else class="rejilla">
      <li v-for="s in servicios" :key="s.id">
        <button type="button" class="tarjeta" :class="{ oculto: !s.activo }" :data-servicio="s.id" @click="abrir(s)">
          <span class="foto">
            <img v-if="s.fotos[0]" :src="s.fotos[0]" :alt="s.nombre" loading="lazy" />
            <span v-else class="foto-vacia" aria-hidden="true">{{ icono(s.categoria) }}</span>
            <span v-if="s.fotos.length > 1" class="mas-fotos">+{{ s.fotos.length - 1 }}</span>
            <span v-if="!s.activo" class="oculto-etiqueta">Oculto</span>
          </span>
          <span class="datos">
            <strong class="nombre">{{ s.nombre }}</strong>
            <span class="precio">{{ etiquetaPrecio(s) }}</span>
            <span v-if="s.duracionMin" class="duracion">⏱ {{ etiquetaDuracion(s.duracionMin) }}</span>
            <span class="cta">{{ puedeCotizar(s) ? 'Ver y cotizar ›' : 'Ver detalle ›' }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useServiciosTienda, etiquetaPrecio, etiquetaDuracion, puedeCotizar } from '../catalogo';
import { CATEGORIAS_SERVICIO, type Servicio } from '../tipos';

/**
 * Catálogo del trabajo de una tienda de servicios. Los clientes ven solo los servicios activos;
 * la dueña o dueño también ve los ocultos (marcados) para poder reactivarlos.
 */
const props = defineProps<{ tiendaId: string; esDueno?: boolean }>();
const router = useRouter();
const { servicios, cargando } = useServiciosTienda(() => props.tiendaId, !props.esDueno);

const icono = (cat: string) => CATEGORIAS_SERVICIO.find((c) => c.id === cat)?.icono ?? '✨';
const abrir = (s: Servicio) => router.push(`/servicio/${s.tiendaId}/${s.id}`);
const irAMisServicios = () => router.push(`/store/servicios/${props.tiendaId}`);
</script>

<style scoped>
.catalogo { text-align: left; }
.vacio { margin: 8px 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.45; }
.btn-pri { margin-top: 6px; padding: 10px 16px; border: 0; border-radius: 10px; background: var(--color-bg-blue-ligth); color: var(--on-primary); font: inherit; font-weight: 700; cursor: pointer; }
.rejilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 700px) { .rejilla { grid-template-columns: repeat(3, 1fr); } }
.tarjeta { width: 100%; display: flex; flex-direction: column; padding: 0; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; overflow: hidden; }
.tarjeta.oculto { opacity: 0.65; }
.foto { position: relative; display: block; aspect-ratio: 4 / 3; background: var(--surface-2); }
.foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
.foto-vacia { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2.4rem; }
.mas-fotos { position: absolute; right: 6px; bottom: 6px; padding: 2px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 0.72rem; font-weight: 700; }
.oculto-etiqueta { position: absolute; left: 6px; top: 6px; padding: 2px 8px; border-radius: 999px; background: var(--aviso-fondo); color: var(--aviso-texto); font-size: 0.72rem; font-weight: 700; }
.datos { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px 12px; }
.nombre { font-size: 0.95rem; line-height: 1.25; }
.precio { font-weight: 700; color: var(--brand-blue-text); font-size: 0.9rem; }
.duracion { color: var(--text-muted); font-size: 0.78rem; }
.cta { margin-top: 4px; color: var(--brand-blue-text); font-size: 0.8rem; font-weight: 700; }
</style>
