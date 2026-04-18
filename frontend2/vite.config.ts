import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    tailwindcss(),
    lingui(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 ships with rolldown, whose `output.manualChunks` accepts only a
        // function form (unlike classic rollup, which also accepts a record). We
        // keep the grouping declaration as a data structure and project it into a
        // function so the scanner-chunk membership is still easy to read and lint.
        // Chunk name `scanner` is load-bearing — it becomes `dist/assets/scanner-[hash].js`.
        manualChunks: (moduleId: string): string | undefined => {
          const scannerChunkModules: Record<string, readonly string[]> = {
            scanner: [
              "@yudiel/react-qr-scanner",
              "barcode-detector",
              "barcode-detector/polyfill",
              "zxing-wasm",
              "webrtc-adapter",
            ],
          };
          for (const [chunkName, specifiers] of Object.entries(scannerChunkModules)) {
            for (const specifier of specifiers) {
              // Match both bare-specifier (`node_modules/<specifier>/...`) and
              // deep-subpath imports (e.g. `barcode-detector/polyfill`).
              if (
                moduleId.includes(`/node_modules/${specifier}/`) ||
                moduleId.includes(`/node_modules/${specifier}.`)
              ) {
                return chunkName;
              }
            }
          }
          return undefined;
        },
      },
    },
  },
});
