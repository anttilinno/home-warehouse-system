import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class MyChangesPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Search and filter controls
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly entityTypeFilter: Locator;

  // Changes list
  readonly changesList: Locator;

  // Stats cards
  readonly pendingStatsCard: Locator;
  readonly approvedStatsCard: Locator;
  readonly rejectedStatsCard: Locator;

  // Empty state
  readonly emptyState: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1 });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Search
    this.searchInput = page.locator('input[type="search"]');

    // Filters
    this.statusFilter = page.locator('button[role="combobox"]').first();
    this.entityTypeFilter = page.locator('button[role="combobox"]').nth(1);

    // Changes list
    this.changesList = page.locator(".space-y-4").filter({ has: page.locator('[class*="card"]') });

    // Stats cards (these are individual cards in a grid, not in a single card)
    this.pendingStatsCard = page.locator('[class*="card"]').filter({ has: page.locator('[class*="text-yellow"]') });
    this.approvedStatsCard = page.locator('[class*="card"]').filter({ has: page.locator('[class*="text-green"]') });
    this.rejectedStatsCard = page.locator('[class*="card"]').filter({ has: page.locator('[class*="text-red"]') });

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]');
  }

  /**
   * Navigate to my changes page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/my-changes");
  }

  /**
   * Get status filter option
   */
  statusOption(status: "pending" | "approved" | "rejected" | "all"): Locator {
    return this.page.locator('[role="option"]').filter({ hasText: new RegExp(status, "i") });
  }

  /**
   * Get entity type filter option
   */
  entityTypeOption(type: string): Locator {
    return this.page.locator('[role="option"]').filter({ hasText: new RegExp(type, "i") });
  }

  /**
   * Get change card by index
   */
  changeCard(index: number): Locator {
    return this.page.locator('[class*="card"]').filter({ has: this.page.locator('[class*="badge"]') }).nth(index);
  }

  /**
   * Get status badge from a change card
   */
  changeCardStatus(cardLocator: Locator): Locator {
    return cardLocator.locator('[class*="badge"]').first();
  }

  /**
   * Get timestamp from a change card
   */
  changeCardTimestamp(cardLocator: Locator): Locator {
    return cardLocator.locator('[class*="lucide-clock"]').locator("..");
  }

  /**
   * Search for changes
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
   * Filter by status
   */
  async filterByStatus(status: "pending" | "approved" | "rejected" | "all"): Promise<void> {
    await this.statusFilter.click();
    await this.statusOption(status).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Filter by entity type
   */
  async filterByEntityType(type: string): Promise<void> {
    await this.entityTypeFilter.click();
    await this.entityTypeOption(type).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoaded(): Promise<void> {
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Get all visible change cards
   */
  getAllChangeCards(): Locator {
    return this.page.locator('[class*="card"]').filter({ has: this.page.locator('[class*="badge"]') });
  }

  /**
   * Get pending count from stats
   */
  async getPendingCount(): Promise<string | null> {
    return this.pendingStatsCard.locator(".text-2xl").textContent();
  }

  /**
   * Get approved count from stats
   */
  async getApprovedCount(): Promise<string | null> {
    return this.approvedStatsCard.locator(".text-2xl").textContent();
  }

  /**
   * Get rejected count from stats
   */
  async getRejectedCount(): Promise<string | null> {
    return this.rejectedStatsCard.locator(".text-2xl").textContent();
  }
}
