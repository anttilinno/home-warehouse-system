import { test, expect } from "../fixtures/authenticated";
import { ApprovalsPage } from "../pages/ApprovalsPage";
import { ApprovalDetailPage } from "../pages/ApprovalDetailPage";

test.describe("Approval Detail Page", () => {
  let approvalsPage: ApprovalsPage;
  let detailPage: ApprovalDetailPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    detailPage = new ApprovalDetailPage(page);

    // Navigate to approvals list first
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("page loads with change information", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      // Click first change to navigate to detail
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      // Title should be visible
      await expect(detailPage.changeTitle).toBeVisible();

      // Status badge should be visible
      await expect(detailPage.statusBadge).toBeVisible();
    }
  });

  test("back button returns to approvals list", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      // Click back button
      await detailPage.goBack();

      // Should be back on approvals list
      await expect(page).toHaveURL(/\/dashboard\/approvals$/);
    }
  });

  test("status badge shows current status", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      await expect(detailPage.statusBadge).toBeVisible();
      const statusText = await detailPage.statusBadge.textContent();
      expect(statusText?.toLowerCase()).toMatch(/pending|approved|rejected/);
    }
  });

  test("requester info is displayed", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      // Request info card should be visible
      await expect(detailPage.requestInfoCard).toBeVisible();

      // Requester information should be present
      await expect(detailPage.requestInfoCard.locator("text=Requester")).toBeVisible();
    }
  });

  test("data diff section shows proposed changes", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      // Payload card should be visible
      await expect(detailPage.payloadCard).toBeVisible();

      // Pre element with JSON data should be present
      await expect(detailPage.dataDiff).toBeVisible();
    }
  });

  test("created date is displayed", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      // Created date info should be present
      await expect(detailPage.requestInfoCard.locator("text=Created")).toBeVisible();
    }
  });
});

test.describe("Approval Detail - Pending Changes", () => {
  let approvalsPage: ApprovalsPage;
  let detailPage: ApprovalDetailPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    detailPage = new ApprovalDetailPage(page);

    // Navigate and filter to pending only
    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
    await approvalsPage.filterByStatus("pending");
    await page.waitForTimeout(300);
  });

  test("approve button visible for pending changes", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isPending = await detailPage.isPending();

      if (isPending) {
        await expect(detailPage.approveButton).toBeVisible();
      }
    }
  });

  test("reject button visible for pending changes", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isPending = await detailPage.isPending();

      if (isPending) {
        await expect(detailPage.rejectButton).toBeVisible();
      }
    }
  });

  test("clicking reject shows reason input", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isPending = await detailPage.isPending();

      if (isPending) {
        await detailPage.openRejectDialog();

        // Reject dialog should be visible
        await expect(detailPage.rejectDialog).toBeVisible();

        // Reason input should be present
        await expect(detailPage.rejectReasonInput).toBeVisible();

        // Cancel to close dialog
        await detailPage.cancelReject();
      }
    }
  });

  test("clicking approve shows confirmation dialog", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isPending = await detailPage.isPending();

      if (isPending) {
        await detailPage.openApproveDialog();

        // Approve dialog should be visible
        await expect(detailPage.approveDialog).toBeVisible();

        // Confirm button should be present
        await expect(detailPage.approveConfirmButton).toBeVisible();

        // Cancel to close dialog
        await detailPage.cancelApprove();
      }
    }
  });

  test("reject dialog cancel button closes dialog", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isPending = await detailPage.isPending();

      if (isPending) {
        await detailPage.openRejectDialog();
        await expect(detailPage.rejectDialog).toBeVisible();

        await detailPage.cancelReject();
        await expect(detailPage.rejectDialog).toBeHidden();
      }
    }
  });
});

test.describe("Approval Detail - Processed Changes", () => {
  let approvalsPage: ApprovalsPage;
  let detailPage: ApprovalDetailPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    detailPage = new ApprovalDetailPage(page);

    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("approved changes show reviewer info", async ({ page }) => {
    // Filter to approved
    await approvalsPage.filterByStatus("approved");
    await page.waitForTimeout(300);

    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isApproved = await detailPage.isApproved();

      if (isApproved) {
        // Review info card should be visible for approved changes
        const hasReviewInfo = await detailPage.hasReviewInfo();
        expect(hasReviewInfo).toBe(true);
      }
    }
  });

  test("rejected changes show rejection reason", async ({ page }) => {
    // Filter to rejected
    await approvalsPage.filterByStatus("rejected");
    await page.waitForTimeout(300);

    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isRejected = await detailPage.isRejected();

      if (isRejected) {
        // Review info should be visible with rejection reason
        const hasReviewInfo = await detailPage.hasReviewInfo();
        expect(hasReviewInfo).toBe(true);

        // Rejection reason text should be present somewhere
        await expect(detailPage.page.locator("text=/reason/i")).toBeVisible();
      }
    }
  });

  test("approved changes do not show approve/reject buttons", async ({ page }) => {
    // Filter to approved
    await approvalsPage.filterByStatus("approved");
    await page.waitForTimeout(300);

    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isApproved = await detailPage.isApproved();

      if (isApproved) {
        // Approve/reject buttons should NOT be visible
        await expect(detailPage.approveButton).toBeHidden();
        await expect(detailPage.rejectButton).toBeHidden();
      }
    }
  });

  test("rejected changes do not show approve/reject buttons", async ({ page }) => {
    // Filter to rejected
    await approvalsPage.filterByStatus("rejected");
    await page.waitForTimeout(300);

    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      const isRejected = await detailPage.isRejected();

      if (isRejected) {
        // Approve/reject buttons should NOT be visible
        await expect(detailPage.approveButton).toBeHidden();
        await expect(detailPage.rejectButton).toBeHidden();
      }
    }
  });
});

test.describe("Approval Detail - Action Badge", () => {
  let approvalsPage: ApprovalsPage;
  let detailPage: ApprovalDetailPage;

  test.beforeEach(async ({ page }) => {
    approvalsPage = new ApprovalsPage(page);
    detailPage = new ApprovalDetailPage(page);

    await approvalsPage.goto();
    await approvalsPage.waitForPageLoaded();
  });

  test("action badge shows create/update/delete", async ({ page }) => {
    const cardCount = await approvalsPage.getAllChangeCards().count();

    if (cardCount > 0) {
      await approvalsPage.clickChangeCard(0);
      await detailPage.waitForPageLoaded();

      await expect(detailPage.actionBadge).toBeVisible();
      const actionText = await detailPage.actionBadge.textContent();
      expect(actionText?.toLowerCase()).toMatch(/create|update|delete/);
    }
  });
});
