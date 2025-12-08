<template>
  <div
    class="max-w-xl mx-auto bg-white shadow-md rounded-md p-6 space-y-6 border border-gray-200"
  >
    <h2 class="text-2xl font-semibold text-gray-800">
      Agregar nueva categoría
    </h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Nombre -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >Nombre</label
        >
        <input
          v-model="form.nombre"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ej. Electrónica"
          required
        />
      </div>

      <!-- Descripción -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >Descripción</label
        >
        <textarea
          v-model="form.descripcion"
          rows="3"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Breve descripción (opcional)"
        ></textarea>
      </div>

      <!-- Ícono personalizado -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1"
          >Ícono personalizado</label
        >
        <input
          type="file"
          accept="image/*"
          @change="onFileSelected"
          class="w-full border border-gray-300 rounded-md px-3 py-2"
        />
        <p class="text-xs text-gray-400 mt-1">
          Sube una imagen (PNG/JPG) para usar como ícono de esta categoría.
        </p>

        <!-- Vista previa del ícono -->
      </div>

      <!-- Botón de enviar -->
      <div>
        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
          :disabled="loading"
        >
          <span v-if="!loading">Guardar categoría</span>
          <span v-else>Guardando...</span>
        </button>
      </div>
    </form>

    <!-- Mensaje de éxito -->
    <div v-if="mensaje" class="text-green-600 font-medium">
      {{ mensaje }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { insertarCategoria } from "@/composables/useCategorias";
import { uploadCategoriaIcon } from "@/composables/useStorage";

interface FormData {
  nombre: string;
  descripcion?: string;
  icono?: string;
}

const form = ref<FormData>({
  nombre: "",
  descripcion: "",
  icono: "",
});

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const loading = ref(false);
const mensaje = ref("");

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0];
    previewUrl.value = URL.createObjectURL(selectedFile.value);
  }
};

const handleSubmit = async () => {
  if (!form.value.nombre.trim()) return;

  loading.value = true;
  mensaje.value = "";

  try {
    const id = crypto.randomUUID(); // Puedes usar push() también

    // Subir ícono si se seleccionó archivo
    if (selectedFile.value) {
      const iconUrl = await uploadCategoriaIcon(selectedFile.value, id);
      form.value.icono = iconUrl;
    }

    // Guardar categoría en base de datos
    await insertarCategoria({
      nombre: form.value.nombre,
      descripcion: form.value.descripcion,
      icono: form.value.icono,
    });

    mensaje.value = `✅ Categoría "${form.value.nombre}" guardada correctamente.`;

    // Limpiar el formulario
    form.value = { nombre: "", descripcion: "", icono: "" };
    selectedFile.value = null;
    previewUrl.value = null;
  } catch (error) {
    console.error("Error al guardar la categoría:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.form-container {
  max-width: 600px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #ddd;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.form-container h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: #555;
}

input,
textarea {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

button {
  width: 100%;
  padding: 0.8rem 1rem;
  background-color: #3b82f6;
  color: white;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #2563eb;
}

.success-message {
  color: #059669;
  font-weight: 500;
}
</style>
