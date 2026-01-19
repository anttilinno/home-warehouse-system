import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class AnalyticsPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Stats cards container
  readonly statsCards: Locator;

  // Loading state
  readonly loadingState: Locator;
  readonly loadingSkeleton: Locator;

  // Charts
  readonly categoryChart: Locator;
  readonly conditionChart: Locator;
  readonly statusChart: Locator;
  readonly activityChart: Locator;

  // Tables
  readonly topBorrowersTable: Locator;
  readonly locationValueTable: Locator;

  // Loan summary card
  readonly loanSummaryCard: Locator;

  // No data state
  readonly noDataMessage: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Analytics" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Stats cards - grid of stat cards at top
    this.statsCards = page.locator('.grid.gap-4').first();

    // Loading state
    this.loadingState = page.locator('[class*="skeleton"]').first();
    this.loadingSkeleton = page.locator('[class*="skeleton"]');

    // Charts - identified by card titles
    this.categoryChart = page.locator('[class*="card"]').filter({ hasText: /items by category/i });
    this.conditionChart = page.locator('[class*="card"]').filter({ hasText: /inventory by condition/i });
    this.statusChart = page.locator('[class*="card"]').filter({ hasText: /inventory by status/i });
    this.activityChart = page.locator('[class*="card"]').filter({ hasText: /loan activity/i });

    // Tables
    this.topBorrowersTable = page.locator('[class*="card"]').filter({ hasText: /top borrowers/i });
    this.locationValueTable = page.locator('[class*="card"]').filter({ hasText: /inventory value by location/i });

    // Loan summary
    this.loanSummaryCard = page.locator('[class*="card"]').filter({ hasText: /loan summary/i });

    // No data
    this.noDataMessage = page.locator("text=No data available");
  }

  /**
   * Navigate to analytics page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/analytics");
  }

  /**
   * Get a specific stats card by title
   */
  statCard(title: string): Locator {
    return this.page.locator('[class*="card"]').filter({ has: this.page.locator(`text="${title}"`) });
  }

  /**
   * Get the value from a stats card
   */
  async getStatCardValue(title: string): Promise<string | null> {
    const card = this.statCard(title);
    const valueElement = card.locator(".text-2xl");
    return valueElement.textContent();
  }

  /**
   * Get all stat card elements
   */
  getAllStatCards(): Locator {
    // Stats cards have the pattern: CardHeader with title, CardContent with value
    return this.page.locator('[class*="card"]').filter({ has: this.page.locator(".text-2xl.font-bold") });
  }

  /**
   * Wait for analytics to load
   */
  async waitForAnalyticsLoaded(): Promise<void> {
    await this.loadingSkeleton.first().waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }

  /**
   * Check if category chart is visible
   */
  async hasCategoryChart(): Promise<boolean> {
    return this.categoryChart.isVisible();
  }

  /**
   * Check if condition chart is visible
   */
  async hasConditionChart(): Promise<boolean> {
    return this.conditionChart.isVisible();
  }

  /**
   * Check if activity chart is visible
   */
  async hasActivityChart(): Promise<boolean> {
    return this.activityChart.isVisible();
  }

  /**
   * Check if top borrowers table is visible
   */
  async hasTopBorrowersTable(): Promise<boolean> {
    return this.topBorrowersTable.isVisible();
  }

  /**
   * Check if location value table is visible
   */
  async hasLocationValueTable(): Promise<boolean> {
    return this.locationValueTable.isVisible();
  }

  /**
   * Get top borrowers table row count
   */
  async getTopBorrowersRowCount(): Promise<number> {
    const table = this.topBorrowersTable.locator("tbody");
    return table.locator("tr").count();
  }

  /**
   * Get location value table row count
   */
  async getLocationValueRowCount(): Promise<number> {
    const table = this.locationValueTable.locator("tbody");
    return table.locator("tr").count();
  }

  /**
   * Check if top borrowers has empty state
   */
  async hasTopBorrowersEmptyState(): Promise<boolean> {
    const emptyMessage = this.topBorrowersTable.locator("text=No borrowers yet");
    return emptyMessage.isVisible();
  }

  /**
   * Check if location values has empty state
   */
  async hasLocationValuesEmptyState(): Promise<boolean> {
    const emptyMessage = this.locationValueTable.locator("text=No locations yet");
    return emptyMessage.isVisible();
  }

  /**
   * Get loan summary stat
   */
  async getLoanSummaryStat(statName: string): Promise<string | null> {
    const statElement = this.loanSummaryCard
      .locator(`text="${statName}"`)
      .locator("xpath=following-sibling::p");
    return statElement.textContent();
  }
}
