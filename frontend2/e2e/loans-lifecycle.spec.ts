import { test, expect, type Page } from "@playwright/test";

// Phase 8 Plan 06 — live loan-lifecycle E2E (LOAN-01 / LOAN-02 / LOAN-03). Runs
// against the live dev stack per the CLAUDE.md §E2E runbook (backend :8080 +
// Postgres warehouse_dev + Vite :5173; no webServer auto-launch). This is the
// phase-gate browser coverage the unit/MSW layer cannot reach: it proves the
// real create → Active → return → History lifecycle through the cookie-JWT
// boundary and the /api proxy rewrite (vite.config.ts). It catches a frontend
// OR backend revert of the lifecycle contract.
//
// ONE LOGIN, ONE SPEC (Pitfall 5 / T-08-E2E — the 20/min auth limiter). The
// whole lifecycle lives in a SINGLE test so login happens exactly once; every
// subsequent backend call (workspace lookup, prerequisite seeding, best-effort
// cleanup) rides the inherited access_token cookie — no manual token plumbing.
// Run this spec ISOLATED, not batched with the other auth-heavy live specs.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// primary submit alongside future OAuth buttons, so the submit MUST be selected
// with /^log in$/i to resolve uniquely.
//
// SEEDING via cookie-authed page.request (NOT the create FORMs): the lifecycle
// gate is create-loan → Active → return → History. The borrower, item, location
// and inventory ENTRY are seeded directly with page.request so the spec stays
// focused on the loan UI chain while the backend seed contracts are still
// exercised end-to-end through the proxy. The loan ITSELF is created through the
// /loans/new UI (LOAN-02) — that is the contract this gate guards.
//
// ROW IDENTITY — the unique borrower name. Loan list rows embed the borrower
// name directly (the backend decorates every LoanResponse with item + borrower
// slices), so the row we just created is addressable by its unique per-run
// borrower name (`E2E-loan-${Date.now()}`) — robust across reruns and against
// the shared dev DB accumulating fixed ids (T-08-01).

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

// LOAN-01 / LOAN-02 / LOAN-03 — the full loan lifecycle through the live stack.
// A single test owns the chain because each step depends on the prior state
// (the loan must exist + be Active before it can be returned), AND because the
// 20/min auth limiter forbids re-logging-in per step (Pitfall 5). Unique
// per-run names keep it idempotent across runs; cleanup is best-effort in
// `finally` (the borrower/item/location/entry are left inert behind unique
// names, mirroring inventory.spec.ts T-07b-13).
test("loan lifecycle: create via UI → Active → return → History", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const stamp = Date.now();
  const borrowerName = `E2E-loan-${stamp}`;
  const itemName = `E2E-LOAN-ITEM-${stamp}`;
  const itemSku = `E2E-LOAN-SKU-${stamp}`;
  const locName = `E2E-LOAN-LOC-${stamp}`;

  let entryId: string | null = null;

  try {
    // ── SEED a borrower (only `name` is required — minLength 1). Its unique
    // name is also the loan row's identity in the list below.
    const borrowerRes = await page.request.post(
      `/api/workspaces/${wsId}/borrowers`,
      { data: { name: borrowerName } },
    );
    expect(borrowerRes.status()).toBe(200);
    const borrowerId = ((await borrowerRes.json()) as { id: string }).id;
    expect(borrowerId).toBeTruthy();

    // ── SEED an item (name + required sku — the backend 422s without sku). The
    // item NAME surfaces in the inventory-entry picker option label.
    const itemRes = await page.request.post(`/api/workspaces/${wsId}/items`, {
      data: { name: itemName, sku: itemSku },
    });
    expect(itemRes.status()).toBe(200);
    const itemId = ((await itemRes.json()) as { id: string }).id;
    expect(itemId).toBeTruthy();

    // ── SEED a location (an inventory entry must live somewhere).
    const locRes = await page.request.post(
      `/api/workspaces/${wsId}/locations`,
      { data: { name: locName } },
    );
    expect(locRes.status()).toBe(200);
    const locId = ((await locRes.json()) as { id: string }).id;
    expect(locId).toBeTruthy();

    // ── SEED an inventory ENTRY (CreateInventoryInput: item_id + location_id +
    // quantity≥1 + condition + status). A loan is taken against this ENTRY's id
    // (inventory_id, NEVER item_id — Pitfall 1 / override 1).
    const entryRes = await page.request.post(
      `/api/workspaces/${wsId}/inventory`,
      {
        data: {
          item_id: itemId,
          location_id: locId,
          quantity: 1,
          condition: "GOOD",
          status: "AVAILABLE",
        },
      },
    );
    expect(entryRes.status()).toBe(200);
    entryId = ((await entryRes.json()) as { id: string }).id;
    expect(entryId).toBeTruthy();

    // ── CREATE the loan through the /loans/new UI (LOAN-02 — the only create
    // surface). The pickers are NATIVE RetroSelects: select the inventory entry
    // by its option label (which contains the seeded item name) and the borrower
    // by its unique name, then submit. On success the form navigates to the
    // Active tab.
    await page.goto("/loans/new");
    await expect(page.getByRole("heading", { name: /new loan/i })).toBeVisible();

    // Select by option VALUE (entry id / borrower id) — Playwright's
    // selectOption `label` expects an exact string, not a RegExp; the wire
    // value is the stable id captured at seed time.
    await page.getByLabel(/inventory entry/i).selectOption(entryId!);
    await page.getByLabel(/^borrower$/i).selectOption(borrowerId);

    await page.getByRole("button", { name: /create loan/i }).click();

    // ── ACTIVE: the form lands on /loans?tab=active and our loan row shows the
    // unique borrower name. Target THAT row by the borrower name so it is
    // unambiguously ours.
    await expect(page).toHaveURL(/\/loans\?tab=active/);
    const activeRow = page.locator("table tbody tr", {
      hasText: borrowerName,
    });
    await expect(activeRow).toBeVisible();
    // Status pill on the active row is Active (locale-agnostic).
    await expect(activeRow).toContainText(/active/i);

    // ── RETURN: the row's RETURN action opens the confirm dialog (blue titlebar
    // — a reversible completion, not destructive). Confirm with the dialog's
    // Return button.
    await activeRow.getByRole("button", { name: /^return$/i }).click();
    const returnDialog = page.getByRole("dialog", { name: /return loan/i });
    await expect(returnDialog).toBeVisible();
    await returnDialog.getByRole("button", { name: /^return$/i }).click();
    await expect(returnDialog).toBeHidden();

    // ── ACTIVE no longer lists the loan: the optimistic mutation moved it to
    // History, so its row leaves the Active tab.
    await expect(
      page.locator("table tbody tr", { hasText: borrowerName }),
    ).toHaveCount(0);

    // ── HISTORY: the loan now lives under /loans?tab=history with a Returned
    // status (locale-agnostic matcher).
    await page.goto("/loans?tab=history");
    await expect(page).toHaveURL(/\/loans\?tab=history/);
    const historyRow = page.locator("table tbody tr", {
      hasText: borrowerName,
    });
    await expect(historyRow).toBeVisible();
    await expect(historyRow).toContainText(/returned/i);
  } finally {
    // Best-effort cleanup: archive the inventory entry (a leaked archived row
    // never collides with a later run — the names are unique, T-08-01). The
    // seeded borrower/item/location are left inert behind their unique names (no
    // guaranteed live delete in scope).
    if (entryId) {
      await page.request
        .post(`/api/workspaces/${wsId}/inventory/${entryId}/archive`)
        .catch(() => undefined);
    }
  }
});
