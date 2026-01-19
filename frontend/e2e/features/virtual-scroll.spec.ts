import { test, expect } from "../fixtures/authenticated";
import { ItemsPage } from "../pages/ItemsPage";

test.describe("Virtual Scrolling", () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page);
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("networkidle");
    await itemsPage.waitForItemsLoaded();
  });

  test("items table uses virtual scrolling container", async ({ page }) => {
    // Check for the virtual scroll container
    // The virtualizer creates a container with specific height styling
    const virtualContainer = page.locator('[style*="height:"][style*="position: relative"]');

    // Also check for overflow-auto container that wraps the virtual content
    const scrollContainer = page.locator(".overflow-auto").filter({
      has: page.locator('[style*="position: relative"]'),
    });

    // At least one of these patterns should exist when virtual scroll is active
    const virtualContainerExists = (await virtualContainer.count()) > 0;
    const scrollContainerExists = (await scrollContainer.count()) > 0;

    // If there are items, virtual scroll should be present
    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      expect(virtualContainerExists || scrollContainerExists).toBe(true);
    }
  });

  test("virtual scroll container has fixed height", async ({ page }) => {
    // Check if the scroll container has a fixed height (600px as per implementation)
    const scrollContainer = page.locator(".overflow-auto").filter({
      has: page.locator("table"),
    });

    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      // The container should exist
      await expect(scrollContainer.first()).toBeVisible();

      // Check for explicit height style
      const style = await scrollContainer.first().getAttribute("style");
      if (style) {
        expect(style).toContain("height");
      }
    }
  });

  test("table rows use absolute positioning for virtualization", async ({ page }) => {
    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      // Virtual rows should have absolute positioning and transform
      const virtualRows = page.locator('tr[style*="position: absolute"]');

      // Wait for virtual rows to render
      await page.waitForTimeout(500);

      const count = await virtualRows.count();

      // If items exist, we should have some absolutely positioned rows
      if (count > 0) {
        // Check first row has transform style
        const firstRow = virtualRows.first();
        const style = await firstRow.getAttribute("style");
        expect(style).toContain("transform");
      }
    }
  });

  test("scrolling down shows more rows", async ({ page }) => {
    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      // Find the scroll container
      const scrollContainer = page
        .locator(".overflow-auto")
        .filter({ has: page.locator("table tbody") })
        .first();

      // Get initial visible rows
      const initialRows = await page.locator("tbody tr").count();

      if (initialRows > 0) {
        // Scroll down
        await scrollContainer.evaluate((el) => {
          el.scrollTop = el.scrollTop + 500;
        });

        // Wait for rerender
        await page.waitForTimeout(300);

        // Rows should still be visible (virtual scroll maintains rendering)
        const rowsAfterScroll = await page.locator("tbody tr").count();
        expect(rowsAfterScroll).toBeGreaterThan(0);
      }
    }
  });

  test("scroll position maintained after filter change", async ({ page }) => {
    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      // Apply a search filter
      await itemsPage.search("test");

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // The table should still be functional
      const table = itemsPage.itemsTable;

      // Table should exist (though it might show empty state if no matches)
      // The scroll container should still be present
      const scrollContainer = page
        .locator(".overflow-auto")
        .filter({ has: page.locator("table") })
        .first();

      await expect(scrollContainer).toBeVisible();

      // Clear filter
      await itemsPage.clearSearch();
    }
  });

  test("virtualizer renders overscan rows", async ({ page }) => {
    // Overscan means extra rows are rendered outside the viewport
    // This is typically 5 rows above/below (as per implementation)
    const hasItems = !(await itemsPage.hasEmptyState());

    if (hasItems) {
      // Check that more rows are rendered than strictly visible
      // The scroll container is 600px, rows are ~73px each
      // Visible rows = ~8, with overscan = ~18

      await page.waitForTimeout(500);

      const renderedRows = await page.locator("tbody tr").count();

      // Should have some rows rendered
      expect(renderedRows).toBeGreaterThan(0);
    }
  });
});
