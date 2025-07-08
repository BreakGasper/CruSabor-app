import axios from "axios";

// Crear una instancia axios con configuración base
const api = axios.create({
  baseURL: "https://pokeapi.co/api/v2/", // Cambia esta URL por la base de tu API
  timeout: 5000, // Tiempo máximo de espera para la respuesta
  headers: {
    "Content-Type": "application/json",
    // Puedes agregar más headers si necesitas, como tokens de auth
  },
});

// Aquí puedes agregar interceptores si quieres manejar errores o tokens
// api.interceptors.request.use(...)
// api.interceptors.response.use(...)

export default api;
