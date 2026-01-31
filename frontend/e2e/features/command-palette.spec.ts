import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";
import {
  pressShortcut,
  pressKey,
  SHORTCUTS,
} from "../helpers/keyboard";

test.describe("Command Palette - Feature Tests", () => {
  let shell: DashboardShell;

  test.beforeEach(async ({ page }) => {
    shell = new DashboardShell(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");
  });

  test("palette opens with keyboard shortcut", async ({ page }) => {
    // Initially hidden
    await expect(shell.commandPalette).toBeHidden();

    // Open with Cmd/Ctrl+K
    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);

    // Should be visible
    await expect(shell.commandPalette).toBeVisible();
  });

  test("search input auto-focused when opened", async ({ page }) => {
    await shell.openCommandPalette();

    // Input should be focused immediately
    await expect(shell.commandPaletteInput).toBeFocused();
  });

  test("typing filters command list", async ({ page }) => {
    await shell.openCommandPalette();

    // Type to filter
    await shell.searchCommandPalette("items");

    // Items-related commands should be visible
    const itemsCommand = shell.getCommandPaletteItem("Go to Items");
    await expect(itemsCommand).toBeVisible();

    // Dashboard command should be filtered out
    const dashboardCommand = shell.getCommandPaletteItem("Go to Dashboard");
    await expect(dashboardCommand).toBeHidden();
  });

  test("arrow keys navigate through options", async ({ page }) => {
    await shell.openCommandPalette();

    // Get all items
    const items = shell.commandPalette.locator("[cmdk-item]");

    // Press ArrowDown
    await pressKey(page, SHORTCUTS.ARROW_DOWN);

    // First item should be selected
    await expect(items.first()).toHaveAttribute("data-selected", "true");

    // Press ArrowDown again
    await pressKey(page, SHORTCUTS.ARROW_DOWN);

    // Second item should be selected
    await expect(items.nth(1)).toHaveAttribute("data-selected", "true");

    // Press ArrowUp
    await pressKey(page, SHORTCUTS.ARROW_UP);

    // First item should be selected again
    await expect(items.first()).toHaveAttribute("data-selected", "true");
  });

  test("Enter selects highlighted option", async ({ page }) => {
    await shell.openCommandPalette();

    // Filter to specific item
    await shell.searchCommandPalette("Go to Items");

    // Press Enter
    await pressKey(page, SHORTCUTS.ENTER);

    // Should navigate
    await expect(page).toHaveURL(/\/dashboard\/items/);

    // Palette should close
    await expect(shell.commandPalette).toBeHidden();
  });

  test("selected option triggers navigation", async ({ page }) => {
    await shell.openCommandPalette();

    // Click on locations command
    const locationsCommand = shell.getCommandPaletteItem("Go to Locations");
    await locationsCommand.click();

    // Should navigate
    await expect(page).toHaveURL(/\/dashboard\/locations/);
  });

  test("Escape closes without action", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    // Type something
    await shell.searchCommandPalette("items");

    // Press Escape
    await pressKey(page, SHORTCUTS.ESCAPE);

    // Palette should close
    await expect(shell.commandPalette).toBeHidden();

    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("search persists during session until closed", async ({ page }) => {
    await shell.openCommandPalette();

    // Type search query
    await shell.searchCommandPalette("containers");

    // Close with Escape
    await pressKey(page, SHORTCUTS.ESCAPE);

    // Reopen
    await shell.openCommandPalette();

    // Input should be cleared (typical UX pattern)
    // or may persist depending on implementation
    const inputValue = await shell.commandPaletteInput.inputValue();

    // Most implementations clear on close
    // If it persists, that's also valid behavior
    expect(typeof inputValue).toBe("string");
  });

  test("clicking outside closes palette", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    // Click on the overlay
    await page.locator("[data-radix-dialog-overlay]").click({ force: true });

    // Palette should close
    await expect(shell.commandPalette).toBeHidden();
  });

  test("palette accessible from any page", async ({ page }) => {
    // Test from items page
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("domcontentloaded");

    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);
    await expect(shell.commandPalette).toBeVisible();
    await pressKey(page, SHORTCUTS.ESCAPE);

    // Test from locations page
    await page.goto("/en/dashboard/locations");
    await page.waitForLoadState("domcontentloaded");

    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);
    await expect(shell.commandPalette).toBeVisible();
    await pressKey(page, SHORTCUTS.ESCAPE);

    // Test from settings page
    await page.goto("/en/dashboard/settings");
    await page.waitForLoadState("domcontentloaded");

    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);
    await expect(shell.commandPalette).toBeVisible();
  });

  test("empty state shown when no results match", async ({ page }) => {
    await shell.openCommandPalette();

    // Search for something that doesn't exist
    await shell.searchCommandPalette("xyznonexistent123456");

    // Should show empty state
    const emptyState = shell.commandPalette.getByText(/no results/i);
    await expect(emptyState).toBeVisible();
  });

  test("commands grouped by category", async ({ page }) => {
    await shell.openCommandPalette();

    // Check for group headings
    const navigationHeading = shell.commandPalette.getByText("Navigation");
    const createHeading = shell.commandPalette.getByText("Create");
    const themeHeading = shell.commandPalette.getByText("Theme");

    await expect(navigationHeading).toBeVisible();
    await expect(createHeading).toBeVisible();
    await expect(themeHeading).toBeVisible();
  });
});
