import { defineConfig, devices } from "@playwright/test";

// Playwright config ported verbatim from v2.1 (commit 5e77f98 — Phase 65 Plan
// 65-11, the G-65-01 regression guard). Phase 1 reserves the path even though
// no specs ship in this plan; the contract is THE auth-contract documented in
// CLAUDE.md §E2E Tests.
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
    locale: "en-US", // deterministic banner text; specs accept ET translation as fallback
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
  // No auto-launch of the dev server — expect the developer to have
  // `bun run dev` + backend running. If a future plan adds CI, wire up the
  // dev-server launch via Playwright's auto-start option.
});
