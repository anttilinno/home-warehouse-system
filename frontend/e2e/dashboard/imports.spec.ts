import { test, expect } from "../fixtures/authenticated";
import { ImportsPage } from "../pages/ImportsPage";

test.describe("Imports List", () => {
  let importsPage: ImportsPage;

  test.beforeEach(async ({ page }) => {
    importsPage = new ImportsPage(page);
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();
  });

  test("page loads with imports list or empty state", async ({ page }) => {
    // Page title should be visible
    await expect(importsPage.pageTitle).toBeVisible();

    // Either the jobs list or empty state should be present
    const hasJobs = await importsPage.getAllJobCards().count() > 0;
    const hasEmpty = await importsPage.hasEmptyState();

    expect(hasJobs || hasEmpty).toBe(true);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(importsPage.pageTitle).toHaveText("Import Jobs");
    await expect(importsPage.pageSubtitle).toContainText(/manage|monitor/i);
  });

  test("New Import button is visible and navigates to new import page", async ({ page }) => {
    await expect(importsPage.newImportButton).toBeVisible();

    await importsPage.newImportButton.click();
    await expect(page).toHaveURL(/\/dashboard\/imports\/new/);
  });

  test("import job card shows file name when jobs exist", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // First card should have a title with file name
      const firstCard = jobCards.first();
      const cardTitle = firstCard.locator('[class*="card-title"]');
      await expect(cardTitle).toBeVisible();

      // File name should contain common extensions or be non-empty
      const titleText = await cardTitle.textContent();
      expect(titleText?.length).toBeGreaterThan(0);
    }
  });

  test("job status badge displays correctly", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // First card should have a status badge
      const firstCard = jobCards.first();
      const badge = firstCard.locator('[class*="badge"]');
      await expect(badge).toBeVisible();

      // Badge should contain one of the valid statuses
      const badgeText = await badge.textContent();
      expect(badgeText?.toLowerCase()).toMatch(/pending|processing|completed|failed|cancelled/);
    }
  });

  test("progress indicator shown for processing jobs", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // Look for a processing job
      for (let i = 0; i < count; i++) {
        const card = jobCards.nth(i);
        const badge = card.locator('[class*="badge"]');
        const badgeText = await badge.textContent();

        if (badgeText?.toLowerCase().includes("processing")) {
          // Processing jobs should show a progress bar
          const progressBar = card.locator('[role="progressbar"]');
          await expect(progressBar).toBeVisible();
          break;
        }
      }
    }
  });

  test("clicking job navigates to detail page", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // Click on View Details link
      const viewDetailsLink = jobCards.first().getByRole("link", { name: /view details/i });
      await viewDetailsLink.click();

      // Should navigate to job detail page
      await expect(page).toHaveURL(/\/dashboard\/imports\/[a-f0-9-]+/);
    }
  });

  test("empty state shows create button when no imports", async ({ page }) => {
    const hasEmpty = await importsPage.hasEmptyState();

    if (hasEmpty) {
      // Empty state should have a New Import button
      await expect(importsPage.emptyStateNewImportButton).toBeVisible();

      // Clicking it should navigate to new import page
      await importsPage.emptyStateNewImportButton.click();
      await expect(page).toHaveURL(/\/dashboard\/imports\/new/);
    }
  });

  test("empty state displays appropriate message", async ({ page }) => {
    const hasEmpty = await importsPage.hasEmptyState();

    if (hasEmpty) {
      await expect(importsPage.emptyState).toContainText(/no import jobs yet/i);
    }
  });
});

test.describe("Import Job Cards Content", () => {
  let importsPage: ImportsPage;

  test.beforeEach(async ({ page }) => {
    importsPage = new ImportsPage(page);
    await importsPage.goto();
    await importsPage.waitForImportsLoaded();
  });

  test("completed job shows success and error counts", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // Look for a completed job
      for (let i = 0; i < count; i++) {
        const card = jobCards.nth(i);
        const badge = card.locator('[class*="badge"]');
        const badgeText = await badge.textContent();

        if (badgeText?.toLowerCase().includes("completed")) {
          // Completed jobs should show success count
          const successText = card.locator("text=Success:");
          await expect(successText).toBeVisible();
          break;
        }
      }
    }
  });

  test("job card shows entity type", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // Job card description should include entity type
      const firstCard = jobCards.first();
      const description = firstCard.locator('[class*="card-description"]');
      const descText = await description.textContent();

      // Should contain entity type (items, locations, etc.)
      expect(descText?.toLowerCase()).toMatch(/items|inventory|locations|containers|categories|borrowers/);
    }
  });

  test("job card shows relative time", async ({ page }) => {
    const jobCards = importsPage.getAllJobCards();
    const count = await jobCards.count();

    if (count > 0) {
      // Job card should show "Started X ago" text
      const firstCard = jobCards.first();
      const description = firstCard.locator('[class*="card-description"]');
      const descText = await description.textContent();

      // Should contain relative time text
      expect(descText?.toLowerCase()).toMatch(/started|ago|seconds|minutes|hours|days/);
    }
  });
});
