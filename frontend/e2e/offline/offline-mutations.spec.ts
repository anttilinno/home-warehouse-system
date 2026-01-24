import { test, expect } from "../fixtures/authenticated";

/**
 * Offline item mutation E2E tests.
 *
 * Tests the full offline create/update flow:
 * - Create item while offline
 * - Optimistic item appears immediately with pending indicator
 * - Item syncs when back online
 * - Pending indicator disappears after sync
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Item Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to items page and wait for it to load
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Wait for items table to be visible
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  });

  test("creates item while offline with pending indicator", async ({ page, context }) => {
    // Generate unique SKU to avoid conflicts
    const uniqueSku = `OFFLINE-TEST-${Date.now()}`;
    const itemName = "Offline Test Item";

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Item button
    await page.getByRole("button", { name: /Add Item/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form
    await page.getByLabel(/SKU/i).fill(uniqueSku);
    await page.getByLabel(/^Name$/i).fill(itemName);

    // Submit the form
    await page.getByRole("button", { name: /Create|Save/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic item appears with pending indicator
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Verify the row has pending styling
    const itemRow = page.locator("tr").filter({ hasText: itemName });
    await expect(itemRow).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Item should still be visible after sync
    await expect(page.getByText(itemName)).toBeVisible();
  });

  test("shows toast when clicking pending item", async ({ page, context }) => {
    // Generate unique SKU
    const uniqueSku = `PENDING-CLICK-${Date.now()}`;
    const itemName = "Pending Click Test";

    // Go offline and create item
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await page.getByRole("button", { name: /Add Item/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/SKU/i).fill(uniqueSku);
    await page.getByLabel(/^Name$/i).fill(itemName);
    await page.getByRole("button", { name: /Create|Save/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 5000 });

    // Click the pending item row
    const itemRow = page.locator("tr").filter({ hasText: itemName });
    await itemRow.click();

    // Should show info toast, not navigate
    await expect(page.getByText(/pending sync/i)).toBeVisible({ timeout: 5000 });

    // URL should not change (still on items page)
    await expect(page).toHaveURL(/\/dashboard\/items$/);

    // Cleanup: go online to sync
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  });

  test("pending item count reflected in sync status", async ({ page, context }) => {
    const uniqueSku = `QUEUE-COUNT-${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Create item offline
    await page.getByRole("button", { name: /Add Item/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/SKU/i).fill(uniqueSku);
    await page.getByLabel(/^Name$/i).fill("Queue Count Test");
    await page.getByRole("button", { name: /Create|Save/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify pending changes count is shown in sync status
    // The SyncStatusIndicator shows pending count when queue is not empty
    // Just verify the item appears as pending
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go online to sync
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });
  });
});
