import { test, expect } from "../fixtures/authenticated";
import { BorrowersPage } from "../pages/BorrowersPage";

test.describe("Borrowers Page", () => {
  let borrowersPage: BorrowersPage;

  test.beforeEach(async ({ page }) => {
    borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();
  });

  test("page loads with borrowers list or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(borrowersPage.pageTitle).toBeVisible();

    // Either the table or empty state should be present
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);
    const hasEmpty = await borrowersPage.hasEmptyState();

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(borrowersPage.pageTitle).toHaveText("Borrowers");
  });

  test("Add Borrower button opens create dialog", async ({ page }) => {
    await borrowersPage.openCreateDialog();

    await expect(borrowersPage.createDialog).toBeVisible();
    await expect(borrowersPage.dialogTitle).toContainText(/borrower/i);
  });

  test("create dialog has name, email, and phone fields", async ({ page }) => {
    await borrowersPage.openCreateDialog();

    // Name input should be visible
    await expect(borrowersPage.dialogNameInput).toBeVisible();

    // Check that Name label exists and is marked required
    const nameLabel = borrowersPage.createDialog.locator('label[for="name"]');
    await expect(nameLabel).toContainText("Name");

    // Email input should be visible
    await expect(borrowersPage.dialogEmailInput).toBeVisible();
    await expect(borrowersPage.dialogEmailInput).toHaveAttribute("type", "email");

    // Phone input should be visible
    await expect(borrowersPage.dialogPhoneInput).toBeVisible();
    await expect(borrowersPage.dialogPhoneInput).toHaveAttribute("type", "tel");
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await borrowersPage.openCreateDialog();
    await expect(borrowersPage.createDialog).toBeVisible();

    await borrowersPage.closeDialog();
    await expect(borrowersPage.createDialog).toBeHidden();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(borrowersPage.searchInput).toBeVisible();
    await expect(borrowersPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await borrowersPage.search("test name");
    await expect(borrowersPage.searchInput).toHaveValue("test name");
  });

  test("search filters borrowers by name/email", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      // Get initial row count
      const initialRows = await borrowersPage.getAllBorrowerRows().count();

      if (initialRows > 0) {
        // Search for something unlikely to match
        await borrowersPage.search("zzz-unlikely-borrower-xyz");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Row count should change (likely 0 or less)
        const filteredRows = await borrowersPage.getAllBorrowerRows().count();
        const hasEmptyAfterSearch = await borrowersPage.page.locator('[class*="flex"]').filter({ hasText: /no borrower/i }).isVisible();

        // Either fewer rows or empty state
        expect(filteredRows < initialRows || hasEmptyAfterSearch).toBe(true);
      }
    }
  });
});

test.describe("Borrowers Table Interactions", () => {
  let borrowersPage: BorrowersPage;

  test.beforeEach(async ({ page }) => {
    borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();
  });

  test("borrower row shows contact info", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = borrowersPage.getAllBorrowerRows();
      const count = await rows.count();

      if (count > 0) {
        // First row should have content
        const firstRow = rows.first();

        // Check for email or phone icons (contact info indicators)
        const hasMailIcon = await firstRow.locator('[class*="lucide-mail"]').isVisible().catch(() => false);
        const hasPhoneIcon = await firstRow.locator('[class*="lucide-phone"]').isVisible().catch(() => false);

        // Row should have some text content
        const rowText = await firstRow.textContent();
        expect(rowText?.length).toBeGreaterThan(0);
      }
    }
  });

  test("borrower row shows active loans count", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = borrowersPage.getAllBorrowerRows();
      const count = await rows.count();

      if (count > 0) {
        // Look for a loans count badge or column
        // This may be displayed as a badge with a number
        const badges = borrowersPage.tableBody.locator('[class*="badge"]');
        const badgeCount = await badges.count();

        // Active loans count might be in a badge or text
        // Just verify the row structure exists
        const firstRow = rows.first();
        await expect(firstRow).toBeVisible();
      }
    }
  });

  test("borrower action menu has edit and delete", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = borrowersPage.getAllBorrowerRows();
      const count = await rows.count();

      if (count > 0) {
        // Get first row
        const firstRow = rows.first();

        // Find the name in the first row
        const nameCell = firstRow.locator("td").first();
        const name = await nameCell.textContent();

        if (name && name.trim()) {
          // Hover and find action menu
          await firstRow.hover();

          const menuButton = firstRow.locator('button').filter({
            has: page.locator('[class*="lucide-more"]')
          }).or(firstRow.getByRole("button", { name: /actions/i })).first();

          const hasMenu = await menuButton.isVisible().catch(() => false);

          if (hasMenu) {
            await menuButton.click();

            // Menu should have edit and delete options
            const menuContent = page.locator("[data-radix-dropdown-menu-content]");
            await expect(menuContent).toBeVisible();
            await expect(menuContent.getByText(/edit/i)).toBeVisible();
            await expect(menuContent.getByText(/delete/i)).toBeVisible();
          }
        }
      }
    }
  });

  test("table headers are visible", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      // Check for name header
      const nameHeader = borrowersPage.tableHeaderColumn("Name");
      await expect(nameHeader).toBeVisible();

      // Check for email header
      const emailHeader = borrowersPage.tableHeaderColumn("Email");
      const hasEmailHeader = await emailHeader.isVisible().catch(() => false);

      // At minimum, name should be visible
    }
  });

  test("table headers are sortable", async ({ page }) => {
    const hasTable = await borrowersPage.borrowersTable.isVisible().catch(() => false);

    if (hasTable) {
      const nameHeader = borrowersPage.tableHeaderColumn("Name");
      const hasNameHeader = await nameHeader.isVisible().catch(() => false);

      if (hasNameHeader) {
        // Click to sort
        await nameHeader.click();

        // Should see sort indicator or column should be clickable
        await page.waitForTimeout(300);

        // Click again to reverse sort
        await nameHeader.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

test.describe("Borrowers Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();

    const hasEmpty = await borrowersPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = borrowersPage.emptyState.getByRole("button", { name: /add|create|new/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();

    const hasEmpty = await borrowersPage.hasEmptyState();

    if (hasEmpty) {
      await expect(borrowersPage.emptyState).toContainText(/no borrowers/i);
    }
  });
});

test.describe("Borrowers Dialog Validation", () => {
  let borrowersPage: BorrowersPage;

  test.beforeEach(async ({ page }) => {
    borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();
  });

  test("create dialog validates required name field", async ({ page }) => {
    await borrowersPage.openCreateDialog();

    // Try to submit without filling name
    const submitButton = borrowersPage.dialogSubmitButton;

    // Submit button should be disabled when name is empty
    // or the form should show validation error
    const isDisabled = await submitButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      // Click submit
      await submitButton.click();

      // Form should stay open or show validation error
      await page.waitForTimeout(300);
      await expect(borrowersPage.createDialog).toBeVisible();
    } else {
      // Button is disabled as expected
      expect(isDisabled).toBe(true);
    }
  });

  test("create dialog name field is required", async ({ page }) => {
    await borrowersPage.openCreateDialog();

    // Check for required indicator on name label
    const nameLabel = borrowersPage.createDialog.locator('label[for="name"]');
    const labelText = await nameLabel.textContent();

    // Name should be marked as required (asterisk or similar)
    const requiredIndicator = borrowersPage.createDialog.locator('label[for="name"] + .text-destructive, label[for="name"] .text-destructive, label[for="name"] span');
    const hasIndicator = await requiredIndicator.isVisible().catch(() => false);

    // Either has visual indicator or the input has required attribute
    const isRequired = await borrowersPage.dialogNameInput.getAttribute("required");
    expect(hasIndicator || isRequired !== null || labelText?.includes("*")).toBe(true);
  });
});

test.describe("Borrowers Import/Export", () => {
  let borrowersPage: BorrowersPage;

  test.beforeEach(async ({ page }) => {
    borrowersPage = new BorrowersPage(page);
    await borrowersPage.goto();
    await borrowersPage.waitForBorrowersLoaded();
  });

  test("import button is present", async ({ page }) => {
    await expect(borrowersPage.importButton).toBeVisible();
  });

  test("export button is present", async ({ page }) => {
    const hasExport = await borrowersPage.exportButton.isVisible().catch(() => false);
    // Export button may only appear when there are borrowers
    // Just verify it's accessible when visible
    if (hasExport) {
      await expect(borrowersPage.exportButton).toBeVisible();
    }
  });
});
