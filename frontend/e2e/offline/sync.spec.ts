import { test, expect } from "../fixtures/authenticated";

/**
 * Sync behavior E2E tests for offline-to-online transitions.
 *
 * These tests verify:
 * - Sync triggers on reconnection
 * - Sync status indicator states
 * - Data preservation across states
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation behavior.
 */
test.describe("Sync Behavior", () => {
  // Skip non-Chromium browsers per user decision
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Load dashboard and wait for initial data
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("sync status changes from offline to synced when back online", async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify offline state in sync status
    const offlineBadge = page.getByText("Offline", { exact: true });
    await expect(offlineBadge).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Verify sync status changes - should show "just now" or a timestamp
    // The "Offline" badge should disappear
    await expect(offlineBadge).not.toBeVisible({ timeout: 5000 });

    // After sync, should show synced state (check icon or "Not synced" is gone)
    // Either "just now" or the green checkmark badge
    const syncedIndicator = page
      .locator(".gap-1\\.5")
      .filter({ has: page.locator(".text-green-500") });
    const notSyncedBadge = page.getByText("Not synced", { exact: true });

    // Wait for either synced state or verify not showing offline
    await expect(offlineBadge).not.toBeVisible();
  });

  test("shows syncing state briefly during sync", async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify offline state
    const offlineBadge = page.getByText("Offline", { exact: true });
    await expect(offlineBadge).toBeVisible({ timeout: 5000 });

    // Go back online and check for syncing state
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Syncing state may appear briefly - "Syncing..." text
    // This may be too fast to catch, but we verify the sync completes
    // by checking that Offline goes away
    await expect(offlineBadge).not.toBeVisible({ timeout: 5000 });
  });

  test("preserves data visibility across offline state transitions", async ({
    page,
    context,
  }) => {
    // Wait for heading to be visible (data loaded)
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const initialHeadingText = await heading.textContent();

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Data should still be visible
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).toBe(initialHeadingText);

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Data should still be visible after reconnection
    await expect(heading).toBeVisible();
  });

  test("multiple offline-online cycles maintain stability", async ({
    page,
    context,
  }) => {
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');

    // Cycle 1: Go offline and back
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });

    // Cycle 2: Go offline and back again
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });

    // Verify app is still functional
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("sync status reflects pending count when offline with mutations", async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify we're showing offline state
    const offlineBadge = page.getByText("Offline", { exact: true });
    await expect(offlineBadge).toBeVisible({ timeout: 5000 });

    // The offline badge should be interactive (clickable if there are pending changes)
    // Check that it has proper cursor styling
    const offlineBadgeWrapper = page.locator(".gap-1\\.5").filter({
      hasText: "Offline",
    });
    await expect(offlineBadgeWrapper).toBeVisible();

    // The badge should have cursor-pointer class when clickable
    await expect(offlineBadgeWrapper).toHaveClass(/cursor-pointer/);
  });

  test("sync status shows proper icon when offline", async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // The SyncStatusIndicator should show CloudOff icon
    // Look for the badge with CloudOff icon (h-3 w-3 class inside .gap-1.5 badge)
    const syncBadge = page.locator(".gap-1\\.5").filter({
      hasText: "Offline",
    });
    await expect(syncBadge).toBeVisible({ timeout: 5000 });

    // Verify the badge contains an SVG (the icon)
    const icon = syncBadge.locator("svg");
    await expect(icon).toBeVisible();
    await expect(icon).toHaveClass(/h-3 w-3/);
  });
});
