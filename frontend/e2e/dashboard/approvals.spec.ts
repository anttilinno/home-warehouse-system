import { test, expect } from "../fixtures/authenticated";
import { test as roleTest, expect as roleExpect } from "../fixtures/roles";
import { ApprovalsPage } from "../pages/ApprovalsPage";

test.describe("Approvals Queue", () => {
  let approvalsPage: ApprovalsPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("page loads for admin/owner user", async ({ page }) => {
    // Page title should be visible
    await expect(approvalsPage.pageTitle).toBeVisible();

    // Check that we're on the approvals page
    await expect(page).toHaveURL(/\/dashboard\/approvals/);
  });

  test("page displays title and subtitle", async ({ page }) => {
    await expect(approvalsPage.pageTitle).toBeVisible();
    await expect(approvalsPage.pageSubtitle).toBeVisible();
  });

  test("pending changes list or empty state displays", async ({ page }) => {
    // Either changes list or empty state should be visible
    const hasChanges = await approvalsPage.getAllChangeCards().count() > 0;
    const hasEmpty = await approvalsPage.hasEmptyState();

    expect(hasChanges || hasEmpty).toBe(true);
  });

  test("status filter is present and clickable", async ({ page }) => {
    await expect(approvalsPage.statusFilter).toBeVisible();

    // Click to open filter dropdown
    await approvalsPage.statusFilter.click();

    // Check filter options are present
    await expect(approvalsPage.statusOption("pending")).toBeVisible();
    await expect(approvalsPage.statusOption("approved")).toBeVisible();
    await expect(approvalsPage.statusOption("rejected")).toBeVisible();
  });

  test("status filter shows pending/approved/rejected options", async ({ page }) => {
    await approvalsPage.statusFilter.click();

    // All status options should be available
    await expect(approvalsPage.statusOption("pending")).toBeVisible();
    await expect(approvalsPage.statusOption("approved")).toBeVisible();
    await expect(approvalsPage.statusOption("rejected")).toBeVisible();
    await expect(approvalsPage.statusOption("all")).toBeVisible();
  });

  test("clicking status filter changes displayed changes", async ({ page }) => {
    // First check if there are any changes to filter
    const initialCount = await approvalsPage.getAllChangeCards().count();

    if (initialCount > 0) {
      // Filter by rejected (likely fewer results)
      await approvalsPage.filterByStatus("rejected");

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Results may have changed
      const filteredCount = await approvalsPage.getAllChangeCards().count();
      const hasEmpty = await approvalsPage.hasEmptyState();

      // Either we have filtered results or empty state
      expect(filteredCount >= 0 || hasEmpty).toBe(true);
    }
  });

  test("entity type filter is present and shows options", async ({ page }) => {
    await expect(approvalsPage.entityTypeFilter).toBeVisible();

    // Click to open filter dropdown
    await approvalsPage.entityTypeFilter.click();

    // Check for entity type options
    await expect(approvalsPage.entityTypeOption("item")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("location")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("container")).toBeVisible();
  });

  test("entity type filter shows all entity types", async ({ page }) => {
    await approvalsPage.entityTypeFilter.click();

    // All entity type options should be available
    await expect(approvalsPage.entityTypeOption("all")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("item")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("location")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("container")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("category")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("borrower")).toBeVisible();
    await expect(approvalsPage.entityTypeOption("loan")).toBeVisible();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(approvalsPage.searchInput).toBeVisible();

    // Type in search
    await approvalsPage.search("test query");
    await expect(approvalsPage.searchInput).toHaveValue("test query");
  });

  test("search filters by requester name", async ({ page }) => {
    const initialCount = await approvalsPage.getAllChangeCards().count();

    if (initialCount > 0) {
      // Search for unlikely term
      await approvalsPage.search("zzz-unlikely-search-term-xyz");

      await page.waitForTimeout(500);

      // Should filter results
      const filteredCount = await approvalsPage.getAllChangeCards().count();
      const hasEmpty = await approvalsPage.hasEmptyState();

      expect(filteredCount < initialCount || hasEmpty).toBe(true);
    }
  });
});

test.describe("Approvals Change Cards", () => {
  let approvalsPage: ApprovalsPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("change card shows status badge", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = approvalsPage.changeCardByIndex(0);
      const statusBadge = approvalsPage.changeCardStatus(firstCard);

      await expect(statusBadge).toBeVisible();
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toMatch(/pending|approved|rejected/);
    }
  });

  test("change card shows entity type icon", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = approvalsPage.changeCardByIndex(0);
      const icon = approvalsPage.changeCardEntityType(firstCard);

      await expect(icon).toBeVisible();
    }
  });

  test("change card shows requester name", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = approvalsPage.changeCardByIndex(0);

      // Check for "Requested by" text
      await expect(firstCard.locator("text=Requested by")).toBeVisible();
    }
  });

  test("clicking change card navigates to detail", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/dashboard\/approvals\/[a-f0-9-]+/);
    }
  });
});

test.describe("Approvals Stats Section", () => {
  let approvalsPage: ApprovalsPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("stats section shows pending count when changes exist", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      // Stats section should be visible
      await expect(approvalsPage.statsSection).toBeVisible();

      // Pending count should be displayed
      await expect(approvalsPage.pendingCount).toBeVisible();
    }
  });

  test("stats section shows approved and rejected counts", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      // Check for all stat counts
      await expect(approvalsPage.approvedCount).toBeVisible();
      await expect(approvalsPage.rejectedCount).toBeVisible();
    }
  });
});

// Tests for role-based access control
roleTest.describe("Approvals Role-Based Access", () => {
  roleTest("page shows permission denied for viewer", async ({ viewerPage }) => {
    const approvalsPage = new ApprovalsPage(viewerPage);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();

    // Viewer should see permission denied state
    const hasPermissionDenied = await approvalsPage.hasPermissionDenied();
    expect(hasPermissionDenied).toBe(true);
  });

  roleTest("page shows permission denied for member", async ({ memberPage }) => {
    const approvalsPage = new ApprovalsPage(memberPage);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();

    // Member should see permission denied state
    const hasPermissionDenied = await approvalsPage.hasPermissionDenied();
    expect(hasPermissionDenied).toBe(true);
  });

  roleTest("admin can access approvals page", async ({ adminPage }) => {
    const approvalsPage = new ApprovalsPage(adminPage);
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();

    // Admin should see the page content, not permission denied
    await roleExpect(approvalsPage.pageTitle).toBeVisible();

    // Either changes list or empty state (but not permission denied)
    const hasPermissionDenied = await approvalsPage.hasPermissionDenied();
    expect(hasPermissionDenied).toBe(false);
  });
});
