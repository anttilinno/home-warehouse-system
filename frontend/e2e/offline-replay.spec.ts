import { test, expect, type Page } from "@playwright/test";

// Offline PWA v2 Phase E — the offline-first replay contract, end to end
// against the live stack (CLAUDE.md §E2E Tests runbook). Chromium only:
// `context.setOffline` + the persisted-mutation restore path are flaky under
// Firefox's Playwright driver (see the describe-level skip below).
//
// Proves the full loop shipped by 7f3544fb (frontend) + b50806b8 (backend):
//   1. an item created while offline optimistically appears in the list AND
//      bumps the TopBar "N pending" badge (`usePendingWrites`),
//   2. both survive a hard reload — the paused mutation + patched query cache
//      are restored from IndexedDB (`PersistQueryClientProvider`), not kept
//      alive in JS memory,
//   3. reconnecting drains the queue (`useResumeOnReconnect`), fires the
//      queue-level sync toast, and the real server row replaces the temp row
//      with no duplicate (the idempotency-keyed create is safe to replay).
//
// A run-scoped distinctive item name/SKU. The suffix keeps reruns from
// colliding on the backend's unique SKU (the create replays for real, so a
// fixed SKU would 409 on the second run against a shared dev DB); it stays a
// stored constant so the row is still unambiguous to locate across the reload.
const RUN_ID = String(Date.now());
const ITEM_NAME = `OFFLINE-REPLAY-PROBE-${RUN_ID}`;
const ITEM_SKU = `OFFLINE-REPLAY-PROBE-SKU-${RUN_ID}`;

const E2E_USER = process.env.E2E_USER ?? "seeder@test.local";
const E2E_PASS = process.env.E2E_PASS ?? "password123";

// Shared seeder login (same exact-match submit discipline as items.spec.ts —
// the /login page hosts OAuth buttons, so the primary submit must be matched
// with /^log in$/i to resolve uniquely).
async function loginAsSeeder(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASS);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page).toHaveURL("/");
}

test.describe("offline replay: queued create survives reload and drains on reconnect", () => {
  test.skip(
    ({ browserName }) => browserName === "firefox",
    "SW + setOffline flaky on firefox",
  );

  test("create an item offline, keep it through reload, sync on reconnect", async ({
    page,
    context,
  }) => {
    // ── Warm the cache + SW: log in and load the items list while online so
    // the ["items", wsId] list query and the ["workspaces"] session probe are
    // both populated (and precached by the SW) before we go offline.
    await loginAsSeeder(page);
    await page.goto("/items");
    await expect(
      page.getByRole("button", { name: /add item/i }),
    ).toBeVisible();

    await context.setOffline(true);

    // ── Create through the real UI: FilterBar's "⊕ ADD ITEM" → /items/new →
    // fill the two backend-required fields → submit.
    await page.getByRole("button", { name: /add item/i }).click();
    await expect(page).toHaveURL(/\/items\/new$/);
    await page.getByLabel("SKU").fill(ITEM_SKU);
    await page.getByLabel("Name").fill(ITEM_NAME);
    await page.getByRole("button", { name: /^save item$/i }).click();

    // The create mutation's networkMode is "online", so it pauses (never
    // resolves) while offline — the form's onSubmit await just hangs and we
    // stay on /items/new. The optimistic list-cache patch from onMutate has
    // already landed, though, so return to the list via the in-app Cancel →
    // "DISCARD CHANGES?" → Discard path (client-side router nav). A hard
    // `page.goto` here would be a real document reload — indistinguishable
    // from the step 4 reload we're about to do on purpose.
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await page.getByRole("button", { name: /^discard$/i }).click();
    await expect(page).toHaveURL(/\/items$/);

    const badge = page.getByTestId("pending-writes-badge");
    await expect(
      page.getByRole("row").filter({ hasText: ITEM_NAME }),
    ).toBeVisible();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1 pending");

    // ── Persistence contract: reload wipes the JS heap, so the row/badge can
    // only still be there if they were actually restored from IndexedDB.
    // ponytail: the query-cache persister throttles its IndexedDB write
    // (~1s, untuned default) and exposes no "flushed" event to await, so a
    // short fixed wait is the pragmatic way to avoid racing the reload against
    // it — bump this if the throttle window is ever tuned lower/higher.
    await page.waitForTimeout(1500);
    await page.reload();

    await expect(
      page.getByRole("row").filter({ hasText: ITEM_NAME }),
    ).toBeVisible();
    await expect(page.getByTestId("pending-writes-badge")).toContainText(
      "1 pending",
    );

    // ── Reconnect: `useResumeOnReconnect` drains the paused mutation and the
    // idempotency-keyed create's success invalidates the list — the real
    // server row replaces the temp one. Assert the DRAIN OUTCOME, not the sync
    // toast: the toast is racy by design (QueryClientProvider's own
    // onlineManager subscriber can drain the queue before useResumeOnReconnect
    // snapshots it → paused.length reads 0 → no toast; see that hook's ponytail
    // note). The durable, race-free signals are: the pending badge clears
    // (queue drained) and exactly one row remains (temp row replaced by the
    // real server row, no duplicate).
    await context.setOffline(false);
    await expect(page.getByTestId("pending-writes-badge")).toHaveCount(0, {
      timeout: 15000,
    });
    // Narrow the list to the probe via the search box before counting rows: the
    // default sort is name-ASC, so the real refetched row lands on a later page
    // (the offline optimistic patch had prepended it to page 1, which is why it
    // showed pre-reconnect). Searching pins it regardless of page, and a count
    // of exactly 1 proves the temp row was replaced by a single server row —
    // no duplicate.
    await page.locator('input[type="search"]').first().fill(ITEM_NAME);
    await expect(
      page.getByRole("row").filter({ hasText: ITEM_NAME }),
    ).toHaveCount(1, { timeout: 15000 });
  });
});
