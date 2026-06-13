import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// POL-02 — axe accessibility sweep across the v3.0 route surface (chromium is the
// hard gate; 17-VALIDATION runs `bun run test:e2e e2e/a11y-sweep.spec.ts`). Runs
// against the live dev stack per CLAUDE.md §E2E (backend :8080 + Postgres + Vite
// :5173 up; no webServer in playwright.config).
//
// Coverage: WCAG 2.0/2.1 A + AA via .withTags(["wcag2a","wcag2aa"]) — that band
// already supplies color-contrast, focus-order/visible, aria/label/button-name/
// image-alt. The WCAG 2.2 `target-size` (touch-target) rule sits OUTSIDE that tag
// band, so it is explicitly enabled per-run. Together the four POL-02 concerns —
// contrast, focus-visible, touch-target, aria-label — are all exercised.
//
// Auth contract (CLAUDE.md): /login → Email + Password labels → submit /^log in$/i;
// the access_token cookie is inherited by BOTH the page context AND page.request,
// so API seeding needs no token plumbing. Honor the 20/min auth limiter — exactly
// ONE login per authenticated sweep test.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

/** Log in via the real /login flow and land on the dashboard (one login/test). */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

/** Public routes — swept WITHOUT a session (no login required). */
const PUBLIC_ROUTES: readonly string[] = [
  "/login",
  "/register",
  "/auth/callback",
];

/** App routes under the shell — STATIC-PATH SUBSET (no :id, no /demo, no
 *  /claim/:code); a seeded /items/{id} detail route is appended at runtime. */
const APP_ROUTES: readonly string[] = [
  "/",
  "/items",
  "/items/new",
  "/inventory",
  "/inventory/new",
  "/inventory/expiring",
  "/maintenance/due",
  "/loans",
  "/loans/new",
  "/borrowers",
  "/borrowers/new",
  "/taxonomy",
  "/scan",
  "/analytics",
  "/approvals",
  "/my-changes",
  "/sync-history",
  "/imports",
  "/wishlist",
  "/declutter",
  "/settings",
  "/settings/security",
  "/settings/accounts",
  "/settings/profile",
  "/settings/appearance",
  "/settings/language",
  "/settings/formats",
  "/settings/notifications",
  "/settings/data",
  "/settings/members",
  "/settings/paperless",
];

type AxeViolation = {
  id: string;
  impact?: string | null;
  nodes: unknown[];
};

/** Run axe on the current page; return only serious/critical violations as a
 *  flat, per-route-reportable list. */
async function seriousViolations(page: Page): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // target-size (WCAG 2.2 touch-target) is outside the wcag2a/aa tag band —
    // enable it so the touch-target POL-02 concern is covered.
    .options({ rules: { "target-size": { enabled: true } } })
    .analyze();
  return (results.violations as AxeViolation[]).filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

/** Goto a route and wait for the SPA to settle on a stable shell selector.
 *  NOTE: must NOT use waitForLoadState("networkidle") — the app holds an open
 *  SSE EventSource (SSEProvider), so the network never goes idle and the wait
 *  would always time out. Wait for the DOM + a stable landmark instead. */
async function gotoAndSettle(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // App routes render into #main; public (login/register) routes render a form.
  await page
    .locator("#main, form, [role='main']")
    .first()
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => {});
  // Brief settle for async data so axe scans the rendered tree, not a spinner.
  await page.waitForTimeout(350);
}

/** Format a per-route failure report so the assertion message is actionable. */
function formatReport(
  failures: Array<{ route: string; violations: AxeViolation[] }>,
): string {
  const lines: string[] = [];
  for (const { route, violations } of failures) {
    for (const v of violations) {
      lines.push(
        `  ${route} — ${v.id} [${v.impact}] (${v.nodes.length} node${
          v.nodes.length === 1 ? "" : "s"
        })`,
      );
    }
  }
  return lines.join("\n");
}

test.describe("a11y sweep (POL-02)", () => {
  test("public routes have zero serious/critical axe violations", async ({
    page,
  }) => {
    const failures: Array<{ route: string; violations: AxeViolation[] }> = [];
    for (const route of PUBLIC_ROUTES) {
      await gotoAndSettle(page, route);
      const violations = await seriousViolations(page);
      if (violations.length > 0) failures.push({ route, violations });
    }
    expect(
      failures,
      `axe serious/critical violations:\n${formatReport(failures)}`,
    ).toEqual([]);
  });

  test("app routes + one seeded detail route have zero serious/critical axe violations", async ({
    page,
  }) => {
    // ~33 routes × (settle + axe analyze) blows past the 30s default; this is an
    // inherently long single-login sweep. Give it a generous ceiling.
    test.setTimeout(240_000);
    // ONE login covers the whole authenticated sweep (20/min auth limiter).
    await login(page);

    // Discover the active workspace (the SHARED probe the app uses) and seed one
    // item so a real /items/{id} detail route can be swept. Cookie is inherited
    // by page.request — no token plumbing.
    const wsRes = await page.request.get("/api/users/me/workspaces");
    expect(wsRes.ok()).toBeTruthy();
    const workspaces = (await wsRes.json()) as Array<{ id: string }>;
    expect(workspaces.length).toBeGreaterThan(0);
    const wsId = workspaces[0].id;

    const stamp = Date.now();
    const createRes = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      { data: { name: `A11y Sweep Widget ${stamp}`, sku: `A11Y-${stamp}` } },
    );
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { id: string };
    expect(created.id).toBeTruthy();

    const routes = [...APP_ROUTES, `/items/${created.id}`];

    const failures: Array<{ route: string; violations: AxeViolation[] }> = [];
    for (const route of routes) {
      await gotoAndSettle(page, route);
      const violations = await seriousViolations(page);
      if (violations.length > 0) failures.push({ route, violations });
    }
    expect(
      failures,
      `axe serious/critical violations:\n${formatReport(failures)}`,
    ).toEqual([]);
  });
});
