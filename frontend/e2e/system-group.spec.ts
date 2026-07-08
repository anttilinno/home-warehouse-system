import { test, expect } from "@playwright/test";

// Phase 14 System-group spec. Exercises the real /login → SYSTEM nav-group
// flow against the running backend + Postgres per the CLAUDE.md §E2E runbook.
// Guards the new routes wired in 14-08 (approvals/wishlist/sync-history) +
// their Sidebar nav entries. Assertions are data-agnostic — the pages render
// their chrome regardless of how sparse the seeder workspace is.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

test("the SYSTEM nav group routes to approvals, wishlist, and sync-history", async ({
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

  // Sync history — the honest online-only informational page (SYS-03).
  await page.getByRole("link", { name: /sync history/i }).click();
  await expect(page).toHaveURL(/\/sync-history$/);
  await expect(
    page.getByRole("heading", { name: /online only/i }),
  ).toBeVisible();
});
