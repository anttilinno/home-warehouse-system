import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class BorrowersPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Actions
  readonly addBorrowerButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;

  // Search
  readonly searchInput: Locator;

  // Borrowers list/table
  readonly borrowersList: Locator;
  readonly borrowersTable: Locator;
  readonly tableHeader: Locator;
  readonly tableBody: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Create/Edit dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogNameInput: Locator;
  readonly dialogEmailInput: Locator;
  readonly dialogPhoneInput: Locator;
  readonly dialogNotesInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Delete confirmation dialog
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  // Import dialog
  readonly importDialog: Locator;

  // Export dialog
  readonly exportDialog: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Borrowers" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Action buttons
    this.addBorrowerButton = page.getByRole("button", { name: /add borrower|new borrower/i });
    this.importButton = page.getByRole("button", { name: /import/i });
    this.exportButton = page.getByRole("button", { name: /export/i });

    // Search
    this.searchInput = page.getByPlaceholder(/search by name, email, or phone/i);

    // Borrowers list/table
    this.borrowersList = page.locator('[class*="card"], table').filter({ hasText: /borrower/i }).first();
    this.borrowersTable = page.locator('table[aria-label*="borrower"], table').filter({ hasText: /name|email/i }).first();
    this.tableHeader = this.borrowersTable.locator("thead");
    this.tableBody = this.borrowersTable.locator("tbody");

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no borrowers/i });

    // Create/Edit dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /borrower/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogNameInput = this.createDialog.locator('input[id="name"]');
    this.dialogEmailInput = this.createDialog.locator('input[id="email"]');
    this.dialogPhoneInput = this.createDialog.locator('input[id="phone"]');
    this.dialogNotesInput = this.createDialog.locator('textarea[id="notes"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /save|create|add/i });

    // Delete confirmation dialog
    this.deleteDialog = page.locator('[role="alertdialog"]');
    this.deleteConfirmButton = this.deleteDialog.getByRole("button", { name: /delete/i });
    this.deleteCancelButton = this.deleteDialog.getByRole("button", { name: /cancel/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import borrowers/i });

    // Export dialog
    this.exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export/i });
  }

  /**
   * Navigate to borrowers page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/borrowers");
  }

  /**
   * Get a borrower row by name
   */
  borrowerRow(name: string): Locator {
    return this.tableBody.locator("tr").filter({ hasText: name });
  }

  /**
   * Get action menu button for a borrower row
   */
  actionMenuButton(name: string): Locator {
    const row = this.borrowerRow(name);
    return row.getByRole("button", { name: new RegExp(`Actions for ${name}`, "i") }).or(
      row.locator('[class*="lucide-more"]').locator("..")
    );
  }

  /**
   * Open action menu for a borrower
   */
  async openActionMenu(name: string): Promise<void> {
    const row = this.borrowerRow(name);
    await row.hover();
    const menuButton = this.actionMenuButton(name);
    await menuButton.click();
    await this.page.locator("[data-radix-dropdown-menu-content]").waitFor({ state: "visible" });
  }

  /**
   * Get contact info from a borrower row
   */
  getContactInfo(name: string): { email: Locator; phone: Locator } {
    const row = this.borrowerRow(name);
    return {
      email: row.locator("td").filter({ has: this.page.locator('[class*="lucide-mail"]') }),
      phone: row.locator("td").filter({ has: this.page.locator('[class*="lucide-phone"]') }),
    };
  }

  /**
   * Get active loans badge/count for a borrower
   */
  getActiveLoansCount(name: string): Locator {
    const row = this.borrowerRow(name);
    return row.locator('[class*="badge"]').filter({ hasText: /\d+/ });
  }

  /**
   * Open create dialog
   */
  async openCreateDialog(): Promise<void> {
    await this.addBorrowerButton.click();
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
   * Get all borrower rows
   */
  getAllBorrowerRows(): Locator {
    return this.tableBody.locator("tr");
  }

  /**
   * Search for borrowers
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
   * Wait for borrowers to load
   */
  async waitForBorrowersLoaded(): Promise<void> {
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
   * Get table header column
   */
  tableHeaderColumn(name: string): Locator {
    return this.tableHeader.locator("th").filter({ hasText: new RegExp(name, "i") });
  }

  /**
   * Click edit action in dropdown menu
   */
  async clickEditAction(): Promise<void> {
    const menuContent = this.page.locator("[data-radix-dropdown-menu-content]");
    await menuContent.getByText(/edit/i).click();
  }

  /**
   * Click delete action in dropdown menu
   */
  async clickDeleteAction(): Promise<void> {
    const menuContent = this.page.locator("[data-radix-dropdown-menu-content]");
    await menuContent.getByText(/delete/i).click();
  }

  /**
   * Get borrower count
   */
  async getBorrowerCount(): Promise<number> {
    const rows = this.getAllBorrowerRows();
    return rows.count();
  }
}
