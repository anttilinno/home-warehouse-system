import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class LoansPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Stats cards
  readonly statsSection: Locator;
  readonly activeLoansCard: Locator;
  readonly overdueCard: Locator;
  readonly returnedCard: Locator;

  // Actions
  readonly addLoanButton: Locator;

  // Search and filters
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly filterPopover: Locator;
  readonly statusFilter: Locator;

  // Loans table
  readonly loansTable: Locator;
  readonly tableHeader: Locator;
  readonly tableBody: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Create dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogItemSelect: Locator;
  readonly dialogInventorySelect: Locator;
  readonly dialogBorrowerSelect: Locator;
  readonly dialogQuantityInput: Locator;
  readonly dialogLoanedAtInput: Locator;
  readonly dialogDueDateInput: Locator;
  readonly dialogNotesInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Return confirmation dialog
  readonly returnDialog: Locator;
  readonly returnConfirmButton: Locator;
  readonly returnCancelButton: Locator;

  // Extend due date dialog
  readonly extendDialog: Locator;
  readonly extendDueDateInput: Locator;
  readonly extendSubmitButton: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Loans" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Stats cards
    this.statsSection = page.locator('[class*="grid"]').filter({ hasText: /active loans/i }).first();
    this.activeLoansCard = page.locator('[class*="card"]').filter({ hasText: /active loans/i }).first();
    this.overdueCard = page.locator('[class*="card"]').filter({ hasText: /overdue/i }).first();
    this.returnedCard = page.locator('[class*="card"]').filter({ hasText: /returned/i }).first();

    // Action buttons
    this.addLoanButton = page.getByRole("button", { name: /new loan|add loan|create loan/i });

    // Search and filters
    this.searchInput = page.getByPlaceholder(/search by borrower or inventory/i);
    this.filterButton = page.locator("button").filter({ has: page.locator('[class*="lucide-filter"]') });
    this.filterPopover = page.locator('[role="dialog"], [data-radix-popper-content-wrapper]').filter({ hasText: /filter/i });
    this.statusFilter = page.locator('[class*="checkbox"]').filter({ hasText: /active|returned|overdue/i }).first();

    // Loans table - matches table with aria-label="Borrowed items and loans"
    this.loansTable = page.locator('table[aria-label*="loan"]');
    this.tableHeader = this.loansTable.locator("thead");
    this.tableBody = this.loansTable.locator("tbody");

    // Empty state - matches EmptyState component with "py-12 text-center" classes
    this.emptyState = page.locator('[class*="py-12"][class*="text-center"]').filter({ hasText: /no loans/i });

    // Create dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /new loan|create.*loan/i });
    this.dialogTitle = this.createDialog.getByRole("heading").or(this.createDialog.locator('[class*="font-semibold"]').first());
    this.dialogItemSelect = this.createDialog.locator('button[role="combobox"]').filter({ hasText: /select item/i }).first();
    this.dialogInventorySelect = this.createDialog.locator('#inventory, [id*="inventory"]').first();
    this.dialogBorrowerSelect = this.createDialog.locator('#borrower, [id*="borrower"]').first();
    this.dialogQuantityInput = this.createDialog.locator('input[id="quantity"]');
    this.dialogLoanedAtInput = this.createDialog.locator('input[id="loaned_at"]');
    this.dialogDueDateInput = this.createDialog.locator('input[id="due_date"]');
    this.dialogNotesInput = this.createDialog.locator('textarea[id="notes"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /create loan/i });

    // Return confirmation dialog
    this.returnDialog = page.locator('[role="alertdialog"]').filter({ hasText: /return loan/i });
    this.returnConfirmButton = this.returnDialog.getByRole("button", { name: /confirm|return/i });
    this.returnCancelButton = this.returnDialog.getByRole("button", { name: /cancel/i });

    // Extend due date dialog
    this.extendDialog = page.locator('[role="dialog"]').filter({ hasText: /extend due date/i });
    this.extendDueDateInput = this.extendDialog.locator('input[type="date"]');
    this.extendSubmitButton = this.extendDialog.getByRole("button", { name: /extend|save/i });
  }

  /**
   * Navigate to loans page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/loans");
  }

  /**
   * Get a loan row by ID or borrower name
   */
  loanRow(identifier: string): Locator {
    return this.tableBody.locator("tr").filter({ hasText: identifier });
  }

  /**
   * Get status option checkbox/button
   */
  statusOption(status: "active" | "returned" | "overdue"): Locator {
    return this.page.locator('[class*="checkbox"], button').filter({ hasText: new RegExp(status, "i") });
  }

  /**
   * Get action menu button for a loan row
   */
  actionMenuButton(identifier: string): Locator {
    const row = this.loanRow(identifier);
    return row.getByRole("button", { name: /actions|more/i }).or(row.locator('[class*="lucide-more"]').locator(".."));
  }

  /**
   * Open action menu for a loan
   */
  async openActionMenu(identifier: string): Promise<void> {
    const row = this.loanRow(identifier);
    await row.hover();
    const menuButton = this.actionMenuButton(identifier);
    await menuButton.click();
    await this.page.locator("[data-radix-dropdown-menu-content]").waitFor({ state: "visible" });
  }

  /**
   * Get status badge for a loan row
   */
  getStatusBadge(identifier: string): Locator {
    const row = this.loanRow(identifier);
    return row.locator('[class*="badge"]').first();
  }

  /**
   * Open create dialog
   */
  async openCreateDialog(): Promise<void> {
    await this.addLoanButton.click();
    await this.createDialog.waitFor({ state: "visible" });
  }

  /**
   * Close create dialog
   */
  async closeDialog(): Promise<void> {
    await this.dialogCancelButton.click();
    await this.createDialog.waitFor({ state: "hidden" });
  }

  /**
   * Open filter popover
   */
  async openFilterPopover(): Promise<void> {
    await this.filterButton.click();
    await this.filterPopover.waitFor({ state: "visible" });
  }

  /**
   * Get all loan rows
   */
  getAllLoanRows(): Locator {
    return this.tableBody.locator("tr");
  }

  /**
   * Search for loans
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(400);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(400);
  }

  /**
   * Check if loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Wait for loans to load
   */
  async waitForLoansLoaded(): Promise<void> {
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Get loan count from stats
   */
  async getActiveLoanCount(): Promise<string | null> {
    return this.activeLoansCard.locator('[class*="text-2xl"], .text-xl').textContent();
  }

  /**
   * Get overdue count from stats
   */
  async getOverdueCount(): Promise<string | null> {
    return this.overdueCard.locator('[class*="text-2xl"], .text-xl').textContent();
  }

  /**
   * Check if a loan row is highlighted as overdue
   */
  async isRowOverdue(identifier: string): Promise<boolean> {
    const row = this.loanRow(identifier);
    const badge = this.getStatusBadge(identifier);
    const badgeText = await badge.textContent();
    return badgeText?.toLowerCase().includes("overdue") ?? false;
  }

  /**
   * Click return action in dropdown menu
   */
  async clickReturnAction(): Promise<void> {
    const menuContent = this.page.locator("[data-radix-dropdown-menu-content]");
    await menuContent.getByText(/mark as returned|return/i).click();
  }

  /**
   * Click extend due date action in dropdown menu
   */
  async clickExtendAction(): Promise<void> {
    const menuContent = this.page.locator("[data-radix-dropdown-menu-content]");
    await menuContent.getByText(/extend due date/i).click();
  }

  /**
   * Get table header column
   */
  tableHeaderColumn(name: string): Locator {
    return this.tableHeader.locator("th").filter({ hasText: new RegExp(name, "i") });
  }

  /**
   * Get item select in create dialog
   */
  getItemSelect(): Locator {
    return this.createDialog.locator('#item').locator('..').locator('button[role="combobox"]').or(
      this.createDialog.locator('button[role="combobox"]').filter({ hasText: /select.*item/i })
    );
  }

  /**
   * Get borrower select in create dialog
   */
  getBorrowerSelect(): Locator {
    return this.createDialog.locator('#borrower').locator('..').locator('button[role="combobox"]').or(
      this.createDialog.locator('button[role="combobox"]').filter({ hasText: /select.*borrower/i })
    );
  }

  /**
   * Get inventory select in create dialog (appears after item is selected)
   */
  getInventorySelect(): Locator {
    return this.createDialog.locator('#inventory').locator('..').locator('button[role="combobox"]').or(
      this.createDialog.locator('button[role="combobox"]').filter({ hasText: /select inventory|no available/i })
    );
  }

  /**
   * Check if item select has options available
   */
  async hasItemOptions(): Promise<boolean> {
    const itemSelect = this.getItemSelect();
    const isVisible = await itemSelect.isVisible().catch(() => false);
    if (!isVisible) return false;

    await itemSelect.click();
    const options = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]');
    const count = await options.count().catch(() => 0);
    // Close the dropdown
    await this.page.keyboard.press('Escape');
    return count > 0;
  }

  /**
   * Check if borrower select has options available
   */
  async hasBorrowerOptions(): Promise<boolean> {
    const borrowerSelect = this.getBorrowerSelect();
    const isVisible = await borrowerSelect.isVisible().catch(() => false);
    if (!isVisible) return false;

    await borrowerSelect.click();
    const options = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]');
    const count = await options.count().catch(() => 0);
    // Close the dropdown
    await this.page.keyboard.press('Escape');
    return count > 0;
  }

  /**
   * Select first available item in create dialog
   */
  async selectFirstItem(): Promise<void> {
    const itemSelect = this.getItemSelect();
    await itemSelect.click();
    const firstOption = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]').first();
    await firstOption.click();
  }

  /**
   * Select first available borrower in create dialog
   */
  async selectFirstBorrower(): Promise<void> {
    const borrowerSelect = this.getBorrowerSelect();
    await borrowerSelect.click();
    const firstOption = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]').first();
    await firstOption.click();
  }

  /**
   * Select first available inventory in create dialog
   */
  async selectFirstInventory(): Promise<void> {
    const inventorySelect = this.getInventorySelect();
    await inventorySelect.click();
    const firstOption = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]').first();
    await firstOption.click();
  }

  /**
   * Check if inventory is available after selecting an item
   */
  async hasInventoryAvailable(): Promise<boolean> {
    const inventorySelect = this.getInventorySelect();
    const isVisible = await inventorySelect.isVisible().catch(() => false);
    if (!isVisible) return false;

    // Check the select trigger text - if it says "No available" there's no inventory
    const text = await inventorySelect.textContent();
    if (text?.toLowerCase().includes('no available')) {
      return false;
    }

    await inventorySelect.click();
    const options = this.page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]');
    const count = await options.count().catch(() => 0);
    // Close the dropdown
    await this.page.keyboard.press('Escape');
    return count > 0;
  }

  /**
   * Submit the create loan form
   */
  async submitCreateForm(): Promise<void> {
    await this.dialogSubmitButton.click();
  }

  /**
   * Confirm return in the return dialog
   */
  async confirmReturn(): Promise<void> {
    await this.returnConfirmButton.click();
    await this.returnDialog.waitFor({ state: "hidden" });
  }

  /**
   * Find and click return on first active loan
   * Returns true if a loan was found and return was initiated
   */
  async initiateReturnOnFirstActiveLoan(): Promise<boolean> {
    const activeBadges = this.tableBody.locator('[class*="badge"]').filter({ hasText: /active|overdue/i });
    const hasActive = await activeBadges.count() > 0;

    if (!hasActive) return false;

    // Get the row with an active loan
    const activeRow = this.tableBody.locator("tr").filter({
      has: this.page.locator('[class*="badge"]').filter({ hasText: /active|overdue/i })
    }).first();

    // Open action menu
    await activeRow.hover();
    const menuButton = activeRow.locator('button').filter({
      has: this.page.locator('[class*="lucide-more"]')
    }).first();

    const hasMenu = await menuButton.isVisible().catch(() => false);
    if (!hasMenu) return false;

    await menuButton.click();

    // Click return option
    const menuContent = this.page.locator("[data-radix-dropdown-menu-content]");
    await menuContent.waitFor({ state: "visible" });
    const returnOption = menuContent.getByText(/mark as returned/i);
    await returnOption.click();

    // Wait for return dialog
    await this.returnDialog.waitFor({ state: "visible" });
    return true;
  }
}
