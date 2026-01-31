import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class InventoryPage extends BasePage {
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
  readonly inventoryCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Add inventory button
  readonly addInventoryButton: Locator;

  // Table elements
  readonly inventoryTable: Locator;
  readonly tableHeader: Locator;
  readonly tableBody: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Bulk action bar
  readonly bulkActionBar: Locator;

  // Create dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogItemSelect: Locator;
  readonly dialogLocationSelect: Locator;
  readonly dialogContainerSelect: Locator;
  readonly dialogQuantityInput: Locator;
  readonly dialogConditionSelect: Locator;
  readonly dialogStatusSelect: Locator;
  readonly dialogNotesInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Export dialog
  readonly exportDialog: Locator;

  // Import dialog
  readonly importDialog: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header - match the actual page structure
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Inventory" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Card - find by "Inventory Tracking" title
    this.inventoryCard = page.locator('[class*="card"]').filter({ hasText: "Inventory Tracking" });
    this.cardTitle = this.inventoryCard.locator('[class*="card-title"]');
    this.cardDescription = this.inventoryCard.locator('[class*="card-description"]');

    // Add inventory button - main button in card header
    this.addInventoryButton = page.getByRole("button", { name: /add inventory/i });

    // Search and filters
    this.searchInput = page.getByPlaceholder(/search by item, sku, or location/i);
    this.filterButton = page.locator("button").filter({ has: page.locator('[class*="lucide-filter"]') });
    this.filterPopover = page.locator("[data-radix-popper-content-wrapper]");
    this.importButton = page.getByRole("button", { name: /import/i });
    this.exportButton = page.getByRole("button", { name: /export/i });
    this.archiveToggle = page.getByRole("button", { name: /archived|active/i });

    // Table - uses "Inventory items" as aria-label
    this.inventoryTable = page.locator('table[aria-label="Inventory items"]');
    this.tableHeader = this.inventoryTable.locator("thead");
    this.tableBody = page.locator("table tbody");

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no inventory/i });

    // Bulk action bar
    this.bulkActionBar = page.locator('[class*="fixed"]').filter({ hasText: /selected/i });

    // Create dialog - filter by dialog title text
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /add inventory/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogItemSelect = this.createDialog.locator('#item').locator('..').locator('button[role="combobox"]');
    this.dialogLocationSelect = this.createDialog.locator('#location').locator('..').locator('button[role="combobox"]');
    this.dialogContainerSelect = this.createDialog.locator('button[role="combobox"]').nth(2);
    this.dialogQuantityInput = this.createDialog.locator('input[id="quantity"]');
    this.dialogConditionSelect = this.createDialog.locator('button[role="combobox"]').filter({ hasText: /good|new|excellent/i });
    this.dialogStatusSelect = this.createDialog.locator('button[role="combobox"]').filter({ hasText: /available|in use/i });
    this.dialogNotesInput = this.createDialog.locator('textarea[id="notes"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /create/i });

    // Export dialog
    this.exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export inventory/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import inventory/i });
  }

  /**
   * Navigate to inventory page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/inventory");
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoaded(): Promise<void> {
    // Wait for skeleton to disappear
    await this.page.locator('[class*="skeleton"]').first().waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    // Wait for page title
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Open create dialog
   */
  async openCreateDialog(): Promise<void> {
    await this.addInventoryButton.click();
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
   * Search for inventory
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounced search to trigger and results to load
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    // Wait for debounced search reset to complete
    await this.page.waitForLoadState("domcontentloaded");
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
   * Get all visible inventory rows
   */
  getAllInventoryRows(): Locator {
    return this.tableBody.locator("tr");
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Get inventory count from card description
   */
  async getInventoryCount(): Promise<string | null> {
    return this.cardDescription.textContent();
  }

  /**
   * Get a sortable table header by name
   */
  tableHeaderColumn(name: string): Locator {
    return this.tableHeader.getByRole("columnheader").filter({ hasText: name });
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Get an inventory row by item name
   */
  inventoryRow(itemName: string): Locator {
    return this.page.locator("tr").filter({ hasText: itemName });
  }
}
