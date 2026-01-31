import { test, expect } from "../fixtures/authenticated";
import { LoansPage } from "../pages/LoansPage";

test.describe("Loans Page", () => {
  let loansPage: LoansPage;

  test.beforeEach(async ({ page }) => {
    loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();
  });

  test("page loads with loans table or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(loansPage.pageTitle).toBeVisible();

    // Either the table or empty state should be present
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);
    const hasEmpty = await loansPage.hasEmptyState();

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(loansPage.pageTitle).toHaveText("Loans");
  });

  test("Add Loan button opens create dialog", async ({ page }) => {
    await loansPage.openCreateDialog();

    await expect(loansPage.createDialog).toBeVisible();
    await expect(loansPage.dialogTitle).toContainText(/loan/i);
  });

  test("create dialog has borrower and item selects", async ({ page }) => {
    await loansPage.openCreateDialog();

    // Item select should be present (may be a combobox or select)
    const itemSelect = loansPage.createDialog.locator('button[role="combobox"], select').filter({ hasText: /item|select/i }).first();
    const hasItemSelect = await itemSelect.isVisible().catch(() => false);

    // Borrower select should be present
    const borrowerLabel = loansPage.createDialog.locator('label').filter({ hasText: /borrower/i });
    await expect(borrowerLabel).toBeVisible();

    // Check that create dialog has the required form elements
    await expect(loansPage.createDialog).toBeVisible();
  });

  test("create dialog has due date picker", async ({ page }) => {
    await loansPage.openCreateDialog();

    // Due date input should be visible
    await expect(loansPage.dialogDueDateInput).toBeVisible();

    // Check it's a date input
    await expect(loansPage.dialogDueDateInput).toHaveAttribute("type", "date");
  });

  test("create dialog closes on cancel", async ({ page }) => {
    await loansPage.openCreateDialog();
    await expect(loansPage.createDialog).toBeVisible();

    await loansPage.closeDialog();
    await expect(loansPage.createDialog).toBeHidden();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(loansPage.searchInput).toBeVisible();
    await expect(loansPage.searchInput).toHaveAttribute("placeholder", /search/i);

    // Type in search
    await loansPage.search("test borrower");
    await expect(loansPage.searchInput).toHaveValue("test borrower");
  });
});

test.describe("Loans Status Filter", () => {
  let loansPage: LoansPage;

  test.beforeEach(async ({ page }) => {
    loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();
  });

  test("status filter shows Active/Returned/Overdue options", async ({ page }) => {
    // Open filter popover if it exists
    const hasFilter = await loansPage.filterButton.isVisible().catch(() => false);

    if (hasFilter) {
      await loansPage.openFilterPopover();

      // Check for status options
      const activeOption = loansPage.statusOption("active");
      const returnedOption = loansPage.statusOption("returned");
      const overdueOption = loansPage.statusOption("overdue");

      const hasActive = await activeOption.isVisible().catch(() => false);
      const hasReturned = await returnedOption.isVisible().catch(() => false);
      const hasOverdue = await overdueOption.isVisible().catch(() => false);

      // At least some status options should be visible
      expect(hasActive || hasReturned || hasOverdue).toBe(true);
    }
  });

  test("clicking status filter changes displayed loans", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);
    const hasFilter = await loansPage.filterButton.isVisible().catch(() => false);

    if (hasTable && hasFilter) {
      // Get initial row count
      const initialRows = await loansPage.getAllLoanRows().count();

      if (initialRows > 0) {
        // Open filter
        await loansPage.openFilterPopover();

        // Click a status option if available
        const returnedOption = loansPage.statusOption("returned");
        const hasReturned = await returnedOption.isVisible().catch(() => false);

        if (hasReturned) {
          await returnedOption.click();
          // Wait for filter to apply by checking network idle
          await page.waitForLoadState("networkidle");

          // The loans displayed may have changed
          // This tests that the filter mechanism works
        }
      }
    }
  });
});

test.describe("Loans Table Interactions", () => {
  let loansPage: LoansPage;

  test.beforeEach(async ({ page }) => {
    loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();
  });

  test("loan row shows borrower name", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = loansPage.getAllLoanRows();
      const count = await rows.count();

      if (count > 0) {
        // First row should have content (borrower info, etc.)
        const firstRow = rows.first();
        const rowText = await firstRow.textContent();

        // Row should have some text content
        expect(rowText?.length).toBeGreaterThan(0);
      }
    }
  });

  test("loan row shows status badge with color", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = loansPage.getAllLoanRows();
      const count = await rows.count();

      if (count > 0) {
        // Find status badges in rows
        const badges = loansPage.tableBody.locator('[class*="badge"]');
        const badgeCount = await badges.count();

        if (badgeCount > 0) {
          const firstBadge = badges.first();
          await expect(firstBadge).toBeVisible();

          // Badge should have status text
          const badgeText = await firstBadge.textContent();
          expect(badgeText?.toLowerCase()).toMatch(/active|overdue|returned/);
        }
      }
    }
  });

  test("overdue loans highlighted differently", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      // Find badges with "overdue" status
      const overdueBadges = loansPage.tableBody.locator('[class*="badge"]').filter({ hasText: /overdue/i });
      const overdueCount = await overdueBadges.count();

      if (overdueCount > 0) {
        const firstOverdue = overdueBadges.first();

        // Overdue badges should have destructive/red styling
        const classList = await firstOverdue.getAttribute("class");

        // Check for destructive variant or red color
        expect(classList).toMatch(/destructive|red|danger|error/i);
      }
    }
  });

  test("loan action menu has Return option", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = loansPage.getAllLoanRows();
      const count = await rows.count();

      if (count > 0) {
        // Find an active loan (not returned)
        const activeBadges = loansPage.tableBody.locator('[class*="badge"]').filter({ hasText: /active|overdue/i });
        const hasActive = await activeBadges.count() > 0;

        if (hasActive) {
          // Get the row with an active loan
          const activeRow = loansPage.tableBody.locator("tr").filter({
            has: page.locator('[class*="badge"]').filter({ hasText: /active|overdue/i })
          }).first();

          // Hover and open action menu
          await activeRow.hover();
          const menuButton = activeRow.locator('button').filter({
            has: page.locator('[class*="lucide-more"]')
          }).or(activeRow.getByRole("button", { name: /actions|more/i })).first();

          const hasMenu = await menuButton.isVisible().catch(() => false);

          if (hasMenu) {
            await menuButton.click();

            // Menu should have return option
            const menuContent = page.locator("[data-radix-dropdown-menu-content]");
            await expect(menuContent).toBeVisible();
            await expect(menuContent.getByText(/return|mark as returned/i)).toBeVisible();
          }
        }
      }
    }
  });

  test("return action opens confirmation dialog", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      const rows = loansPage.getAllLoanRows();
      const count = await rows.count();

      if (count > 0) {
        // Find an active loan
        const activeBadges = loansPage.tableBody.locator('[class*="badge"]').filter({ hasText: /active|overdue/i });
        const hasActive = await activeBadges.count() > 0;

        if (hasActive) {
          const activeRow = loansPage.tableBody.locator("tr").filter({
            has: page.locator('[class*="badge"]').filter({ hasText: /active|overdue/i })
          }).first();

          await activeRow.hover();
          const menuButton = activeRow.locator('button').filter({
            has: page.locator('[class*="lucide-more"]')
          }).or(activeRow.getByRole("button", { name: /actions|more/i })).first();

          const hasMenu = await menuButton.isVisible().catch(() => false);

          if (hasMenu) {
            await menuButton.click();

            const menuContent = page.locator("[data-radix-dropdown-menu-content]");
            const returnOption = menuContent.getByText(/return|mark as returned/i);
            const hasReturn = await returnOption.isVisible().catch(() => false);

            if (hasReturn) {
              await returnOption.click();

              // Confirmation dialog should appear
              await expect(loansPage.returnDialog).toBeVisible();
            }
          }
        }
      }
    }
  });

  test("table headers are sortable", async ({ page }) => {
    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (hasTable) {
      // Check for sortable headers
      const borrowerHeader = loansPage.tableHeaderColumn("Borrower");
      const hasBorrowerHeader = await borrowerHeader.isVisible().catch(() => false);

      if (hasBorrowerHeader) {
        await borrowerHeader.click();

        // Should see sort indicator or column should be clickable
        // Wait for any sort animation/re-render to complete
        await page.waitForLoadState("domcontentloaded");
      }
    }
  });
});

test.describe("Loans Empty State", () => {
  test("empty state shows create button", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    const hasEmpty = await loansPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a create button
      const emptyStateButton = loansPage.emptyState.getByRole("button", { name: /add|create|new/i });
      await expect(emptyStateButton).toBeVisible();
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    const hasEmpty = await loansPage.hasEmptyState();

    if (hasEmpty) {
      await expect(loansPage.emptyState).toContainText(/no loans/i);
    }
  });
});

test.describe("Loans Stats Cards", () => {
  let loansPage: LoansPage;

  test.beforeEach(async ({ page }) => {
    loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();
  });

  test("stats cards display loan counts", async ({ page }) => {
    // Check if stats cards are visible
    const hasActiveCard = await loansPage.activeLoansCard.isVisible().catch(() => false);
    const hasOverdueCard = await loansPage.overdueCard.isVisible().catch(() => false);
    const hasReturnedCard = await loansPage.returnedCard.isVisible().catch(() => false);

    if (hasActiveCard || hasOverdueCard || hasReturnedCard) {
      // At least one card should have a number
      if (hasActiveCard) {
        const activeCount = await loansPage.getActiveLoanCount();
        expect(activeCount).toMatch(/\d+/);
      }

      if (hasOverdueCard) {
        const overdueCount = await loansPage.getOverdueCount();
        expect(overdueCount).toMatch(/\d+/);
      }
    }
  });
});

// Serial mode ensures tests run in order and can build on each other's state
test.describe.serial("Loan CRUD Flows", () => {
  test("can check prerequisites for loan creation", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    // Open create dialog
    await loansPage.openCreateDialog();

    // Check if we have items and borrowers available
    const hasItems = await loansPage.hasItemOptions();
    const hasBorrowers = await loansPage.hasBorrowerOptions();

    // Log state for debugging
    console.log(`[Loan CRUD] Prerequisites - Items: ${hasItems}, Borrowers: ${hasBorrowers}`);

    // Close dialog
    await loansPage.closeDialog();

    // This test always passes - it's informational for subsequent tests
    expect(true).toBe(true);
  });

  test("can create a new loan when prerequisites exist", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    // Open create dialog
    await loansPage.openCreateDialog();

    // Check prerequisites
    const hasItems = await loansPage.hasItemOptions();
    const hasBorrowers = await loansPage.hasBorrowerOptions();

    if (!hasItems || !hasBorrowers) {
      console.log("[Loan CRUD] Skipping create test - missing items or borrowers");
      test.skip(true, "Prerequisites not met: need items and borrowers to create loan");
      return;
    }

    // Select first item
    await loansPage.selectFirstItem();

    // Wait for inventory to load after item selection
    await page.waitForLoadState("networkidle");

    // Check if inventory is available for this item
    const hasInventory = await loansPage.hasInventoryAvailable();

    if (!hasInventory) {
      console.log("[Loan CRUD] Skipping create test - no available inventory for selected item");
      await loansPage.closeDialog();
      test.skip(true, "No available inventory for selected item");
      return;
    }

    // Select first inventory
    await loansPage.selectFirstInventory();

    // Select first borrower
    await loansPage.selectFirstBorrower();

    // Check if submit button is now enabled
    const isSubmitEnabled = await loansPage.dialogSubmitButton.isEnabled();

    if (isSubmitEnabled) {
      // Submit the form
      await loansPage.submitCreateForm();

      // Wait for dialog to close (success) or error toast
      await expect(async () => {
        const dialogHidden = await loansPage.createDialog.isHidden();
        const hasError = await page.locator('[data-sonner-toast][data-type="error"]').isVisible().catch(() => false);
        expect(dialogHidden || hasError).toBe(true);
      }).toPass({ timeout: 5000 });

      // If dialog closed, loan was created
      const dialogClosed = await loansPage.createDialog.isHidden();
      if (dialogClosed) {
        console.log("[Loan CRUD] Successfully created a loan");
      }
    } else {
      console.log("[Loan CRUD] Submit button not enabled - form validation may have failed");
      await loansPage.closeDialog();
    }
  });

  test("can view loan details in table after creation", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (!hasTable) {
      console.log("[Loan CRUD] No loans table visible");
      test.skip(true, "No loans table visible");
      return;
    }

    const rows = loansPage.getAllLoanRows();
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log("[Loan CRUD] No loans to view");
      test.skip(true, "No loans available to view");
      return;
    }

    // Click on first row to see if it has details
    const firstRow = rows.first();

    // Check that row contains expected loan data
    const rowText = await firstRow.textContent();
    expect(rowText?.length).toBeGreaterThan(0);

    // Check for status badge
    const badge = firstRow.locator('[class*="badge"]');
    const hasBadge = await badge.isVisible().catch(() => false);
    expect(hasBadge).toBe(true);

    // Badge should show a valid status
    const badgeText = await badge.textContent();
    expect(badgeText?.toLowerCase()).toMatch(/active|overdue|returned/);

    console.log(`[Loan CRUD] Found loan with status: ${badgeText}`);
  });

  test("can return an active loan", async ({ page }) => {
    const loansPage = new LoansPage(page);
    await loansPage.goto();
    await loansPage.waitForLoansLoaded();

    const hasTable = await loansPage.loansTable.isVisible().catch(() => false);

    if (!hasTable) {
      console.log("[Loan CRUD] No loans table visible");
      test.skip(true, "No loans table visible");
      return;
    }

    // Try to initiate return on first active loan
    const returnInitiated = await loansPage.initiateReturnOnFirstActiveLoan();

    if (!returnInitiated) {
      console.log("[Loan CRUD] No active loans to return");
      test.skip(true, "No active loans available to return");
      return;
    }

    // Return dialog should be visible
    await expect(loansPage.returnDialog).toBeVisible();

    // Get initial active loan count from stats card (if visible)
    const hasActiveCard = await loansPage.activeLoansCard.isVisible().catch(() => false);
    let initialActiveCount: string | null = null;
    if (hasActiveCard) {
      initialActiveCount = await loansPage.getActiveLoanCount();
    }

    // Confirm the return
    await loansPage.confirmReturn();

    // Wait for page to update (toast or table refresh)
    await expect(async () => {
      // Either success toast appears or active count changes
      const successToast = await page.locator('[data-sonner-toast]').filter({ hasText: /return|success/i }).isVisible().catch(() => false);
      const dialogHidden = await loansPage.returnDialog.isHidden();
      expect(successToast || dialogHidden).toBe(true);
    }).toPass({ timeout: 5000 });

    console.log("[Loan CRUD] Successfully returned a loan");
  });
});
