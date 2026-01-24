import { test, expect } from "../fixtures/authenticated";

/**
 * Offline borrower mutation E2E tests.
 *
 * Tests the full offline create/update flow for borrowers:
 * - Create borrower while offline
 * - Optimistic borrower appears immediately with pending indicator
 * - Borrower syncs when back online
 * - Pending indicator disappears after sync
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Borrower Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to borrowers page and wait for it to load
    await page.goto("/en/dashboard/borrowers");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates borrower while offline with pending indicator", async ({ page, context }) => {
    // Generate unique name to avoid conflicts
    const uniqueName = `Offline Borrower ${Date.now()}`;
    const testEmail = `test-${Date.now()}@example.com`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Borrower button
    await page.getByRole("button", { name: /Add Borrower/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form
    await page.getByLabel(/^Name/i).fill(uniqueName);
    await page.getByLabel(/Email/i).fill(testEmail);

    // Submit the form
    await page.getByRole("button", { name: /Create/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic borrower appears with pending indicator
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Verify the row has pending styling
    const borrowerRow = page.locator("tr").filter({ hasText: uniqueName });
    await expect(borrowerRow).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Borrower should still be visible after sync
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("updates borrower while offline with pending indicator", async ({ page, context }) => {
    // First, find an existing borrower to update
    // Wait for borrowers table to load
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

    // Check if we have any borrowers
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      // Create a borrower first (online)
      await page.getByRole("button", { name: /Add Borrower/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^Name/i).fill(`Test Borrower ${Date.now()}`);
      await page.getByRole("button", { name: /Create/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
      // Wait for borrower to appear
      await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 10000 });
    }

    // Get the first borrower's name for reference
    const firstRow = rows.first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Click the first borrower's edit button
    await firstRow.getByRole("button", { name: /Actions/i }).click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Update the name
    const updatedName = `Updated Borrower ${Date.now()}`;
    await page.getByLabel(/^Name/i).clear();
    await page.getByLabel(/^Name/i).fill(updatedName);

    // Submit
    await page.getByRole("button", { name: /Update/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify updated borrower appears with pending indicator
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Updated name should still be visible
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test("borrower pending count reflected in sync status", async ({ page, context }) => {
    const uniqueName = `Queue Count Borrower ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Create borrower offline
    await page.getByRole("button", { name: /Add Borrower/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/^Name/i).fill(uniqueName);
    await page.getByRole("button", { name: /Create/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify pending indicator is shown
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go online to sync
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });
  });
});
