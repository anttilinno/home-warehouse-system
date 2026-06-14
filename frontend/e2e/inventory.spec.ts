import { test, expect, type Page } from "@playwright/test";

// Phase 7b Plan 06 — live inventory-lifecycle E2E (INV-01 / INV-04 / INV-07).
// Runs against the live dev stack per the CLAUDE.md §E2E runbook (backend :8080
// + Postgres warehouse_dev + Vite :5173; no webServer auto-launch). This is the
// phase-gate browser coverage the unit/MSW layer cannot reach: it proves the
// real create → list → move → movements lifecycle through the cookie-JWT
// boundary and the /api proxy rewrite (vite.config.ts).
//
// THE MOVE-BEFORE-MOVEMENTS CONTRACT (07b-RESEARCH Pitfall 3): movements start
// EMPTY. A movement record is created ONLY by a move (POST /inventory/{id}/move
// — the server writes the row as a side effect). The spec therefore MUST perform
// the move BEFORE asserting any movement row exists; asserting movements on a
// freshly-created entry would be a false expectation. The whole point of this
// gate is to prove that the first movement row appears exactly after the move.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// primary submit alongside future OAuth buttons, so the submit MUST be selected
// with /^log in$/i to resolve uniquely. After login the access_token cookie is
// inherited by BOTH the page context AND page.request — additional API calls
// (workspace lookup, prerequisite seeding, best-effort cleanup) need no manual
// token plumbing.
//
// SEEDING via cookie-authed page.request (NOT the /inventory/new form): the
// lifecycle gate is create → list → move → movements, and the create FORM path
// is its own surface (covered by unit/MSW + the form's own tests). Seeding the
// item, the two locations, and the inventory entry directly with page.request
// keeps this spec focused on the list → move → movements UI chain while the
// backend create contract (item_id/location_id/quantity≥1/condition/status —
// CreateInventoryInput) is exercised end-to-end through the proxy.
//
// ROW IDENTITY — why NOT the item name. The /inventory list joins item NAMES
// from a sibling items query, but that join can render a muted "—" instead of
// the name (the list requests items at limit=200 while the backend item list
// caps limit at 100 — a pre-existing list-page join quirk, out of this spec's
// scope). The list is ordered created_at DESC server-side, so the entry we just
// created is the FIRST tbody data row. We therefore target the first data row
// and assert the SEEDED quantity / status / condition (1 / Available / Good) to
// prove it is OUR freshly-created entry, independent of the fragile name join.

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
// uses) needs no manual token. Used for cookie-authed seeding + cleanup.
async function firstWorkspaceId(page: Page): Promise<string> {
  const res = await page.request.get("/api/users/me/workspaces");
  expect(res.status()).toBe(200);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  expect(workspaces.length).toBeGreaterThan(0);
  return workspaces[0].id;
}

// INV-01 / INV-04 / INV-07 — the full inventory lifecycle through the live
// stack. A single test owns the chain because each step depends on the prior row
// existing; unique per-run names (`E2E-${Date.now()}`) keep it idempotent across
// runs and keep the shared dev DB from accumulating fixed ids (T-07b-13).
// Cleanup is best-effort in `finally` (archive the entry — a leaked archived row
// never collides with a later run since the name is unique, mirroring
// items.spec.ts T-07-20).
test("inventory lifecycle: create entry → list → move → movements recorded", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const stamp = Date.now();
  const itemName = `E2E-INV-${stamp}`;
  const itemSku = `E2E-INV-SKU-${stamp}`;
  const fromLocName = `E2E-LOC-FROM-${stamp}`;
  const toLocName = `E2E-LOC-TO-${stamp}`;

  let entryId: string | null = null;

  try {
    // ── SEED an item (name + required sku — the backend 422s without sku).
    const itemRes = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      { data: { name: itemName, sku: itemSku } },
    );
    expect(itemRes.status()).toBe(200);
    const itemId = ((await itemRes.json()) as { id: string }).id;
    expect(itemId).toBeTruthy();

    // ── SEED two locations (the move target must differ from the origin).
    const fromRes = await page.request.post(
      `/api/workspaces/${wsId}/locations`,
      { data: { name: fromLocName } },
    );
    expect(fromRes.status()).toBe(200);
    const fromLocId = ((await fromRes.json()) as { id: string }).id;

    const toRes = await page.request.post(
      `/api/workspaces/${wsId}/locations`,
      { data: { name: toLocName } },
    );
    expect(toRes.status()).toBe(200);
    const toLocId = ((await toRes.json()) as { id: string }).id;
    expect(toLocId).not.toBe(fromLocId);

    // ── CREATE the inventory entry at the FIRST location (CreateInventoryInput:
    // item_id + location_id + quantity≥1 + condition + status are all required).
    const createRes = await page.request.post(
      `/api/workspaces/${wsId}/inventory`,
      {
        data: {
          item_id: itemId,
          location_id: fromLocId,
          quantity: 1,
          condition: "GOOD",
          status: "AVAILABLE",
        },
      },
    );
    expect(createRes.status()).toBe(200);
    entryId = ((await createRes.json()) as { id: string }).id;
    expect(entryId).toBeTruthy();

    // ── LIST: the new entry is the FIRST tbody row (created_at DESC). Assert the
    // seeded quantity (1), status (Available) and condition (Good) to confirm
    // this is OUR entry without relying on the fragile item-name join.
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/inventory$/);
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();
    // NOTE: InlineEditCell aria-label is `edit {field} for {itemName}`, falling
    // back to "this entry" only when the item-name join is unresolved. Since the
    // join now resolves names (limit clamped to the backend cap of 100, and the
    // dev workspace has <100 items), the label carries the real item name —
    // match on the field+verb prefix, not the volatile name suffix.
    await expect(
      row.getByRole("button", { name: /edit status for /i }),
    ).toContainText(/available/i);
    await expect(
      row.getByRole("button", { name: /edit condition for /i }),
    ).toContainText(/good/i);

    // ── MOVE: the row MOVE action opens the MoveDialog; select the SECOND
    // location and confirm. The dialog is location-only (whole-entry relocate —
    // INV-04, no quantity split). MOVE is disabled until the target differs.
    await row.getByRole("button", { name: /^move$/i }).click();
    const moveDialog = page.getByRole("dialog", { name: /move entry/i });
    await expect(moveDialog).toBeVisible();

    // The "To location" RetroSelect — pick the second location by its label.
    await moveDialog
      .getByLabel(/to location/i)
      .selectOption({ label: toLocName });

    // Confirm the move; the dialog closes on success (success toast + invalidate).
    await moveDialog.getByRole("button", { name: /^move$/i }).click();
    await expect(moveDialog).toBeHidden();

    // ── MOVEMENTS: open the entry's movements drawer (the per-row ↧ button,
    // aria-label "Movement history"). It MUST now show at least one row — the
    // move just created the first movement (Pitfall 3's move-only semantic).
    // The post-move list re-render keeps our entry as the first tbody row.
    const movedRow = page.locator("table tbody tr").first();
    await expect(movedRow).toBeVisible();
    await movedRow
      .getByRole("button", { name: /movement history/i })
      .click();

    const movementsDrawer = page.getByRole("dialog", { name: /movements/i });
    await expect(movementsDrawer).toBeVisible();
    // The drawer's "NO MOVEMENTS" empty state must be ABSENT, and at least one
    // movement list row must be present (the move that just happened).
    await expect(
      movementsDrawer.getByText(/no movements/i),
    ).toHaveCount(0);
    await expect(
      movementsDrawer.locator("ul li").first(),
    ).toBeVisible();
  } finally {
    // Best-effort cleanup: archive the entry (a leaked archived row never
    // collides with a later run since the name is unique — T-07b-13). The seeded
    // item + locations are left (no guaranteed live delete); their unique names
    // keep them inert across runs.
    if (entryId) {
      await page.request
        .post(`/api/workspaces/${wsId}/inventory/${entryId}/archive`)
        .catch(() => undefined);
    }
  }
});
