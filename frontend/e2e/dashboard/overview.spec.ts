import { test, expect } from "../fixtures/authenticated";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Dashboard Overview", () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.waitForDataLoaded();
  });

  test("page loads without errors", async ({ page }) => {
    // Page should have loaded successfully
    await expect(dashboardPage.pageTitle).toBeVisible();
    await expect(dashboardPage.pageTitle).toHaveText(/dashboard/i);

    // Should not show error state
    const hasError = await dashboardPage.hasError();
    expect(hasError).toBe(false);
  });

  test("page title and subtitle are displayed", async ({ page }) => {
    await expect(dashboardPage.pageTitle).toHaveText(/dashboard/i);
    await expect(dashboardPage.pageSubtitle).toBeVisible();
  });

  test("stats cards render (Items, Locations, Containers, Loans)", async ({ page }) => {
    // Check for the four main stat cards
    const itemsCard = dashboardPage.statCard("Items");
    const locationsCard = dashboardPage.statCard("Locations");
    const containersCard = dashboardPage.statCard("Containers");
    const loansCard = dashboardPage.statCard("Loans");

    await expect(itemsCard).toBeVisible();
    await expect(locationsCard).toBeVisible();
    await expect(containersCard).toBeVisible();
    await expect(loansCard).toBeVisible();
  });

  test("stats cards show numeric values", async ({ page }) => {
    // Each stat card should display a number (0 or more)
    const statsCards = ["Total Items", "Locations", "Containers", "Active Loans"];

    for (const cardTitle of statsCards) {
      const value = await dashboardPage.getStatCardValue(cardTitle);
      expect(value).toBeTruthy();
      // Value should contain at least one digit
      expect(value).toMatch(/\d+/);
    }
  });

  test("alerts section is visible", async ({ page }) => {
    await expect(dashboardPage.alertsSection).toBeVisible();
    await expect(dashboardPage.alertsTitle).toHaveText(/alerts/i);
  });

  test("activity feed section is visible", async ({ page }) => {
    await expect(dashboardPage.activityFeed).toBeVisible();
    await expect(dashboardPage.activityTitle).toHaveText(/recent activity/i);
  });

  test("refresh button is visible and clickable", async ({ page }) => {
    await expect(dashboardPage.refreshButton).toBeVisible();
    await expect(dashboardPage.refreshButton).toHaveText(/refresh/i);
  });

  test("refresh button triggers data reload", async ({ page }) => {
    // Listen for network requests to analytics API
    const requestPromise = page.waitForRequest((request) =>
      request.url().includes("/analytics") && request.method() === "GET"
    );

    // Click refresh
    await dashboardPage.refresh();

    // Should have made an API call
    const request = await requestPromise;
    expect(request).toBeTruthy();
  });

  test("alerts section shows badge when there are warnings", async ({ page }) => {
    // Check if alerts are present
    const alertsCount = await dashboardPage.getAlertsCount();

    if (alertsCount > 0) {
      // If there are alerts, each should have a badge
      const firstAlert = dashboardPage.alertItems.first();
      const badge = firstAlert.locator('[class*="badge"]');
      await expect(badge).toBeVisible();
    } else {
      // If no alerts, should show "No alerts" message
      const noAlertsMessage = dashboardPage.alertsSection.getByText(/no alerts/i);
      await expect(noAlertsMessage).toBeVisible();
    }
  });

  test("activity feed shows items or empty message", async ({ page }) => {
    const activityCount = await dashboardPage.getActivityItemsCount();

    if (activityCount > 0) {
      // Activity items should have time indicators
      const firstActivity = dashboardPage.activityItems.first();
      await expect(firstActivity).toBeVisible();
    } else {
      // Should show "No recent activity" message
      const noActivityMessage = dashboardPage.activityFeed.getByText(/no recent activity/i);
      await expect(noActivityMessage).toBeVisible();
    }
  });

  test("live activity feed is visible on desktop", async ({ page }) => {
    // This test is for desktop viewport
    // Live activity feed should be in the aside element
    await expect(dashboardPage.liveActivityFeed).toBeVisible();
  });

  test("stats cards have icons", async ({ page }) => {
    // Each stat card should have an SVG icon
    const statsContainer = dashboardPage.statsCards;
    const icons = statsContainer.locator("svg");

    // Should have at least 4 icons for 4 stat cards
    const iconCount = await icons.count();
    expect(iconCount).toBeGreaterThanOrEqual(4);
  });

  test("page maintains state after navigation and back", async ({ page }) => {
    // Navigate to Items
    await dashboardPage.shell.navigateTo("Items");
    await expect(page).toHaveURL(/\/dashboard\/items/);

    // Navigate back to Dashboard
    await dashboardPage.shell.navigateTo("Dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Dashboard should still show correctly
    await dashboardPage.waitForDataLoaded();
    await expect(dashboardPage.pageTitle).toHaveText(/dashboard/i);
  });
});
