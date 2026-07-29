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
  // CAVEAT on the line above: `fullyParallel: false` only serialises tests
  // WITHIN a file. Separate spec files still run concurrently across workers,
  // so "seed state is shared" is a hazard this setting does NOT actually
  // remove. Every spec logs in as the same seeded account and several mutate
  // global state on it — settings.spec changes the display name and language,
  // items.spec flips the `show_archived` preference — each visible to whatever
  // else is mid-run.
  //
  // Both halves of the fix, and they only work together. Serialising alone was
  // measured on 2026-07-29 and made things worse: the suite logged in 27 times
  // and each spec takes ~2 s, so serial or not they all landed inside about a
  // minute — 24/min against the 20/min limiter on /auth/login (router.go:405),
  // producing 7 × 429 and failing ~7 specs with assertion errors that look
  // nothing like rate limiting. auth.setup.ts removes that ceiling by logging
  // in once for the whole run, which is what makes one worker viable.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US", // deterministic banner text; specs accept ET translation as fallback
  },
  // Chromium only. The firefox project was dropped — Playwright drives its own
  // bundled browser builds (never system Firefox/Zen), so a second project just
  // forces an extra ~100 MB download for no added coverage on this app.
  projects: [
    // Logs the seeder in once and writes e2e/.auth/seeder.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        // Every spec starts authenticated. The two specs that own the real
        // login/logout flows opt out with
        // `test.use({ storageState: { cookies: [], origins: [] } })`.
        storageState: "e2e/.auth/seeder.json",
      },
    },
  ],
  // No auto-launch of the dev server — expect the developer to have
  // `bun run dev` + backend running. If a future plan adds CI, wire up the
  // dev-server launch via Playwright's auto-start option.
});
