import { test, expect } from "@playwright/test";

// First v3.0 e2e spec (retro-os sample screens, 2026-06-11). Exercises the
// real /login → / dashboard flow against the running backend + Postgres per
// the CLAUDE.md §E2E Tests runbook. Guards the cookie-JWT login contract,
// the /api proxy rewrite (vite.config.ts), and the dashboard's binding to
// the real analytics endpoints.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

test("login lands on the dashboard with real workspace stats", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page).toHaveURL("/");
  // Stat windows render once /analytics/dashboard resolves.
  await expect(page.getByRole("heading", { name: /^items$/i })).toBeVisible();
  await expect(page.getByText(/units total/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /recent activity/i }),
  ).toBeVisible();
});

test("visiting / without a session redirects to /login", async ({ page }) => {
  // Fresh Playwright context = no access_token cookie. Guards the
  // RequireAuth wrapper AND api.ts throwing HttpError(401) from the
  // no-refresh-token path (a plain Error there breaks the redirect).
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
});

test("wrong password shows the error banner and stays on /login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: /^log in$/i }).click();

  await expect(page.getByRole("alert")).toContainText(
    /wrong email or password/i,
  );
  await expect(page).toHaveURL(/\/login$/);
});

// Phase 3 shell smoke (SHELL-01/02 + BAR-05 end-to-end). Runs against the live
// dev stack per the CLAUDE.md §E2E runbook (no webServer in playwright.config —
// it expects backend + Postgres + dev server up). At the default desktop
// viewport (≥768px) the Bottombar + persistent Navigator render; this proves:
// login → shell chrome present → CSS-only collapse toggles the grid root's
// data-collapsed → F1 help opens → ESC closes the dialog WITHOUT logging out.
test("shell renders, collapse toggles, and F1 help opens then ESC closes", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");

  // Shell chrome: the TopBar brand, the Navigator nav landmark, and the
  // Bottombar shortcuts footer are all present at desktop width.
  await expect(page.getByText(/warehouse/i).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: /primary/i })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: /shortcuts/i })).toBeVisible();

  // CSS-only collapse: toggling the Navigator chevron flips the grid root's
  // data-collapsed attribute (no JS measurement — SHELL-02).
  const grid = page.locator(".app-shell");
  await expect(grid).toHaveAttribute("data-collapsed", "false");
  await page.getByRole("button", { name: /collapse navigator/i }).click();
  await expect(grid).toHaveAttribute("data-collapsed", "true");

  // F1 help: the Bottombar F1 chip opens the KEYBOARD SHORTCUTS dialog…
  await page.getByRole("button", { name: /help/i }).click();
  const dialog = page.getByRole("dialog", { name: /keyboard shortcuts/i });
  await expect(dialog).toBeVisible();

  // …and ESC closes it via the modal stack — it must NOT log out (BAR-05).
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL("/");
});
