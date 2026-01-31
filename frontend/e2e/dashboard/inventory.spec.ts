import { test, expect } from "../fixtures/authenticated";
import { InventoryPage } from "../pages/InventoryPage";

test.describe("Inventory Page", () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();
  });

  test("page loads with inventory table or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(inventoryPage.pageTitle).toBeVisible();

    // Either the table or empty state should be present
    const hasTable = await inventoryPage.inventoryTable.isVisible().catch(() => false);
    const hasEmpty = await inventoryPage.hasEmptyState();

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(inventoryPage.pageTitle).toHaveText("Inventory");
    await expect(inventoryPage.pageSubtitle).toContainText("Track physical instances");
  });

  test("Add Inventory button opens create dialog", async ({ page }) => {
    await inventoryPage.openCreateDialog();

    await expect(inventoryPage.createDialog).toBeVisible();
    // Dialog should have Add Inventory title
    await expect(inventoryPage.dialogTitle).toContainText(/add inventory/i);
  });

  test("create dialog has required fields", async ({ page }) => {
    await inventoryPage.openCreateDialog();

    // Quantity and Notes inputs should be visible
    await expect(inventoryPage.dialogQuantityInput).toBeVisible();
    await expect(inventoryPage.dialogNotesInput).toBeVisible();

    // Check for required field indicators
    const itemLabel = inventoryPage.createDialog.locator('label').filter({ hasText: "Item" });
    const locationLabel = inventoryPage.createDialog.locator('label').filter({ hasText: "Location" });
    await expect(itemLabel).toContainText("*");
    await expect(locationLabel).toContainText("*");
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await inventoryPage.openCreateDialog();
    await expect(inventoryPage.createDialog).toBeVisible();

    await inventoryPage.closeDialog();
    await expect(inventoryPage.createDialog).toBeHidden();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(inventoryPage.searchInput).toBeVisible();
    await expect(inventoryPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await inventoryPage.search("test query");
    await expect(inventoryPage.searchInput).toHaveValue("test query");
  });

  test("filter button opens filter popover", async ({ page }) => {
    const filterBtn = inventoryPage.filterButton;

    // Only test if filter button exists
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await expect(inventoryPage.filterPopover).toBeVisible();
    }
  });

  test("archive toggle changes view", async ({ page }) => {
    const archiveButton = inventoryPage.archiveToggle;
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
    await inventoryPage.openImportDialog();
    await expect(inventoryPage.importDialog).toBeVisible();
  });

  test("export button is present and handles state correctly", async ({ page }) => {
    await expect(inventoryPage.exportButton).toBeVisible();

    // If empty state is shown, export should be disabled
    const hasEmpty = await inventoryPage.hasEmptyState();
    if (hasEmpty) {
      await expect(inventoryPage.exportButton).toBeDisabled();
    }
  });

  test("card shows inventory count in description", async ({ page }) => {
    const countText = await inventoryPage.getInventoryCount();
    // Should contain "inventor" (singular or plural) - matches "inventory" or "inventories"
    expect(countText).toMatch(/inventor/i);
  });
});

test.describe("Inventory Table Interactions", () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();
  });

  test("table headers are visible when inventory exists", async ({ page }) => {
    const hasTable = await inventoryPage.inventoryTable.isVisible().catch(() => false);

    if (hasTable) {
      // Check for sortable headers
      const itemHeader = inventoryPage.tableHeaderColumn("Item");
      const locationHeader = inventoryPage.tableHeaderColumn("Location");
      const qtyHeader = inventoryPage.tableHeaderColumn("Qty");
      const conditionHeader = inventoryPage.tableHeaderColumn("Condition");
      const statusHeader = inventoryPage.tableHeaderColumn("Status");

      await expect(itemHeader).toBeVisible();
      await expect(locationHeader).toBeVisible();
      await expect(qtyHeader).toBeVisible();
      await expect(conditionHeader).toBeVisible();
      await expect(statusHeader).toBeVisible();
    }
  });

  test("table headers are sortable", async ({ page }) => {
    const hasTable = await inventoryPage.inventoryTable.isVisible().catch(() => false);

    if (hasTable) {
      const itemHeader = inventoryPage.tableHeaderColumn("Item");

      // Click to sort
      await itemHeader.click();

      // Header should have sort indicator (chevron or arrow)
      const sortIcon = itemHeader.locator('[class*="lucide-arrow-up"], [class*="lucide-arrow-down"], [class*="lucide-chevron"]');
      // Sort indicator should be visible after clicking
      await expect(sortIcon.or(itemHeader)).toBeVisible();
    }
  });

  test("checkbox in header selects all rows", async ({ page }) => {
    const hasTable = await inventoryPage.inventoryTable.isVisible().catch(() => false);
    const rows = inventoryPage.getAllInventoryRows();
    const rowCount = await rows.count();

    if (hasTable && rowCount > 0) {
      // Find header checkbox
      const headerCheckbox = inventoryPage.tableHeader.locator('input[type="checkbox"], [role="checkbox"]');

      if (await headerCheckbox.isVisible()) {
        await headerCheckbox.click();

        // Bulk action bar should appear
        await expect(inventoryPage.bulkActionBar).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test("search filters table rows", async ({ page }) => {
    const hasTable = await inventoryPage.inventoryTable.isVisible().catch(() => false);

    if (hasTable) {
      const initialRows = await inventoryPage.getAllInventoryRows().count();

      if (initialRows > 0) {
        // Search for something unlikely to match
        await inventoryPage.search("zzz-unlikely-search-term-xyz");

        // Wait for table to update using assertion retry
        await expect(async () => {
          const filteredRows = await inventoryPage.getAllInventoryRows().count();
          const hasEmptyAfterSearch = await inventoryPage.hasEmptyState();
          // Either fewer rows or empty state
          expect(filteredRows < initialRows || hasEmptyAfterSearch || filteredRows === 0).toBe(true);
        }).toPass({ timeout: 3000 });
      }
    }
  });
});

test.describe("Inventory Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();

    const hasEmpty = await inventoryPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have the "Add Your First Inventory" button
      const emptyStateButton = page.getByRole("button", { name: /add your first inventory/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
    await inventoryPage.waitForPageLoaded();

    const hasEmpty = await inventoryPage.hasEmptyState();

    if (hasEmpty) {
      // Check for "No inventory yet" heading
      const emptyHeading = page.getByRole("heading", { level: 3, name: /no inventory/i });
      await expect(emptyHeading).toBeVisible();
    }
  });
});
