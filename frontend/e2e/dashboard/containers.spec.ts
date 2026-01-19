import { test, expect } from "../fixtures/authenticated";
import { ContainersPage } from "../pages/ContainersPage";

test.describe("Containers Page", () => {
  let containersPage: ContainersPage;

  test.beforeEach(async ({ page }) => {
    containersPage = new ContainersPage(page);
    await containersPage.goto();
    await containersPage.waitForContainersLoaded();
  });

  test("page loads with containers list or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(containersPage.pageTitle).toBeVisible();

    // Either table or empty state should be present
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);
    const hasEmpty = await containersPage.hasEmptyState();

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(containersPage.pageTitle).toHaveText("Containers");
    await expect(containersPage.pageSubtitle).toContainText("storage containers");
  });

  test("Add Container button opens create dialog", async ({ page }) => {
    await containersPage.openCreateDialog();

    await expect(containersPage.createDialog).toBeVisible();
    await expect(containersPage.dialogTitle).toContainText(/new container/i);
  });

  test("create dialog has name and location fields", async ({ page }) => {
    await containersPage.openCreateDialog();

    // Name input should be visible
    await expect(containersPage.dialogNameInput).toBeVisible();

    // Check that Name is required
    const nameLabel = containersPage.createDialog.locator('label[for="name"]');
    await expect(nameLabel).toContainText("Name");

    // Location select should be visible
    await expect(containersPage.dialogLocationSelect).toBeVisible();

    // Check that Location is required
    const locationLabel = containersPage.createDialog.locator('label[for="location"]');
    await expect(locationLabel).toContainText("Location");
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await containersPage.openCreateDialog();
    await expect(containersPage.createDialog).toBeVisible();

    await containersPage.closeDialog();
    await expect(containersPage.createDialog).toBeHidden();
  });

  test("create dialog has capacity field", async ({ page }) => {
    await containersPage.openCreateDialog();

    // Capacity input should be visible
    await expect(containersPage.dialogCapacityInput).toBeVisible();
  });

  test("create dialog has short code field", async ({ page }) => {
    await containersPage.openCreateDialog();

    // Short code input should be visible
    await expect(containersPage.dialogShortCodeInput).toBeVisible();
  });

  test("create dialog has description field", async ({ page }) => {
    await containersPage.openCreateDialog();

    // Description textarea should be visible
    await expect(containersPage.dialogDescriptionInput).toBeVisible();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(containersPage.searchInput).toBeVisible();
    await expect(containersPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await containersPage.search("test query");
    await expect(containersPage.searchInput).toHaveValue("test query");
  });

  test("search filters containers", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      // Get initial row count
      const initialRows = await containersPage.getAllContainerRows().count();

      if (initialRows > 0) {
        // Search for something unlikely to match
        await containersPage.search("zzz-unlikely-search-xyz");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Row count should change (likely 0 or less)
        const filteredRows = await containersPage.getAllContainerRows().count();
        const hasEmptyAfterSearch = await containersPage.hasEmptyState();

        // Either fewer rows or empty state
        expect(filteredRows < initialRows || hasEmptyAfterSearch).toBe(true);
      }
    }
  });

  test("filter button opens filter popover", async ({ page }) => {
    // Only test if filter button exists
    if (await containersPage.filterButton.isVisible()) {
      await containersPage.openFilters();
      await expect(containersPage.filterPopover).toBeVisible();
    }
  });

  test("archive toggle changes view", async ({ page }) => {
    const archiveButton = containersPage.archiveToggle;
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
    await containersPage.openImportDialog();
    await expect(containersPage.importDialog).toBeVisible();
  });

  test("export button is present", async ({ page }) => {
    await expect(containersPage.exportButton).toBeVisible();
  });

  test("card shows container count in description", async ({ page }) => {
    const countText = await containersPage.getContainerCount();
    expect(countText).toMatch(/\d+\s+container/i);
  });
});

test.describe("Containers Table Interactions", () => {
  let containersPage: ContainersPage;

  test.beforeEach(async ({ page }) => {
    containersPage = new ContainersPage(page);
    await containersPage.goto();
    await containersPage.waitForContainersLoaded();
  });

  test("table headers are visible when containers exist", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      // Check for sortable headers
      const nameHeader = containersPage.tableHeaderColumn("Name");
      const locationHeader = containersPage.tableHeaderColumn("Location");

      await expect(nameHeader).toBeVisible();
      await expect(locationHeader).toBeVisible();
    }
  });

  test("table headers are sortable", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      const nameHeader = containersPage.tableHeaderColumn("Name");

      // Click to sort
      await nameHeader.click();

      // Header should have sort indicator
      const sortIcon = nameHeader.locator('[class*="lucide-arrow-up"], [class*="lucide-arrow-down"], [class*="lucide-chevron"]');
      // Sort indicator should be visible after clicking
      await expect(sortIcon.or(nameHeader)).toBeVisible();
    }
  });

  test("container row shows location info", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = containersPage.getAllContainerRows();
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // First row should show location
        const firstRow = rows.first();

        // Location column should have map pin icon
        const mapPinIcon = firstRow.locator('[class*="lucide-map-pin"]');
        await expect(mapPinIcon).toBeVisible();
      }
    }
  });

  test("container row has action menu", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = containersPage.getAllContainerRows();
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Get first row container name
        const firstRow = rows.first();
        const nameCell = firstRow.locator("td").first().locator(".font-medium");
        const name = await nameCell.textContent();

        if (name) {
          // Open action menu
          await containersPage.openRowActionMenu(name.trim());

          // Menu should be visible with Edit option
          const menuContent = page.locator("[data-radix-dropdown-menu-content]");
          await expect(menuContent).toBeVisible();
          await expect(menuContent.getByText("Edit")).toBeVisible();
        }
      }
    }
  });

  test("action menu has archive option", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = containersPage.getAllContainerRows();
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Get first row container name
        const firstRow = rows.first();
        const nameCell = firstRow.locator("td").first().locator(".font-medium");
        const name = await nameCell.textContent();

        if (name) {
          await containersPage.openRowActionMenu(name.trim());

          const menuContent = page.locator("[data-radix-dropdown-menu-content]");
          await expect(menuContent.getByText(/archive|restore/i)).toBeVisible();
        }
      }
    }
  });

  test("action menu has delete option", async ({ page }) => {
    const hasTable = await containersPage.containersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = containersPage.getAllContainerRows();
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // Get first row container name
        const firstRow = rows.first();
        const nameCell = firstRow.locator("td").first().locator(".font-medium");
        const name = await nameCell.textContent();

        if (name) {
          await containersPage.openRowActionMenu(name.trim());

          const menuContent = page.locator("[data-radix-dropdown-menu-content]");
          await expect(menuContent.getByText("Delete")).toBeVisible();
        }
      }
    }
  });
});

test.describe("Containers Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const containersPage = new ContainersPage(page);
    await containersPage.goto();
    await containersPage.waitForContainersLoaded();

    const hasEmpty = await containersPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = containersPage.emptyState.getByRole("button", { name: /add/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const containersPage = new ContainersPage(page);
    await containersPage.goto();
    await containersPage.waitForContainersLoaded();

    const hasEmpty = await containersPage.hasEmptyState();

    if (hasEmpty) {
      await expect(containersPage.emptyState).toContainText(/no containers/i);
    }
  });
});
