import { defineConfig, devices } from "@playwright/test";

// First Playwright config in the repo — landed by Phase 65 Plan 65-11 (G-65-01
// regression guard). The scan-lookup spec exists precisely because every
// Vitest unit test in Phase 65 mocked at the api-helper layer, which is why
// G-65-01 (FTS search_vector excluded barcode column) shipped to production
// while all 710 unit tests passed. E2E crosses the real HTTP boundary the
// unit tests mocked.
//
// Contract: spec expects a running backend on :8080 and frontend on :5173,
// both orchestrated by the developer (or CI, later). See CLAUDE.md §E2E Tests
// for the runbook.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // keep serial while the spec count is small; seed state is shared
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US", // deterministic banner text; the spec also accepts the ET translation as a fallback
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  // No webServer config — expect the developer to have `bun run dev` + backend running.
  // If a future plan adds CI, wire up webServer: { command: "bun run dev", ... }.
});
