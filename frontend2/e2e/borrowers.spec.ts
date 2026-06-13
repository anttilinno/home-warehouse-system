import { test, expect, type Page } from "@playwright/test";

// Phase 9 Plan 03 — live borrower-lifecycle E2E (BORR-02 / BORR-03 / BORR-04 /
// BORR-05). Runs against the live dev stack per the CLAUDE.md §E2E runbook
// (backend :8080 + Postgres warehouse_dev + Vite :5173; no webServer
// auto-launch). This is the phase-gate browser coverage the unit/MSW layer
// cannot reach: it proves the real create → list → detail → edit → delete chain
// through the cookie-JWT boundary and the /api proxy rewrite (vite.config.ts).
//
// ONE LOGIN, ONE SPEC (Pitfall 5 / the 20/min auth limiter). The whole
// lifecycle lives in a SINGLE test so login happens exactly once; every
// subsequent backend call rides the inherited access_token cookie — no manual
// token plumbing. Run this spec ISOLATED, not batched with the other auth-heavy
// live specs.
//
// Exact-match submit discipline (CLAUDE.md): the v3.0 /login page hosts the
// primary submit alongside future OAuth buttons, so the submit MUST be selected
// with /^log in$/i to resolve uniquely.
//
// CREATE/EDIT/DELETE through the UI forms (BORR-02/04/05 — the contracts this
// gate guards). The borrower is created via /borrowers/new, edited via
// /borrowers/:id/edit, and deleted from the detail page DELETE… confirm.
//
// DELETE-GUARD scope: this spec covers the CLEAN-delete path (a borrower with NO
// active loans → DELETE… is enabled → confirm → removed). The ACTIVE-loan-blocked
// branch (DELETE… disabled + ⚠ Active loans badge + banner) is covered by the
// BorrowerDetailPage component test (Task 2) against an MSW 400 — exercising it
// live would mean seeding a loan + an extra create surface, and the auth limiter
// makes a second login costly. The component test owns the blocked branch.
//
// ROW IDENTITY — the unique borrower name (`E2E-borrower-${Date.now()}`) keeps
// the row addressable across reruns against the shared dev DB.

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

// BORR-02 → BORR-03 → BORR-04 → BORR-05 — the full borrower lifecycle through
// the live stack. A single test owns the chain because each step depends on the
// prior state, AND because the 20/min auth limiter forbids re-logging-in per
// step. The unique per-run name keeps it idempotent across runs.
test("borrower lifecycle: create via UI → list → detail → edit → clean delete", async ({
  page,
}) => {
  await loginAsSeeder(page);

  const stamp = Date.now();
  const borrowerName = `E2E-borrower-${stamp}`;
  const editedName = `${borrowerName}-edited`;
  const email = `e2e-${stamp}@example.io`;

  // ── CREATE through /borrowers/new (BORR-02). Name + email via getByLabel
  // (native form fields), then Save borrower. On success the form navigates to
  // the new borrower's detail page.
  await page.goto("/borrowers/new");
  await expect(
    page.getByRole("heading", { name: /new borrower/i }),
  ).toBeVisible();

  await page.getByLabel(/name/i).fill(borrowerName);
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: /save borrower/i }).click();

  // ── DETAIL (BORR-03): lands on /borrowers/:id; the profile shows the name +
  // the mounted BorrowerLoanPanels Active/History panels are present.
  await expect(page).toHaveURL(/\/borrowers\/[0-9a-f-]+$/i);
  // name shows in BOTH the Window titlebar and the profile <dl> → match first
  await expect(page.getByText(borrowerName).first()).toBeVisible();
  await expect(page.getByText(/active loans/i).first()).toBeVisible();
  await expect(page.getByText(/loan history/i).first()).toBeVisible();

  // ── LIST: navigate to /borrowers and find the new row (search to isolate it).
  await page.goto("/borrowers");
  await page.getByRole("searchbox").fill(borrowerName);
  const row = page.locator("table tbody tr", { hasText: borrowerName });
  await expect(row).toBeVisible();

  // ── EDIT (BORR-04): open the detail, EDIT, change the name, Save changes,
  // and assert the change on the detail page.
  await row.click();
  await expect(page).toHaveURL(/\/borrowers\/[0-9a-f-]+$/i);
  await page.getByRole("button", { name: /^edit$/i }).click();
  await expect(
    page.getByRole("heading", { name: /edit borrower/i }),
  ).toBeVisible();
  const nameField = page.getByLabel(/name/i);
  await nameField.fill(editedName);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText(editedName).first()).toBeVisible();

  // ── CLEAN DELETE (BORR-05): with NO active loans, DELETE… is enabled →
  // confirm → navigate to /borrowers, and the row is gone.
  const deleteBtn = page.getByRole("button", { name: /delete…/i });
  await expect(deleteBtn).toBeEnabled();
  await deleteBtn.click();
  const dialog = page.getByRole("dialog", { name: /delete borrower/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^delete$/i }).click();

  await expect(page).toHaveURL(/\/borrowers$/);
  await page.getByRole("searchbox").fill(editedName);
  await expect(
    page.locator("table tbody tr", { hasText: editedName }),
  ).toHaveCount(0);
});
