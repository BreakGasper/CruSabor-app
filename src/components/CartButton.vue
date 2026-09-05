<template>
  <button
    class="cart-btn-root"
    type="button"
    :title="total > 0 ? `${total} en el carrito` : 'Mi carrito'"
    @click="irAlCarrito"
  >
    <FontAwesomeIcon :icon="['fas', 'shopping-cart']" />
    <transition name="pop">
      <span v-if="total > 0" class="cart-count">{{ total > 99 ? '99+' : total }}</span>
    </transition>
  </button>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { liveQuery, type Subscription } from 'dexie';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { db } from '@/db';
import { sessionUser, sessionUsuarioValidation } from '@/utils/sessionUser';

/**
 * Botón de carrito con contador de artículos del usuario logueado.
 * Se actualiza en vivo cuando cambia la tabla Carrito (Dexie liveQuery),
 * así refleja lo agregado desde cualquier pantalla sin recargar.
 */
const router = useRouter();
const total = ref(0);
let sub: Subscription | null = null;

function suscribir(idUsuario?: string) {
  sub?.unsubscribe();
  sub = null;
  total.value = 0;
  if (!idUsuario) return;

  sub = liveQuery(() =>
    db.Carrito.where('id_usuario').equals(idUsuario).toArray(),
  ).subscribe({
    next: (items) => {
      total.value = items.reduce((acc, i) => acc + (i.cantidad || 0), 0);
    },
    error: (e) => console.error('CartButton liveQuery:', e),
  });
}

watch(() => sessionUser.value?.id, suscribir, { immediate: true });
onUnmounted(() => sub?.unsubscribe());

function irAlCarrito() {
  router.push(sessionUsuarioValidation() ? '/cart' : '/login');
}
</script>

<style scoped>
.cart-btn-root {
  position: relative;
}
.cart-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e74c3c;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.pop-enter-active,
.pop-leave-active {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.pop-enter-from,
.pop-leave-to {
  transform: scale(0.4);
  opacity: 0;
}
</style>
