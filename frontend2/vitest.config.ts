import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-utils.tsx"],
    globals: true,
    // Exclude Playwright E2E specs (Phase 65 Plan 65-11 — G-65-01 regression
    // guard). `test.describe` from @playwright/test is not compatible with
    // vitest's runner — the specs are invoked by `bun run test:e2e` only.
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
