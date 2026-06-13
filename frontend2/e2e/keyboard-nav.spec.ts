import { test, expect, type Page } from "@playwright/test";

// POL-03 — keyboard navigation audit (chromium is the hard gate; 17-VALIDATION
// runs `bun run test:e2e e2e/keyboard-nav.spec.ts`). Runs against the live dev
// stack per CLAUDE.md §E2E (backend :8080 + Postgres + Vite :5173 up).
//
// Proves three things on a representative authenticated route:
//   1. focus-visible reachable — Tab moves focus AND the focused element shows a
//      visible outline ring (the POL-03 global fallback OR a per-component rule
//      guarantees this). Asserted via getComputedStyle on document.activeElement.
//   2. ESC closes a modal, no trap — the command palette opens on ControlOrMeta+k,
//      ESC hides it AND the route is unchanged (no logout / no nav).
//   3. no keyboard trap — outside any modal, repeated Tab eventually moves focus
//      off any single widget (focus is never stuck on one element).
//
// Assertions are kept chromium-stable (chromium is the gate; Firefox has outline
// quirks). Auth contract (CLAUDE.md): /login → Email + Password labels → submit
// /^log in$/i; ONE login per test (20/min auth limiter).

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Palette overlay scrim testid + open chord, mirrored from command-palette.spec.
const PALETTE = '[data-testid="command-palette"]';

/** Log in via the real /login flow and land on the dashboard (one login/test). */
async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

/** Read a stable identity for the active element so we can detect focus motion
 *  across Tab presses without depending on element refs surviving navigation. */
async function activeElementSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "none";
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).join(".")}`
        : "";
    const label =
      el.getAttribute("aria-label") ??
      el.getAttribute("name") ??
      (el.textContent ?? "").trim().slice(0, 24);
    return `${el.tagName.toLowerCase()}${id}${cls}|${label}`;
  });
}

/** Whether the active element currently paints a visible outline ring. */
async function activeElementHasFocusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const cs = getComputedStyle(el);
    const style = cs.outlineStyle;
    const width = parseFloat(cs.outlineWidth || "0");
    return style !== "none" && width > 0;
  });
}

test.describe("keyboard navigation (POL-03)", () => {
  test("Tab reaches an interactive element with a visible focus ring", async ({
    page,
  }) => {
    await login(page);
    // Anchor focus at the document start so Tab walks the natural focus order.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

    let sawFocusRing = false;
    let lastSignature = await activeElementSignature(page);
    let moved = false;

    // Bounded walk — assert focus both MOVES and (at least once) shows a ring.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const sig = await activeElementSignature(page);
      if (sig !== lastSignature) moved = true;
      lastSignature = sig;
      if (await activeElementHasFocusRing(page)) {
        sawFocusRing = true;
        break;
      }
    }

    expect(moved, "Tab should move focus between elements").toBeTruthy();
    expect(
      sawFocusRing,
      "a Tab-focused element should show a visible :focus-visible outline ring",
    ).toBeTruthy();
  });

  test("ESC closes the command palette without a route change or trap", async ({
    page,
  }) => {
    await login(page);
    const overlay = page.locator(PALETTE);

    // Open via ControlOrMeta+k (tinykeys $mod = Ctrl on Linux CI / ⌘ on macOS).
    await page.keyboard.press("ControlOrMeta+k");
    await expect(overlay).toBeVisible();

    // ESC pops the modal stack — overlay gone AND route unchanged (no logout/nav).
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(page).toHaveURL("/");

    // No keyboard trap: outside any modal, repeated Tab must eventually leave any
    // single widget — focus is never stuck on one element for the whole walk.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      seen.add(await activeElementSignature(page));
    }
    expect(
      seen.size,
      "Tab must reach more than one element (no single-widget trap)",
    ).toBeGreaterThan(1);
    // The palette is still closed after the Tab walk (ESC truly dismissed it).
    await expect(overlay).toBeHidden();
  });
});
