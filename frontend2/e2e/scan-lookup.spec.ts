// Phase 65 Plan 65-11 — G-65-01 regression guard (Branch A: Playwright E2E).
//
// Why this spec exists: every Vitest unit test in Phase 65 mocked above the
// backend boundary (itemsApi.list or itemsApi.lookupByBarcode at the JS
// module layer). G-65-01 — the FTS search_vector generated column silently
// excluded the barcode column — shipped to production with all 710 unit tests
// green. A Firefox MCP UAT on 2026-04-19 caught it by manually scanning a
// known barcode and seeing `EI LEITUD` (NOT FOUND) instead of `VASTE LEITUD`
// (MATCHED).
//
// Plans 65-09 (backend) + 65-10 (frontend) fix the bug by adding a dedicated
// GET /api/workspaces/{wsId}/items/by-barcode/{code} route. THIS spec is the
// regression guard at the right layer — if any future plan reverts 65-09 OR
// 65-10, this test fails because:
//   - 65-09 revert → endpoint 404s → frontend returns null → NOT FOUND banner
//   - 65-10 revert → frontend calls list({search}) → backend FTS misses → NOT FOUND banner
// Both cases break the MATCHED-banner assertion at the bottom of this spec.
//
// Contract: requires a running backend on :8080 and frontend on :5173.
// Developer credentials are read from env vars E2E_USER / E2E_PASS (defaults
// to seeder@test.local / password — override in CI or .env.local).
//
// Auth model: the api layer uses cookie-based access_token (sent automatically
// by the browser) + in-memory refresh_token. Because Playwright's request
// fixture shares cookies with the browser context (see
// https://playwright.dev/docs/api-testing#using-request-context), any fetch
// made via `request` after the page logs in carries the same access_token
// cookie the UI holds. We therefore do NOT need to extract tokens manually.
//
// Cleanup: the test creates one item with a unique per-run barcode
// (E2E-${Date.now()}) and deletes it in a finally block. Worst-case leakage
// is one row per failed run, distinguished by the `E2E-` prefix.
import { test, expect, type APIResponse } from "@playwright/test";

const TEST_USER = process.env.E2E_USER ?? "seeder@test.local";
const TEST_PASS = process.env.E2E_PASS ?? "password";

test.describe("G-65-01 regression — scan-lookup round-trip", () => {
  test("scanned barcode resolves to workspace item via MATCHED banner", async ({
    page,
  }) => {
    const runId = Date.now();
    const TEST_BARCODE = `E2E-${runId}`;
    const TEST_NAME = `G-65-01 Regression Item ${runId}`;
    const TEST_SKU = `E2E-SKU-${runId}`;

    // 1. Log in via the UI so both the access_token cookie AND the in-memory
    //    refresh_token are set exactly the way a real user's session would be.
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_USER);
    await page.getByLabel(/password/i).fill(TEST_PASS);
    // Use exact match on the submit button (not OAuth providers or the page
    // toggle "LOGIN" button). type=submit is the credential-login CTA.
    await page
      .locator('button[type="submit"]', { hasText: /^LOG IN$/i })
      .click();

    // 2. Wait for any post-login redirect (anything outside /login). The app
    //    lands on dashboard by default — we assert just "no longer on /login"
    //    to stay robust against future landing-page changes.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 10_000,
    });

    // 3. Resolve workspaceId via the same /api/workspaces call the app made.
    //    `page.request` shares cookies with `page`, so the access_token cookie
    //    set during login rides this request automatically.
    const wsListResp = await page.request.get("/api/workspaces");
    expect(
      wsListResp.ok(),
      `GET /workspaces must succeed — got ${wsListResp.status()} ${await safeBody(wsListResp)}`,
    ).toBeTruthy();
    const wsListBody = (await wsListResp.json()) as {
      items: { id: string; is_personal?: boolean }[];
    };
    expect(
      wsListBody.items.length,
      "user must have at least one workspace",
    ).toBeGreaterThan(0);
    const personal = wsListBody.items.find((ws) => ws.is_personal);
    const wsId = (personal ?? wsListBody.items[0]).id;

    // 4. Seed an item with a known barcode through the shared cookie context.
    const createResp = await page.request.post(
      `/api/workspaces/${wsId}/items`,
      {
        data: {
          name: TEST_NAME,
          sku: TEST_SKU,
          barcode: TEST_BARCODE,
          min_stock_level: 0,
        },
      },
    );
    expect(
      createResp.status(),
      `item seed must succeed — got ${createResp.status()} ${await safeBody(createResp)}`,
    ).toBe(200);
    const created = (await createResp.json()) as {
      id: string;
      barcode: string;
    };
    expect(created.barcode).toBe(TEST_BARCODE);

    try {
      // 5. Navigate to /scan, open MANUAL tab, enter the barcode, submit.
      //    RetroTabs renders plain <button type="button"> (not role="tab"),
      //    so we target by button role + exact text.
      await page.goto("/scan");
      await page
        .getByRole("button", { name: /^manual$|^käsitsi$/i })
        .click();
      await page
        .getByLabel(/barcode or code|vöötkood|kood/i)
        .fill(TEST_BARCODE);
      await page
        .getByRole("button", { name: /^look up code$|^otsi kood$/i })
        .click();

      // 6. ASSERTION: the MATCHED banner renders with the seeded item's name.
      //    Both EN (MATCHED) and ET (VASTE LEITUD) accepted.
      await expect(
        page.getByText(/^matched$|^vaste leitud$/i).first(),
      ).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(TEST_NAME)).toBeVisible();
    } finally {
      // 7. Cleanup — best-effort delete of the seeded item.
      await page.request
        .delete(`/api/workspaces/${wsId}/items/${created.id}`)
        .catch(() => {
          /* ignore cleanup failure */
        });
    }
  });
});

async function safeBody(resp: APIResponse): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "<unreadable>";
  }
}
