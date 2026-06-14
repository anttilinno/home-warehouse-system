import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Phase 1 scaffold (v3.0). Lingui v6 SWC plugin slot mirrors vite.config.ts so
// unit-test transforms match the build (Pattern C). Pinned exact at 6.0.0 in
// package.json per Pitfall 1.
export default defineConfig({
  plugins: [react({ plugins: [["@lingui/swc-plugin", {}]] })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-utils.tsx", "./src/test/setup.ts"],
    globals: true,
    // Exclude Playwright E2E specs — `test.describe` from @playwright/test is
    // not compatible with vitest's runner. The specs are invoked by
    // `bun run test:e2e` only.
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
