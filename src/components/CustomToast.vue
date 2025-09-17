<template>
  <transition name="toast-fade">
    <div v-if="visible" class="toast" :class="type">
      <i v-if="type === 'success'" class="pi pi-check icon"></i>
      <i v-else-if="type === 'error'" class="pi pi-times icon"></i>
      <i v-else-if="type === 'info'" class="pi pi-info-circle icon"></i>

      <span>{{ message }}</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  message: string
  duration?: number
  type?: 'success' | 'error' | 'info'
}>()

const emit = defineEmits(['close'])
const visible = ref(false)

onMounted(() => {
  visible.value = true
  setTimeout(() => {
    visible.value = false
    emit('close')
  }, props.duration ?? 3000)
})
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem; /* separa el icono del texto */
  padding: 1rem 1.5rem;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  max-width: 80%;
  text-align: center;
}

.icon {
  font-size: 1.2rem;
}

/* Colores */
.toast.success {
  background: #28a745;
}
.toast.error {
  background: #dc3545;
}
.toast.info {
  background: #007bff;
}

/* Animación */
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 0.4s,
    transform 0.4s;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
