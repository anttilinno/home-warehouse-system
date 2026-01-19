import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class NewImportPage extends BasePage {
  readonly shell: DashboardShell;

  // Page header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Back button
  readonly backButton: Locator;

  // Entity type selector
  readonly entityTypeSelect: Locator;
  readonly entityTypeTrigger: Locator;

  // File upload
  readonly fileInput: Locator;
  readonly uploadArea: Locator;

  // File preview (when file is selected)
  readonly filePreview: Locator;
  readonly removeFileButton: Locator;

  // Action buttons
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  // Validation errors
  readonly validationError: Locator;

  // Template download link (if exists)
  readonly templateDownloadLink: Locator;

  // CSV format requirements alert
  readonly formatRequirementsAlert: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Page header
    this.pageTitle = page.getByRole("heading", { level: 1, name: "New Import" });
    this.pageSubtitle = page.locator("p.text-muted-foreground").first();

    // Back button
    this.backButton = page.getByRole("link", { name: /back to imports/i });

    // Entity type selector
    this.entityTypeTrigger = page.locator('button#entity-type');
    this.entityTypeSelect = page.locator('[data-radix-select-viewport]');

    // File upload
    this.fileInput = page.locator('input[type="file"]');
    this.uploadArea = page.locator('[class*="border-dashed"]');

    // File preview
    this.filePreview = page.locator('[class*="border-dashed"]').filter({ hasText: /\.csv/i });
    this.removeFileButton = page.getByRole("button", { name: /remove/i });

    // Action buttons
    this.submitButton = page.getByRole("button", { name: /start import|uploading/i });
    this.cancelButton = page.getByRole("link", { name: /cancel/i });

    // Validation errors
    this.validationError = page.locator('[role="alert"]').filter({ has: page.locator('[class*="lucide-alert-circle"]') });

    // Template download link
    this.templateDownloadLink = page.getByRole("link", { name: /template|download/i });

    // Format requirements
    this.formatRequirementsAlert = page.locator('[role="alert"]').filter({ hasText: /csv format requirements/i });
  }

  /**
   * Navigate to new import page
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard/imports/new");
  }

  /**
   * Get entity type option by value
   */
  entityTypeOption(type: string): Locator {
    return this.page.locator(`[role="option"]`).filter({ hasText: new RegExp(`^${type}$`, "i") });
  }

  /**
   * Select entity type
   */
  async selectEntityType(type: string): Promise<void> {
    await this.entityTypeTrigger.click();
    await this.entityTypeOption(type).click();
  }

  /**
   * Upload a file via file input
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Get the currently selected entity type text
   */
  async getSelectedEntityType(): Promise<string | null> {
    return this.entityTypeTrigger.textContent();
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled();
  }

  /**
   * Check if file is selected
   */
  async hasFileSelected(): Promise<boolean> {
    const previewVisible = await this.filePreview.isVisible().catch(() => false);
    const removeVisible = await this.removeFileButton.isVisible().catch(() => false);
    return previewVisible || removeVisible;
  }

  /**
   * Get validation error text
   */
  async getValidationErrorText(): Promise<string | null> {
    const isVisible = await this.validationError.isVisible();
    if (isVisible) {
      return this.validationError.textContent();
    }
    return null;
  }

  /**
   * Submit the import form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Wait for page to be ready
   */
  async waitForPageReady(): Promise<void> {
    await this.pageTitle.waitFor({ state: "visible" });
    await this.entityTypeTrigger.waitFor({ state: "visible" });
  }
}
