import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { DashboardShell } from "./DashboardShell";

export class ApprovalDetailPage extends BasePage {
  readonly shell: DashboardShell;

  // Navigation
  readonly backButton: Locator;

  // Header
  readonly changeTitle: Locator;
  readonly statusBadge: Locator;
  readonly actionBadge: Locator;
  readonly entityTypeLabel: Locator;

  // Request info card
  readonly requestInfoCard: Locator;
  readonly requesterInfo: Locator;
  readonly createdDate: Locator;
  readonly entityId: Locator;

  // Review info card (shown when approved/rejected)
  readonly reviewInfoCard: Locator;
  readonly reviewerInfo: Locator;
  readonly reviewedDate: Locator;
  readonly rejectionReason: Locator;

  // Payload/diff section
  readonly dataDiff: Locator;
  readonly payloadCard: Locator;

  // Action buttons
  readonly approveButton: Locator;
  readonly rejectButton: Locator;

  // Approve dialog
  readonly approveDialog: Locator;
  readonly approveConfirmButton: Locator;
  readonly approveCancelButton: Locator;

  // Reject dialog
  readonly rejectDialog: Locator;
  readonly rejectReasonInput: Locator;
  readonly rejectConfirmButton: Locator;
  readonly rejectCancelButton: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);
    this.shell = new DashboardShell(page, locale);

    // Navigation
    this.backButton = page.getByRole("button", { name: /back/i });

    // Header
    this.changeTitle = page.getByRole("heading", { level: 1 });
    this.statusBadge = page.locator('[class*="badge"]').filter({ hasText: /pending|approved|rejected/i }).first();
    this.actionBadge = page.locator('[class*="badge"]').filter({ hasText: /create|update|delete/i }).first();
    this.entityTypeLabel = page.locator("span.capitalize").filter({ hasText: /item|location|container|category|borrower|loan|inventory/i });

    // Request info card
    this.requestInfoCard = page.locator('[class*="card"]').filter({ hasText: /request information/i });
    this.requesterInfo = this.requestInfoCard.locator("text=Requester").locator("..");
    this.createdDate = this.requestInfoCard.locator("text=Created").locator("..");
    this.entityId = this.requestInfoCard.locator("text=Entity ID").locator("..");

    // Review info card
    this.reviewInfoCard = page.locator('[class*="card"]').filter({ hasText: /review information/i });
    this.reviewerInfo = this.reviewInfoCard.locator("text=Reviewer").locator("..");
    this.reviewedDate = this.reviewInfoCard.locator("text=Reviewed").locator("..");
    this.rejectionReason = page.locator('[class*="destructive"]').filter({ hasText: /reason/i }).locator("..");

    // Payload section
    this.payloadCard = page.locator('[class*="card"]').filter({ hasText: /payload|changes/i });
    this.dataDiff = this.payloadCard.locator("pre");

    // Action buttons
    this.approveButton = page.getByRole("button", { name: /approve/i });
    this.rejectButton = page.getByRole("button", { name: /reject/i });

    // Approve dialog
    this.approveDialog = page.locator('[role="alertdialog"]');
    this.approveConfirmButton = this.approveDialog.getByRole("button", { name: /approve|confirm/i });
    this.approveCancelButton = this.approveDialog.getByRole("button", { name: /cancel/i });

    // Reject dialog
    this.rejectDialog = page.locator('[role="dialog"]').filter({ hasText: /reject/i });
    this.rejectReasonInput = this.rejectDialog.locator('textarea');
    this.rejectConfirmButton = this.rejectDialog.getByRole("button", { name: /reject/i }).last();
    this.rejectCancelButton = this.rejectDialog.getByRole("button", { name: /cancel/i });
  }

  /**
   * Navigate to approval detail page
   */
  async goto(id: string): Promise<void> {
    await super.goto(`/dashboard/approvals/${id}`);
  }

  /**
   * Click back button to return to approvals list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Approve the pending change
   */
  async approve(): Promise<void> {
    await this.approveButton.click();
    await this.approveDialog.waitFor({ state: "visible" });
    await this.approveConfirmButton.click();
    await this.approveDialog.waitFor({ state: "hidden" });
  }

  /**
   * Reject the pending change with a reason
   */
  async reject(reason: string): Promise<void> {
    await this.rejectButton.click();
    await this.rejectDialog.waitFor({ state: "visible" });
    await this.rejectReasonInput.fill(reason);
    await this.rejectConfirmButton.click();
    await this.rejectDialog.waitFor({ state: "hidden" });
  }

  /**
   * Open reject dialog without confirming
   */
  async openRejectDialog(): Promise<void> {
    await this.rejectButton.click();
    await this.rejectDialog.waitFor({ state: "visible" });
  }

  /**
   * Cancel reject dialog
   */
  async cancelReject(): Promise<void> {
    await this.rejectCancelButton.click();
    await this.rejectDialog.waitFor({ state: "hidden" });
  }

  /**
   * Open approve dialog without confirming
   */
  async openApproveDialog(): Promise<void> {
    await this.approveButton.click();
    await this.approveDialog.waitFor({ state: "visible" });
  }

  /**
   * Cancel approve dialog
   */
  async cancelApprove(): Promise<void> {
    await this.approveCancelButton.click();
    await this.approveDialog.waitFor({ state: "hidden" });
  }

  /**
   * Check if the change is in pending state
   */
  async isPending(): Promise<boolean> {
    const statusText = await this.statusBadge.textContent();
    return statusText?.toLowerCase().includes("pending") ?? false;
  }

  /**
   * Check if the change is approved
   */
  async isApproved(): Promise<boolean> {
    const statusText = await this.statusBadge.textContent();
    return statusText?.toLowerCase().includes("approved") ?? false;
  }

  /**
   * Check if the change is rejected
   */
  async isRejected(): Promise<boolean> {
    const statusText = await this.statusBadge.textContent();
    return statusText?.toLowerCase().includes("rejected") ?? false;
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoaded(): Promise<void> {
    await this.page.waitForSelector('[class*="skeleton"]', { state: "hidden", timeout: 10000 }).catch(() => {});
    await this.changeTitle.waitFor({ state: "visible" });
  }

  /**
   * Check if approve button is visible
   */
  async hasApproveButton(): Promise<boolean> {
    return this.approveButton.isVisible();
  }

  /**
   * Check if reject button is visible
   */
  async hasRejectButton(): Promise<boolean> {
    return this.rejectButton.isVisible();
  }

  /**
   * Check if review info is visible (for already processed changes)
   */
  async hasReviewInfo(): Promise<boolean> {
    return this.reviewInfoCard.isVisible();
  }
}
