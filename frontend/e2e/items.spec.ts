import { test, expect, type Page } from "@playwright/test";

// Phase 7 Plan 07 — live item-lifecycle E2E (ITEM-01 / ITEM-05). Runs against
// the live dev stack per the CLAUDE.md §E2E runbook (backend :8080 + Postgres
// warehouse_dev + Vite :5173; no webServer auto-launch). This is the phase-gate
// browser coverage the unit/MSW layer cannot reach: it proves the real
// create → list → detail → archive → filtered-out → archived-facet-reveal →
// unarchive round-trip through the cookie-JWT boundary and the /api proxy.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// OAuth buttons, so the primary submit MUST be selected with /^log in$/i to
// resolve uniquely. After login the access_token cookie is inherited by BOTH
// the page context AND page.request — additional API calls (workspace lookup,
// best-effort cleanup) need no manual token plumbing.
//
// SCOPE — what is NOT here, and why (no silent gaps):
//   • Photo upload is intentionally NOT exercised at the browser level. The
//     EXIF-rotated phone-JPEG + lightbox + zip flows need real image fixtures
//     and an eyeball (07-VALIDATION "Manual-Only Verifications"); the upload
//     accept-list / URL-rewrite / compress paths are covered by unit + MSW
//     (07-VALIDATION ITEM-07/08). Adding a file fixture here buys no assertion
//     the unit layer doesn't already make.
//   • Create is seeded via cookie-authed page.request (not the /items/new
//     form): the backend REQUIRES `sku` on create, but the current form does
//     not collect/submit one (it 422s — deferred Plan-05/06 gap, see
//     07/deferred-items.md). The plan explicitly sanctions page.request seeding
//     as the alternative create path, so the lifecycle gate (ITEM-01/05) is
//     proven without coupling to that separate form bug.
//   • The by-barcode browser spec is STILL a gap (CLAUDE.md): the Phase 65
//     scan-lookup Playwright spec was wiped with the v2.2 frontend. The
//     `itemsApi.lookupByBarcode` helper is re-added + unit-tested this phase
//     (ITEM-09) and the backend G-65-01 integration test guards the server
//     side, but the browser-level by-barcode flow lands when the scan feature
//     is rebuilt in Phase 11.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Shared seeder login. Exact-match submit (multi-button login page).
async function loginAsSeeder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

// The seeder's first workspace id. page.request inherits the cookie, so the
// authenticated /users/me/workspaces call (the same endpoint WorkspaceProvider
// uses) needs no manual token. Used for cookie-authed item seeding + cleanup.
async function firstWorkspaceId(page: Page): Promise<string> {
  const res = await page.request.get("/api/users/me/workspaces");
  expect(res.status()).toBe(200);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  expect(workspaces.length).toBeGreaterThan(0);
  return workspaces[0].id;
}

// ITEM-01 / ITEM-05 — the full item lifecycle through the live stack. A single
// test owns the chain because each step depends on the prior row existing; a
// unique per-run name (`E2E-${Date.now()}`) keeps it idempotent across runs and
// keeps the shared dev DB from accumulating fixed ids (T-07-20). Cleanup is
// best-effort in `finally` (the seeder cannot be guaranteed a delete endpoint
// on a live item, so a leaked archived row is acceptable — the unique name
// means it never collides with a later run).
test("item lifecycle: create → list → detail → archive → hidden → reveal → unarchive", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const itemName = `E2E-${Date.now()}`;
  // The backend requires `sku` on create (422 "expected required property sku
  // to be present" otherwise). The current /items/new form does NOT collect or
  // submit a SKU (it sends name + optional fields only), so a form-driven
  // create 422s today — tracked as a deferred Plan-05/06 gap, NOT this spec's
  // concern. The plan sanctions cookie-authed page.request seeding as the
  // alternative create path, so we seed the row directly and exercise the
  // list → detail → archive → reveal → unarchive UI chain (the ITEM-01/05 gate)
  // against it. page.request inherits the access_token cookie (no token plumbing).
  const itemSku = `E2E-SKU-${Date.now()}`;
  let createdId: string | null = null;

  try {
    // ── CREATE via cookie-authed seed (name + required sku). Returns the
    // ItemResponse with the new id.
    const createRes = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      { data: { name: itemName, sku: itemSku } },
    );
    expect(createRes.status()).toBe(200);
    createdId = ((await createRes.json()) as { id: string }).id;
    expect(createdId).toBeTruthy();

    // ── DETAIL renders the freshly-created item by id: the name shows in the
    // DETAILS field grid AND the Window titlebar (ITEM-02 surface).
    await page.goto(`/items/${createdId}`);
    await expect(page).toHaveURL(new RegExp(`/items/${createdId}$`));
    await expect(page.getByText(itemName).first()).toBeVisible();

    // ── LIST: the new item appears in the default (non-archived) list.
    await page.goto("/items");
    await expect(page).toHaveURL(/\/items$/);
    const liveRow = page.getByRole("row").filter({ hasText: itemName });
    await expect(liveRow).toBeVisible();

    // ── DETAIL via row click: the row navigates to the detail route and the
    // name renders there too (ITEM-02 surface, exercised as the lifecycle hop).
    await liveRow.click();
    await expect(page).toHaveURL(new RegExp(`/items/${createdId}$`));
    await expect(page.getByText(itemName).first()).toBeVisible();

    // ── ARCHIVE via the detail titlebar overflow menu (↧ → ARCHIVE). The
    // overflow button is the "More actions" labelled BevelButton; the menu
    // hosts the ARCHIVE item.
    await page.getByRole("button", { name: /more actions/i }).click();
    await page.getByRole("button", { name: /^archive$/i }).click();

    // ── HIDDEN: back on the default list the archived row is filtered out
    // (ITEM-05 default = non-archived). Assert the row is gone.
    await page.goto("/items");
    await expect(page).toHaveURL(/\/items$/);
    await expect(
      page.getByRole("row").filter({ hasText: itemName }),
    ).toHaveCount(0);

    // ── REVEAL: turning on the ARCHIVED facet (the FilterPopover's "Show
    // archived" option) flips ?archived=true and the row reappears, now flagged
    // ARCHIVED. We drive the facet through the URL param the popover writes —
    // the popover trigger + option are the user path, but the URL is the SSOT
    // (Pattern 1) and is the deterministic, locale-agnostic way to assert it.
    await page.goto("/items?archived=true&page=1");
    const archivedRow = page.getByRole("row").filter({ hasText: itemName });
    await expect(archivedRow).toBeVisible();
    await expect(archivedRow.getByText(/archived/i)).toBeVisible();

    // ── UNARCHIVE: the archived row exposes a RESTORE action. Clicking it
    // restores the item; with the archived facet still on it stays visible, and
    // back on the DEFAULT list it returns (no longer filtered out).
    await archivedRow.getByRole("button", { name: /^restore$/i }).click();

    await page.goto("/items");
    await expect(page).toHaveURL(/\/items$/);
    const restoredRow = page.getByRole("row").filter({ hasText: itemName });
    await expect(restoredRow).toBeVisible();
    // It is no longer flagged ARCHIVED in the default list (IN STOCK status).
    await expect(restoredRow.getByText(/archived/i)).toHaveCount(0);
  } finally {
    // Best-effort cleanup: archive then delete (delete is archived-only per
    // ITEM-06 server/UI convention). Failures are swallowed — a leaked unique
    // row never collides with a later run (T-07-20).
    if (createdId) {
      await page.request
        .post(`/api/workspaces/${wsId}/items/${createdId}/archive`)
        .catch(() => undefined);
      await page.request
        .delete(`/api/workspaces/${wsId}/items/${createdId}`)
        .catch(() => undefined);
    }
  }
});
