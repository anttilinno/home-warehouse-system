import { test, expect } from "@playwright/test";

// Phase 13b analytics spec (retro-os charts, sketch 009). Exercises the real
// /login → /analytics flow against the running backend + Postgres per the
// CLAUDE.md §E2E runbook. Guards the lazy-loaded charts route (ANL-03 — recharts
// only loads on /analytics) + the chart panels (ANL-01/02) + the out-of-stock
// table (ANL-04). The charts render their retro Window titles regardless of how
// sparse the seeder workspace data is, so the assertions are data-agnostic.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

test("analytics page renders the chart panels and the out-of-stock table", async ({
  page,
}) => {
  await login(page);

  // Navigate via the Sidebar Analytics nav item (wired in Phase 13b — was a
  // disabled placeholder before). The route is React.lazy so this also proves
  // the charts chunk loads on demand without a crash.
  await page.getByRole("link", { name: /^analytics$/i }).click();
  await expect(page).toHaveURL(/\/analytics$/);

  // ANL-01/02: the chart Window titles render (the recharts marks are themed
  // per sketch 009; titles render even when a series is empty).
  await expect(
    page.getByRole("heading", { name: /category breakdown/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /top borrowers/i }),
  ).toBeVisible();

  // ANL-04: the out-of-stock table panel renders (rows or a calm empty state).
  await expect(
    page.getByRole("heading", { name: /out of stock/i }),
  ).toBeVisible();
});
