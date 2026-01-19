import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ItemDetailPage extends BasePage {
  readonly shell: DashboardShell;

  // Navigation
  readonly backButton: Locator;

  // Header
  readonly itemTitle: Locator;
  readonly skuBadge: Locator;
  readonly archivedBadge: Locator;

  // Action buttons
  readonly editButton: Locator;
  readonly archiveButton: Locator;

  // Photo section
  readonly photoCard: Locator;
  readonly photoGallery: Locator;
  readonly primaryPhoto: Locator;
  readonly photoPlaceholder: Locator;
  readonly addPhotoButton: Locator;
  readonly photoUploadSection: Locator;

  // Details section
  readonly detailsCard: Locator;
  readonly descriptionSection: Locator;
  readonly productInfoSection: Locator;
  readonly identificationSection: Locator;
  readonly warrantySection: Locator;
  readonly inventorySection: Locator;
  readonly metadataSection: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Navigation
    this.backButton = page.getByRole("button").filter({ has: page.locator('[class*="lucide-arrow-left"]') });

    // Header
    this.itemTitle = page.getByRole("heading", { level: 1 });
    this.skuBadge = page.locator("p.text-muted-foreground").filter({ hasText: /SKU:/ });
    this.archivedBadge = page.locator('[class*="badge"]').filter({ hasText: "Archived" });

    // Action buttons
    this.editButton = page.getByRole("button", { name: /edit/i });
    this.archiveButton = page.getByRole("button", { name: /archive|restore/i });

    // Photo section
    this.photoCard = page.locator('[class*="card"]').filter({ hasText: "Photos" }).first();
    this.photoGallery = this.photoCard.locator('[class*="grid"], [class*="flex"]').filter({ has: page.locator("img") });
    this.primaryPhoto = this.photoCard.locator("img").first();
    this.photoPlaceholder = this.photoCard.locator('[aria-label*="No photo"]');
    this.addPhotoButton = this.photoCard.getByRole("button", { name: /add/i });
    this.photoUploadSection = this.photoCard.locator('[class*="dropzone"], [class*="upload"]');

    // Details card
    this.detailsCard = page.locator('[class*="card"]').filter({ hasText: "Item Details" });

    // Detail sections
    this.descriptionSection = this.detailsCard.locator("div").filter({ has: page.locator('[class*="lucide-file-text"]') });
    this.productInfoSection = this.detailsCard.locator("div").filter({ hasText: "Product Information" });
    this.identificationSection = this.detailsCard.locator("div").filter({ hasText: "Identification" });
    this.warrantySection = this.detailsCard.locator("div").filter({ hasText: "Warranty & Insurance" });
    this.inventorySection = this.detailsCard.locator("div").filter({ hasText: "Inventory" });
    this.metadataSection = this.detailsCard.locator("div").filter({ hasText: "Metadata" });
  }

  /**
   * Navigate to item detail page
   */
  async goto(id: string): Promise<void> {
    await super.goto(`/dashboard/items/${id}`);
  }

  /**
   * Go back to items list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL(/\/dashboard\/items$/);
  }

  /**
   * Click edit button
   */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
  }

  /**
   * Click archive/restore button
   */
  async clickArchive(): Promise<void> {
    await this.archiveButton.click();
  }

  /**
   * Get item name from title
   */
  async getItemName(): Promise<string | null> {
    return this.itemTitle.textContent();
  }

  /**
   * Get SKU value
   */
  async getSku(): Promise<string | null> {
    const text = await this.skuBadge.textContent();
    if (text) {
      // Extract SKU from "SKU: ABC123"
      const match = text.match(/SKU:\s*(\S+)/);
      return match ? match[1] : text;
    }
    return null;
  }

  /**
   * Check if item is archived
   */
  async isArchived(): Promise<boolean> {
    return this.archivedBadge.isVisible();
  }

  /**
   * Check if edit button is visible
   */
  async canEdit(): Promise<boolean> {
    return this.editButton.isVisible();
  }

  /**
   * Check if photo section has photos
   */
  async hasPhotos(): Promise<boolean> {
    return this.primaryPhoto.isVisible();
  }

  /**
   * Check if photo placeholder is visible (no photos)
   */
  async hasPhotoPlaceholder(): Promise<boolean> {
    return this.photoPlaceholder.isVisible();
  }

  /**
   * Get photo count from card description
   */
  async getPhotoCount(): Promise<number> {
    const cardDesc = this.photoCard.locator('[class*="card-description"]');
    const text = await cardDesc.textContent();
    if (text) {
      const match = text.match(/(\d+)\s+photo/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  }

  /**
   * Check if product info section is visible
   */
  async hasProductInfo(): Promise<boolean> {
    return this.productInfoSection.isVisible();
  }

  /**
   * Get product info field value
   */
  async getProductInfoField(fieldName: string): Promise<string | null> {
    const dt = this.productInfoSection.locator("dt").filter({ hasText: fieldName });
    const dd = dt.locator("+ dd");
    return dd.textContent();
  }

  /**
   * Get identification field value
   */
  async getIdentificationField(fieldName: string): Promise<string | null> {
    const dt = this.identificationSection.locator("dt").filter({ hasText: fieldName });
    const dd = dt.locator("+ dd");
    return dd.textContent();
  }

  /**
   * Check if loading state
   */
  async isLoading(): Promise<boolean> {
    const skeleton = this.page.locator('[class*="skeleton"]').first();
    return skeleton.isVisible();
  }

  /**
   * Wait for page to load
   */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.itemTitle.waitFor({ state: "visible" });
  }
}
