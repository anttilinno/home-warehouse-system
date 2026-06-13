import { test, expect, type Page } from "@playwright/test";

// Phase 10b Plan 05, Wave 4 — live repairs + maintenance E2E (RPR-01 / RPR-02 /
// MNT-01 / MNT-02). Runs against the live dev stack per the CLAUDE.md §E2E
// runbook (backend :8080 + Postgres warehouse_dev + Vite :5173; no webServer
// auto-launch). This is the phase-gate browser coverage the unit/MSW layer
// cannot reach: it drives the real flows through the cookie-JWT boundary and the
// /api proxy rewrite (vite.config.ts):
//   A) Repairs drawer — a completed (cost-bearing) repair's cost ROLLUP renders
//      (RPR-02) + the lifecycle create → START flips Pending → In progress
//      (RPR-01).
//   B) Maintenance drawer — create a schedule due TODAY → it appears on
//      /maintenance/due → COMPLETE → the row LEAVES the due list (MNT-01 + MNT-02,
//      next_due advanced server-side).
//
// ONE LOGIN, ONE SPEC (T-10b-11 — the 20/min auth limiter). Both flows live in a
// SINGLE serial test so login happens exactly once; every subsequent backend call
// (workspace lookup, prerequisite seeding, the cost-bearing repair seed,
// best-effort cleanup) rides the inherited access_token cookie — no manual token
// plumbing. Run this spec ISOLATED, not batched with the other auth-heavy live
// specs.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEFECTS D-10b-05-01 + D-10b-05-02 — FIXED (orchestrator gate, 2026-06-13)
// ─────────────────────────────────────────────────────────────────────────────
// This spec originally surfaced two BLOCKING happy-path defects and seeded around
// them; both are now fixed and this spec drives the real UI for both:
//  • D-10b-05-01 (RPR-02): RepairsDrawer rendered the cost rollup via
//    formatCents(total, currency_code) where a zero-/no-cost repair's summary
//    carries currency_code:null; formatCents only defaulted `undefined`, so `null`
//    hit Intl.NumberFormat({currency:null}) → RangeError → white-screen on COMPLETE.
//    FIX: src/lib/utils/money.ts coalesces nullish/empty currency to EUR. This spec
//    now COMPLETES a no-cost repair through the drawer UI and asserts no crash.
//  • D-10b-05-02 (MNT-01): MaintenanceForm posted next_due as date-only `YYYY-MM-DD`
//    but POST /maintenance requires RFC 3339 date-time → 422. FIX: MaintenanceForm
//    (and RepairForm's repair_date/reminder_date) serialize the day to midnight UTC
//    before sending. This spec now CREATES the schedule through the drawer UI.
// A 30-day interval is used so the post-complete next_due (today+30) lands OUTSIDE
// the default 7-day due window and the row leaves /maintenance/due.

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

// Seed item + location + inventory entry through the cookie-authed API. Returns
// the inventory ENTRY id (repairs + schedules attach to the entry, not the item).
async function seedInventoryEntry(
  page: Page,
  wsId: string,
  stamp: number,
): Promise<string> {
  const itemRes = await page.request.post(`/api/workspaces/${wsId}/items`, {
    data: { name: `E2E-RM-ITEM-${stamp}`, sku: `E2E-RM-SKU-${stamp}` },
  });
  expect(itemRes.status()).toBe(200);
  const itemId = ((await itemRes.json()) as { id: string }).id;

  const locRes = await page.request.post(`/api/workspaces/${wsId}/locations`, {
    data: { name: `E2E-RM-LOC-${stamp}` },
  });
  expect(locRes.status()).toBe(200);
  const locId = ((await locRes.json()) as { id: string }).id;

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
  const entryId = ((await entryRes.json()) as { id: string }).id;
  expect(entryId).toBeTruthy();
  return entryId;
}

// Seed a COMPLETED, cost-bearing repair on an entry — WITH an explicit
// currency_code so the rollup row carries a non-null currency (the UI form cannot
// supply this; see D-10b-05-01). cost is integer CENTS. Drives the real lifecycle
// create → start → complete through the API so the drawer renders a genuine
// completed repair + a real rollup.
async function seedCompletedRepair(
  page: Page,
  wsId: string,
  entryId: string,
  description: string,
): Promise<void> {
  const createRes = await page.request.post(`/api/workspaces/${wsId}/repairs`, {
    data: {
      inventory_id: entryId,
      description,
      cost: 1250, // €12.50 in cents
      currency_code: "EUR",
    },
  });
  expect(createRes.status()).toBe(200);
  const repairId = ((await createRes.json()) as { id: string }).id;
  expect(repairId).toBeTruthy();

  const startRes = await page.request.post(
    `/api/workspaces/${wsId}/repairs/${repairId}/start`,
  );
  expect(startRes.status()).toBe(200);

  const completeRes = await page.request.post(
    `/api/workspaces/${wsId}/repairs/${repairId}/complete`,
    { data: {} },
  );
  expect(completeRes.status()).toBe(200);
}

// (Maintenance schedules are now created through the drawer UI in the test body —
// the D-10b-05-02 RFC3339 fix means the form's next_due is accepted. The former
// API-seed helper was removed.)

// RPR-01/RPR-02 + MNT-01/MNT-02 — both happy paths in ONE test (one login, the
// 20/min limiter). Unique per-run names keep the shared dev DB idempotent;
// cleanup archives the seeded entry in `finally` (a leaked archived row never
// collides with a later run — T-10b-12 / the inventory.spec.ts contract).
test("repairs + maintenance: repair rollup + lifecycle start, schedule due → complete leaves due list", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const stamp = Date.now();
  const completedDesc = `E2E-DONE-${stamp}`;
  const pendingDesc = `E2E-REPAIR-${stamp}`;
  const scheduleTitle = `E2E-SCHEDULE-${stamp}`;

  let entryId: string | null = null;

  try {
    entryId = await seedInventoryEntry(page, wsId, stamp);
    // Seed a completed, currency-bearing repair so the drawer's RPR-02 rollup has
    // real data to render (the UI form cannot set a currency — D-10b-05-01).
    await seedCompletedRepair(page, wsId, entryId, completedDesc);

    // ── IN-PLAN DISCOVERY GATE: the inventory list must carry at least one entry
    // (the one just seeded). Fail loudly if not — the drawers attach to a row.
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/inventory$/);
    const firstRow = page.locator("table tbody tr").first();
    await expect(
      firstRow,
      "expected at least one inventory entry row to attach the repair/maintenance drawers to",
    ).toBeVisible();

    // ════════════════════════════════════════════════════════════════════════
    // FLOW A — REPAIRS DRAWER: rollup (RPR-02) + create → START (RPR-01)
    // ════════════════════════════════════════════════════════════════════════

    // Open the per-row REPAIRS drawer (🔧 action; aria-label "Repairs").
    await firstRow.getByRole("button", { name: /^repairs$/i }).click();
    const repairsDrawer = page.getByRole("dialog", { name: /^REPAIRS/i });
    await expect(repairsDrawer).toBeVisible();

    // ── RPR-02: the cost rollup renders the seeded completed repair — the
    // formatted cost (formatCents EUR → e.g. "€12.50"; assert the locale-agnostic
    // amount) + the "1 completed" tally. (Empty copy must be absent.)
    await expect(repairsDrawer.getByText(/repair cost/i)).toBeVisible();
    await expect(
      repairsDrawer.getByText(/no completed repairs yet/i),
    ).toHaveCount(0);
    // The rollup total line uniquely reads "{formatCents} · {n} completed" (the
    // repair row meta renders "completed {date}", never "1 completed") — match the
    // tally phrase to scope to the rollup, then assert it carries the cost amount.
    const rollupLine = repairsDrawer.locator("li", {
      hasText: /1\s+completed/i,
    });
    await expect(rollupLine).toBeVisible();
    await expect(rollupLine).toContainText(/12\.50/);

    // The seeded repair row shows a "Completed" pill (RPR-01 completed display).
    const completedRow = repairsDrawer.locator("li", {
      hasText: completedDesc,
    });
    await expect(completedRow).toBeVisible();
    await expect(completedRow).toContainText(/completed/i);

    // ── RPR-01: create a NEW repair through the drawer UI (description only — no
    // cost, so completing it later would NOT be needed; we drive create → START).
    // While the list already has a row the drawer renders a single "⊕ ADD REPAIR"
    // CTA, but keep .first() defensive (the empty-state action shares the text).
    await repairsDrawer
      .getByRole("button", { name: /add repair/i })
      .first()
      .click();
    const repairForm = page.getByRole("dialog", { name: /^ADD REPAIR$/i });
    await expect(repairForm).toBeVisible();
    await repairForm.getByLabel(/description/i).fill(pendingDesc);
    await repairForm.getByRole("button", { name: /save repair/i }).click();
    await expect(repairForm).toBeHidden();

    // The new repair appears as a PENDING row (unique description).
    const pendingRow = repairsDrawer.locator("li", { hasText: pendingDesc });
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow).toContainText(/pending/i);

    // START → pill flips to "In progress" (PENDING → IN_PROGRESS) — the lifecycle
    // transition verified in a real browser.
    await pendingRow.getByRole("button", { name: /^start$/i }).click();
    await expect(pendingRow).toContainText(/in progress/i);

    // COMPLETE through the drawer UI (RPR-01 full lifecycle). This repair carries
    // NO cost → its rollup summary returns currency_code: null; formatCents now
    // coalesces nullish currency to EUR (the D-10b-05-01 fix), so the drawer must
    // NOT crash — it stays mounted and the cost-rollup header is still rendered.
    await pendingRow.getByRole("button", { name: /^complete$/i }).click();
    const completeRepairDialog = page.getByRole("dialog", {
      name: /COMPLETE REPAIR/i,
    });
    await expect(completeRepairDialog).toBeVisible();
    await completeRepairDialog
      .getByRole("button", { name: /^complete$/i })
      .click();
    await expect(completeRepairDialog).toBeHidden();
    // The drawer survived the null-currency rollup (no white-screen) and the row
    // is now Completed.
    await expect(repairsDrawer.getByText(/repair cost/i)).toBeVisible();
    await expect(pendingRow).toContainText(/completed/i);

    // Close the repairs drawer before the maintenance flow.
    await repairsDrawer.getByRole("button", { name: /^close$/i }).click();
    await expect(repairsDrawer).toBeHidden();

    // ════════════════════════════════════════════════════════════════════════
    // FLOW B — MAINTENANCE: schedule due today → /maintenance/due → complete
    // ════════════════════════════════════════════════════════════════════════

    // Open the per-row MAINTENANCE drawer (⟳ action; aria-label "Maintenance").
    const maintRow = page.locator("table tbody tr").first();
    await expect(maintRow).toBeVisible();
    await maintRow.getByRole("button", { name: /^maintenance$/i }).click();
    const maintDrawer = page.getByRole("dialog", { name: /^MAINTENANCE/i });
    await expect(maintDrawer).toBeVisible();

    // ── MNT-01: CREATE the schedule (due TODAY) through the drawer UI. The form
    // sends next_due as RFC3339 now (the D-10b-05-02 fix); a date-only value
    // would 422. The default 30-day interval is kept.
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    await maintDrawer
      .getByRole("button", { name: /add schedule/i })
      .first()
      .click();
    const schedForm = page.getByRole("dialog", { name: /ADD SCHEDULE/i });
    await expect(schedForm).toBeVisible();
    await schedForm.getByLabel(/title/i).fill(scheduleTitle);
    await schedForm.getByLabel(/next due/i).fill(today);
    await schedForm.getByRole("button", { name: /save/i }).click();
    await expect(schedForm).toBeHidden();

    // The new schedule is listed in the drawer (unique title) — proves the UI
    // create path no longer 422s.
    await expect(
      maintDrawer.locator("li", { hasText: scheduleTitle }),
    ).toBeVisible();

    // Close the drawer and navigate to the due page (the server includes a
    // due-today schedule — is_overdue is server-authoritative).
    await maintDrawer.getByRole("button", { name: /^close$/i }).click();
    await expect(maintDrawer).toBeHidden();

    await page.goto("/maintenance/due");
    await expect(page).toHaveURL(/\/maintenance\/due$/);

    // ── MNT-02: the schedule row appears on the due list (its unique title).
    const dueRow = page.locator("table tbody tr", { hasText: scheduleTitle });
    await expect(dueRow).toBeVisible();

    // COMPLETE → the blue COMPLETE MAINTENANCE? confirm → confirm COMPLETE.
    await dueRow.getByRole("button", { name: /^complete$/i }).click();
    const completeMaintDialog = page.getByRole("dialog", {
      name: /COMPLETE MAINTENANCE/i,
    });
    await expect(completeMaintDialog).toBeVisible();
    await completeMaintDialog
      .getByRole("button", { name: /^complete$/i })
      .click();
    await expect(completeMaintDialog).toBeHidden();

    // ── MNT-02: the row LEAVES the due list — completion advanced next_due to
    // today+30 (the seeded interval), past the default 7-day due window, so the
    // prefix-invalidate drops it from /maintenance/due.
    await expect(
      page.locator("table tbody tr", { hasText: scheduleTitle }),
    ).toHaveCount(0);

    // Clean up the schedule for re-runnability: reopen the drawer + DELETE it.
    await page.goto("/inventory");
    const reRow = page.locator("table tbody tr").first();
    await expect(reRow).toBeVisible();
    await reRow.getByRole("button", { name: /^maintenance$/i }).click();
    const cleanupDrawer = page.getByRole("dialog", { name: /^MAINTENANCE/i });
    await expect(cleanupDrawer).toBeVisible();
    const cleanupSchedRow = cleanupDrawer.locator("li", {
      hasText: scheduleTitle,
    });
    await expect(cleanupSchedRow).toBeVisible();
    await cleanupSchedRow.getByRole("button", { name: /^delete$/i }).click();
    const deleteSchedDialog = page.getByRole("dialog", {
      name: /DELETE SCHEDULE/i,
    });
    await expect(deleteSchedDialog).toBeVisible();
    await deleteSchedDialog
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(deleteSchedDialog).toBeHidden();
  } finally {
    // Best-effort cleanup: archive the seeded inventory entry (a leaked archived
    // row never collides with a later run — the names are unique, T-10b-12). The
    // seeded item + location are left inert behind their unique names.
    if (entryId) {
      await page.request
        .post(`/api/workspaces/${wsId}/inventory/${entryId}/archive`)
        .catch(() => undefined);
    }
  }
});
