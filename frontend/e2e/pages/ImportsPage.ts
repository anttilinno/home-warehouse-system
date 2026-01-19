import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ImportsPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // New Import button
  readonly newImportButton: Locator;

  // Import jobs list
  readonly importJobsList: Locator;

  // Empty state
  readonly emptyState: Locator;
  readonly emptyStateNewImportButton: Locator;

  // Loading state
  readonly loadingSpinner: Locator;

  // Error state
  readonly errorMessage: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "Import Jobs" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // New Import button - main button in header
    this.newImportButton = page.getByRole("link", { name: /new import/i });

    // Import jobs list container
    this.importJobsList = page.locator(".grid.gap-4");

    // Empty state
    this.emptyState = page.locator('[class*="card"]').filter({ hasText: /no import jobs yet/i });
    this.emptyStateNewImportButton = this.emptyState.getByRole("link", { name: /new import/i });

    // Loading state
    this.loadingSpinner = page.locator('[class*="animate-spin"]');

    // Error message
    this.errorMessage = page.locator("p.text-red-600");
  }

  /**
   * Navigate to imports page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/imports");
  }

  /**
   * Get import job card by job ID
   */
  importJobCard(id: string): Locator {
    return this.page.locator(`[href*="/dashboard/imports/${id}"]`).locator("xpath=ancestor::*[contains(@class, 'card')]");
  }

  /**
   * Get import job card by file name
   */
  importJobCardByName(fileName: string): Locator {
    return this.page.locator('[class*="card"]').filter({ hasText: fileName });
  }

  /**
   * Get job status badge for a job
   */
  jobStatus(id: string): Locator {
    return this.importJobCard(id).locator('[class*="badge"]');
  }

  /**
   * Get job status badge by file name
   */
  jobStatusByName(fileName: string): Locator {
    return this.importJobCardByName(fileName).locator('[class*="badge"]');
  }

  /**
   * Get job progress bar for a processing job
   */
  jobProgress(id: string): Locator {
    return this.importJobCard(id).locator('[role="progressbar"]');
  }

  /**
   * Get job progress by file name
   */
  jobProgressByName(fileName: string): Locator {
    return this.importJobCardByName(fileName).locator('[role="progressbar"]');
  }

  /**
   * Get the view details link for a job card
   */
  viewDetailsLink(fileName: string): Locator {
    return this.importJobCardByName(fileName).getByRole("link", { name: /view details/i });
  }

  /**
   * Get all import job cards
   */
  getAllJobCards(): Locator {
    return this.page.locator('.grid.gap-4 > [class*="card"]');
  }

  /**
   * Wait for imports page to load
   */
  async waitForImportsLoaded(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if empty state is displayed
   */
  async hasEmptyState(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSpinner.isVisible();
  }

  /**
   * Get job success count text
   */
  getJobSuccessCount(fileName: string): Locator {
    return this.importJobCardByName(fileName).locator("text=Success:").locator("xpath=following-sibling::span");
  }

  /**
   * Get job error count text
   */
  getJobErrorCount(fileName: string): Locator {
    return this.importJobCardByName(fileName).locator("text=Errors:").locator("xpath=following-sibling::span");
  }
}
