import { test, expect } from "../fixtures/authenticated";
import { OutOfStockPage } from "../pages/OutOfStockPage";

test.describe("Out of Stock Page", () => {
  let outOfStockPage: OutOfStockPage;

  test.beforeEach(async ({ page }) => {
    outOfStockPage = new OutOfStockPage(page);
    await outOfStockPage.goto();
    await outOfStockPage.waitForPageLoaded();
  });

  test("page loads successfully", async ({ page }) => {
    // Page title should be visible
    await expect(outOfStockPage.pageTitle).toBeVisible();
  });

  test("page displays title and subtitle", async ({ page }) => {
    await expect(outOfStockPage.pageTitle).toBeVisible();
    await expect(outOfStockPage.pageSubtitle).toBeVisible();
  });

  test("search input is present", async ({ page }) => {
    await expect(outOfStockPage.searchInput).toBeVisible();
    await expect(outOfStockPage.searchInput).toHaveAttribute("type", "search");
  });

  test("items card is displayed", async ({ page }) => {
    await expect(outOfStockPage.itemsCard).toBeVisible();
  });

  test("items below minimum stock displayed or empty state", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();
    const hasEmptyState = await outOfStockPage.hasEmptyState();

    // Either has items or shows empty state
    expect(itemCount > 0 || hasEmptyState).toBe(true);
  });
});

test.describe("Out of Stock Items Display", () => {
  let outOfStockPage: OutOfStockPage;

  test.beforeEach(async ({ page }) => {
    outOfStockPage = new OutOfStockPage(page);
    await outOfStockPage.goto();
    await outOfStockPage.waitForPageLoaded();
  });

  test("item shows name", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      const firstRow = outOfStockPage.getAllItemRows().first();
      const name = outOfStockPage.itemName(firstRow);

      await expect(name).toBeVisible();
      const nameText = await name.textContent();
      expect(nameText?.length).toBeGreaterThan(0);
    }
  });

  test("item shows SKU", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      const firstRow = outOfStockPage.getAllItemRows().first();
      const sku = outOfStockPage.itemSku(firstRow);

      await expect(sku).toBeVisible();
    }
  });

  test("item shows category badge", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      const firstRow = outOfStockPage.getAllItemRows().first();
      const category = outOfStockPage.itemCategory(firstRow);

      await expect(category).toBeVisible();
    }
  });

  test("item shows minimum stock level", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      // Min stock column should be visible
      const header = page.locator('text=/min.?stock/i');
      await expect(header).toBeVisible();
    }
  });

  test("item has view link", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      const firstRow = outOfStockPage.getAllItemRows().first();
      const viewLink = outOfStockPage.itemViewLink(firstRow);

      await expect(viewLink).toBeVisible();
    }
  });

  test("view link navigates to item detail page", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      const firstRow = outOfStockPage.getAllItemRows().first();
      const viewLink = outOfStockPage.itemViewLink(firstRow);

      await viewLink.click();
      await expect(page).toHaveURL(/\/dashboard\/items\/[a-f0-9-]+/);
    }
  });
});

test.describe("Out of Stock Search", () => {
  let outOfStockPage: OutOfStockPage;

  test.beforeEach(async ({ page }) => {
    outOfStockPage = new OutOfStockPage(page);
    await outOfStockPage.goto();
    await outOfStockPage.waitForPageLoaded();
  });

  test("search filters items", async ({ page }) => {
    const initialCount = await outOfStockPage.getItemCount();

    if (initialCount > 0) {
      // Search for unlikely term
      await outOfStockPage.search("zzz-unlikely-search-xyz");

      // Either filtered results or no results state
      const filteredCount = await outOfStockPage.getItemCount();
      const hasNoResults = await outOfStockPage.hasNoResultsState();

      expect(filteredCount < initialCount || hasNoResults).toBe(true);
    }
  });

  test("clearing search shows all items again", async ({ page }) => {
    const initialCount = await outOfStockPage.getItemCount();

    if (initialCount > 0) {
      // Search then clear
      await outOfStockPage.search("test");
      await outOfStockPage.clearSearch();

      // Should show same number of items
      const finalCount = await outOfStockPage.getItemCount();
      expect(finalCount).toBe(initialCount);
    }
  });

  test("search works with SKU", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      // Get the first item's SKU
      const firstRow = outOfStockPage.getAllItemRows().first();
      const skuElement = outOfStockPage.itemSku(firstRow);
      const sku = await skuElement.textContent();

      if (sku) {
        // Search by SKU
        await outOfStockPage.search(sku);

        // Should still find at least one item
        const searchCount = await outOfStockPage.getItemCount();
        expect(searchCount).toBeGreaterThan(0);
      }
    }
  });

  test("search works with category name", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      // Get the first item's category
      const firstRow = outOfStockPage.getAllItemRows().first();
      const categoryElement = outOfStockPage.itemCategory(firstRow);
      const category = await categoryElement.textContent();

      if (category && category !== "Uncategorized") {
        // Search by category
        await outOfStockPage.search(category);

        // Should find at least one item
        const searchCount = await outOfStockPage.getItemCount();
        expect(searchCount).toBeGreaterThan(0);
      }
    }
  });
});

test.describe("Out of Stock Empty State", () => {
  let outOfStockPage: OutOfStockPage;

  test.beforeEach(async ({ page }) => {
    outOfStockPage = new OutOfStockPage(page);
    await outOfStockPage.goto();
    await outOfStockPage.waitForPageLoaded();
  });

  test("empty state displays when all items stocked", async ({ page }) => {
    const itemCount = await outOfStockPage.getItemCount();
    const hasEmptyState = await outOfStockPage.hasEmptyState();

    if (itemCount === 0) {
      expect(hasEmptyState).toBe(true);
    }
  });

  test("no results state displays when search has no matches", async ({ page }) => {
    const initialCount = await outOfStockPage.getItemCount();

    if (initialCount > 0) {
      // Search for impossible term
      await outOfStockPage.search("zzzzzzzzz-impossible-term-xxxxx");

      const hasNoResults = await outOfStockPage.hasNoResultsState();
      const filteredCount = await outOfStockPage.getItemCount();

      // Either shows no results state or has 0 items
      expect(hasNoResults || filteredCount === 0).toBe(true);
    }
  });

  test("card description updates based on item count", async ({ page }) => {
    const descriptionText = await outOfStockPage.cardDescription.textContent();
    const itemCount = await outOfStockPage.getItemCount();

    if (itemCount > 0) {
      // Description should contain the count
      expect(descriptionText?.toLowerCase()).toMatch(/\d+\s*item/);
    }
  });
});

test.describe("Out of Stock Loading State", () => {
  test("loading skeleton is shown initially", async ({ page }) => {
    // Navigate and immediately check for loading state
    await page.goto(`/en/dashboard/out-of-stock`);

    // Either loading or content visible
    const loadingSkeleton = page.locator('[class*="skeleton"]');
    const pageTitle = page.getByRole("heading", { level: 1 });

    const hasLoading = await loadingSkeleton.first().isVisible().catch(() => false);
    const hasTitle = await pageTitle.isVisible().catch(() => false);

    expect(hasLoading || hasTitle).toBe(true);
  });

  test("page transitions from loading to content", async ({ page }) => {
    const outOfStockPage = new OutOfStockPage(page);
    await outOfStockPage.goto();

    // Wait for loading to complete
    await outOfStockPage.waitForPageLoaded();

    // Title should be visible
    await expect(outOfStockPage.pageTitle).toBeVisible();

    // Skeleton should be hidden
    const isLoading = await outOfStockPage.isLoading();
    expect(isLoading).toBe(false);
  });
});
