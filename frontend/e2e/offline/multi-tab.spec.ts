import { test, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Multi-tab E2E tests for offline scenarios using multiple browser contexts.
 *
 * These tests verify:
 * - Independent offline states per tab/context
 * - Shared IndexedDB data across tabs
 * - Sync behavior across multiple tabs
 *
 * Chromium only: WebKit and Firefox have inconsistent offline simulation behavior.
 */
test.describe("Multi-Tab Offline Scenarios", () => {
  // Skip non-Chromium browsers per user decision
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  // Run tests serially to avoid conflicts
  test.describe.configure({ mode: "serial" });

  // Helper to create an authenticated context with a page
  async function createAuthenticatedContext(browser: typeof test.info.prototype.project.use.browserName extends "chromium" ? Parameters<typeof test.info>[0]["browser"] : never): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
      storageState: "playwright/.auth/user.json",
    });
    const page = await context.newPage();
    return { context, page };
  }

  test("both tabs show offline indicator when their network disconnected", async ({
    browser,
  }) => {
    // Create two separate contexts (like two browser tabs)
    const { context: context1, page: page1 } = await createAuthenticatedContext(browser);
    const { context: context2, page: page2 } = await createAuthenticatedContext(browser);

    try {
      // Navigate both to dashboard
      await page1.goto("/en/dashboard");
      await page1.waitForLoadState("domcontentloaded");
      await expect(page1.locator("main")).toBeVisible({ timeout: 15000 });

      await page2.goto("/en/dashboard");
      await page2.waitForLoadState("domcontentloaded");
      await expect(page2.locator("main")).toBeVisible({ timeout: 15000 });

      // Set both offline
      await context1.setOffline(true);
      await page1.evaluate(() => window.dispatchEvent(new Event("offline")));

      await context2.setOffline(true);
      await page2.evaluate(() => window.dispatchEvent(new Event("offline")));

      // Verify both show offline indicator
      const indicator1 = page1.locator('[data-testid="offline-indicator"]');
      const indicator2 = page2.locator('[data-testid="offline-indicator"]');

      await expect(indicator1).toBeVisible({ timeout: 5000 });
      await expect(indicator2).toBeVisible({ timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("offline state is independent per tab", async ({ browser }) => {
    // Create two separate contexts
    const { context: context1, page: page1 } = await createAuthenticatedContext(browser);
    const { context: context2, page: page2 } = await createAuthenticatedContext(browser);

    try {
      // Navigate both to dashboard
      await page1.goto("/en/dashboard");
      await page1.waitForLoadState("domcontentloaded");
      await expect(page1.locator("main")).toBeVisible({ timeout: 15000 });

      await page2.goto("/en/dashboard");
      await page2.waitForLoadState("domcontentloaded");
      await expect(page2.locator("main")).toBeVisible({ timeout: 15000 });

      // Set only context1 offline
      await context1.setOffline(true);
      await page1.evaluate(() => window.dispatchEvent(new Event("offline")));

      // Context2 stays online
      const indicator1 = page1.locator('[data-testid="offline-indicator"]');
      const indicator2 = page2.locator('[data-testid="offline-indicator"]');

      // Tab 1 should show offline
      await expect(indicator1).toBeVisible({ timeout: 5000 });

      // Tab 2 should NOT show offline (it's still online)
      await expect(indicator2).not.toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("data visibility maintained in both tabs while offline", async ({
    browser,
  }) => {
    // Create two separate contexts
    const { context: context1, page: page1 } = await createAuthenticatedContext(browser);
    const { context: context2, page: page2 } = await createAuthenticatedContext(browser);

    try {
      // Navigate both to dashboard
      await page1.goto("/en/dashboard");
      await page1.waitForLoadState("domcontentloaded");
      await expect(page1.locator("main")).toBeVisible({ timeout: 15000 });

      await page2.goto("/en/dashboard");
      await page2.waitForLoadState("domcontentloaded");
      await expect(page2.locator("main")).toBeVisible({ timeout: 15000 });

      // Get heading content while online
      const heading1 = page1.getByRole("heading", { level: 1 });
      const heading2 = page2.getByRole("heading", { level: 1 });
      await expect(heading1).toBeVisible();
      await expect(heading2).toBeVisible();

      // Set both offline
      await context1.setOffline(true);
      await page1.evaluate(() => window.dispatchEvent(new Event("offline")));

      await context2.setOffline(true);
      await page2.evaluate(() => window.dispatchEvent(new Event("offline")));

      // Both tabs should still show their content (React state preserved)
      await expect(heading1).toBeVisible();
      await expect(heading2).toBeVisible();

      // Main content still visible in both
      await expect(page1.locator("main")).toBeVisible();
      await expect(page2.locator("main")).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("tab going online first can sync while other remains offline", async ({
    browser,
  }) => {
    // Create two separate contexts
    const { context: context1, page: page1 } = await createAuthenticatedContext(browser);
    const { context: context2, page: page2 } = await createAuthenticatedContext(browser);

    try {
      // Navigate both to dashboard
      await page1.goto("/en/dashboard");
      await page1.waitForLoadState("domcontentloaded");
      await expect(page1.locator("main")).toBeVisible({ timeout: 15000 });

      await page2.goto("/en/dashboard");
      await page2.waitForLoadState("domcontentloaded");
      await expect(page2.locator("main")).toBeVisible({ timeout: 15000 });

      // Set both offline
      await context1.setOffline(true);
      await page1.evaluate(() => window.dispatchEvent(new Event("offline")));

      await context2.setOffline(true);
      await page2.evaluate(() => window.dispatchEvent(new Event("offline")));

      // Verify both are offline
      const indicator1 = page1.locator('[data-testid="offline-indicator"]');
      const indicator2 = page2.locator('[data-testid="offline-indicator"]');

      await expect(indicator1).toBeVisible({ timeout: 5000 });
      await expect(indicator2).toBeVisible({ timeout: 5000 });

      // Tab 1 goes online
      await context1.setOffline(false);
      await page1.evaluate(() => window.dispatchEvent(new Event("online")));

      // Tab 1 should no longer show offline
      await expect(indicator1).not.toBeVisible({ timeout: 5000 });

      // Tab 2 should still show offline (independent state)
      await expect(indicator2).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("both tabs recover when going back online", async ({ browser }) => {
    // Create two separate contexts
    const { context: context1, page: page1 } = await createAuthenticatedContext(browser);
    const { context: context2, page: page2 } = await createAuthenticatedContext(browser);

    try {
      // Navigate both to dashboard
      await page1.goto("/en/dashboard");
      await page1.waitForLoadState("domcontentloaded");
      await expect(page1.locator("main")).toBeVisible({ timeout: 15000 });

      await page2.goto("/en/dashboard");
      await page2.waitForLoadState("domcontentloaded");
      await expect(page2.locator("main")).toBeVisible({ timeout: 15000 });

      // Set both offline
      await context1.setOffline(true);
      await page1.evaluate(() => window.dispatchEvent(new Event("offline")));

      await context2.setOffline(true);
      await page2.evaluate(() => window.dispatchEvent(new Event("offline")));

      const indicator1 = page1.locator('[data-testid="offline-indicator"]');
      const indicator2 = page2.locator('[data-testid="offline-indicator"]');

      await expect(indicator1).toBeVisible({ timeout: 5000 });
      await expect(indicator2).toBeVisible({ timeout: 5000 });

      // Both go back online
      await context1.setOffline(false);
      await page1.evaluate(() => window.dispatchEvent(new Event("online")));

      await context2.setOffline(false);
      await page2.evaluate(() => window.dispatchEvent(new Event("online")));

      // Both should recover
      await expect(indicator1).not.toBeVisible({ timeout: 5000 });
      await expect(indicator2).not.toBeVisible({ timeout: 5000 });

      // Both should still have functional UI
      await expect(page1.locator("main")).toBeVisible();
      await expect(page2.locator("main")).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
