<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ mensaje }}</h3>

        <div class="buttons">
          <button class="btn cancel" @click="handleCancel">Cancelar</button>
          <button class="btn confirm" @click="handleConfirm">Aceptar</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

const props = defineProps<{
  visible: boolean;
  mensaje: string;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

function handleConfirm() {
  emit("confirm");
}

function handleCancel() {
  emit("cancel");
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  padding: 1.8rem 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

.buttons {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.btn {
  flex: 1;
  padding: 0.6rem 0;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.btn.cancel {
  background: #ccc;
  color: #333;
}

.btn.confirm {
  background: var(--color-bg-blue-dark);
  color: white;
}
</style>
