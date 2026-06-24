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

// Dashboard + the items list. /items is the representative table view: the wide
// multi-column table is rendered through the shared RetroTable, which now owns
// the overflow-x wrapper, so this one route guards the fix for ALL list tables.
// (We keep the route set small on purpose — looping every list view here pushes
// the dev server into blank-page resource exhaustion after ~20 rapid full-page
// navigations, a harness artifact unrelated to layout. The full per-view sweep
// is done manually via the browser devtools probe in the layout PR.)
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

/**
 * Find content that overflows the viewport but is NOT inside a horizontal
 * scroll container — i.e. it is CLIPPED by an `overflow:hidden` ancestor (or
 * overflows the root) and is therefore visibly cut off. This catches the class
 * of bug the cheap root-scrollWidth check above misses entirely: a wide table
 * whose min-content width propagates up through a card lacking `min-width:0`,
 * forcing the card past the viewport where AppShell clips it. Properly handled
 * wide content lives inside an `overflow-x:auto/scroll` wrapper and is excluded.
 *
 * SVG primitives and sub-60px slivers are ignored (decorative chrome like the
 * FAB icon and chart-axis labels can sit a few px past the edge by design).
 */
async function clippedOverflowOffenders(
  page: Page,
  tol: number,
): Promise<{ tag: string; cls: string; width: number; right: number }[]> {
  return page.evaluate((t) => {
    const SVG = new Set([
      "svg", "g", "ellipse", "path", "rect", "circle", "line",
      "polygon", "polyline", "use", "defs", "clippath", "text", "tspan",
    ]);
    const vw = document.documentElement.clientWidth;
    const out: { tag: string; cls: string; width: number; right: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const tag = el.tagName.toLowerCase();
      if (SVG.has(tag)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.right <= vw + t) continue;
      // Walk ancestors: the FIRST overflow-managing ancestor decides. auto/
      // scroll => the element scrolls in place (fine). hidden / none => the
      // element is clipped or overflows the root (a real visual break).
      let p: HTMLElement | null = el.parentElement;
      let scrollable = false;
      while (p) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") { scrollable = true; break; }
        if (ox === "hidden") break;
        p = p.parentElement;
      }
      if (!scrollable) {
        out.push({
          tag,
          cls: (el.className || "").toString().slice(0, 60),
          width: Math.round(r.width),
          right: Math.round(r.right),
        });
      }
    }
    return out.sort((a, b) => b.right - a.right).slice(0, 8);
  }, tol);
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
        await expect(
          page.locator("#main"),
          `#main missing at ${width}px on ${route}`,
        ).toBeVisible();

        // 1) No horizontal overflow at this viewport/route (cheap root check).
        expect(
          await hasNoHorizontalOverflow(page),
          `horizontal overflow at ${width}px on ${route}`,
        ).toBe(true);

        // 1b) No CLIPPED overflow — content cut off by an overflow:hidden
        // ancestor (the failure the root check above cannot see). Wide tables
        // must live in an overflow-x:auto wrapper, not spill out of their card.
        const offenders = await clippedOverflowOffenders(page, OVERFLOW_TOL);
        expect(
          offenders,
          `clipped overflow at ${width}px on ${route}: ${JSON.stringify(offenders)}`,
        ).toEqual([]);

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
