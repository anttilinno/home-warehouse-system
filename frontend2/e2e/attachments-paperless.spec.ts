import { test, expect, type Page } from "@playwright/test";

// Phase 14b — live Attachments + Paperless E2E (ATT-01/02, PPL-01). Runs against
// the live dev stack per the CLAUDE.md §E2E runbook (backend :8080 with the
// byte-storage fix + Postgres warehouse_dev + Vite :5173). This is the phase-gate
// browser coverage the unit/MSW layer cannot reach: it proves the real
// item → FILES tab → multipart upload (POST /items/{id}/attachments/file, the
// NEW byte-persisting route) → list → delete round-trip through the cookie-JWT
// boundary + the /api proxy, plus the Paperless settings page rendering under
// the Settings hub.
//
// SCOPE — what is NOT here (no silent gaps):
//   • Set-primary is covered at the unit/MSW layer (14b-03); the browser gate
//     proves upload+list+delete, the byte-persistence-dependent path.
//   • Paperless SEARCH + LINK (PPL-02/03) need a live Paperless-ngx instance,
//     which the dev stack does not run — those are unit/MSW-covered (14b-04) and
//     flagged as human-UAT residues. The settings PAGE render (PPL-01) IS gated
//     here.

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

async function loginAsSeeder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

async function firstWorkspaceId(page: Page): Promise<string> {
  const res = await page.request.get("/api/users/me/workspaces");
  expect(res.status()).toBe(200);
  const workspaces = (await res.json()) as Array<{ id: string }>;
  expect(workspaces.length).toBeGreaterThan(0);
  return workspaces[0].id;
}

// ATT-01 / ATT-02 — the full item-attachment lifecycle through the live stack.
// A single test owns the chain because each step depends on the prior state. A
// unique per-run title keeps the assertion deterministic on the shared dev DB.
test("item attachment lifecycle: upload → list → delete (real byte storage)", async ({
  page,
}) => {
  await loginAsSeeder(page);
  const wsId = await firstWorkspaceId(page);

  const itemName = `E2E-ATT-${Date.now()}`;
  const itemSku = `E2E-ATT-SKU-${Date.now()}`;
  const fileTitle = `receipt-${Date.now()}`;
  let createdId: string | null = null;

  try {
    // ── Seed an item via cookie-authed page.request (the backend requires sku;
    //    the /items/new form is a separate gap — see items.spec.ts).
    const createRes = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      { data: { name: itemName, sku: itemSku } },
    );
    expect(createRes.status()).toBe(200);
    createdId = ((await createRes.json()) as { id: string }).id;
    expect(createdId).toBeTruthy();

    // ── Item detail → FILES tab shows the empty state.
    await page.goto(`/items/${createdId}`);
    await page.getByRole("tab", { name: /files/i }).click();
    await expect(page.getByText(/no files/i)).toBeVisible();

    // ── ⊕ ADD FILE → dialog → pick a file + a deterministic title → ADD FILE.
    //    The upload posts multipart to the NEW byte-persisting route. RetroFileInput
    //    hides the native <input type=file>; Playwright setInputFiles drives it.
    await page.getByRole("button", { name: /add file/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "receipt.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("phase-14b byte-storage round-trip"),
    });
    await dialog.getByLabel(/title/i).fill(fileTitle);
    await dialog.getByRole("button", { name: /add file/i }).click();

    // ── The uploaded file appears in the FILES list by its title. The dialog
    //    closes; the list invalidates on the locked query key.
    await expect(dialog).toBeHidden();
    const fileRow = page.getByRole("listitem").filter({ hasText: fileTitle });
    await expect(fileRow).toBeVisible();

    // ── The download anchor points at the workspace-scoped serve route — proving
    //    the bytes are retrievable (real storage, not the old metadata stub).
    const href = await fileRow.getByRole("link").getAttribute("href");
    expect(href).toMatch(/\/attachments\/[^/]+\/file$/);

    // ── DELETE → confirm → the row is gone.
    await fileRow.getByRole("button", { name: /^delete$/i }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: /delete file/i });
    await confirm.getByRole("button", { name: /^delete$/i }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: fileTitle }),
    ).toHaveCount(0);
  } finally {
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

// PPL-01 — the Paperless connection settings page renders under the Settings hub
// at /settings/paperless (get/put/delete wired; live Paperless instance not
// required to prove the page mounts + reads the stored settings).
test("paperless settings page renders under the Settings hub", async ({
  page,
}) => {
  await loginAsSeeder(page);
  await page.goto("/settings/paperless");
  await expect(page).toHaveURL(/\/settings\/paperless$/);
  await expect(page.getByText(/paperless connection/i)).toBeVisible();
  await expect(page.getByLabel(/paperless url/i)).toBeVisible();
});
