import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class OutOfStockPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Search
  readonly searchInput: Locator;

  // Items card
  readonly itemsCard: Locator;
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  // Items list
  readonly itemsList: Locator;

  // Empty state
  readonly emptyState: Locator;
  readonly noResultsState: Locator;

  // Loading state
  readonly loadingSkeleton: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1 }).first();
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Search input
    this.searchInput = page.locator('input[type="search"]');

    // Items card
    this.itemsCard = page.locator('[class*="card"]').filter({ has: page.locator('[class*="lucide-package-x"]') });
    this.cardTitle = this.itemsCard.locator('[class*="card-title"]');
    this.cardDescription = this.itemsCard.locator('[class*="card-description"]');

    // Items list
    this.itemsList = this.itemsCard.locator(".divide-y");

    // Empty state - different from no results
    this.emptyState = page.locator('[class*="empty-state"], [class*="flex-col"]').filter({ hasText: /all items are stocked|no items/i });
    this.noResultsState = page.locator('[class*="empty-state"], [class*="flex-col"]').filter({ hasText: /no results/i });

    // Loading skeleton
    this.loadingSkeleton = page.locator('[class*="skeleton"]');
  }

  /**
   * Navigate to out of stock page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/out-of-stock");
  }

  /**
   * Get item row by name
   */
  itemRow(name: string): Locator {
    return this.itemsList.locator(".grid").filter({ hasText: name });
  }

  /**
   * Get all item rows
   */
  getAllItemRows(): Locator {
    return this.itemsList.locator(".grid");
  }

  /**
   * Get item name from row
   */
  itemName(row: Locator): Locator {
    return row.locator(".font-medium").first();
  }

  /**
   * Get item SKU from row
   */
  itemSku(row: Locator): Locator {
    return row.locator("code");
  }

  /**
   * Get item category badge from row
   */
  itemCategory(row: Locator): Locator {
    return row.locator('[class*="badge"]');
  }

  /**
   * Get item min stock from row
   */
  itemMinStock(row: Locator): Locator {
    return row.locator(".sm\\:col-span-2").last();
  }

  /**
   * Get view item link from row
   */
  itemViewLink(row: Locator): Locator {
    return row.getByRole("link");
  }

  /**
   * Search for items
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoaded(): Promise<void> {
    await this.loadingSkeleton.first().waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if page is loading
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.first().isVisible();
  }

  /**
   * Check if empty state is visible (all items stocked)
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Check if no results state is visible (search has no matches)
   */
  async hasNoResultsState(): Promise<boolean> {
    return this.noResultsState.isVisible();
  }

  /**
   * Get count of items displayed
   */
  async getItemCount(): Promise<number> {
    return this.getAllItemRows().count();
  }

  /**
   * Get item count from card description
   */
  async getItemCountFromDescription(): Promise<number | null> {
    const text = await this.cardDescription.textContent();
    const match = text?.match(/(\d+)\s+item/);
    return match ? parseInt(match[1], 10) : null;
  }
}
