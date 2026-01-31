import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class DashboardPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;
  readonly refreshButton: Locator;

  // Stats cards
  readonly statsCards: Locator;

  // Alerts section
  readonly alertsSection: Locator;
  readonly alertsTitle: Locator;
  readonly alertItems: Locator;

  // Activity feed section
  readonly activityFeed: Locator;
  readonly activityTitle: Locator;
  readonly activityItems: Locator;

  // Live activity feed (desktop sidebar)
  readonly liveActivityFeed: Locator;

  // Mobile activity FAB
  readonly mobileActivityButton: Locator;
  readonly mobileActivitySheet: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header elements
    this.pageTitle = page.getByRole("heading", { level: 1 });
    this.pageSubtitle = page.locator("main").locator("p.text-muted-foreground").first();
    this.refreshButton = page.getByRole("button", { name: /refresh/i });

    // Stats cards grid (4 stat cards)
    this.statsCards = page.locator("main").locator('[class*="grid"]').first();

    // Alerts card
    this.alertsSection = page.locator('[class*="card"]').filter({ hasText: /alerts/i }).first();
    this.alertsTitle = this.alertsSection.locator('[class*="card-title"]');
    this.alertItems = this.alertsSection.locator('[class*="rounded-lg border"]');

    // Recent Activity card
    this.activityFeed = page.locator('[class*="card"]').filter({ hasText: /recent activity/i }).first();
    this.activityTitle = this.activityFeed.locator('[class*="card-title"]');
    this.activityItems = this.activityFeed.locator('[class*="flex items-start gap-3"]');

    // Live Activity Feed (desktop - aside element)
    this.liveActivityFeed = page.locator("aside").filter({ hasText: /activity feed/i });

    // Mobile activity button (FAB)
    this.mobileActivityButton = page.locator("button").filter({ has: page.locator('svg') }).filter({ hasText: /activity/i });
    this.mobileActivitySheet = page.locator("[data-state='open'][role='dialog']").filter({ hasText: /activity/i });
  }

  /**
   * Navigate to dashboard page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard");
  }

  /**
   * Get a specific stat card by its title
   */
  statCard(title: string): Locator {
    return this.page.locator('[class*="card"]')
      .filter({ hasText: new RegExp(title, "i") })
      .first();
  }

  /**
   * Get the value displayed on a stat card
   */
  async getStatCardValue(title: string): Promise<string | null> {
    const card = this.statCard(title);
    const valueElement = card.locator('[class*="text-2xl"], [class*="font-bold"]').first();
    return valueElement.textContent();
  }

  /**
   * Click the refresh button
   */
  async refresh(): Promise<void> {
    await this.refreshButton.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Check if the page is showing loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Wait for dashboard data to load
   */
  async waitForDataLoaded(): Promise<void> {
    // Wait for skeletons to disappear or stats to appear
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Get the number of alerts displayed
   */
  async getAlertsCount(): Promise<number> {
    return this.alertItems.count();
  }

  /**
   * Get the number of recent activity items
   */
  async getActivityItemsCount(): Promise<number> {
    return this.activityItems.count();
  }

  /**
   * Check if there's an error state displayed
   */
  async hasError(): Promise<boolean> {
    const errorState = this.page.locator("text=Failed to load dashboard");
    return errorState.isVisible();
  }

  /**
   * Get all stats card titles
   */
  async getStatsCardTitles(): Promise<string[]> {
    const cards = this.page.locator("main [class*='card']").filter({ has: this.page.locator("svg") });
    const titles: string[] = [];

    // Get the first 4 cards (stats cards)
    const count = Math.min(await cards.count(), 4);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const title = await card.locator('[class*="text-sm"], [class*="text-muted"]').first().textContent();
      if (title) titles.push(title.trim());
    }

    return titles;
  }

  /**
   * Open mobile activity sheet
   */
  async openMobileActivityFeed(): Promise<void> {
    await this.mobileActivityButton.click();
    await this.mobileActivitySheet.waitFor({ state: "visible" });
  }
}
