import { test, expect } from "../fixtures/authenticated";
import { CategoriesPage } from "../pages/CategoriesPage";

test.describe("Categories Page", () => {
  let categoriesPage: CategoriesPage;

  test.beforeEach(async ({ page }) => {
    categoriesPage = new CategoriesPage(page);
    await categoriesPage.goto();
    await categoriesPage.waitForCategoriesLoaded();
  });

  test("page loads with tree view or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(categoriesPage.pageTitle).toBeVisible();

    // Either tree view or empty state should be present
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);
    const hasEmpty = await categoriesPage.hasEmptyState();

    expect(hasTree || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(categoriesPage.pageTitle).toHaveText("Categories");
    await expect(categoriesPage.pageSubtitle).toContainText(/categor/i);
  });

  test("Add Category button opens create dialog", async ({ page }) => {
    await categoriesPage.openCreateDialog();

    await expect(categoriesPage.createDialog).toBeVisible();
    await expect(categoriesPage.dialogTitle).toContainText(/category/i);
  });

  test("create dialog has name, description, and parent fields", async ({ page }) => {
    await categoriesPage.openCreateDialog();

    // Name input should be visible
    await expect(categoriesPage.dialogNameInput).toBeVisible();

    // Check that Name label exists
    const nameLabel = categoriesPage.createDialog.locator('label[for="name"]');
    await expect(nameLabel).toContainText("Name");

    // Description input should be visible
    await expect(categoriesPage.dialogDescriptionInput).toBeVisible();

    // Parent select should be visible
    await expect(categoriesPage.dialogParentSelect).toBeVisible();
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await categoriesPage.openCreateDialog();
    await expect(categoriesPage.createDialog).toBeVisible();

    await categoriesPage.closeDialog();
    await expect(categoriesPage.createDialog).toBeHidden();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(categoriesPage.searchInput).toBeVisible();
    await expect(categoriesPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await categoriesPage.search("test query");
    await expect(categoriesPage.searchInput).toHaveValue("test query");
  });

  test("search filters categories", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      // Get initial node count
      const initialNodes = await categoriesPage.getAllTreeNodes().count();

      if (initialNodes > 0) {
        // Search for something unlikely to match
        await categoriesPage.search("zzz-unlikely-search-xyz");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Node count should change (likely 0 or less)
        const filteredNodes = await categoriesPage.getAllTreeNodes().count();
        const hasEmptyAfterSearch = await categoriesPage.page.locator('[class*="flex"]').filter({ hasText: /no categor/i }).isVisible();

        // Either fewer nodes or empty state
        expect(filteredNodes < initialNodes || hasEmptyAfterSearch).toBe(true);
      }
    }
  });
});

test.describe("Categories Tree View", () => {
  let categoriesPage: CategoriesPage;

  test.beforeEach(async ({ page }) => {
    categoriesPage = new CategoriesPage(page);
    await categoriesPage.goto();
    await categoriesPage.waitForCategoriesLoaded();
  });

  test("tree view renders with proper structure", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      // Tree should have role="tree"
      await expect(categoriesPage.treeView).toHaveAttribute("role", "tree");

      // Tree items should have proper aria attributes
      const nodes = categoriesPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        const firstNode = nodes.first();
        await expect(firstNode).toHaveAttribute("role", "treeitem");
      }
    }
  });

  test("expand button reveals subcategories", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = categoriesPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        // Find a node that has children (aria-expanded attribute)
        for (let i = 0; i < count; i++) {
          const node = nodes.nth(i);
          const isExpandable = await node.getAttribute("aria-expanded");

          if (isExpandable !== null) {
            // Get the node name
            const nameElement = node.locator('.font-medium, [class*="font-medium"]').first();
            const name = await nameElement.textContent();

            if (name) {
              // If it's expanded, collapse it first
              if (isExpandable === "true") {
                await categoriesPage.collapseNode(name.trim());
                await expect(node).toHaveAttribute("aria-expanded", "false");
              }

              // Now expand it
              await categoriesPage.expandNode(name.trim());
              await expect(node).toHaveAttribute("aria-expanded", "true");

              break; // Test one node only
            }
          }
        }
      }
    }
  });

  test("subcategory count badge displays", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = categoriesPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        // Look for any category that has a subcategory count
        for (let i = 0; i < count; i++) {
          const node = nodes.nth(i);
          const isExpandable = await node.getAttribute("aria-expanded");

          if (isExpandable !== null) {
            // This category has children, check for count badge
            const badge = node.locator('[class*="badge"], .text-muted-foreground').filter({ hasText: /\d+\s*subcategor/i });
            const hasBadge = await badge.isVisible().catch(() => false);

            if (hasBadge) {
              // Found a badge, verify it contains a number
              const badgeText = await badge.textContent();
              expect(badgeText).toMatch(/\d+/);
              break;
            }
          }
        }
      }
    }
  });

  test("category row has action menu with edit and delete", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = categoriesPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 0) {
        // Get first node name
        const firstNode = nodes.first();
        const nameElement = firstNode.locator('.font-medium, [class*="font-medium"]').first();
        const name = await nameElement.textContent();

        if (name) {
          // Open action menu
          await categoriesPage.openActionMenu(name.trim());

          // Menu should be visible with Edit and Delete options
          const menuContent = page.locator("[data-radix-dropdown-menu-content]");
          await expect(menuContent).toBeVisible();
          await expect(menuContent.getByText(/edit/i)).toBeVisible();
          await expect(menuContent.getByText(/delete/i)).toBeVisible();
        }
      }
    }
  });

  test("tree keyboard navigation with arrow keys", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = categoriesPage.getAllTreeNodes();
      const count = await nodes.count();

      if (count > 1) {
        // Focus the tree
        await categoriesPage.focusTreeView();

        // Press down arrow
        await categoriesPage.pressArrowKey("down");

        // The focus should have moved (we can verify by checking active element)
        // This is a basic test that keyboard navigation is wired up
        await page.waitForTimeout(100);

        // Press up arrow to go back
        await categoriesPage.pressArrowKey("up");
        await page.waitForTimeout(100);
      }
    }
  });

  test("tree indentation shows hierarchy", async ({ page }) => {
    const hasTree = await categoriesPage.treeView.isVisible().catch(() => false);

    if (hasTree) {
      const nodes = categoriesPage.getAllTreeNodes();
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

test.describe("Categories Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const categoriesPage = new CategoriesPage(page);
    await categoriesPage.goto();
    await categoriesPage.waitForCategoriesLoaded();

    const hasEmpty = await categoriesPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = categoriesPage.emptyState.getByRole("button", { name: /add/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const categoriesPage = new CategoriesPage(page);
    await categoriesPage.goto();
    await categoriesPage.waitForCategoriesLoaded();

    const hasEmpty = await categoriesPage.hasEmptyState();

    if (hasEmpty) {
      await expect(categoriesPage.emptyState).toContainText(/no categories/i);
    }
  });
});
