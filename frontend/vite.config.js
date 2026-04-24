import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Permettre d'importer des .js contenant du JSX sans extension explicite
    extensions: [".jsx", ".js", ".tsx", ".ts", ".json"],
  },
  esbuild: {
    // Traiter les fichiers .js comme du JSX (pour la compatibilité)
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  server: {
    port: 3000,
    open: false,
    host: "127.0.0.1",
  },
  build: {
    outDir: "build",
    sourcemap: false,
  },
});
