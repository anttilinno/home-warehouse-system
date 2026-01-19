import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ContainersPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Card
  readonly containersCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Actions
  readonly addContainerButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;

  // Search and filters
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly filterPopover: Locator;
  readonly archiveToggle: Locator;

  // Table
  readonly containersTable: Locator;
  readonly tableHeader: Locator;
  readonly tableBody: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Bulk action bar
  readonly bulkActionBar: Locator;

  // Create/Edit dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;
  readonly dialogNameInput: Locator;
  readonly dialogLocationSelect: Locator;
  readonly dialogCapacityInput: Locator;
  readonly dialogShortCodeInput: Locator;
  readonly dialogDescriptionInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Delete confirmation dialog
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  // Export dialog
  readonly exportDialog: Locator;

  // Import dialog
  readonly importDialog: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Containers" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Card
    this.containersCard = page.locator('[class*="card"]').filter({ hasText: "Storage Containers" });
    this.cardTitle = this.containersCard.locator('[class*="card-title"]');
    this.cardDescription = this.containersCard.locator('[class*="card-description"]');

    // Action buttons
    this.addContainerButton = page.getByRole("button", { name: /add container/i });
    this.importButton = page.getByRole("button", { name: /import/i });
    this.exportButton = page.getByRole("button", { name: /export/i });

    // Search and filters
    this.searchInput = page.getByPlaceholder(/search by name, location/i);
    this.filterButton = page.locator("button").filter({ has: page.locator('[class*="lucide-filter"]') });
    this.filterPopover = page.locator("[data-radix-popper-content-wrapper]");
    this.archiveToggle = page.getByRole("button", { name: /archived|active/i });

    // Table
    this.containersTable = page.locator('table[aria-label="Storage containers"]');
    this.tableHeader = this.containersTable.locator("thead");
    this.tableBody = this.containersTable.locator("tbody");

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no containers/i });

    // Bulk action bar
    this.bulkActionBar = page.locator('[class*="fixed"]').filter({ hasText: /selected/i });

    // Create/Edit dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /container/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogDescription = this.createDialog.locator('[class*="dialog-description"]');
    this.dialogNameInput = this.createDialog.locator('input[id="name"]');
    this.dialogLocationSelect = this.createDialog.locator('button[role="combobox"]').first();
    this.dialogCapacityInput = this.createDialog.locator('input[id="capacity"]');
    this.dialogShortCodeInput = this.createDialog.locator('input[id="short_code"]');
    this.dialogDescriptionInput = this.createDialog.locator('textarea[id="description"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /create|update/i });

    // Delete confirmation dialog
    this.deleteDialog = page.locator('[role="alertdialog"]');
    this.deleteConfirmButton = this.deleteDialog.getByRole("button", { name: /delete/i });
    this.deleteCancelButton = this.deleteDialog.getByRole("button", { name: /cancel/i });

    // Export dialog
    this.exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export containers/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import containers/i });
  }

  /**
   * Navigate to containers page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/containers");
  }

  /**
   * Get a table row by container name
   */
  containerRow(name: string): Locator {
    return this.tableBody.locator("tr").filter({ hasText: name });
  }

  /**
   * Get a sortable table header by name
   */
  tableHeaderColumn(name: string): Locator {
    return this.tableHeader.getByRole("columnheader").filter({ hasText: name });
  }

  /**
   * Search for containers
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounced search to apply
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
   * Open create dialog
   */
  async openCreateDialog(): Promise<void> {
    await this.addContainerButton.click();
    await this.createDialog.waitFor({ state: "visible" });
  }

  /**
   * Close create dialog via cancel button
   */
  async closeDialog(): Promise<void> {
    await this.dialogCancelButton.click();
    await this.createDialog.waitFor({ state: "hidden" });
  }

  /**
   * Open filter popover
   */
  async openFilters(): Promise<void> {
    await this.filterButton.click();
    await this.filterPopover.waitFor({ state: "visible" });
  }

  /**
   * Open export dialog
   */
  async openExportDialog(): Promise<void> {
    await this.exportButton.click();
    await this.exportDialog.waitFor({ state: "visible" });
  }

  /**
   * Open import dialog
   */
  async openImportDialog(): Promise<void> {
    await this.importButton.click();
    await this.importDialog.waitFor({ state: "visible" });
  }

  /**
   * Toggle archive view
   */
  async toggleArchiveView(): Promise<void> {
    await this.archiveToggle.click();
  }

  /**
   * Open action menu for a container row
   */
  async openRowActionMenu(name: string): Promise<void> {
    const row = this.containerRow(name);
    const menuButton = row.getByRole("button", { name: `Actions for ${name}` });
    await menuButton.click();
    await this.page.locator("[data-radix-dropdown-menu-content]").waitFor({ state: "visible" });
  }

  /**
   * Get container count from card description
   */
  async getContainerCount(): Promise<string | null> {
    return this.cardDescription.textContent();
  }

  /**
   * Check if loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Wait for containers to load
   */
  async waitForContainersLoaded(): Promise<void> {
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
   * Get all visible container rows
   */
  getAllContainerRows(): Locator {
    return this.tableBody.locator("tr");
  }

  /**
   * Get location info from a container row
   */
  async getRowLocation(name: string): Promise<string | null> {
    const row = this.containerRow(name);
    const locationCell = row.locator("td").nth(2); // Location is typically the second visible column
    return locationCell.textContent();
  }

  /**
   * Check if container row shows location icon
   */
  async rowHasLocationIcon(name: string): Promise<boolean> {
    const row = this.containerRow(name);
    const locationIcon = row.locator('[class*="lucide-map-pin"]');
    return locationIcon.isVisible();
  }
}
