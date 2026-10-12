import { test, expect } from "@playwright/test";

// Phase 14 System-group spec. Exercises the real /login → SYSTEM nav-group
// flow against the running backend + Postgres per the CLAUDE.md §E2E runbook.
// Guards the new routes wired in 14-08 (approvals/wishlist/sync-history) +
// their Sidebar nav entries. Assertions are data-agnostic — the pages render
// their chrome regardless of how sparse the seeder workspace is.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

async function login(page: import("@playwright/test").Page) {
  // Already authenticated by the `setup` project via storageState, so this
  // returns immediately in a normal run. It only performs a real login when
  // the saved state is missing (running one spec with e2e/.auth deleted).
  // Logging in per spec is what pushed the suite over the 20/min limiter.
  await page.goto("/");
  if (new URL(page.url()).pathname === "/login") {
    await page.getByLabel("Email").fill(E2E_USER);
    await page.getByLabel("Password").fill(E2E_PASS);
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page).toHaveURL("/");
  }
  // Wait for the authenticated shell to actually mount. `goto` resolves on
  // load, which is earlier than the old login flow settled — specs that
  // immediately press a keyboard chord raced the app attaching its handlers.
  await expect(page.getByTestId("workspace-pill")).toBeVisible();
}

test("the SYSTEM nav group routes to approvals and wishlist", async ({
  page,
}) => {
  await login(page);

  // Plan 1D: PLANNING (Wishlist) and SYSTEM (Approvals / Sync History) start
  // collapsed — expand both before their rows are reachable. The header names
  // are prefix-matched (not `/^…$/`): a pending count rides the collapsed
  // SYSTEM header (e.g. "System 16"), so an anchored match would miss it.
  await page.getByRole("button", { name: /^planning/i }).click();
  await page.getByRole("button", { name: /^system/i }).click();

  // Approvals — the route Phase 13's PendingApprovalsPanel "Review" link
  // targets. Prefix match: a pending count appends to the link name.
  await page.getByRole("link", { name: /^approvals/i }).click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(page.getByText(/approvals/i).first()).toBeVisible();

  // Wishlist — status tabs (WANTED / ORDERED / ACQUIRED).
  await page.getByRole("link", { name: /^wishlist/i }).click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByRole("tab", { name: /wanted/i })).toBeVisible();
});
