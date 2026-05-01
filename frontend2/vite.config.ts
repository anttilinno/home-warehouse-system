import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Phase 1 scaffold (v3.0). i18n plugin (Lingui or react-intl) lands in Plan 03
// after the empirical spike concludes. /api → :8080 proxy + changeOrigin:true
// is the locked v2.1 contract (Pitfall 6: required for cookie binding).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: true,
    // Forward-compat (Phase 11): scanner WASM manualChunks slot
    // rollupOptions: { output: { manualChunks: { /* scanner */ } } },
  },
});
