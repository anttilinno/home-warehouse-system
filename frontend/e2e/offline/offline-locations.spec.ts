import { test, expect } from "../fixtures/authenticated";

/**
 * Offline location mutation E2E tests.
 *
 * Tests the full offline create/update flow for locations including
 * hierarchical parent-child relationships:
 * - Create location while offline
 * - Update location while offline
 * - Create sublocation under pending parent
 * - Verify pending indicators with parent context
 * - Verify dropdown menu hidden for pending locations
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Location Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to locations page and wait for it to load
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates location while offline with pending indicator", async ({ page, context }) => {
    const uniqueName = `Offline Location ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Location button
    await page.getByRole("button", { name: /Add Location/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form
    await page.getByLabel(/^Name/i).fill(uniqueName);

    // Submit the form
    await page.getByRole("button", { name: /Create/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic location appears with pending indicator
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Location should still be visible after sync
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("updates location while offline with pending indicator", async ({ page, context }) => {
    // First, ensure we have a location to update
    const locationRows = page.locator('[role="treeitem"]');

    // Wait for page to load first
    await page.waitForTimeout(2000);

    // If no locations exist, create one first (online)
    const rowCount = await locationRows.count();
    if (rowCount === 0) {
      await page.getByRole("button", { name: /Add Location/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^Name/i).fill(`Test Location ${Date.now()}`);
      await page.getByRole("button", { name: /Create/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
      // Wait for location to appear
      await expect(locationRows.first()).toBeVisible({ timeout: 10000 });
    }

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Click on the first location's action menu
    const firstRow = locationRows.first();
    await firstRow.hover();
    // The dropdown trigger button has aria-label "Actions for [location name]"
    await firstRow.getByRole("button").filter({ hasText: "" }).last().click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Update the name
    const updatedName = `Updated Location ${Date.now()}`;
    await page.getByLabel(/^Name/i).clear();
    await page.getByLabel(/^Name/i).fill(updatedName);

    // Submit
    await page.getByRole("button", { name: /Update/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify updated location appears with pending indicator
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

  test("creates sublocation under pending parent with correct context", async ({ page, context }) => {
    const parentName = `Parent Location ${Date.now()}`;
    const childName = `Child Location ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Create parent location
    await page.getByRole("button", { name: /Add Location/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(parentName);
    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify parent appears with pending indicator
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Create child location under pending parent
    await page.getByRole("button", { name: /Add Location/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(childName);

    // Select the pending parent from dropdown
    // Click on the parent select trigger
    await page.locator('[role="combobox"]').click();
    // The pending parent should show with (pending) suffix
    await page.getByRole("option", { name: new RegExp(`${parentName}.*pending`, "i") }).click();

    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify child appears with pending indicator AND parent context
    await expect(page.getByText(childName)).toBeVisible({ timeout: 5000 });
    // The badge should show "Pending... under [ParentName]"
    await expect(page.getByText(`Pending... under ${parentName}`)).toBeVisible({ timeout: 5000 });

    // Go online and verify sync order (parent before child)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for both pending indicators to disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Both locations should remain visible
    await expect(page.getByText(parentName)).toBeVisible();
    await expect(page.getByText(childName)).toBeVisible();
  });

  test("pending locations have no dropdown menu", async ({ page, context }) => {
    const locationName = `No Menu Location ${Date.now()}`;

    // Go offline and create a location
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add Location/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(locationName);
    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify location appears
    await expect(page.getByText(locationName)).toBeVisible({ timeout: 5000 });

    // Find the pending location row
    const pendingRow = page.locator('[role="treeitem"]').filter({ hasText: locationName });
    await expect(pendingRow).toBeVisible();

    // Hover over the row
    await pendingRow.hover();

    // Verify dropdown trigger button is NOT visible on the pending row
    // The dropdown trigger has aria-label "Actions for [location name]"
    const dropdownTrigger = pendingRow.locator(`button[aria-label="Actions for ${locationName}"]`);
    await expect(dropdownTrigger).not.toBeVisible();

    // Clean up - go online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });
  });
});
