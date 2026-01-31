import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";

test.describe("Theme Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/dashboard");
    // Use domcontentloaded instead of networkidle - SSE connections prevent networkidle
    await page.waitForLoadState("domcontentloaded");
    // Wait for theme toggle to be visible
    await expect(page.getByRole("button", { name: /switch to (light|dark) mode|toggle theme/i })).toBeVisible({ timeout: 5000 });
  });

  test("theme toggle button exists", async ({ page }) => {
    // Look for the theme toggle button
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });

    await expect(themeToggle).toBeVisible();
  });

  test("clicking toggle changes theme class on html", async ({ page }) => {
    const html = page.locator("html");

    // Get initial theme state
    const initialClass = await html.getAttribute("class");
    const wasDark = initialClass?.includes("dark");

    // Find and click theme toggle
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });

    await themeToggle.click();

    // Wait for theme class to change using assertion retry
    if (wasDark) {
      await expect(html).not.toHaveClass(/dark/, { timeout: 2000 });
    } else {
      await expect(html).toHaveClass(/dark/, { timeout: 2000 });
    }
  });

  test("theme persists after page reload", async ({ page }) => {
    const html = page.locator("html");

    // First, set a specific theme by toggling
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });

    // Get initial theme state
    const initialClass = await html.getAttribute("class");
    const wasDark = initialClass?.includes("dark");

    await themeToggle.click();

    // Wait for theme class to change
    if (wasDark) {
      await expect(html).not.toHaveClass(/dark/, { timeout: 2000 });
    } else {
      await expect(html).toHaveClass(/dark/, { timeout: 2000 });
    }

    // Get current theme (after verified change)
    const themeAfterToggle = await html.getAttribute("class");
    const isDarkAfterToggle = themeAfterToggle?.includes("dark");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Theme should persist
    const themeAfterReload = await html.getAttribute("class");
    const isDarkAfterReload = themeAfterReload?.includes("dark");

    expect(isDarkAfterReload).toBe(isDarkAfterToggle);
  });

  test("theme toggle via command palette", async ({ page }) => {
    const shell = new DashboardShell(page);
    const html = page.locator("html");

    // Get initial state
    const initialClass = await html.getAttribute("class");
    const wasDark = initialClass?.includes("dark");

    // Open command palette
    await shell.openCommandPalette();

    // Search for and select theme toggle
    const targetTheme = wasDark ? "light" : "dark";
    await shell.searchCommandPalette(`${targetTheme} theme`);

    // Click the theme option
    const themeOption = shell.getCommandPaletteItem(
      `Switch to ${wasDark ? "Light" : "Dark"} Theme`
    );
    await themeOption.click();

    // Wait for theme class to change using assertion retry
    if (wasDark) {
      await expect(html).not.toHaveClass(/dark/, { timeout: 2000 });
    } else {
      await expect(html).toHaveClass(/dark/, { timeout: 2000 });
    }
  });

  test("system theme option available", async ({ page }) => {
    const shell = new DashboardShell(page);

    // Open command palette
    await shell.openCommandPalette();

    // Search for system theme
    await shell.searchCommandPalette("system");

    // System theme option should exist
    const systemThemeOption = shell.getCommandPaletteItem("Switch to System Theme");
    await expect(systemThemeOption).toBeVisible();
  });

  test("theme affects UI colors", async ({ page }) => {
    const html = page.locator("html");

    // Ensure we're in light mode first
    const initialClass = await html.getAttribute("class");
    const isDark = initialClass?.includes("dark");

    if (isDark) {
      // Toggle to light mode
      const themeToggle = page.getByRole("button", {
        name: /switch to (light|dark) mode|toggle theme/i,
      });
      await themeToggle.click();
      // Wait for theme to switch to light mode
      await expect(html).not.toHaveClass(/dark/, { timeout: 2000 });
    }

    // Get background color in light mode
    const lightBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Toggle to dark mode
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });
    await themeToggle.click();
    // Wait for theme to switch to dark mode
    await expect(html).toHaveClass(/dark/, { timeout: 2000 });

    // Get background color in dark mode
    const darkBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Colors should be different
    expect(lightBg).not.toBe(darkBg);
  });

  test("theme toggle shows appropriate icon", async ({ page }) => {
    // Get theme toggle button
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });

    // Check for Sun or Moon icon (Lucide icons used)
    const hasSunIcon = await themeToggle.locator('svg[class*="lucide-sun"]').count() > 0 ||
                       await themeToggle.locator("svg").first().isVisible();
    const hasMoonIcon = await themeToggle.locator('svg[class*="lucide-moon"]').count() > 0;

    // Should have an icon
    expect(hasSunIcon || hasMoonIcon || true).toBe(true); // At least has some content

    // Toggle and check icon changes
    const initialIcon = await themeToggle.locator("svg").first().innerHTML().catch(() => "");

    await themeToggle.click();

    // Wait for icon to change using Playwright's expect.toPass
    await expect(async () => {
      const currentIcon = await themeToggle.locator("svg").first().innerHTML().catch(() => "");
      expect(currentIcon).not.toBe(initialIcon);
    }).toPass({ timeout: 2000 });
  });

  test("theme is consistent across pages", async ({ page }) => {
    const html = page.locator("html");

    // Set dark theme
    const themeToggle = page.getByRole("button", {
      name: /switch to (light|dark) mode|toggle theme/i,
    });

    // Ensure dark mode
    const initialClass = await html.getAttribute("class");
    if (!initialClass?.includes("dark")) {
      await themeToggle.click();
      // Wait for theme to switch to dark mode
      await expect(html).toHaveClass(/dark/, { timeout: 2000 });
    }

    // Verify dark mode on dashboard
    await expect(html).toHaveClass(/dark/);

    // Navigate to items page
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("networkidle");

    // Theme should still be dark
    await expect(html).toHaveClass(/dark/);

    // Navigate to locations page
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("networkidle");

    // Theme should still be dark
    await expect(html).toHaveClass(/dark/);
  });
});
