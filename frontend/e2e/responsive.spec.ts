import { test, expect, type Page } from "@playwright/test";

// Phase 17 POL-05 — mobile breakpoint matrix. Runs against the live dev stack
// per the CLAUDE.md §E2E runbook (backend + Postgres + Vite dev server up; no
// webServer in playwright.config). Chromium is the hard gate (17-VALIDATION
// runs `bun run test:e2e e2e/responsive.spec.ts`).
//
// This spec asserts ONLY the STRUCTURAL responsive contract:
//   - no horizontal overflow at any of the 5 breakpoints, on / and /items
//   - the AppShell nav-surface swap at the Tailwind `md` (768px) boundary:
//       <768  => mobile Fab visible, desktop Sidebar hidden
//       >=768 => desktop Sidebar visible (Fab hidden)
//   - captures a full-page dashboard screenshot at each breakpoint as a
//     Playwright artifact (test-results/dashboard-<width>.png).
//
// The pixel diff vs the `006-retro-os-dashboard` sketch is a DOCUMENTED
// human-eye residue (OQ-5, logged to FINAL-REVIEW-CHECKLIST) — it is NOT
// asserted here; only the captured screenshots feed that manual review.
//
// VERIFIED AppShell contract (frontend/src/components/layout/):
//   .app-sidebar => `hidden md:block`  -> Sidebar HIDDEN <768, VISIBLE >=768
//   Fab wrapper  => `md:hidden`        -> Fab VISIBLE <768, HIDDEN >=768
//   Bottombar    => `hidden md:flex`   -> desktop-only; NOT asserted at <768
//   Sidebar <nav> carries aria-label="Primary"; the Fab toggle is a
//   <button aria-label="Quick actions" aria-haspopup="menu">.
//
// Auth contract (CLAUDE.md): /login → Email + Password labels → submit
// /^log in$/i; the access_token cookie is inherited by the page context. Honor
// the 20/min auth limiter — exactly ONE login per test (this file logs in once
// then loops every viewport).

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// POL-05 breakpoints (widths, px). 768 is the boundary itself: Tailwind `md`
// is min-width:768px, so it is ACTIVE at exactly 768 (desktop surface).
//   320 / 360  => mobile  (Fab)
//   768 / 1024 / 1440 => desktop (Sidebar)
const BREAKPOINTS = [320, 360, 768, 1024, 1440] as const;
const MD = 768;
const VIEWPORT_HEIGHT = 900;

// Small tolerance for sub-pixel rounding when comparing scrollWidth/clientWidth.
const OVERFLOW_TOL = 2;

const ROUTES = ["/", "/items"] as const;

/** Log in via the real /login flow and land on the dashboard (one login/test). */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

/** True iff the document has no horizontal overflow (within OVERFLOW_TOL). */
async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate((tol) => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + tol;
  }, OVERFLOW_TOL);
}

test.describe("responsive breakpoint matrix (POL-05)", () => {
  test("no horizontal overflow + Sidebar/Fab swap across 5 breakpoints", async ({
    page,
  }) => {
    await login(page);

    // Stable nav-surface locators (verified contract).
    const sidebar = page.locator(".app-sidebar nav[aria-label='Primary']");
    const fab = page.getByRole("button", { name: "Quick actions" });

    for (const width of BREAKPOINTS) {
      const isDesktop = width >= MD;

      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });

      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page).toHaveURL(
          route === "/" ? "/" : new RegExp(`${route}$`),
        );
        // Wait for the shell to settle: the <main> region is always present.
        await expect(page.locator("#main")).toBeVisible();

        // 1) No horizontal overflow at this viewport/route.
        expect(
          await hasNoHorizontalOverflow(page),
          `horizontal overflow at ${width}px on ${route}`,
        ).toBe(true);

        // 2) Nav-surface contract at the `md` (768px) boundary.
        if (isDesktop) {
          await expect(
            sidebar,
            `Sidebar should be visible at ${width}px on ${route}`,
          ).toBeVisible();
          await expect(
            fab,
            `Fab should be hidden at ${width}px on ${route}`,
          ).toBeHidden();
        } else {
          await expect(
            fab,
            `Fab should be visible at ${width}px on ${route}`,
          ).toBeVisible();
          await expect(
            sidebar,
            `Sidebar should be hidden at ${width}px on ${route}`,
          ).toBeHidden();
        }
      }

      // POL-05 artifact: full-page dashboard screenshot at this breakpoint.
      // Captured for the human visual-diff residue (OQ-5) — not pixel-asserted.
      await page.goto("/");
      await expect(page.locator("#main")).toBeVisible();
      await page.screenshot({
        path: `test-results/dashboard-${width}.png`,
        fullPage: true,
      });
    }
  });
});
