import { test, expect } from "../fixtures/authenticated";

test.describe("SSE Status Indicator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");
  });

  test("SSE status indicator present in UI", async ({ page }) => {
    // Look for the SSE status indicator component
    // It should have either Wifi or WifiOff icon with aria-label
    const sseIndicator = page
      .locator('[aria-label="Connected"], [aria-label="Disconnected"]')
      .first();

    await expect(sseIndicator).toBeVisible();
  });

  test("indicator shows connected or reconnecting state", async ({ page }) => {
    // The indicator should show one of two states
    // Connected: Wifi icon with "Live" text
    // Reconnecting: WifiOff icon with "Reconnecting..." text

    // Check for either state indicator
    const liveText = page.getByText("Live");
    const reconnectingText = page.getByText("Reconnecting...");

    // One of these should be visible
    const isLiveVisible = await liveText.isVisible().catch(() => false);
    const isReconnectingVisible = await reconnectingText.isVisible().catch(() => false);

    expect(isLiveVisible || isReconnectingVisible).toBe(true);
  });

  test("indicator accessible via aria-label", async ({ page }) => {
    // The icon should have an aria-label for accessibility
    const connectedIndicator = page.locator('[aria-label="Connected"]');
    const disconnectedIndicator = page.locator('[aria-label="Disconnected"]');

    // Check that at least one is present (depending on actual connection state)
    const connectedCount = await connectedIndicator.count();
    const disconnectedCount = await disconnectedIndicator.count();

    expect(connectedCount + disconnectedCount).toBeGreaterThan(0);
  });

  test("indicator present on multiple pages", async ({ page }) => {
    // Check dashboard
    await expect(
      page.locator('[aria-label="Connected"], [aria-label="Disconnected"]').first()
    ).toBeVisible();

    // Navigate to items and check
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.locator('[aria-label="Connected"], [aria-label="Disconnected"]').first()
    ).toBeVisible();

    // Navigate to locations and check
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.locator('[aria-label="Connected"], [aria-label="Disconnected"]').first()
    ).toBeVisible();
  });

  test("indicator uses correct icon colors", async ({ page }) => {
    // Connected state should use green color (text-green-500)
    // Disconnected state should use yellow color (text-yellow-500)

    const connectedIcon = page.locator('[aria-label="Connected"]');
    const disconnectedIcon = page.locator('[aria-label="Disconnected"]');

    // Check which state we're in
    const isConnected = (await connectedIcon.count()) > 0;

    if (isConnected) {
      // Verify green styling
      await expect(connectedIcon.first()).toHaveClass(/text-green-500/);
    } else {
      // Verify yellow styling for disconnected
      await expect(disconnectedIcon.first()).toHaveClass(/text-yellow-500/);
    }
  });
});
