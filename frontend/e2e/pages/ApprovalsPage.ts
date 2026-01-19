import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ApprovalsPage extends BasePage {
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

  // Stats section
  readonly statsSection: Locator;
  readonly pendingCount: Locator;
  readonly approvedCount: Locator;
  readonly rejectedCount: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Permission denied state
  readonly permissionDenied: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1 });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Search
    this.searchInput = page.locator('input[type="search"]');

    // Filters - select triggers
    this.statusFilter = page.locator('button[role="combobox"]').first();
    this.entityTypeFilter = page.locator('button[role="combobox"]').nth(1);

    // Changes list container
    this.changesList = page.locator(".space-y-4").filter({ has: page.locator('[class*="card"]') });

    // Stats section
    this.statsSection = page.locator('[class*="card"]').filter({ hasText: /statistics|summary/i });
    this.pendingCount = page.locator('[class*="text-yellow"]').locator("..").locator(".text-2xl");
    this.approvedCount = page.locator('[class*="text-green"]').locator("..").locator(".text-2xl");
    this.rejectedCount = page.locator('[class*="text-red"]').locator("..").locator(".text-2xl");

    // Empty state
    this.emptyState = page.locator('[class*="flex flex-col items-center"]');

    // Permission denied state (Shield icon in empty state)
    this.permissionDenied = page.locator('[class*="lucide-shield"]').locator("..");
  }

  /**
   * Navigate to approvals page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/approvals");
  }

  /**
   * Get status filter option by status
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
   * Get change card by ID
   */
  changeCard(id: string): Locator {
    return this.page.locator(`a[href*="${id}"]`).locator('[class*="card"]');
  }

  /**
   * Get change card status badge by index
   */
  changeCardByIndex(index: number): Locator {
    return this.page.locator('[class*="card"]').filter({ has: this.page.locator('[class*="badge"]') }).nth(index);
  }

  /**
   * Get status badge from a change card
   */
  changeCardStatus(cardLocator: Locator): Locator {
    return cardLocator.locator('[class*="badge"]').first();
  }

  /**
   * Get entity type from a change card
   */
  changeCardEntityType(cardLocator: Locator): Locator {
    return cardLocator.locator('[class*="lucide-"]').first();
  }

  /**
   * Get requester name from a change card
   */
  changeCardRequester(cardLocator: Locator): Locator {
    return cardLocator.locator("text=Requested by").locator("..");
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
   * Click on a change card to navigate to detail
   */
  async clickChangeCard(index: number): Promise<void> {
    const card = this.changeCardByIndex(index);
    await card.click();
  }

  /**
   * Check if permission denied state is shown
   */
  async hasPermissionDenied(): Promise<boolean> {
    return this.permissionDenied.isVisible();
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
    return this.page.locator('a[href*="/dashboard/approvals/"]').locator('[class*="card"]');
  }
}
