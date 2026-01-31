import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class CategoriesPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Card
  readonly categoriesCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Actions
  readonly addCategoryButton: Locator;
  readonly importButton: Locator;

  // Search
  readonly searchInput: Locator;

  // Tree view
  readonly treeView: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Create/Edit dialog
  readonly createDialog: Locator;
  readonly dialogTitle: Locator;
  readonly dialogDescription: Locator;
  readonly dialogNameInput: Locator;
  readonly dialogDescriptionInput: Locator;
  readonly dialogParentSelect: Locator;
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
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Categories" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Card
    this.categoriesCard = page.locator('[class*="card"]').filter({ hasText: /categories/i }).first();
    this.cardTitle = this.categoriesCard.locator('[class*="card-title"]');
    this.cardDescription = this.categoriesCard.locator('[class*="card-description"]');

    // Action buttons
    this.addCategoryButton = page.getByRole("button", { name: /add category/i });
    this.importButton = page.getByRole("button", { name: /import/i });

    // Search
    this.searchInput = page.getByPlaceholder(/search categories/i);

    // Tree view
    this.treeView = page.locator('[role="tree"]');

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]').filter({ hasText: /no categories/i });

    // Create/Edit dialog
    this.createDialog = page.locator('[role="dialog"]').filter({ hasText: /category/i });
    this.dialogTitle = this.createDialog.locator('[class*="dialog-title"]');
    this.dialogDescription = this.createDialog.locator('[class*="dialog-description"]');
    this.dialogNameInput = this.createDialog.locator('input[id="name"]');
    this.dialogDescriptionInput = this.createDialog.locator('textarea[id="description"], input[id="description"]');
    this.dialogParentSelect = this.createDialog.locator('button[role="combobox"]').first();
    this.dialogCancelButton = this.createDialog.getByRole("button", { name: /cancel/i });
    this.dialogSubmitButton = this.createDialog.getByRole("button", { name: /save|create/i });

    // Delete confirmation dialog
    this.deleteDialog = page.locator('[role="alertdialog"]');
    this.deleteConfirmButton = this.deleteDialog.getByRole("button", { name: /delete/i });
    this.deleteCancelButton = this.deleteDialog.getByRole("button", { name: /cancel/i });

    // Import dialog
    this.importDialog = page.locator('[role="dialog"]').filter({ hasText: /import categories/i });
  }

  /**
   * Navigate to categories page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/categories");
  }

  /**
   * Get a tree node by name
   */
  treeNode(name: string): Locator {
    return this.treeView.locator('[role="treeitem"]').filter({ hasText: name });
  }

  /**
   * Get drag handle for a tree node
   */
  dragHandle(name: string): Locator {
    const node = this.treeNode(name);
    return node.locator('[class*="lucide-grip-vertical"], [data-drag-handle]').first();
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
    return node.getByRole("button", { name: new RegExp(`Actions for ${name}`, "i") });
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
   * Search for categories
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
   * Open create dialog
   */
  async openCreateDialog(): Promise<void> {
    await this.addCategoryButton.click();
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
   * Open import dialog
   */
  async openImportDialog(): Promise<void> {
    await this.importButton.click();
    await this.importDialog.waitFor({ state: "visible" });
  }

  /**
   * Open action menu for a category
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
   * Get category count from card description
   */
  async getCategoryCount(): Promise<string | null> {
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
   * Wait for categories to load
   */
  async waitForCategoriesLoaded(): Promise<void> {
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

  /**
   * Get subcategory count badge for a node
   */
  getSubcategoryBadge(name: string): Locator {
    const node = this.treeNode(name);
    return node.locator('[class*="badge"], .text-muted-foreground').filter({ hasText: /subcategor/i });
  }

  /**
   * Focus the tree view for keyboard navigation
   */
  async focusTreeView(): Promise<void> {
    const firstNode = this.getAllTreeNodes().first();
    await firstNode.focus();
  }

  /**
   * Press arrow key for tree navigation
   */
  async pressArrowKey(direction: "up" | "down" | "left" | "right"): Promise<void> {
    const key = `Arrow${direction.charAt(0).toUpperCase()}${direction.slice(1)}`;
    await this.page.keyboard.press(key);
  }
}
