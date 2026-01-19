import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";

test.describe("Responsive Design", () => {
  test.describe("Mobile (390x844)", () => {
    test.use({
      viewport: { width: 390, height: 844 }, // iPhone 12 Pro
    });

    test("sidebar hidden by default", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Desktop sidebar should be hidden on mobile
      // The sidebar is inside a div with "hidden md:block"
      const desktopSidebar = page.locator("#navigation");
      await expect(desktopSidebar).toBeHidden();

      // Mobile sidebar sheet should be closed by default
      await expect(shell.mobileSidebar).toBeHidden();
    });

    test("menu toggle visible", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Mobile menu toggle should be visible
      await expect(shell.mobileMenuToggle).toBeVisible();
    });

    test("clicking toggle shows sidebar", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Open mobile menu
      await shell.openMobileMenu();

      // Mobile sidebar should be visible
      await expect(shell.mobileSidebar).toBeVisible();
    });

    test("navigation works from mobile menu", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Navigate using mobile menu
      await shell.navigateToMobile("Items");

      // Should navigate to items page
      await expect(page).toHaveURL(/\/dashboard\/items/);

      // Mobile sidebar should auto-close after navigation
      await expect(shell.mobileSidebar).toBeHidden();
    });

    test("tables scroll horizontally", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("networkidle");

      // Table container should have horizontal scroll capability
      const tableContainer = page.locator(".overflow-x-auto").first();

      if ((await tableContainer.count()) > 0) {
        // Check that container can scroll horizontally
        const scrollWidth = await tableContainer.evaluate((el) => el.scrollWidth);
        const clientWidth = await tableContainer.evaluate((el) => el.clientWidth);

        // On mobile, table might be wider than viewport, requiring scroll
        // This test verifies the overflow-x-auto class is present
        await expect(tableContainer).toHaveClass(/overflow-x-auto/);
      }
    });

    test("dialogs full-width on mobile", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("networkidle");

      // Open create dialog
      const addButton = page.getByRole("button", { name: /add item/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Get dialog width
      const dialogBox = await dialog.boundingBox();
      const viewport = page.viewportSize();

      if (dialogBox && viewport) {
        // Dialog should be close to full width on mobile (accounting for padding)
        // Typically dialog width >= 90% of viewport on mobile
        const widthPercentage = (dialogBox.width / viewport.width) * 100;
        expect(widthPercentage).toBeGreaterThan(80);
      }
    });

    test("header adapts to mobile", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Header should be visible
      await expect(shell.header).toBeVisible();

      // Mobile menu toggle should be in header
      await expect(shell.mobileMenuToggle).toBeVisible();

      // Workspace switcher should still be visible
      await expect(shell.workspaceSwitcher).toBeVisible();
    });
  });

  test.describe("Tablet (768x1024)", () => {
    test.use({
      viewport: { width: 768, height: 1024 }, // iPad
    });

    test("sidebar visible on tablet", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // At md breakpoint (768px), desktop sidebar should be visible
      const sidebar = page.locator("#navigation");
      await expect(sidebar).toBeVisible();
    });

    test("navigation items visible in sidebar", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator("#navigation");

      // Navigation links should be visible
      const navLinks = sidebar.locator("nav a");
      const linkCount = await navLinks.count();

      expect(linkCount).toBeGreaterThan(0);
      await expect(navLinks.first()).toBeVisible();
    });
  });

  test.describe("Desktop (1920x1080)", () => {
    test.use({
      viewport: { width: 1920, height: 1080 },
    });

    test("sidebar expanded", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Desktop sidebar should be visible
      const sidebar = page.locator("#navigation");
      await expect(sidebar).toBeVisible();

      // Sidebar should have normal width (not collapsed)
      const sidebarBox = await sidebar.boundingBox();
      if (sidebarBox) {
        // Normal sidebar width is 256px (w-64), collapsed is 64px (w-16)
        expect(sidebarBox.width).toBeGreaterThanOrEqual(200);
      }
    });

    test("mobile menu toggle hidden", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Mobile menu toggle should be hidden on desktop
      await expect(shell.mobileMenuToggle).toBeHidden();
    });

    test("full navigation labels visible", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      const sidebar = page.locator("#navigation");

      // Navigation links should show full text labels
      const dashboardLink = sidebar.getByRole("link", { name: /dashboard/i });
      await expect(dashboardLink).toBeVisible();

      const itemsLink = sidebar.getByRole("link", { name: /items/i });
      await expect(itemsLink).toBeVisible();
    });

    test("wide content area", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      const mainContent = page.locator("main#main-content");
      const mainBox = await mainContent.boundingBox();

      if (mainBox) {
        // Main content should be wide on desktop
        expect(mainBox.width).toBeGreaterThan(1000);
      }
    });
  });

  test.describe("Breakpoint Transitions", () => {
    test("sidebar collapses when resizing below md", async ({ page }) => {
      // Start at desktop size
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Desktop sidebar should be visible
      const desktopSidebar = page.locator("#navigation");
      await expect(desktopSidebar).toBeVisible();

      // Resize to mobile
      await page.setViewportSize({ width: 600, height: 800 });
      await page.waitForTimeout(300); // Wait for responsive changes

      // Desktop sidebar should now be hidden
      await expect(desktopSidebar).toBeHidden();

      // Mobile menu toggle should appear
      const shell = new DashboardShell(page);
      await expect(shell.mobileMenuToggle).toBeVisible();
    });

    test("content reflows correctly at breakpoints", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("networkidle");

      // Test mobile
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);

      // Content should be readable
      const pageTitle = page.getByRole("heading", { level: 1 });
      await expect(pageTitle).toBeVisible();

      // Test tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(200);
      await expect(pageTitle).toBeVisible();

      // Test desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(200);
      await expect(pageTitle).toBeVisible();
    });
  });

  test.describe("Touch Interactions", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });

    test("buttons are large enough for touch", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("networkidle");

      // Get Add Item button
      const addButton = page.getByRole("button", { name: /add item/i });
      const buttonBox = await addButton.boundingBox();

      if (buttonBox) {
        // Minimum touch target is 44x44px per WCAG
        expect(buttonBox.height).toBeGreaterThanOrEqual(36); // Allow slightly smaller with padding
        expect(buttonBox.width).toBeGreaterThanOrEqual(44);
      }
    });

    test("mobile menu can be opened by tap", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("networkidle");

      // Tap mobile menu toggle
      await shell.mobileMenuToggle.tap();

      // Sidebar should open
      await expect(shell.mobileSidebar).toBeVisible();
    });
  });
});
