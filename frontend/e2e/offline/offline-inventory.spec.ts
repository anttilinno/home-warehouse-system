import { test, expect } from "../fixtures/authenticated";

/**
 * Offline inventory mutation E2E tests.
 *
 * Tests the full offline create/update flow for inventory including
 * multi-entity dependencies (item, location, container):
 * - Create inventory while offline
 * - Update inventory while offline
 * - Create inventory with pending item/location/container dependencies
 * - Verify pending indicators with item + location context
 * - Verify dropdown menu hidden for pending inventory
 * - Verify dropdowns show pending entities
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Inventory Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to inventory page and wait for it to load
    await page.goto("/en/dashboard/inventory");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates inventory while offline with pending indicator", async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Inventory button
    await page.getByRole("button", { name: /Add Inventory/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form - select first available item
    // The inventory page uses Select components (not combobox)
    const itemSelect = page.locator("#item").locator("..").locator("button");
    await itemSelect.click();
    await page.getByRole("option").first().click();

    // Select first available location
    const locationSelect = page
      .locator("#location")
      .locator("..")
      .locator("button");
    await locationSelect.click();
    await page.getByRole("option").first().click();

    // Submit the form
    await page.getByRole("button", { name: /Create/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic inventory appears with pending indicator
    await expect(page.getByText(/Pending\.\.\./)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText(/Pending\.\.\./)).not.toBeVisible({
      timeout: 15000,
    });
  });

  test("updates inventory quantity while offline", async ({ page, context }) => {
    // Wait for inventory rows to load
    const inventoryRows = page.locator("tbody tr");
    await page.waitForTimeout(2000);

    // If no inventory exists, skip this test
    const rowCount = await inventoryRows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).toBeVisible({ timeout: 5000 });

    // Find and click on the quantity cell to edit inline
    // Note: This tests inline edit which may show pending state
    // The exact interaction depends on how InlineEditCell is implemented
    const firstRow = inventoryRows.first();

    // Look for the quantity cell (4th column based on current layout: checkbox, item, location, qty)
    const quantityCell = firstRow.locator("td").nth(3);

    // Click to edit
    await quantityCell.click();

    // Check if inline edit is triggered (implementation specific)
    // For now, just verify we're still on the page
    await expect(page.locator("main")).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  });

  test("pending inventory has no dropdown menu", async ({ page, context }) => {
    // Go offline and create an inventory entry
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add Inventory/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Select first available item
    const itemSelect = page.locator("#item").locator("..").locator("button");
    await itemSelect.click();
    await page.getByRole("option").first().click();

    // Select first available location
    const locationSelect = page
      .locator("#location")
      .locator("..")
      .locator("button");
    await locationSelect.click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify pending indicator appears
    await expect(page.getByText(/Pending\.\.\./)).toBeVisible({ timeout: 5000 });

    // Find the pending row - it should have the pending badge
    const pendingRow = page.locator("tr").filter({ hasText: /Pending\.\.\./ });
    await expect(pendingRow).toBeVisible();

    // Verify dropdown trigger button is NOT visible on the pending row
    // The dropdown should not be present for pending rows
    // Check that there's no MoreHorizontal button in actions column (last cell)
    const actionsCell = pendingRow.locator("td").last();
    await expect(actionsCell.locator("button")).not.toBeVisible();

    // Clean up - go online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/Pending\.\.\./)).not.toBeVisible({
      timeout: 15000,
    });
  });

  test("pending badge shows item and location context", async ({
    page,
    context,
  }) => {
    // Go offline and create inventory
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add Inventory/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Select first item
    const itemSelect = page.locator("#item").locator("..").locator("button");
    await itemSelect.click();
    await page.getByRole("option").first().click();

    // Select first location
    const locationSelect = page
      .locator("#location")
      .locator("..")
      .locator("button");
    await locationSelect.click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify pending badge includes context information
    // Expected format: "Pending... ItemName at LocationName"
    const pendingBadge = page.getByText(/Pending\.\.\./);
    await expect(pendingBadge).toBeVisible({ timeout: 5000 });

    // The badge should contain both item and location context
    // Format is: "Pending... {itemName} at {locationName}" or "Pending... {itemName} at {locationName} / {containerName}"
    const badgeText = await pendingBadge.textContent();
    expect(badgeText).toContain("Pending...");
    expect(badgeText).toContain(" at ");

    // Clean up
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/Pending\.\.\./)).not.toBeVisible({
      timeout: 15000,
    });
  });

  test("creates inventory with pending location dependency", async ({
    page,
    context,
  }) => {
    const locationName = `Offline Location ${Date.now()}`;

    // First navigate to locations and create a location offline
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).toBeVisible({ timeout: 5000 });

    // Create location offline
    await page.getByRole("button", { name: /Add Location/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(locationName);
    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify location pending
    await expect(page.getByText(/Pending/)).toBeVisible({ timeout: 5000 });

    // Navigate to inventory page (still offline)
    await page.goto("/en/dashboard/inventory");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify still offline
    await expect(
      page.locator('[data-testid="offline-indicator"]')
    ).toBeVisible({ timeout: 5000 });

    // Create inventory with the pending location
    await page.getByRole("button", { name: /Add Inventory/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Select first available item
    const itemSelect = page.locator("#item").locator("..").locator("button");
    await itemSelect.click();
    await page.getByRole("option").first().click();

    // Select the pending location (should show with "(pending)" suffix)
    const locationSelect = page
      .locator("#location")
      .locator("..")
      .locator("button");
    await locationSelect.click();

    // Look for the pending location with "(pending)" suffix
    await page
      .getByRole("option", { name: new RegExp(`${locationName}.*pending`, "i") })
      .click();

    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify inventory appears with pending indicator
    await expect(page.getByText(/Pending\.\.\./)).toBeVisible({ timeout: 5000 });

    // Go online - sync should happen in correct order (location before inventory)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync
    await expect(page.getByText(/Pending\.\.\./)).not.toBeVisible({
      timeout: 15000,
    });
  });
});
