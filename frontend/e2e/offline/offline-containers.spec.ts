import { test, expect } from "../fixtures/authenticated";

/**
 * Offline container mutation E2E tests.
 *
 * Tests the full offline create/update flow for containers including
 * cross-entity location dependency:
 * - Create container while offline
 * - Update container while offline
 * - Create container in pending location
 * - Verify pending indicators with location context ("Pending... in [LocationName]")
 * - Verify dropdown menu hidden for pending containers
 * - Verify location dropdown shows pending locations
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Container Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to containers page and wait for it to load
    await page.goto("/en/dashboard/containers");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates container while offline with pending indicator", async ({ page, context }) => {
    const uniqueName = `Offline Container ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Container button
    await page.getByRole("button", { name: /Add Container/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form - name is required, location is required
    await page.getByLabel(/^Name/i).fill(uniqueName);

    // Select first available location from dropdown
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option").first().click();

    // Submit the form
    await page.getByRole("button", { name: /Create/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic container appears with pending indicator
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Pending/)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText(/Pending/)).not.toBeVisible({ timeout: 15000 });

    // Container should still be visible after sync
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("updates container while offline with pending indicator", async ({ page, context }) => {
    // First, ensure we have a container to update
    const containerRows = page.locator("tbody tr");

    // Wait for page to load first
    await page.waitForTimeout(2000);

    // If no containers exist, create one first (online)
    const rowCount = await containerRows.count();
    if (rowCount === 0) {
      await page.getByRole("button", { name: /Add Container/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^Name/i).fill(`Test Container ${Date.now()}`);
      // Select first available location
      await page.locator('[role="combobox"]').first().click();
      await page.getByRole("option").first().click();
      await page.getByRole("button", { name: /Create/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
      // Wait for container to appear
      await expect(containerRows.first()).toBeVisible({ timeout: 10000 });
    }

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Click on the first container's action menu (the MoreHorizontal button in last cell)
    const firstRow = containerRows.first();
    // The dropdown trigger has aria-label "Actions for [container name]"
    await firstRow.locator("button").filter({ hasText: "" }).last().click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Update the name
    const updatedName = `Updated Container ${Date.now()}`;
    await page.getByLabel(/^Name/i).clear();
    await page.getByLabel(/^Name/i).fill(updatedName);

    // Submit
    await page.getByRole("button", { name: /Update/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify updated container appears with pending indicator
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Pending/)).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync
    await expect(page.getByText(/Pending/)).not.toBeVisible({ timeout: 15000 });

    // Updated name should still be visible
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test("creates container in pending location with correct context", async ({ page, context }) => {
    const locationName = `Offline Location ${Date.now()}`;
    const containerName = `Container In Pending ${Date.now()}`;

    // First navigate to locations and create a location offline
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Create location offline
    await page.getByRole("button", { name: /Add Location/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(locationName);
    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Navigate to containers page (still offline)
    await page.goto("/en/dashboard/containers");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify still offline
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Create container in the pending location
    await page.getByRole("button", { name: /Add Container/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(containerName);

    // Select the pending location (should show with "(pending)" suffix)
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: new RegExp(`${locationName}.*pending`, "i") }).click();

    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify container appears with pending indicator AND location context
    await expect(page.getByText(containerName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`Pending... in ${locationName}`)).toBeVisible({ timeout: 5000 });

    // Go online and verify sync order (location before container)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Pending indicator should disappear
    await expect(page.getByText(/Pending/)).not.toBeVisible({ timeout: 15000 });

    // Container should remain visible
    await expect(page.getByText(containerName)).toBeVisible();
  });

  test("pending containers have no dropdown menu", async ({ page, context }) => {
    const containerName = `No Menu Container ${Date.now()}`;

    // Go offline and create a container
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add Container/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name/i).fill(containerName);
    // Select first available location
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /Create/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify container appears
    await expect(page.getByText(containerName)).toBeVisible({ timeout: 5000 });

    // Find the pending container row
    const pendingRow = page.locator("tbody tr").filter({ hasText: containerName });
    await expect(pendingRow).toBeVisible();

    // Verify dropdown trigger button is NOT visible on the pending row
    // The dropdown trigger has aria-label "Actions for [container name]"
    const dropdownTrigger = pendingRow.locator(`button[aria-label="Actions for ${containerName}"]`);
    await expect(dropdownTrigger).not.toBeVisible();

    // Clean up - go online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/Pending/)).not.toBeVisible({ timeout: 15000 });
  });
});
