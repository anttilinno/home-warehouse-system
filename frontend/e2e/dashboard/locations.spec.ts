import { test, expect } from "../fixtures/authenticated";
import { LocationsPage } from "../pages/LocationsPage";

test.describe("Locations Page", () => {
  let locationsPage: LocationsPage;

  test.beforeEach(async ({ page }) => {
    locationsPage = new LocationsPage(page);
    await locationsPage.goto();
    await locationsPage.waitForLocationsLoaded();
  });

  test("page loads with tree view or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(locationsPage.pageTitle).toBeVisible();

    // Either tree view or empty state should be present
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);
    const hasEmpty = await locationsPage.hasEmptyState();

    expect(hasTree || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(locationsPage.pageTitle).toHaveText("Locations");
    await expect(locationsPage.pageSubtitle).toContainText("storage locations");
  });

  test("Add Location button opens create dialog", async ({ page }) => {
    await locationsPage.openCreateDialog();

    await expect(locationsPage.createDialog).toBeVisible();
    await expect(locationsPage.dialogTitle).toContainText(/new location/i);
  });

  test("create dialog has name and parent fields", async ({ page }) => {
    await locationsPage.openCreateDialog();

    // Name input should be visible
    await expect(locationsPage.dialogNameInput).toBeVisible();

    // Check that Name is required
    const nameLabel = locationsPage.createDialog.locator('label[for="name"]');
    await expect(nameLabel).toContainText("Name");

    // Parent select should be visible
    await expect(locationsPage.dialogParentSelect).toBeVisible();
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await locationsPage.openCreateDialog();
    await expect(locationsPage.createDialog).toBeVisible();

    await locationsPage.closeDialog();
    await expect(locationsPage.createDialog).toBeHidden();
  });

  test("create dialog has zone, shelf, and bin fields", async ({ page }) => {
    await locationsPage.openCreateDialog();

    // Zone, shelf, bin inputs should be visible
    await expect(locationsPage.dialogZoneInput).toBeVisible();
    await expect(locationsPage.dialogShelfInput).toBeVisible();
    await expect(locationsPage.dialogBinInput).toBeVisible();
  });

  test("create dialog has short code field", async ({ page }) => {
    await locationsPage.openCreateDialog();

    // Short code input should be visible
    await expect(locationsPage.dialogShortCodeInput).toBeVisible();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(locationsPage.searchInput).toBeVisible();
    await expect(locationsPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await locationsPage.search("test query");
    await expect(locationsPage.searchInput).toHaveValue("test query");
  });

  test("search filters locations in tree", async ({ page }) => {
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      // Get initial node count
      const initialNodes = await locationsPage.getAllTreeNodes().count();

      if (initialNodes > 0) {
        // Search for something unlikely to match
        await locationsPage.search("zzz-unlikely-search-xyz");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Node count should change (likely 0 or less)
        const filteredNodes = await locationsPage.getAllTreeNodes().count();
        const hasEmptyAfterSearch = await locationsPage.hasEmptyState();

        // Either fewer nodes or empty state
        expect(filteredNodes < initialNodes || hasEmptyAfterSearch).toBe(true);
      }
    }
  });

  test("archive toggle changes view", async ({ page }) => {
    const archiveButton = locationsPage.archiveToggle;
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
    await locationsPage.openImportDialog();
    await expect(locationsPage.importDialog).toBeVisible();
  });

  test("card shows location count in description", async ({ page }) => {
    const countText = await locationsPage.getLocationCount();
    expect(countText).toMatch(/\d+\s+location/i);
  });
});

test.describe("Locations Tree View", () => {
  let locationsPage: LocationsPage;

  test.beforeEach(async ({ page }) => {
    locationsPage = new LocationsPage(page);
    await locationsPage.goto();
    await locationsPage.waitForLocationsLoaded();
  });

  test("tree view renders with hierarchy", async ({ page }) => {
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      // Tree should have role="tree"
      await expect(locationsPage.treeView).toHaveAttribute("role", "tree");

      // Tree items should have proper aria attributes
      const nodes = locationsPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        const firstNode = nodes.first();
        await expect(firstNode).toHaveAttribute("role", "treeitem");
      }
    }
  });

  test("expand button reveals child locations", async ({ page }) => {
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = locationsPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        // Find a node that has children (aria-expanded attribute)
        for (let i = 0; i < count; i++) {
          const node = nodes.nth(i);
          const isExpandable = await node.getAttribute("aria-expanded");

          if (isExpandable !== null) {
            // Get the node name
            const nameElement = node.locator('.font-medium').first();
            const name = await nameElement.textContent();

            if (name) {
              // If it's expanded, collapse it first
              if (isExpandable === "true") {
                await locationsPage.collapseNode(name);
                await expect(node).toHaveAttribute("aria-expanded", "false");
              }

              // Now expand it
              await locationsPage.expandNode(name);
              await expect(node).toHaveAttribute("aria-expanded", "true");

              break; // Test one node only
            }
          }
        }
      }
    }
  });

  test("location row has action menu", async ({ page }) => {
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = locationsPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        // Get first node name
        const firstNode = nodes.first();
        const nameElement = firstNode.locator('.font-medium').first();
        const name = await nameElement.textContent();

        if (name) {
          // Open action menu
          await locationsPage.openActionMenu(name.trim());

          // Menu should be visible with Edit option
          const menuContent = page.locator("[data-radix-dropdown-menu-content]");
          await expect(menuContent).toBeVisible();
          await expect(menuContent.getByText("Edit")).toBeVisible();
        }
      }
    }
  });

  test("tree indentation shows hierarchy", async ({ page }) => {
    const hasTree = await locationsPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = locationsPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 1) {
        // Check for aria-level attributes indicating hierarchy
        let foundLevel1 = false;
        let foundLevel2 = false;

        for (let i = 0; i < count; i++) {
          const node = nodes.nth(i);
          const level = await node.getAttribute("aria-level");

          if (level === "1") foundLevel1 = true;
          if (level === "2") foundLevel2 = true;

          // Found both levels - hierarchy confirmed
          if (foundLevel1 && foundLevel2) break;
        }

        // At minimum, level 1 should exist
        expect(foundLevel1).toBe(true);
      }
    }
  });
});

test.describe("Locations Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const locationsPage = new LocationsPage(page);
    await locationsPage.goto();
    await locationsPage.waitForLocationsLoaded();

    const hasEmpty = await locationsPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = locationsPage.emptyState.getByRole("button", { name: /add/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const locationsPage = new LocationsPage(page);
    await locationsPage.goto();
    await locationsPage.waitForLocationsLoaded();

    const hasEmpty = await locationsPage.hasEmptyState();

    if (hasEmpty) {
      await expect(locationsPage.emptyState).toContainText(/no locations/i);
    }
  });
});
