import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
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
    // PWA: installable on Android home screen (WebAPK). Auto-injects the
    // manifest link + SW registration into index.html at build; precaches
    // static assets. Icons live in public/ (icon-192/512.png). Requires
    // HTTPS in production (localhost is exempt) or the SW won't register.
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // OAuth/SSO initiate paths are FULL-PAGE navigations that must reach
        // the network → ingress (Google/GitHub via /api, Authelia via the bare
        // ingress path). Without this denylist the SW's index.html navigation
        // fallback swallows them and serves the SPA shell — the app renders the
        // "v3.0 placeholder shell" wildcard instead of redirecting to the
        // provider. PWA-only bug (a plain tab has no SW interception).
        // /auth/callback is intentionally NOT denylisted — it is a real SPA
        // route that the shell must render.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\/authelia\//],
        // Precache the IBM Plex woff2 files too, not just JS/CSS/HTML/icons —
        // otherwise every lazy route works offline after one visit but text
        // renders in a fallback font (woff2-only: legacy .woff is never
        // requested by a woff2-capable browser; ~1MB/30 files, each file is
        // under the workbox 2MB per-file cap).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Thumbnails are auth-cookie-gated at fetch time but served from this
        // cache without auth afterwards on repeat visits — CacheFirst is fine
        // offline-first, but see useLogout.ts: the cache is wiped on logout so
        // it can't leak a photo to the next device user. Full-size photos and
        // offline photo upload stay out of scope (v2 thumbnails-only).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/photos\/[^/]+\/thumbnail$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "hws-thumbs",
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Home Warehouse",
        short_name: "Warehouse",
        start_url: "/",
        display: "standalone",
        background_color: "#fdf6ec",
        theme_color: "#fdf6ec",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
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
  // `vite preview` needs the SAME /api proxy as the dev server — the SW only
  // registers in a real build, so the offline-replay E2E (which reloads while
  // offline and needs the SW to serve the shell) runs against `preview`, not
  // `dev`. Same rewrite contract as `server.proxy`.
  preview: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
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
          // Phase 16 (Command Palette): isolate cmdk (~5KB gz) + the
          // @radix-ui/react-dialog tree (~10-15KB gz) into a lazy `palette`
          // chunk so the entry bundle carries ZERO palette bytes (TUI-05 /
          // POL-04 budget). Pairs with the React.lazy palette body shipped in
          // a downstream plan — the palette bytes load ONLY when the palette is
          // first opened. OVERRIDE B: cmdk hard-imports @radix-ui/react-dialog
          // at module top level (non-tree-shakable), so radix-dialog MUST be
          // co-located in this chunk or it leaks into the always-loaded entry.
          // The chunk stays empty until the first app-side import lands
          // (rolldown no-ops an unreachable rule). Mirrors the scanner/charts
          // isolates above — membership is a greppable data structure.
          const paletteModules = ["cmdk", "@radix-ui/react-dialog"];
          if (paletteModules.some((mod) => id.includes(mod))) {
            return "palette";
          }
          return undefined;
        },
      },
    },
  },
});
