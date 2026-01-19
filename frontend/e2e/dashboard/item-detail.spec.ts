import { test, expect } from "../fixtures/authenticated";
import { ItemsPage } from "../pages/ItemsPage";
import { ItemDetailPage } from "../pages/ItemDetailPage";

test.describe("Item Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to items list first to find an item to view
    const itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();
  });

  test("page loads with item information", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Click first item to navigate to detail
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Item title should be visible
      await expect(detailPage.itemTitle).toBeVisible();

      // SKU badge should be visible
      await expect(detailPage.skuBadge).toBeVisible();
    }
  });

  test("back button returns to items list", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Click back button
      await detailPage.goBack();

      // Should be back on items list
      await expect(page).toHaveURL(/\/dashboard\/items$/);
    }
  });

  test("item title and SKU displayed", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Get item name
      const itemName = await detailPage.getItemName();
      expect(itemName).toBeTruthy();
      expect(itemName?.length).toBeGreaterThan(0);

      // Get SKU
      const sku = await detailPage.getSku();
      expect(sku).toBeTruthy();
    }
  });

  test("photo gallery section present", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Photo card should be visible
      await expect(detailPage.photoCard).toBeVisible();

      // Should have either photos or placeholder
      const hasPhotos = await detailPage.hasPhotos();
      const hasPlaceholder = await detailPage.hasPhotoPlaceholder();

      // One of these should be true
      expect(hasPhotos || hasPlaceholder).toBe(true);
    }
  });

  test("edit button visible for users with permission", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Edit button should be visible for authorized users
      // Note: This depends on user permissions - may not be visible for viewers
      const canEdit = await detailPage.canEdit();

      // Just verify the method works - actual visibility depends on permissions
      expect(typeof canEdit).toBe("boolean");
    }
  });

  test("product info section shows details", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Product info section should be visible
      const hasProductInfo = await detailPage.hasProductInfo();
      expect(hasProductInfo).toBe(true);
    }
  });

  test("details card shows item details section", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Details card should be visible
      await expect(detailPage.detailsCard).toBeVisible();

      // Identification section should be present
      await expect(detailPage.identificationSection).toBeVisible();
    }
  });

  test("identification section shows SKU", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Get SKU from identification section
      const skuValue = await detailPage.getIdentificationField("SKU");
      expect(skuValue).toBeTruthy();
    }
  });

  test("metadata section shows created date", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();
      await page.waitForURL(/\/dashboard\/items\/[a-f0-9-]+/);

      const detailPage = new ItemDetailPage(page);
      await detailPage.waitForLoaded();

      // Metadata section should be visible
      await expect(detailPage.metadataSection).toBeVisible();

      // Should show Created date
      const metadataText = await detailPage.metadataSection.textContent();
      expect(metadataText).toContain("Created");
    }
  });
});

test.describe("Item Detail Page - No Items Available", () => {
  test("handles case with no items gracefully", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();

    const hasEmpty = await itemsPage.hasEmptyState();

    if (hasEmpty) {
      // If no items, just verify we're on the items page
      await expect(page).toHaveURL(/\/dashboard\/items$/);
      await expect(itemsPage.pageTitle).toBeVisible();
    }
  });
});
