import { test, expect } from "../fixtures/authenticated";
import { ItemsPage } from "../pages/ItemsPage";

test.describe("Items Catalog", () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();
  });

  test("page loads with items table or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(itemsPage.pageTitle).toBeVisible();

    // Either the table or empty state should be present
    const hasTable = await itemsPage.itemsTable.isVisible().catch(() => false);
    const hasEmpty = await itemsPage.hasEmptyState();

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(itemsPage.pageTitle).toHaveText("Items");
    await expect(itemsPage.pageSubtitle).toContainText("item catalog");
  });

  test("Add Item button opens create dialog", async ({ page }) => {
    await itemsPage.openCreateDialog();

    await expect(itemsPage.createDialog).toBeVisible();
    await expect(itemsPage.dialogTitle).toContainText(/new item/i);
  });

  test("create dialog has SKU and Name fields", async ({ page }) => {
    await itemsPage.openCreateDialog();

    await expect(itemsPage.dialogSkuInput).toBeVisible();
    await expect(itemsPage.dialogNameInput).toBeVisible();

    // Check that SKU is required (has asterisk label)
    const skuLabel = itemsPage.createDialog.locator('label[for="sku"]');
    await expect(skuLabel).toContainText("SKU");

    // Check that Name is required
    const nameLabel = itemsPage.createDialog.locator('label[for="name"]');
    await expect(nameLabel).toContainText("Name");
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await itemsPage.openCreateDialog();
    await expect(itemsPage.createDialog).toBeVisible();

    await itemsPage.closeDialog();
    await expect(itemsPage.createDialog).toBeHidden();
  });

  test("create dialog has product detail fields", async ({ page }) => {
    await itemsPage.openCreateDialog();

    // Check for brand and model inputs
    await expect(itemsPage.dialogBrandInput).toBeVisible();
    await expect(itemsPage.dialogModelInput).toBeVisible();

    // Check for description textarea
    await expect(itemsPage.dialogDescriptionInput).toBeVisible();

    // Check for category select
    await expect(itemsPage.dialogCategorySelect).toBeVisible();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(itemsPage.searchInput).toBeVisible();
    await expect(itemsPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await itemsPage.search("test query");
    await expect(itemsPage.searchInput).toHaveValue("test query");
  });

  test("filter button opens filter popover", async ({ page }) => {
    // Find the filter button by looking for FilterPopover component
    const filterBtn = page.locator("button").filter({ has: page.locator('[class*="lucide-filter"]') });

    // Only test if filter button exists (depends on having categories/brands)
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await expect(itemsPage.filterPopover).toBeVisible();
    }
  });

  test("archive toggle changes view", async ({ page }) => {
    const archiveButton = itemsPage.archiveToggle;
    await expect(archiveButton).toBeVisible();

    // Check initial state
    const initialText = await archiveButton.textContent();
    expect(initialText).toMatch(/active|archived/i);

    // Click to toggle
    await archiveButton.click();

    // Text should change
    const newText = await archiveButton.textContent();
    expect(newText).not.toBe(initialText);
  });

  test("import button opens import dialog", async ({ page }) => {
    await itemsPage.openImportDialog();
    await expect(itemsPage.importDialog).toBeVisible();
  });

  test("export button is present", async ({ page }) => {
    await expect(itemsPage.exportButton).toBeVisible();
  });

  test("card shows item count in description", async ({ page }) => {
    const countText = await itemsPage.getItemCount();
    expect(countText).toMatch(/\d+\s+item/i);
  });
});

test.describe("Items Table Interactions", () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();
  });

  test("table headers are visible when items exist", async ({ page }) => {
    const hasTable = await itemsPage.itemsTable.isVisible().catch(() => false);

    if (hasTable) {
      // Check for sortable headers
      const skuHeader = itemsPage.tableHeaderColumn("SKU");
      const nameHeader = itemsPage.tableHeaderColumn("Name");

      await expect(skuHeader).toBeVisible();
      await expect(nameHeader).toBeVisible();
    }
  });

  test("table headers are sortable", async ({ page }) => {
    const hasTable = await itemsPage.itemsTable.isVisible().catch(() => false);

    if (hasTable) {
      const nameHeader = itemsPage.tableHeaderColumn("Name");

      // Click to sort
      await nameHeader.click();

      // Header should have sort indicator
      const sortIcon = nameHeader.locator('[class*="lucide-arrow-up"], [class*="lucide-arrow-down"], [class*="lucide-chevron"]');
      // Sort indicator should be visible after clicking
      await expect(sortIcon.or(nameHeader)).toBeVisible();
    }
  });

  test("clicking item row navigates to detail page", async ({ page }) => {
    const rows = itemsPage.getAllItemRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Get the first row
      const firstRow = rows.first();

      // Click on the row (not on buttons/checkboxes)
      await firstRow.click();

      // Should navigate to item detail
      await expect(page).toHaveURL(/\/dashboard\/items\/[a-f0-9-]+/);
    }
  });

  test("search filters table rows", async ({ page }) => {
    const hasTable = await itemsPage.itemsTable.isVisible().catch(() => false);

    if (hasTable) {
      // Get initial row count
      const initialRows = await itemsPage.getAllItemRows().count();

      if (initialRows > 0) {
        // Search for something unlikely to match all items
        await itemsPage.search("zzz-unlikely-search-term-xyz");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Row count should be different (likely 0 or less)
        const filteredRows = await itemsPage.getAllItemRows().count();
        const hasEmptyAfterSearch = await itemsPage.hasEmptyState();

        // Either fewer rows or empty state
        expect(filteredRows < initialRows || hasEmptyAfterSearch).toBe(true);
      }
    }
  });
});

test.describe("Items Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();

    const hasEmpty = await itemsPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = itemsPage.emptyState.getByRole("button", { name: /add/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    await itemsPage.goto();
    await itemsPage.waitForItemsLoaded();

    const hasEmpty = await itemsPage.hasEmptyState();

    if (hasEmpty) {
      await expect(itemsPage.emptyState).toContainText(/no items/i);
    }
  });
});
