import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";

test.describe("Dashboard Navigation", () => {
  let shell: DashboardShell;

  test.beforeEach(async ({ page }) => {
    shell = new DashboardShell(page);
    await page.goto("/en/dashboard");
    // Don't use networkidle - SSE connections keep it busy
    await page.waitForLoadState("domcontentloaded");
    // Wait for sidebar to be visible
    await expect(shell.sidebar).toBeVisible();
  });

  test("sidebar renders all navigation items", async ({ page }) => {
    // Core navigation items that should always be visible
    const expectedNavItems = [
      "Dashboard",
      "Items",
      "Locations",
      "Containers",
      "Categories",
      "Loans",
      "Borrowers",
      "Analytics",
      "Out of Stock",
      "Imports",
      "My Changes",
      "Settings",
    ];

    for (const item of expectedNavItems) {
      const navItem = shell.sidebarNavItem(item);
      await expect(navItem).toBeVisible();
    }
  });

  test('clicking "Items" navigates to /dashboard/items', async ({ page }) => {
    await shell.navigateTo("Items");
    await expect(page).toHaveURL(/\/dashboard\/items/);
  });

  test('clicking "Locations" navigates to /dashboard/locations', async ({ page }) => {
    await shell.navigateTo("Locations");
    await expect(page).toHaveURL(/\/dashboard\/locations/);
  });

  test('clicking "Containers" navigates to /dashboard/containers', async ({ page }) => {
    await shell.navigateTo("Containers");
    await expect(page).toHaveURL(/\/dashboard\/containers/);
  });

  test('clicking "Categories" navigates to /dashboard/categories', async ({ page }) => {
    await shell.navigateTo("Categories");
    await expect(page).toHaveURL(/\/dashboard\/categories/);
  });

  test('clicking "Loans" navigates to /dashboard/loans', async ({ page }) => {
    await shell.navigateTo("Loans");
    await expect(page).toHaveURL(/\/dashboard\/loans/);
  });

  test('clicking "Borrowers" navigates to /dashboard/borrowers', async ({ page }) => {
    await shell.navigateTo("Borrowers");
    await expect(page).toHaveURL(/\/dashboard\/borrowers/);
  });

  test("user menu opens on click", async ({ page }) => {
    await shell.openUserMenu();
    await expect(shell.userMenuDropdown).toBeVisible();
  });

  test("logout option is visible in user menu", async ({ page }) => {
    await shell.openUserMenu();

    const logoutItem = shell.userMenuDropdown.getByText(/log out/i);
    await expect(logoutItem).toBeVisible();
  });

  test("profile option is visible in user menu", async ({ page }) => {
    await shell.openUserMenu();

    const profileItem = shell.userMenuDropdown.getByText(/profile/i);
    await expect(profileItem).toBeVisible();
  });

  test("workspace name is displayed in switcher", async ({ page }) => {
    const workspaceName = await shell.getWorkspaceName();
    expect(workspaceName).toBeTruthy();
    // Workspace name should be a non-empty string
    expect(workspaceName?.length).toBeGreaterThan(0);
  });

  test("workspace switcher opens on click", async ({ page }) => {
    await shell.openWorkspaceSwitcher();

    // Dropdown content should be visible (uses data-slot from shadcn/ui)
    const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(dropdown).toBeVisible();

    // Should show "Workspaces" label
    await expect(dropdown.getByText(/workspaces/i)).toBeVisible();
  });

  test("sidebar collapse toggle works", async ({ page }) => {
    // Initial state - sidebar should be expanded (w-64)
    const sidebar = shell.sidebar;
    await expect(sidebar).toBeVisible();

    // Click the logo/toggle button to collapse
    const toggleButton = sidebar.locator("button").first();
    await toggleButton.click();

    // After collapse, sidebar should have narrower width (w-16)
    // We verify by checking if "Home Warehouse" text is hidden
    await expect(sidebar.getByText("Home Warehouse")).toBeHidden();

    // Click again to expand
    await toggleButton.click();
    await expect(sidebar.getByText("Home Warehouse")).toBeVisible();
  });

  test('clicking "Analytics" navigates to /dashboard/analytics', async ({ page }) => {
    await shell.navigateTo("Analytics");
    await expect(page).toHaveURL(/\/dashboard\/analytics/);
  });

  test('clicking "Out of Stock" navigates to /dashboard/out-of-stock', async ({ page }) => {
    await shell.navigateTo("Out of Stock");
    await expect(page).toHaveURL(/\/dashboard\/out-of-stock/);
  });

  test('clicking "Imports" navigates to /dashboard/imports', async ({ page }) => {
    await shell.navigateTo("Imports");
    await expect(page).toHaveURL(/\/dashboard\/imports/);
  });

  test('clicking "Settings" navigates to /dashboard/settings', async ({ page }) => {
    await shell.navigateTo("Settings");
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test('clicking "My Changes" navigates to /dashboard/my-changes', async ({ page }) => {
    await shell.navigateTo("My Changes");
    await expect(page).toHaveURL(/\/dashboard\/my-changes/);
  });

  test("active navigation item is highlighted", async ({ page }) => {
    // Dashboard should be active initially
    const dashboardLink = shell.sidebarNavItem("Dashboard");
    await expect(dashboardLink).toHaveClass(/bg-primary/);

    // Navigate to Items
    await shell.navigateTo("Items");

    // Items should now be active
    const itemsLink = shell.sidebarNavItem("Items");
    await expect(itemsLink).toHaveClass(/bg-primary/);

    // Dashboard should no longer be active
    const dashboardLinkAfter = shell.sidebarNavItem("Dashboard");
    await expect(dashboardLinkAfter).not.toHaveClass(/bg-primary/);
  });
});
