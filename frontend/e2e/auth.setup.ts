import { test as setup, expect } from "@playwright/test";

// Logs the seeder in ONCE per run and saves the cookie jar. Every spec then
// starts already authenticated via `use.storageState` (playwright.config.ts).
//
// Why this exists: /auth/login is rate-limited to 20 requests/minute
// (backend/internal/api/router.go). The suite used to log in once per spec —
// 27 logins, all landing inside about a minute — so roughly seven of them were
// answered with 429 and the specs failed with `toHaveURL` errors that look
// nothing like rate limiting. That ceiling is also what blocked running the
// suite with a single worker, which is the only way to stop spec files racing
// each other over shared seed data.
//
// auth.spec.ts and login-dashboard.spec.ts opt OUT of this state (they own the
// real login/logout flows and must drive the form themselves). auth.spec's
// logout revokes the session it created, not this one — separate logins mean
// separate session rows.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Relative to the config's rootDir, matching `use.storageState` in
// playwright.config.ts. Not built with __dirname: this file is loaded as an ES
// module, where that global does not exist.
export const SEEDER_STATE = "e2e/.auth/seeder.json";

setup("authenticate as the seeder", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: SEEDER_STATE });
});
