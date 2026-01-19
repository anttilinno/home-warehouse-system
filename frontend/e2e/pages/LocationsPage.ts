import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class LocationsPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Card
  readonly locationsCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Actions
  readonly addLocationButton: Locator;
  readonly importButton: Locator;

  // Search and filters
  readonly searchInput: Locator;
  readonly archiveToggle: Locator;

  // Tree view
  readonly treeView: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Create/Edit dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;
  readonly dialogNameInput: Locator;
  readonly dialogParentSelect: Locator;
  readonly dialogZoneInput: Locator;
  readonly dialogShelfInput: Locator;
  readonly dialogBinInput: Locator;
  readonly dialogShortCodeInput: Locator;
  readonly dialogDescriptionInput: Locator;
  readonly dialogCancelButton: Locator;
  readonly dialogSubmitButton: Locator;

  // Delete confirmation dialog
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  // Import dialog
  readonly importDialog: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Locations" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Card
    this.locationsCard = page.locator('[class*="card"]').filter({ hasText: "Storage Locations" });
    this.cardTitle = this.locationsCard.locator('[class*="card-title"]');
    this.cardDescription = this.locationsCard.locator('[class*="card-description"]');

    // Action buttons
    this.addLocationButton = page.getByRole("button", { name: /add location/i });
    this.importButton = page.getByRole("button", { name: /import/i });

    // Search and filters
    this.searchInput = page.getByPlaceholder(/search by name, zone, shelf/i);
    this.archiveToggle = page.getByRole("button", { name: /archived|active/i });

    // Tree view
    this.treeView = page.locator('[role="tree"]');

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no locations/i });

    // Create/Edit dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /location/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogDescription = this.createDialog.locator('[class*="dialog-description"]');
    this.dialogNameInput = this.createDialog.locator('input[id="name"]');
    this.dialogParentSelect = this.createDialog.locator('button[role="combobox"]').first();
    this.dialogZoneInput = this.createDialog.locator('input[id="zone"]');
    this.dialogShelfInput = this.createDialog.locator('input[id="shelf"]');
    this.dialogBinInput = this.createDialog.locator('input[id="bin"]');
    this.dialogShortCodeInput = this.createDialog.locator('input[id="short_code"]');
    this.dialogDescriptionInput = this.createDialog.locator('textarea[id="description"]');
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /create|update/i });

    // Delete confirmation dialog
    this.deleteDialog = page.locator('[role="alertdialog"]');
    this.deleteConfirmButton = this.deleteDialog.getByRole("button", { name: /delete/i });
    this.deleteCancelButton = this.deleteDialog.getByRole("button", { name: /cancel/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import locations/i });
  }

  /**
   * Navigate to locations page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/locations");
  }

  /**
   * Get a tree node by name
   */
  treeNode(name: string): Locator {
    return this.treeView.locator('[role="treeitem"]').filter({ hasText: name });
  }

  /**
   * Get expand button for a tree node
   */
  expandButton(name: string): Locator {
    const node = this.treeNode(name);
    return node.locator("button").first();
  }

  /**
   * Get action menu button for a tree node
   */
  actionMenuButton(name: string): Locator {
    const node = this.treeNode(name);
    return node.getByRole("button", { name: `Actions for ${name}` });
  }

  /**
   * Expand a tree node
   */
  async expandNode(name: string): Promise<void> {
    const node = this.treeNode(name);
    const isExpanded = await node.getAttribute("aria-expanded");
    if (isExpanded !== "true") {
      const button = this.expandButton(name);
      await button.click();
    }
  }

  /**
   * Collapse a tree node
   */
  async collapseNode(name: string): Promise<void> {
    const node = this.treeNode(name);
    const isExpanded = await node.getAttribute("aria-expanded");
    if (isExpanded === "true") {
      const button = this.expandButton(name);
      await button.click();
    }
  }

  /**
   * Search for locations
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
    await this.addLocationButton.click();
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
   * Toggle archive view
   */
  async toggleArchiveView(): Promise<void> {
    await this.archiveToggle.click();
  }

  /**
   * Open import dialog
   */
  async openImportDialog(): Promise<void> {
    await this.importButton.click();
    await this.importDialog.waitFor({ state: "visible" });
  }

  /**
   * Open action menu for a location
   */
  async openActionMenu(name: string): Promise<void> {
    // Hover to show the action button
    const node = this.treeNode(name);
    await node.hover();
    const menuButton = this.actionMenuButton(name);
    await menuButton.click();
    await this.page.locator("[data-radix-dropdown-menu-content]").waitFor({ state: "visible" });
  }

  /**
   * Get location count from card description
   */
  async getLocationCount(): Promise<string | null> {
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
   * Wait for locations to load
   */
  async waitForLocationsLoaded(): Promise<void> {
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
   * Get all visible tree nodes
   */
  getAllTreeNodes(): Locator {
    return this.treeView.locator('[role="treeitem"]');
  }

  /**
   * Check if a node is expanded
   */
  async isNodeExpanded(name: string): Promise<boolean> {
    const node = this.treeNode(name);
    const isExpanded = await node.getAttribute("aria-expanded");
    return isExpanded === "true";
  }

  /**
   * Get node level (indentation)
   */
  async getNodeLevel(name: string): Promise<number> {
    const node = this.treeNode(name);
    const level = await node.getAttribute("aria-level");
    return level ? parseInt(level, 10) : 1;
  }
}
