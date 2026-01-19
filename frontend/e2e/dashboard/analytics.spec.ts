import { test, expect } from "../fixtures/authenticated";
import { AnalyticsPage } from "../pages/AnalyticsPage";

test.describe("Analytics Dashboard", () => {
  let analyticsPage: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
  });

  test("page loads with loading skeleton initially", async ({ page }) => {
    // Navigate fresh to catch loading state
    await page.goto(`/en/dashboard/analytics`);

    // Either loading skeleton or content should be visible
    const hasLoading = await analyticsPage.isLoading();
    const hasTitle = await analyticsPage.pageTitle.isVisible().catch(() => false);

    // Page should show either loading or be loaded
    expect(hasLoading || hasTitle).toBe(true);

    // Wait for full load
    await analyticsPage.waitForAnalyticsLoaded();
    await expect(analyticsPage.pageTitle).toBeVisible();
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    await expect(analyticsPage.pageTitle).toBeVisible();
    await expect(analyticsPage.pageTitle).toHaveText("Analytics");
    await expect(analyticsPage.pageSubtitle).toContainText(/insights|inventory|loan/i);
  });

  test("stats cards render after loading", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    // Should have multiple stats cards
    const statCards = analyticsPage.getAllStatCards();
    const count = await statCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test("Total Items stats card is present", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    const card = analyticsPage.statCard("Total Items");
    await expect(card).toBeVisible();

    // Value should be a number
    const value = await analyticsPage.getStatCardValue("Total Items");
    expect(value).toMatch(/^\d+$/);
  });

  test("Total Inventory stats card is present", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    const card = analyticsPage.statCard("Total Inventory");
    await expect(card).toBeVisible();
  });

  test("Active Loans stats card is present", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    const card = analyticsPage.statCard("Active Loans");
    await expect(card).toBeVisible();
  });

  test("Overdue Loans stats card is present", async ({ page }) => {
    await analyticsPage.waitForAnalyticsLoaded();

    const card = analyticsPage.statCard("Overdue Loans");
    await expect(card).toBeVisible();
  });
});

test.describe("Analytics Charts", () => {
  let analyticsPage: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
    await analyticsPage.waitForAnalyticsLoaded();
  });

  test("category distribution chart is present", async ({ page }) => {
    const hasChart = await analyticsPage.hasCategoryChart();
    expect(hasChart).toBe(true);

    // Chart card should have title
    const chartTitle = analyticsPage.categoryChart.locator('[class*="card-title"]');
    await expect(chartTitle).toContainText(/items by category/i);
  });

  test("inventory condition chart is present", async ({ page }) => {
    const hasChart = await analyticsPage.hasConditionChart();
    expect(hasChart).toBe(true);

    // Chart card should have title
    const chartTitle = analyticsPage.conditionChart.locator('[class*="card-title"]');
    await expect(chartTitle).toContainText(/inventory by condition/i);
  });

  test("inventory status chart is present", async ({ page }) => {
    const statusChart = analyticsPage.statusChart;
    await expect(statusChart).toBeVisible();

    // Chart card should have title
    const chartTitle = statusChart.locator('[class*="card-title"]');
    await expect(chartTitle).toContainText(/inventory by status/i);
  });

  test("monthly activity chart is present", async ({ page }) => {
    const hasChart = await analyticsPage.hasActivityChart();
    expect(hasChart).toBe(true);

    // Chart card should have title
    const chartTitle = analyticsPage.activityChart.locator('[class*="card-title"]');
    await expect(chartTitle).toContainText(/loan activity/i);
  });

  test("charts contain Recharts elements", async ({ page }) => {
    // Look for SVG elements that Recharts generates
    const categoryChartSvg = analyticsPage.categoryChart.locator("svg");
    await expect(categoryChartSvg).toBeVisible();

    const conditionChartSvg = analyticsPage.conditionChart.locator("svg");
    await expect(conditionChartSvg).toBeVisible();
  });
});

test.describe("Analytics Tables", () => {
  let analyticsPage: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
    await analyticsPage.waitForAnalyticsLoaded();
  });

  test("top borrowers table is visible", async ({ page }) => {
    const hasTable = await analyticsPage.hasTopBorrowersTable();
    expect(hasTable).toBe(true);
  });

  test("top borrowers table has correct headers", async ({ page }) => {
    const table = analyticsPage.topBorrowersTable.locator("table");
    await expect(table).toBeVisible();

    const nameHeader = table.locator('th').filter({ hasText: /name/i });
    const totalHeader = table.locator('th').filter({ hasText: /total/i });
    const activeHeader = table.locator('th').filter({ hasText: /active/i });

    await expect(nameHeader).toBeVisible();
    await expect(totalHeader).toBeVisible();
    await expect(activeHeader).toBeVisible();
  });

  test("top borrowers table has data or empty state", async ({ page }) => {
    const rowCount = await analyticsPage.getTopBorrowersRowCount();
    const hasEmptyState = await analyticsPage.hasTopBorrowersEmptyState();

    // Either has rows or shows empty state
    expect(rowCount > 0 || hasEmptyState).toBe(true);
  });

  test("location value table is visible", async ({ page }) => {
    const hasTable = await analyticsPage.hasLocationValueTable();
    expect(hasTable).toBe(true);
  });

  test("location value table has correct headers", async ({ page }) => {
    const table = analyticsPage.locationValueTable.locator("table");
    await expect(table).toBeVisible();

    const locationHeader = table.locator('th').filter({ hasText: /location/i });
    const itemsHeader = table.locator('th').filter({ hasText: /items/i });
    const valueHeader = table.locator('th').filter({ hasText: /value/i });

    await expect(locationHeader).toBeVisible();
    await expect(itemsHeader).toBeVisible();
    await expect(valueHeader).toBeVisible();
  });

  test("location value table has data or empty state", async ({ page }) => {
    const rowCount = await analyticsPage.getLocationValueRowCount();
    const hasEmptyState = await analyticsPage.hasLocationValuesEmptyState();

    // Either has rows or shows empty state
    expect(rowCount > 0 || hasEmptyState).toBe(true);
  });
});

test.describe("Analytics Loan Summary", () => {
  let analyticsPage: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
    await analyticsPage.waitForAnalyticsLoaded();
  });

  test("loan summary card is present", async ({ page }) => {
    await expect(analyticsPage.loanSummaryCard).toBeVisible();
  });

  test("loan summary shows total loans", async ({ page }) => {
    const totalLoansText = analyticsPage.loanSummaryCard.locator("text=Total Loans");
    await expect(totalLoansText).toBeVisible();
  });

  test("loan summary shows active loans", async ({ page }) => {
    const activeText = analyticsPage.loanSummaryCard.locator("text=Active");
    await expect(activeText).toBeVisible();
  });

  test("loan summary shows returned loans", async ({ page }) => {
    const returnedText = analyticsPage.loanSummaryCard.locator("text=Returned");
    await expect(returnedText).toBeVisible();
  });

  test("loan summary shows overdue loans", async ({ page }) => {
    const overdueText = analyticsPage.loanSummaryCard.locator("text=Overdue");
    await expect(overdueText).toBeVisible();
  });
});

test.describe("Analytics Additional Stats", () => {
  let analyticsPage: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
    await analyticsPage.waitForAnalyticsLoaded();
  });

  test("Locations stats card is present", async ({ page }) => {
    const card = analyticsPage.statCard("Locations");
    await expect(card).toBeVisible();
  });

  test("Containers stats card is present", async ({ page }) => {
    const card = analyticsPage.statCard("Containers");
    await expect(card).toBeVisible();
  });

  test("Borrowers stats card is present", async ({ page }) => {
    const card = analyticsPage.statCard("Borrowers");
    await expect(card).toBeVisible();
  });

  test("Low Stock Items stats card is present", async ({ page }) => {
    const card = analyticsPage.statCard("Low Stock Items");
    await expect(card).toBeVisible();
  });

  test("stats card values are numeric", async ({ page }) => {
    const statCards = analyticsPage.getAllStatCards();
    const count = await statCards.count();

    for (let i = 0; i < Math.min(count, 4); i++) {
      const card = statCards.nth(i);
      const valueElement = card.locator(".text-2xl.font-bold");
      const value = await valueElement.textContent();

      // Value should be a number
      expect(value).toMatch(/^\d+$/);
    }
  });
});
