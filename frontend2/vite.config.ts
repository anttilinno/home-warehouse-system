import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import path from "path";

// Phase 1 scaffold (v3.0). Lingui v6 + @lingui/swc-plugin pinned EXACT
// (Pitfall 1) for deterministic build-time macro transformation. The SWC
// inner-plugins slot here MUST match vitest.config.ts (Pattern C: build and
// unit-test transforms must agree).
//
// /api → :8080 proxy + changeOrigin:true is the locked v2.1 contract
// (Pitfall 6: required for cookie binding).
export default defineConfig({
  plugins: [
    react({ plugins: [["@lingui/swc-plugin", {}]] }),
    tailwindcss(),
    lingui(),
  ],
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
        // Backend routes live at root (/auth/login, /workspaces/…) — the
        // /api prefix is frontend-only. Rewrite restored from the pre-wipe
        // v2.2 config (the Phase 1 scaffold dropped it by accident).
        rewrite: (path: string) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    // Sourcemaps are off in production builds (info disclosure: source
    // would leak via .map files; also breaks the Phase 1 verify that the
    // shipped bundle contains no `__react-query-devtools` string — the
    // dynamic-import path lives in the sourcemap even when the function
    // body is tree-shaken to a no-op). Re-enable per-environment if a
    // future phase adds error-reporting integration that needs them.
    sourcemap: false,
    // Phase 11 (Scan): isolate the scanner stack into its own lazy chunk so the
    // ~500-700 kB raw (zxing-wasm via barcode-detector + @yudiel/react-qr-scanner)
    // never inflates the main bundle. Pairs with 11-06's React.lazy of ScanPage
    // (Pattern 5) — the scanner bytes load only when /scan is visited. The chunk
    // stays empty until the first app-side import lands (rolldown no-ops an
    // unreachable rule). Vite 8 ships rolldown: manualChunks MUST be a function
    // (id) => string | undefined, NOT a record (archived 64-02 lesson). Declared
    // as a data structure so membership is readable + greppable.
    rollupOptions: {
      output: {
        manualChunks: (id: string): string | undefined => {
          const scannerModules = [
            "@yudiel/react-qr-scanner",
            "barcode-detector",
            "zxing-wasm",
          ];
          if (scannerModules.some((mod) => id.includes(mod))) {
            return "scanner";
          }
          // Phase 13b (Analytics): isolate recharts + its resolved d3 sub-deps
          // (recharts 3.x ships them as separate d3-* packages via the
          // victory-vendor shim) into a lazy `charts` chunk. Pairs with 13b-05's
          // React.lazy of AnalyticsPage — the charting bytes load ONLY when
          // /analytics is visited (ANL-03 hard gate + the POL-04 budget: the
          // main/vendor chunk must carry ZERO charting bytes). Mirrors the
          // scanner precedent above. Membership is the resolved d3 tree under
          // node_modules — the build gate greps dist to prove no leak.
          const chartModules = [
            "recharts",
            "victory-vendor",
            "d3-shape",
            "d3-scale",
            "d3-array",
            "d3-time",
            "d3-format",
            "d3-interpolate",
            "d3-color",
            "d3-path",
            "d3-time-format",
            "d3-ease",
            "d3-timer",
          ];
          if (chartModules.some((mod) => id.includes(mod))) {
            return "charts";
          }
          return undefined;
        },
      },
    },
  },
});
