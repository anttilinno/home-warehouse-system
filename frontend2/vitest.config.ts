import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Phase 1 scaffold (v3.0). i18n SWC plugin (Lingui) lands in Plan 03 after the
// empirical spike concludes — when it does, mirror the inner-plugins arg in
// vite.config.ts so unit-test transforms match build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-utils.tsx"],
    globals: true,
    // Exclude Playwright E2E specs — `test.describe` from @playwright/test is
    // not compatible with vitest's runner. The specs are invoked by
    // `bun run test:e2e` only.
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
