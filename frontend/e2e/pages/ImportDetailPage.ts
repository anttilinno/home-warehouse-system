import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ImportDetailPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Back button
  readonly backButton: Locator;

  // Job status
  readonly jobStatus: Locator;
  readonly liveBadge: Locator;

  // Progress card
  readonly progressCard: Locator;
  readonly progressBar: Locator;
  readonly progressPercentage: Locator;
  readonly progressText: Locator;

  // Stats
  readonly totalRowsStat: Locator;
  readonly successCount: Locator;
  readonly errorCount: Locator;

  // Timestamps
  readonly startedTimestamp: Locator;
  readonly completedTimestamp: Locator;

  // Error message (for failed jobs)
  readonly errorMessage: Locator;

  // Errors table
  readonly errorsCard: Locator;
  readonly errorList: Locator;
  readonly errorTable: Locator;
  readonly errorTableBody: Locator;

  // Retry button (if exists)
  readonly retryButton: Locator;

  // Loading state
  readonly loadingSpinner: Locator;

  // Not found state
  readonly notFoundAlert: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header (file name)
    this.pageTitle = page.getByRole("heading", { level: 1 }).first();
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Back button
    this.backButton = page.getByRole("link", { name: /back to imports/i });

    // Job status badges
    this.jobStatus = page.locator('[class*="badge"]').filter({ hasNotText: /live/i }).first();
    this.liveBadge = page.locator('[class*="badge"]').filter({ hasText: /live/i });

    // Progress card
    this.progressCard = page.locator('[class*="card"]').filter({ hasText: /progress/i }).first();
    this.progressBar = this.progressCard.locator('[role="progressbar"]');
    this.progressPercentage = this.progressCard.locator('text=/\\d+%/');
    this.progressText = this.progressCard.locator('text=/\\d+ of \\d+ rows/');

    // Stats
    this.totalRowsStat = page.locator('text="Total Rows"').locator("xpath=following-sibling::p");
    this.successCount = page.locator('text="Successful"').locator("xpath=following-sibling::p");
    this.errorCount = page.locator('text="Errors"').locator("xpath=following-sibling::p");

    // Timestamps
    this.startedTimestamp = page.locator('text=/started:/i').locator("xpath=following-sibling::span");
    this.completedTimestamp = page.locator('text=/completed:/i').locator("xpath=following-sibling::span");

    // Error message alert
    this.errorMessage = page.locator('[role="alert"]').filter({ has: page.locator('[class*="lucide-alert-circle"]') });

    // Errors table
    this.errorsCard = page.locator('[class*="card"]').filter({ hasText: /import errors/i });
    this.errorList = this.errorsCard.locator("tbody");
    this.errorTable = this.errorsCard.locator("table");
    this.errorTableBody = this.errorTable.locator("tbody");

    // Retry button
    this.retryButton = page.getByRole("button", { name: /retry/i });

    // Loading state
    this.loadingSpinner = page.locator('[class*="animate-spin"]');

    // Not found state
    this.notFoundAlert = page.locator('[role="alert"]').filter({ hasText: /not found/i });
  }

  /**
   * Navigate to import detail page
   */
  async goto(jobId: string): Promise<void> {
    await super.goto(`/dashboard/imports/${jobId}`);
  }

  /**
   * Get error row by index (0-based)
   */
  errorRow(index: number): Locator {
    return this.errorTableBody.locator("tr").nth(index);
  }

  /**
   * Get error row number cell
   */
  errorRowNumber(index: number): Locator {
    return this.errorRow(index).locator("td").first();
  }

  /**
   * Get error field name cell
   */
  errorFieldName(index: number): Locator {
    return this.errorRow(index).locator("td").nth(1);
  }

  /**
   * Get error message cell
   */
  errorRowMessage(index: number): Locator {
    return this.errorRow(index).locator("td").nth(2);
  }

  /**
   * Get error row data cell
   */
  errorRowData(index: number): Locator {
    return this.errorRow(index).locator("td").nth(3);
  }

  /**
   * Get all error rows
   */
  getAllErrorRows(): Locator {
    return this.errorTableBody.locator("tr");
  }

  /**
   * Get error count from errors card title
   */
  async getErrorCountFromTitle(): Promise<number | null> {
    const titleText = await this.errorsCard.locator('[class*="card-title"]').textContent();
    const match = titleText?.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Wait for job details to load
   */
  async waitForJobLoaded(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.pageTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if job is currently live (SSE connected)
   */
  async isLive(): Promise<boolean> {
    return this.liveBadge.isVisible();
  }

  /**
   * Get current job status text
   */
  async getStatusText(): Promise<string | null> {
    return this.jobStatus.textContent();
  }

  /**
   * Get success count value
   */
  async getSuccessCountValue(): Promise<number | null> {
    const text = await this.successCount.textContent();
    return text ? parseInt(text, 10) : null;
  }

  /**
   * Get error count value
   */
  async getErrorCountValue(): Promise<number | null> {
    const text = await this.errorCount.textContent();
    return text ? parseInt(text, 10) : null;
  }

  /**
   * Get total rows value
   */
  async getTotalRowsValue(): Promise<number | null> {
    const text = await this.totalRowsStat.textContent();
    if (text === "-") return null;
    return text ? parseInt(text, 10) : null;
  }

  /**
   * Check if page is in loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSpinner.isVisible();
  }

  /**
   * Check if job was not found
   */
  async isNotFound(): Promise<boolean> {
    return this.notFoundAlert.isVisible();
  }

  /**
   * Check if errors table is visible
   */
  async hasErrors(): Promise<boolean> {
    return this.errorsCard.isVisible();
  }
}
