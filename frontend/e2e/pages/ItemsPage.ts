import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ItemsPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Search and filter controls
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly filterPopover: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly archiveToggle: Locator;

  // Card container
  readonly itemsCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Add item button
  readonly addItemButton: Locator;

  // Table elements
  readonly itemsTable: Locator;
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
  readonly dialogSkuInput: Locator;
  readonly dialogNameInput: Locator;
  readonly dialogDescriptionInput: Locator;
  readonly dialogCategorySelect: Locator;
  readonly dialogBrandInput: Locator;
  readonly dialogModelInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Export dialog
  readonly exportDialog: Locator;

  // Import dialog
  readonly importDialog: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Items" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Card
    this.itemsCard = page.locator('[class*="card"]').filter({ hasText: "Item Catalog" });
    this.cardTitle = this.itemsCard.locator('[class*="card-title"]');
    this.cardDescription = this.itemsCard.locator('[class*="card-description"]');

    // Add item button - main button in card header
    this.addItemButton = page.getByRole("button", { name: /add item/i });

    // Search and filters
    this.searchInput = page.getByPlaceholder(/search by sku, name, brand/i);
    this.filterButton = page.locator("button").filter({ has: page.locator('svg') }).filter({ hasText: "" }).nth(0);
    this.filterPopover = page.locator("[data-radix-popper-content-wrapper]");
    this.importButton = page.getByRole("button", { name: /import/i });
    this.exportButton = page.getByRole("button", { name: /export/i });
    this.archiveToggle = page.getByRole("button", { name: /archived|active/i });

    // Table
    this.itemsTable = page.locator('table[aria-label="Item catalog"]');
    this.tableHeader = this.itemsTable.locator("thead");
    this.tableBody = page.locator("table tbody");

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no items/i });

    // Bulk action bar
    this.bulkActionBar = page.locator('[class*="fixed"]').filter({ hasText: /selected/i });

    // Create/Edit dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /item/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogDescription = this.createDialog.locator('[class*="dialog-description"]');
    this.dialogSkuInput = this.createDialog.locator('input[id="sku"]');
    this.dialogNameInput = this.createDialog.locator('input[id="name"]');
    this.dialogDescriptionInput = this.createDialog.locator('textarea[id="description"]');
    this.dialogCategorySelect = this.createDialog.locator('button[role="combobox"]').first();
    this.dialogBrandInput = this.createDialog.locator('input[id="brand"]');
    this.dialogModelInput = this.createDialog.locator('input[id="model"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /create|update/i });

    // Export dialog
    this.exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export items/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import items/i });
  }

  /**
   * Navigate to items page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/items");
  }

  /**
   * Get a table row by SKU
   */
  itemRow(sku: string): Locator {
    return this.page.locator("tr").filter({ hasText: sku });
  }

  /**
   * Get a sortable table header by name
   */
  tableHeaderColumn(name: string): Locator {
    return this.tableHeader.getByRole("columnheader").filter({ hasText: name });
  }

  /**
   * Search for items
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
    await this.addItemButton.click();
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
    // Find the filter button (with Filter icon before Import button)
    const filterBtn = this.page.locator("button").filter({ has: this.page.locator('[class*="lucide-filter"]') });
    await filterBtn.click();
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
   * Click on an item row to navigate to detail
   */
  async clickItemRow(sku: string): Promise<void> {
    const row = this.itemRow(sku);
    await row.click();
  }

  /**
   * Get item count from card description
   */
  async getItemCount(): Promise<string | null> {
    return this.cardDescription.textContent();
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Wait for items to load
   */
  async waitForItemsLoaded(): Promise<void> {
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Get all visible item rows
   */
  getAllItemRows(): Locator {
    return this.tableBody.locator("tr");
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
