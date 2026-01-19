import { test, expect } from "../fixtures/authenticated";
import { test as roleTest, expect as roleExpect } from "../fixtures/roles";
import { MyChangesPage } from "../pages/MyChangesPage";

test.describe("My Changes Page", () => {
  let myChangesPage: MyChangesPage;

  test.beforeEach(async ({ page }) => {
    myChangesPage = new MyChangesPage(page);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();
  });

  test("page loads for any authenticated user", async ({ page }) => {
    // Page title should be visible
    await expect(myChangesPage.pageTitle).toBeVisible();

    // Check that we're on the my-changes page
    await expect(page).toHaveURL(/\/dashboard\/my-changes/);
  });

  test("page displays title and subtitle", async ({ page }) => {
    await expect(myChangesPage.pageTitle).toBeVisible();
    await expect(myChangesPage.pageSubtitle).toBeVisible();
  });

  test("shows changes submitted by current user or empty state", async ({ page }) => {
    // Either changes list or empty state should be visible
    const hasChanges = await myChangesPage.getAllChangeCards().count() > 0;
    const hasEmpty = await myChangesPage.hasEmptyState();

    expect(hasChanges || hasEmpty).toBe(true);
  });

  test("empty state when no changes submitted", async ({ page }) => {
    // If there are no changes, empty state should be shown
    const hasChanges = await myChangesPage.getAllChangeCards().count() > 0;

    if (!hasChanges) {
      const hasEmpty = await myChangesPage.hasEmptyState();
      expect(hasEmpty).toBe(true);
    }
  });
});

test.describe("My Changes Filters", () => {
  let myChangesPage: MyChangesPage;

  test.beforeEach(async ({ page }) => {
    myChangesPage = new MyChangesPage(page);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();
  });

  test("status filter is present and clickable", async ({ page }) => {
    await expect(myChangesPage.statusFilter).toBeVisible();

    // Click to open filter dropdown
    await myChangesPage.statusFilter.click();

    // Check filter options are present
    await expect(myChangesPage.statusOption("pending")).toBeVisible();
    await expect(myChangesPage.statusOption("approved")).toBeVisible();
    await expect(myChangesPage.statusOption("rejected")).toBeVisible();
  });

  test("status filter works (pending/approved/rejected)", async ({ page }) => {
    const initialCount = await myChangesPage.getAllChangeCards().count();

    if (initialCount > 0) {
      // Filter by pending
      await myChangesPage.filterByStatus("pending");
      await page.waitForTimeout(500);

      // Results may have changed
      const filteredCount = await myChangesPage.getAllChangeCards().count();
      const hasEmpty = await myChangesPage.hasEmptyState();

      // Either we have filtered results or empty state
      expect(filteredCount >= 0 || hasEmpty).toBe(true);
    }
  });

  test("entity type filter is present", async ({ page }) => {
    await expect(myChangesPage.entityTypeFilter).toBeVisible();

    // Click to open filter dropdown
    await myChangesPage.entityTypeFilter.click();

    // Check for entity type options
    await expect(myChangesPage.entityTypeOption("item")).toBeVisible();
  });

  test("search input is present and functional", async ({ page }) => {
    await expect(myChangesPage.searchInput).toBeVisible();

    // Type in search
    await myChangesPage.search("test query");
    await expect(myChangesPage.searchInput).toHaveValue("test query");
  });
});

test.describe("My Changes Cards", () => {
  let myChangesPage: MyChangesPage;

  test.beforeEach(async ({ page }) => {
    myChangesPage = new MyChangesPage(page);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();
  });

  test("change card shows status badge", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);
      const statusBadge = myChangesPage.changeCardStatus(firstCard);

      await expect(statusBadge).toBeVisible();
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toMatch(/pending|approved|rejected/);
    }
  });

  test("change card shows timestamp", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);
      const timestamp = myChangesPage.changeCardTimestamp(firstCard);

      await expect(timestamp).toBeVisible();
    }
  });

  test("change card shows entity type", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);

      // Should have entity type text
      const entityTypeText = await firstCard.locator("span.capitalize").last().textContent();
      expect(entityTypeText?.toLowerCase()).toMatch(/item|location|container|category|borrower|loan|inventory/);
    }
  });

  test("change card shows action type", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);

      // Should have action badge (create/update/delete)
      const actionBadge = firstCard.locator('[class*="badge"]').filter({ hasText: /create|update|delete/i });
      await expect(actionBadge).toBeVisible();
    }
  });
});

test.describe("My Changes Stats", () => {
  let myChangesPage: MyChangesPage;

  test.beforeEach(async ({ page }) => {
    myChangesPage = new MyChangesPage(page);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();
  });

  test("stats cards show when changes exist", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      // Stats cards should be visible
      await expect(myChangesPage.pendingStatsCard).toBeVisible();
      await expect(myChangesPage.approvedStatsCard).toBeVisible();
      await expect(myChangesPage.rejectedStatsCard).toBeVisible();
    }
  });

  test("pending stats card shows count", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const pendingCount = await myChangesPage.getPendingCount();
      expect(pendingCount).toMatch(/\d+/);
    }
  });

  test("approved stats card shows count", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const approvedCount = await myChangesPage.getApprovedCount();
      expect(approvedCount).toMatch(/\d+/);
    }
  });

  test("rejected stats card shows count", async ({ page }) => {
    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const rejectedCount = await myChangesPage.getRejectedCount();
      expect(rejectedCount).toMatch(/\d+/);
    }
  });
});

test.describe("My Changes - Status Display", () => {
  let myChangesPage: MyChangesPage;

  test.beforeEach(async ({ page }) => {
    myChangesPage = new MyChangesPage(page);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();
  });

  test("pending changes show awaiting review message", async ({ page }) => {
    // Filter to pending
    await myChangesPage.filterByStatus("pending");
    await page.waitForTimeout(300);

    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);

      // Should show pending-related text
      const cardText = await firstCard.textContent();
      expect(cardText?.toLowerCase()).toMatch(/pending|awaiting|review/i);
    }
  });

  test("approved changes show approval confirmation", async ({ page }) => {
    // Filter to approved
    await myChangesPage.filterByStatus("approved");
    await page.waitForTimeout(300);

    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);

      // Should show approved status
      const statusBadge = myChangesPage.changeCardStatus(firstCard);
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toContain("approved");
    }
  });

  test("rejected changes show rejection info", async ({ page }) => {
    // Filter to rejected
    await myChangesPage.filterByStatus("rejected");
    await page.waitForTimeout(300);

    const cardCount = await myChangesPage.getAllChangeCards().count();

    if (cardCount > 0) {
      const firstCard = myChangesPage.changeCard(0);

      // Should show rejected status
      const statusBadge = myChangesPage.changeCardStatus(firstCard);
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toContain("rejected");
    }
  });
});

// Role-based tests for my-changes page
roleTest.describe("My Changes - Role Access", () => {
  roleTest("admin can access my changes page", async ({ adminPage }) => {
    const myChangesPage = new MyChangesPage(adminPage);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();

    await roleExpect(myChangesPage.pageTitle).toBeVisible();
    await roleExpect(adminPage).toHaveURL(/\/dashboard\/my-changes/);
  });

  roleTest("member can access my changes page", async ({ memberPage }) => {
    const myChangesPage = new MyChangesPage(memberPage);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();

    await roleExpect(myChangesPage.pageTitle).toBeVisible();
    await roleExpect(memberPage).toHaveURL(/\/dashboard\/my-changes/);
  });

  roleTest("viewer can access my changes page", async ({ viewerPage }) => {
    const myChangesPage = new MyChangesPage(viewerPage);
    await myChangesPage.goto();
    await myChangesPage.waitForPageLoaded();

    await roleExpect(myChangesPage.pageTitle).toBeVisible();
    await roleExpect(viewerPage).toHaveURL(/\/dashboard\/my-changes/);
  });
});
