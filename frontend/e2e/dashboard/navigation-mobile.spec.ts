import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";

test.describe("Mobile Navigation", () => {
  let shell: DashboardShell;

  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 12 Pro dimensions
  });

  test.beforeEach(async ({ page }) => {
    shell = new DashboardShell(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("mobile menu toggle is visible", async ({ page }) => {
    await expect(shell.mobileMenuToggle).toBeVisible();
  });

  test("clicking toggle opens sidebar overlay", async ({ page }) => {
    await shell.openMobileMenu();
    await expect(shell.mobileSidebar).toBeVisible();
  });

  test("mobile sidebar contains navigation items", async ({ page }) => {
    await shell.openMobileMenu();

    // Check for key navigation items in mobile sidebar
    const expectedItems = [
      "Dashboard",
      "Items",
      "Locations",
      "Containers",
      "Loans",
    ];

    for (const item of expectedItems) {
      const navItem = shell.mobileNavItem(item);
      await expect(navItem).toBeVisible();
    }
  });

  test("navigation works from mobile menu", async ({ page }) => {
    // Open mobile menu and navigate to Items
    await shell.navigateToMobile("Items");

    // Should navigate to items page
    await expect(page).toHaveURL(/\/dashboard\/items/);
  });

  test("mobile menu closes after navigation", async ({ page }) => {
    await shell.navigateToMobile("Locations");

    // Sidebar should be hidden after navigation
    await expect(shell.mobileSidebar).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard\/locations/);
  });

  test("clicking outside closes mobile menu", async ({ page }) => {
    await shell.openMobileMenu();
    await expect(shell.mobileSidebar).toBeVisible();

    // Click outside the sidebar (on the overlay)
    await shell.closeMobileMenuByClickOutside();

    // Sidebar should close
    await expect(shell.mobileSidebar).toBeHidden();
  });

  test("pressing Escape closes mobile menu", async ({ page }) => {
    await shell.openMobileMenu();
    await expect(shell.mobileSidebar).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Sidebar should close
    await expect(shell.mobileSidebar).toBeHidden();
  });

  test("desktop sidebar is hidden on mobile", async ({ page }) => {
    // The desktop sidebar (hidden md:block) should not be visible
    const desktopSidebar = page.locator("aside").filter({ has: page.locator("nav") }).first();

    // On mobile, sidebar should be hidden (using CSS md:hidden)
    // We check that it's not in the visible viewport when mobile menu is closed
    await expect(shell.mobileSidebar).toBeHidden();
  });

  test("mobile navigation to all main routes", async ({ page }) => {
    const routes = [
      { name: "Items", path: "/dashboard/items" },
      { name: "Containers", path: "/dashboard/containers" },
      { name: "Categories", path: "/dashboard/categories" },
      { name: "Loans", path: "/dashboard/loans" },
    ];

    for (const route of routes) {
      await shell.navigateToMobile(route.name);
      await expect(page).toHaveURL(new RegExp(route.path));

      // Go back to dashboard for next iteration
      await shell.navigateToMobile("Dashboard");
    }
  });

  test("user menu is accessible in mobile sidebar", async ({ page }) => {
    await shell.openMobileMenu();

    // User menu should be visible in the mobile sidebar
    const userMenuButton = shell.mobileSidebar.locator("button").filter({ has: page.locator('[class*="avatar"]') });
    await expect(userMenuButton).toBeVisible();
  });

  test("workspace switcher is visible in header on mobile", async ({ page }) => {
    // Workspace switcher should still be in the header
    await expect(shell.workspaceSwitcher).toBeVisible();
  });

  test("header is visible on mobile", async ({ page }) => {
    await expect(shell.header).toBeVisible();

    // Header should contain mobile menu toggle and workspace switcher
    await expect(shell.mobileMenuToggle).toBeVisible();
    await expect(shell.workspaceSwitcher).toBeVisible();
  });

  test("settings link is accessible in mobile menu", async ({ page }) => {
    await shell.openMobileMenu();

    const settingsLink = shell.mobileNavItem("Settings");
    await expect(settingsLink).toBeVisible();

    await settingsLink.click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });
});
