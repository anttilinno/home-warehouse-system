import { test, expect, type Page } from "@playwright/test";

// Phase 11 Plan 08 — live by-barcode lookup E2E (G-65-01 re-add). Restores the
// browser-level barcode-lookup guard that was wiped with the v2.2 frontend2
// rebuild (CLAUDE.md §Backend Integration Tests: "Frontend-side barcode-lookup
// coverage is currently NOWHERE … must be re-added"). Runs against the live dev
// stack per the CLAUDE.md §E2E runbook (backend :8080 + Postgres warehouse_dev +
// Vite :5173; no webServer auto-launch).
//
// MANUAL-ENTRY PATH (binding override / CLAUDE.md): a real camera cannot be
// driven in CI, so this exercises the CI-drivable path — the /scan MANUAL tab's
// ManualBarcodeEntry. The manual submit funnels through the SAME
// useScanResolve.handleResolveCode as a live decode (ScanPage binding override 7),
// so this guards the real lookupByBarcode → 4-state banner contract end to end:
//   - seeded code      → MATCH banner (StatusPill "MATCH" + the item name)
//   - random absent code → NOT-FOUND banner (StatusPill "NOT FOUND" + CREATE WITH
//     CODE link to /items/new?barcode=…)
//
// ONE LOGIN, ONE SPEC (Pitfall 5 / the 20/min auth limiter). The whole flow is a
// SINGLE test so login happens exactly once; every subsequent backend call rides
// the inherited access_token cookie — no manual token plumbing. Run this spec
// ISOLATED, not batched with the other auth-heavy live specs.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// primary submit alongside future OAuth buttons, so the submit MUST be selected
// with /^log in$/i to resolve uniquely.
//
// SEEDING via cookie-authed page.request (NOT a UI form): POST the matching item
// directly into the seeder's first workspace, then a discovery step
// (lookupByBarcode endpoint) GATES that the seeded code resolves server-side
// before the UI assertions — so a UI MATCH failure cannot be masked by a missing
// seed. The backend item-create input accepts `barcode` (handler.go:314), and the
// by-barcode lookup is workspace-scoped (`WHERE barcode = $2 AND workspace_id = $1`).
//
// CODE IDENTITY — a unique per-run 13-digit barcode keeps the seeded row
// addressable across reruns against the shared dev DB; the random absent code is
// a distinct 13-digit string guaranteed not to collide with the seed.

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
// uses) resolves the workspace the UI will operate in.
async function firstWorkspaceId(page: Page): Promise<string> {
  const res = await page.request.get("/api/users/me/workspaces");
  expect(res.status()).toBe(200);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  expect(workspaces.length).toBeGreaterThan(0);
  return workspaces[0].id;
}

// SCAN-05 / SCAN-08 / SCAN-09 — the by-barcode lookup chain through the live
// stack. A single test owns the flow because the 20/min auth limiter forbids
// re-logging-in, and the MATCH/NOT-FOUND assertions both ride the one session.
test("by-barcode lookup: MANUAL tab → MATCH banner for a seeded code, NOT-FOUND for an absent code", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const stamp = Date.now();
  const itemName = `E2E-SCAN-${stamp}`;
  const itemSku = `E2E-SCAN-SKU-${stamp}`;
  // A unique 13-digit barcode for the seed; a distinct 13-digit string for the
  // guaranteed-absent miss (different leading digit → cannot collide).
  const seededCode = `9${String(stamp).slice(-12).padStart(12, "0")}`;
  const absentCode = `1${String(stamp + 7).slice(-12).padStart(12, "0")}`;
  expect(seededCode).not.toBe(absentCode);

  // ── SEED the matching item with a known barcode (name + required sku — the
  // backend 422s without sku — plus the barcode the lookup will match on).
  const itemRes = await page.request.post(`/api/workspaces/${wsId}/items`, {
    data: { name: itemName, sku: itemSku, barcode: seededCode },
  });
  expect(itemRes.status()).toBe(200);
  const itemId = ((await itemRes.json()) as { id: string }).id;
  expect(itemId).toBeTruthy();

  // ── DISCOVERY GATE: the by-barcode endpoint (the exact one the UI funnel
  // calls) must resolve the seeded item server-side BEFORE asserting the UI, so
  // a UI MATCH failure cannot be masked by a bad seed. The absent code must 404.
  const matchRes = await page.request.get(
    `/api/workspaces/${wsId}/items/by-barcode/${encodeURIComponent(seededCode)}`,
  );
  expect(matchRes.status()).toBe(200);
  expect(((await matchRes.json()) as { id: string }).id).toBe(itemId);

  const missRes = await page.request.get(
    `/api/workspaces/${wsId}/items/by-barcode/${encodeURIComponent(absentCode)}`,
  );
  expect(missRes.status()).toBe(404);

  // ── MATCH PATH: open /scan on the MANUAL tab (deep-link ?tab=manual — the same
  // tab state the RetroTabs control drives), type the seeded code, LOOK UP CODE.
  await page.goto("/scan?tab=manual");
  const manualTab = page.getByRole("tab", { name: /manual/i });
  const scanTab = page.getByRole("tab", { name: /^scan$/i });
  await expect(manualTab).toHaveAttribute("aria-selected", "true");

  // ManualBarcodeEntry: RetroInput labelled ENTER CODE → LOOK UP CODE submit.
  await page.getByLabel(/enter code/i).fill(seededCode);
  await page.getByRole("button", { name: /look up code/i }).click();

  // ScanPage architecture (binding override 1): the 4-state ScanResultBanner
  // renders inside the PERSISTENT camera/scan layer (CSS-toggled, never
  // unmounted), NOT inside the Manual panel — the manual submit sets the shared
  // banner state, but it is DISPLAYED on the Scan tab. So switch to Scan to view
  // the result, mirroring the real user's eyes returning to the viewfinder.
  await scanTab.click();
  await expect(scanTab).toHaveAttribute("aria-selected", "true");

  // On MATCH the banner shows the "MATCH" StatusPill + the item name.
  // Field-verb-prefix locator discipline (commit bf694bba): match the state word.
  await expect(page.getByText(/^MATCH$/).first()).toBeVisible();
  await expect(page.getByText(itemName).first()).toBeVisible();

  // ── NOT-FOUND PATH: back to MANUAL (the input cleared on the prior submit),
  // type the absent code and look it up again (same session).
  await manualTab.click();
  await page.getByLabel(/enter code/i).fill(absentCode);
  await page.getByRole("button", { name: /look up code/i }).click();

  // View the result on the Scan tab again. NOT-FOUND banner: "NOT FOUND" state
  // word + the CREATE WITH CODE affordance (a link to /items/new?barcode=<code>).
  await scanTab.click();
  await expect(page.getByText(/NOT FOUND/i).first()).toBeVisible();
  const createCta = page.getByRole("link", { name: /create with code/i });
  await expect(createCta).toBeVisible();
  await expect(createCta).toHaveAttribute(
    "href",
    new RegExp(`/items/new\\?barcode=${absentCode}`),
  );
});
