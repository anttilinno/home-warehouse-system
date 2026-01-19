import { test, expect } from "../fixtures/authenticated";
import { ImportDetailPage } from "../pages/ImportDetailPage";
import { ImportsPage } from "../pages/ImportsPage";

test.describe("Import Detail Page", () => {
  let detailPage: ImportDetailPage;
  let importsPage: ImportsPage;

  // Helper to get a real job ID from the imports list
  async function getFirstJobId(page: import("@playwright/test").Page): Promise<string | null> {
    const tempImportsPage = new ImportsPage(page);
    await tempImportsPage.goto();
    await tempImportsPage.waitForImportsLoaded();

    const jobCards = tempImportsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count === 0) {
      return null;
    }

    // Get the first job's View Details link href
    const viewDetailsLink = jobCards.first().getByRole("link", { name: /view details/i });
    const href = await viewDetailsLink.getAttribute("href");

    // Extract job ID from href (format: /dashboard/imports/{jobId})
    const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  test.beforeEach(async ({ page }) => {
    detailPage = new ImportDetailPage(page);
    importsPage = new ImportsPage(page);
  });

  test("page loads with job information", async ({ page }) => {
    const jobId = await getFirstJobId(page);

    if (jobId) {
      await detailPage.goto(jobId);
      await detailPage.waitForJobLoaded();

      // Page title (file name) should be visible
      await expect(detailPage.pageTitle).toBeVisible();

      // Status badge should be visible
      await expect(detailPage.jobStatus).toBeVisible();
    }
  });

  test("back button returns to imports list", async ({ page }) => {
    const jobId = await getFirstJobId(page);

    if (jobId) {
      await detailPage.goto(jobId);
      await detailPage.waitForJobLoaded();

      await expect(detailPage.backButton).toBeVisible();
      await detailPage.backButton.click();

      await expect(page).toHaveURL(/\/dashboard\/imports$/);
    }
  });

  test("status badge shows current state", async ({ page }) => {
    const jobId = await getFirstJobId(page);

    if (jobId) {
      await detailPage.goto(jobId);
      await detailPage.waitForJobLoaded();

      const statusText = await detailPage.getStatusText();
      expect(statusText?.toLowerCase()).toMatch(/pending|processing|completed|failed|cancelled/);
    }
  });

  test("progress shows rows processed for processing job", async ({ page }) => {
    // This test specifically looks for a processing job
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    let processingJobId: string | null = null;

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const badge = card.locator('[class*="badge"]');
      const badgeText = await badge.textContent();

      if (badgeText?.toLowerCase().includes("processing")) {
        const href = await card.getByRole("link", { name: /view details/i }).getAttribute("href");
        const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
        processingJobId = match ? match[1] : null;
        break;
      }
    }

    if (processingJobId) {
      await detailPage.goto(processingJobId);
      await detailPage.waitForJobLoaded();

      // Processing job should show progress bar
      await expect(detailPage.progressBar).toBeVisible();

      // Should show progress text
      await expect(detailPage.progressText).toBeVisible();
    }
  });

  test("success and error counts displayed", async ({ page }) => {
    const jobId = await getFirstJobId(page);

    if (jobId) {
      await detailPage.goto(jobId);
      await detailPage.waitForJobLoaded();

      // Stats section should be visible
      const successLabel = page.locator('text="Successful"');
      const errorsLabel = page.locator('text="Errors"');

      await expect(successLabel).toBeVisible();
      await expect(errorsLabel).toBeVisible();

      // Count values should be numbers
      const successCount = await detailPage.getSuccessCountValue();
      const errorCount = await detailPage.getErrorCountValue();

      // At minimum, values should be valid numbers (>= 0)
      if (successCount !== null) {
        expect(successCount).toBeGreaterThanOrEqual(0);
      }
      if (errorCount !== null) {
        expect(errorCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("completed job shows final statistics", async ({ page }) => {
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    let completedJobId: string | null = null;

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const badge = card.locator('[class*="badge"]');
      const badgeText = await badge.textContent();

      if (badgeText?.toLowerCase().includes("completed")) {
        const href = await card.getByRole("link", { name: /view details/i }).getAttribute("href");
        const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
        completedJobId = match ? match[1] : null;
        break;
      }
    }

    if (completedJobId) {
      await detailPage.goto(completedJobId);
      await detailPage.waitForJobLoaded();

      // Should show total rows
      const totalRows = await detailPage.getTotalRowsValue();
      expect(totalRows).not.toBeNull();

      // Status should be completed
      const statusText = await detailPage.getStatusText();
      expect(statusText?.toLowerCase()).toContain("completed");
    }
  });
});

test.describe("Import Detail Error Display", () => {
  let detailPage: ImportDetailPage;
  let importsPage: ImportsPage;

  test.beforeEach(async ({ page }) => {
    detailPage = new ImportDetailPage(page);
    importsPage = new ImportsPage(page);
  });

  test("error list shows failed rows with messages", async ({ page }) => {
    // Find a job with errors
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    let jobWithErrorsId: string | null = null;

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const errorText = card.locator("text=Errors:");
      const isVisible = await errorText.isVisible().catch(() => false);

      if (isVisible) {
        const errorCount = card.locator("text=Errors:").locator("xpath=following-sibling::span");
        const countText = await errorCount.textContent();
        const errorNum = parseInt(countText || "0", 10);

        if (errorNum > 0) {
          const href = await card.getByRole("link", { name: /view details/i }).getAttribute("href");
          const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
          jobWithErrorsId = match ? match[1] : null;
          break;
        }
      }
    }

    if (jobWithErrorsId) {
      await detailPage.goto(jobWithErrorsId);
      await detailPage.waitForJobLoaded();

      // Errors card should be visible
      const hasErrors = await detailPage.hasErrors();
      expect(hasErrors).toBe(true);

      // Error table should have headers
      const rowHeader = detailPage.errorsCard.locator('th').filter({ hasText: /row/i });
      const errorHeader = detailPage.errorsCard.locator('th').filter({ hasText: /error/i });

      await expect(rowHeader).toBeVisible();
      await expect(errorHeader).toBeVisible();

      // Should have at least one error row
      const errorRows = detailPage.getAllErrorRows();
      const rowCount = await errorRows.count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test("error row shows row number and message", async ({ page }) => {
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    let jobWithErrorsId: string | null = null;

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      // Check for failed status or error count
      const badge = card.locator('[class*="badge"]');
      const badgeText = await badge.textContent();

      if (badgeText?.toLowerCase().includes("failed") || badgeText?.toLowerCase().includes("completed")) {
        const href = await card.getByRole("link", { name: /view details/i }).getAttribute("href");
        const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
        jobWithErrorsId = match ? match[1] : null;
        break;
      }
    }

    if (jobWithErrorsId) {
      await detailPage.goto(jobWithErrorsId);
      await detailPage.waitForJobLoaded();

      const hasErrors = await detailPage.hasErrors();

      if (hasErrors) {
        // First error row should have content
        const firstRowNumber = detailPage.errorRowNumber(0);
        const firstRowMessage = detailPage.errorRowMessage(0);

        await expect(firstRowNumber).toBeVisible();
        await expect(firstRowMessage).toBeVisible();

        // Row number should be a number
        const rowNumText = await firstRowNumber.textContent();
        expect(parseInt(rowNumText || "0", 10)).toBeGreaterThan(0);
      }
    }
  });
});

test.describe("Import Detail Progress Card", () => {
  let detailPage: ImportDetailPage;

  test.beforeEach(async ({ page }) => {
    detailPage = new ImportDetailPage(page);
  });

  test("progress card displays started timestamp", async ({ page }) => {
    const importsPage = new ImportsPage(page);
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      const href = await jobCards.first().getByRole("link", { name: /view details/i }).getAttribute("href");
      const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
      const jobId = match ? match[1] : null;

      if (jobId) {
        await detailPage.goto(jobId);
        await detailPage.waitForJobLoaded();

        // Progress card should be visible
        await expect(detailPage.progressCard).toBeVisible();

        // Card description should contain "Started" text
        const cardDesc = detailPage.progressCard.locator('[class*="card-description"]');
        await expect(cardDesc).toContainText(/started/i);
      }
    }
  });

  test("completed job shows completed timestamp", async ({ page }) => {
    const importsPage = new ImportsPage(page);
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();

    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    for (let i = 0; i < count; i++) {
      const card = jobCards.nth(i);
      const badge = card.locator('[class*="badge"]');
      const badgeText = await badge.textContent();

      if (badgeText?.toLowerCase().includes("completed")) {
        const href = await card.getByRole("link", { name: /view details/i }).getAttribute("href");
        const match = href?.match(/\/dashboard\/imports\/([a-f0-9-]+)/);
        const jobId = match ? match[1] : null;

        if (jobId) {
          await detailPage.goto(jobId);
          await detailPage.waitForJobLoaded();

          // Completed timestamp should be visible
          const completedText = page.locator("text=Completed:");
          await expect(completedText).toBeVisible();
          break;
        }
      }
    }
  });
});
