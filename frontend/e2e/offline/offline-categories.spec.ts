import { test, expect } from "../fixtures/authenticated";

/**
 * Offline category mutation E2E tests.
 *
 * Tests the full offline create/update flow for categories including
 * hierarchical parent-child relationships:
 * - Create category while offline
 * - Update category while offline
 * - Create subcategory under pending parent
 * - Verify pending indicators with parent context
 * - Verify drag handles are hidden for pending categories
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation.
 */
test.describe("Offline Category Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid auth state conflicts
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Navigate to categories page and wait for it to load
    await page.goto("/en/dashboard/categories");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates category while offline with pending indicator", async ({ page, context }) => {
    const uniqueName = `Offline Category ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator appears
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Category button
    await page.getByRole("button", { name: /Add Category/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill the form
    await page.getByLabel(/^Name$/i).fill(uniqueName);

    // Submit the form
    await page.getByRole("button", { name: /Save/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic category appears with pending indicator
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Category should still be visible after sync
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("updates category while offline with pending indicator", async ({ page, context }) => {
    // First, ensure we have a category to update
    // Check for existing categories in the tree
    const categoryRows = page.locator('[role="treeitem"]');

    // Wait for page to load first
    await page.waitForTimeout(2000);

    // If no categories exist, create one first (online)
    const rowCount = await categoryRows.count();
    if (rowCount === 0) {
      await page.getByRole("button", { name: /Add Category/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      await page.getByLabel(/^Name$/i).fill(`Test Category ${Date.now()}`);
      await page.getByRole("button", { name: /Save/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
      // Wait for category to appear
      await expect(categoryRows.first()).toBeVisible({ timeout: 10000 });
    }

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Click on the first category's action menu
    const firstRow = categoryRows.first();
    await firstRow.hover();
    // The dropdown trigger button has aria-label "Actions for [category name]"
    await firstRow.getByRole("button").filter({ hasText: "" }).last().click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Update the name
    const updatedName = `Updated Category ${Date.now()}`;
    await page.getByLabel(/^Name$/i).clear();
    await page.getByLabel(/^Name$/i).fill(updatedName);

    // Submit
    await page.getByRole("button", { name: /Save/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify updated category appears with pending indicator
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

  test("creates subcategory under pending parent with correct context", async ({ page, context }) => {
    const parentName = `Parent Category ${Date.now()}`;
    const childName = `Child Category ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Create parent category
    await page.getByRole("button", { name: /Add Category/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name$/i).fill(parentName);
    await page.getByRole("button", { name: /Save/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify parent appears with pending indicator
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Create child category under pending parent
    await page.getByRole("button", { name: /Add Category/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name$/i).fill(childName);

    // Select the pending parent from dropdown
    // Click on the parent category dropdown trigger
    await page.getByRole("combobox").click();
    // The pending parent should show with (pending) suffix
    await page.getByRole("option", { name: new RegExp(`${parentName}.*pending`, "i") }).click();

    await page.getByRole("button", { name: /Save/i }).click();
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

    // Both categories should remain visible
    await expect(page.getByText(parentName)).toBeVisible();
    await expect(page.getByText(childName)).toBeVisible();
  });

  test("pending categories cannot be dragged", async ({ page, context }) => {
    const categoryName = `No Drag Category ${Date.now()}`;

    // Go offline and create a category
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Add Category/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/^Name$/i).fill(categoryName);
    await page.getByRole("button", { name: /Save/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify category appears
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 5000 });

    // Find the pending category row
    const pendingRow = page.locator('[role="treeitem"]').filter({ hasText: categoryName });
    await expect(pendingRow).toBeVisible();

    // Verify drag handle is NOT visible on the pending row
    // (The drag handle should be hidden for pending categories)
    // The drag handle has class cursor-grab
    const dragHandle = pendingRow.locator('[class*="cursor-grab"]');
    await expect(dragHandle).not.toBeVisible();

    // Clean up - go online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });
  });
});
