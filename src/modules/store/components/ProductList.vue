<template>
  <div>
    <!-- Botón para insertar todos los pueblos -->
    <button @click="insertarTodosLosPueblos">
      Insertar pueblos de San Martín Hidalgo
    </button>

    <div>
      <Test></Test>
    </div>
  </div>
</template>

<script setup lang="ts">
import { insertarPueblosPorMunicipio } from "@/composables/useLugar"; // Asegúrate de que esté exportado si está en ese archivo
import CategoriaRegister from "../components/CategoriaRegister.vue";
import Test from "../components/Test.vue";

const municipios = {
  Ameca: [
    "Ameca",
    "El Huarache",
    "El Cerrito",
    "San Martín de Hidalgo",
    "La Loma",
    "Las Palmas",
    "San Isidro",
    "La Puerta de Animas",
    "El Refugio",
    "Las Juntas",
    "La Piedra",
    "El Rodeo",
    "La Cañada",
    "El Zapote",
    "El Tigre",
    "La Mesa",
    "El Zapotillo",
    "El Salitre",
    "El Centinela",
    "El Tecuán",
    "San José de las Flores",
    "La Higuerita",
    "San Ignacio",
    "El Sauz",
    "San José del Refugio",
    "El Chante",
  ],
  SanMartinHidalgo: [
    "Camajapita",
    "El Crucero de Santa María",
    "El Salitre",
    "El Tepehuaje de Morelos",
    "Ipazoltic",
    "Jesús María (El Zapote)",
    "La Loma",
    "Labor de Medina",
    "Lagunillas",
    "Lázaro Cárdenas",
    "Los Guerrero",
    "Los Vergara",
    "Río Grande",
    "San Isidro Palo Verde",
    "San Jerónimo (Los Barbosa)",
    "San Jacinto",
    "San Martín Hidalgo (cabecera municipal)",
    "Santa Cruz de las Flores",
    "Trapiche de Abra",
    "Venustiano Carranza",
    "San Jacintito (El Ranchito)",
    "La Puerta Blanca",
    "Casa del Río",
    "La Lobera",
    "Potrero San Gabriel",
    "Planta Purificadora la Paloma",
    "Bodega C Rancho del Carmen",
    "Granja Avícola Tepehuaje",
    "Granja VIWECO",
    "Granja El Milagro",
    "La Caballeriza",
    "Las Guácimas",
    "Rancho la Virgen",
    "Antonio Rodríguez Silva",
    "El Casquito",
    "Francisco Navarro",
    "La Coraleta",
    "La Guamuchilera",
    "Vicente Camacho",
  ],
  Cocula: [
    "Cocula (cabecera municipal)",
    "La Cofradía de la Luz",
    "San Nicolás (San Nicolás Acuña)",
    "La Sauceda",
    "Camichines",
    "Tateposco (San José Tateposco)",
    "Santa Teresa",
    "Agua Caliente",
    "La Estanzuela",
    "Santa María",
    "El Saucillo",
    "La Taberna",
    "Colonia El Vergel",
    "Rancho la Primavera",
    "Arroyo Colorado",
    "Viveros el Paso Hondo",
  ],
  // agrega más si quieres
};

// Función que llama a la lógica de inserción
async function insertarTodosLosPueblos() {
  try {
    for (const [municipio, pueblos] of Object.entries(municipios)) {
      await insertarPueblosPorMunicipio(municipio, "Jalisco", pueblos);
    }
    alert("✅ Todos los pueblos se insertaron correctamente.");
  } catch (error) {
    console.error("❌ Error al insertar pueblos:", error);
    alert("❌ Error al insertar pueblos.");
  }
}
</script>
