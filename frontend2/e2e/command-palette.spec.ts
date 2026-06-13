import { test, expect, type Page } from "@playwright/test";

// Phase 16 Command Palette (TUI-05 / §4) browser spec — chromium project only
// (16-VALIDATION). Runs against the live dev stack per the CLAUDE.md §E2E
// runbook (backend + Postgres + Vite dev server up; no webServer in
// playwright.config). Proves the 16-03 ShellChrome mount end-to-end:
//
//   SC1  open via ⌘K/Ctrl+K (Meta+k) AND via F2 (both chords)
//   SC2  type to filter the static Routes group
//   SC3  ArrowDown + Enter navigates to the selected route; ESC closes the
//        overlay without leaving the route (modal-stack pop, TUI-02)
//   SC4  entity-search → an item row appears → Enter lands on /items/{id}
//
// Auth contract (CLAUDE.md): /login → Email + Password labels → submit
// /^log in$/i; the access_token cookie is inherited by BOTH the page context
// and page.request, so API seeding needs no manual token plumbing. Honor the
// 20/min auth limiter — exactly ONE login per test.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// The palette overlay scrim carries data-testid="command-palette" (16-02). Its
// search box is a cmdk CommandInput (role textbox); the Routes group rows are
// cmdk CommandItems.
const PALETTE = '[data-testid="command-palette"]';

/** Log in via the real /login flow and land on the dashboard (one login/test). */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

test.describe("command palette", () => {
  test("opens via ⌘K/Ctrl+K AND via F2 (SC1)", async ({ page }) => {
    await login(page);
    const overlay = page.locator(PALETTE);

    // Chord 1 — ControlOrMeta+k: Playwright's ControlOrMeta resolves to Meta on
    // macOS / Control elsewhere, matching tinykeys `$mod` (⌘ on Apple, Ctrl on
    // Linux/Windows). On the Linux CI box this presses Ctrl+K.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(overlay).toBeVisible();

    // ESC pops it via the shared modal stack — and must NOT log out (TUI-02).
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(page).toHaveURL("/");

    // Chord 2 — F2 (fires even from inputs; 16-02 chord owner).
    await page.keyboard.press("F2");
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });

  test("filters routes, Arrow+Enter navigates, ESC closes (SC2/SC3)", async ({
    page,
  }) => {
    await login(page);
    const overlay = page.locator(PALETTE);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(overlay).toBeVisible();

    // SC2 — type a static Routes label; the matching row substring-filters in.
    // "Borrowers" → /borrowers (paletteRoutes), a stable, no-arg route.
    await page.keyboard.type("Borrowers");
    const row = overlay.getByText(/borrowers/i).first();
    await expect(row).toBeVisible();

    // SC3 — ArrowDown selects the first (filtered) row, Enter navigates.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/borrowers$/);
    // Selecting a row closes the palette.
    await expect(overlay).toBeHidden();

    // ESC modal-stack pop — reopen, ESC, assert overlay gone + route intact.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(page).toHaveURL(/\/borrowers$/);
  });

  test("entity-search finds an item and navigates to /items/{id} (SC4)", async ({
    page,
  }) => {
    await login(page);

    // Discover the active workspace (the SHARED ["workspaces"] probe the app
    // uses) so seeding/listing hits the right tenant. The cookie is inherited
    // by page.request — no token plumbing.
    const wsRes = await page.request.get("/api/users/me/workspaces");
    expect(wsRes.ok()).toBeTruthy();
    const workspaces = (await wsRes.json()) as Array<{ id: string }>;
    expect(workspaces.length).toBeGreaterThan(0);
    const wsId = workspaces[0].id;

    // Seed a uniquely-named item so the substring search matches EXACTLY one
    // entity row deterministically (a known-unique token avoids flaking on
    // whatever else the dev DB holds).
    const unique = `Palette E2E Widget ${Date.now()}`;
    const createRes = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      { data: { name: unique, sku: `PAL-E2E-${Date.now()}` } },
    );
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { id: string };
    expect(created.id).toBeTruthy();

    const overlay = page.locator(PALETTE);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(overlay).toBeVisible();

    // Type the unique token; the debounced (250ms) entity search resolves an
    // Items group row carrying the seeded name.
    await page.keyboard.type(unique);
    const itemRow = overlay.getByText(unique, { exact: false });
    await expect(itemRow).toBeVisible({ timeout: 10_000 });

    // Click the entity row → navigates to /items/{id} (item entity toFor).
    await itemRow.click();
    await expect(page).toHaveURL(new RegExp(`/items/${created.id}$`));
    await expect(overlay).toBeHidden();
  });
});
