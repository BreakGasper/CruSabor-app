import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import vueDevTools from "vite-plugin-vue-devtools";

// Identificador de ESTA compilación: el commit en GitHub Actions, o la hora en local. La app lo compara con
// /version.json (publicado junto con ella) para saber si hay una versión nueva (src/utils/actualizacion.ts).
const BUILD_ID = (process.env.GITHUB_SHA || "").slice(0, 10) || String(Date.now());
const versionJson = () => ({
  name: "crustore-version-json",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ id: BUILD_ID, fecha: new Date().toISOString() }),
    });
  },
});

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [vue(), vueDevTools({ launchEditor: "code" }), versionJson()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // aumenta el límite de advertencia a 1000 kB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor"; // todos los módulos externos van a vendor.js
          }
        },
      },
    },
  },
});
