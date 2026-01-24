import { test, expect } from "../fixtures/authenticated";

/**
 * Core offline flow E2E tests using Playwright's context.setOffline() API.
 *
 * These tests verify the fundamental offline experience:
 * - Offline indicator visibility
 * - Cached data display
 * - Recovery when back online
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation behavior.
 */
test.describe("Offline Flows", () => {
  // Skip non-Chromium browsers per user decision
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Load dashboard and wait for initial data to cache
    await page.goto("/en/dashboard");
    // Use domcontentloaded instead of networkidle due to SSE connections
    await page.waitForLoadState("domcontentloaded");
    // Wait for main content to render with longer timeout
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("shows offline indicator when network disconnected", async ({
    page,
    context,
  }) => {
    // Verify online state initially (no offline indicator)
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).not.toBeVisible();

    // Go offline
    await context.setOffline(true);

    // Trigger a navigation or interaction to detect offline status
    // The offline indicator appears when navigator.onLine changes
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify offline indicator becomes visible
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Verify it has the CloudOff icon (check aria-label)
    await expect(offlineIndicator).toHaveAttribute(
      "aria-label",
      "You are offline"
    );
  });

  test("hides offline indicator when network reconnected", async ({
    page,
    context,
  }) => {
    // Go offline first
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify offline indicator is visible
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Verify offline indicator disappears
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });
  });

  test("retains cached data visibility when offline", async ({
    page,
    context,
  }) => {
    // Wait for main heading to be visible (confirming initial data loaded)
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    // Capture the heading text while online
    const headingText = await heading.textContent();

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify main content is still visible (React state preserved)
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    // The heading should still be there (React state not cleared)
    const headingAfterOffline = page.getByRole("heading", { level: 1 });
    await expect(headingAfterOffline).toBeVisible();

    // The page should show content, not an error state
    // Check that we don't have a generic error message
    const errorText = page.getByText(/something went wrong|error loading/i);
    await expect(errorText).not.toBeVisible();
  });

  test("shows sync status indicator in offline state", async ({
    page,
    context,
  }) => {
    // The SyncStatusIndicator should show "Offline" when disconnected
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Wait for the sync status to update
    // Look for the "Offline" badge in SyncStatusIndicator
    const offlineBadge = page.getByText("Offline", { exact: true });
    await expect(offlineBadge).toBeVisible({ timeout: 5000 });

    // Verify the badge has proper structure (Badge component with gap)
    const syncStatusBadge = page.locator(".gap-1\\.5").filter({
      hasText: "Offline",
    });
    await expect(syncStatusBadge).toBeVisible();
  });

  test("recovers gracefully from offline state", async ({ page, context }) => {
    // Verify initial online state
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Offline indicator should disappear
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });

    // Navigation should work after recovery
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Main content should be visible again
    await expect(page.locator("main")).toBeVisible();
  });

  test("offline indicator has correct accessibility attributes", async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Wait for offline indicator
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // The indicator should have role="status" for accessibility
    await expect(offlineIndicator).toHaveAttribute("role", "status");

    // The indicator should have aria-label for screen readers
    await expect(offlineIndicator).toHaveAttribute(
      "aria-label",
      "You are offline"
    );
  });
});
