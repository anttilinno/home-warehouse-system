import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";

test.describe("Command Palette", () => {
  let shell: DashboardShell;

  test.beforeEach(async ({ page }) => {
    shell = new DashboardShell(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("Cmd/Ctrl+K opens command palette", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();
  });

  test("palette has search input focused", async ({ page }) => {
    await shell.openCommandPalette();

    // The input should be focused
    await expect(shell.commandPaletteInput).toBeFocused();
  });

  test("typing filters available commands", async ({ page }) => {
    await shell.openCommandPalette();

    // Type "items" to filter
    await shell.searchCommandPalette("items");

    // Should show "Go to Items" command
    const itemsCommand = shell.getCommandPaletteItem("Go to Items");
    await expect(itemsCommand).toBeVisible();

    // Other unrelated commands should be filtered out
    const dashboardCommand = shell.getCommandPaletteItem("Go to Dashboard");
    await expect(dashboardCommand).toBeHidden();
  });

  test("Escape closes palette", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    await shell.closeCommandPalette();
    await expect(shell.commandPalette).toBeHidden();
  });

  test("clicking option navigates", async ({ page }) => {
    await shell.openCommandPalette();

    // Click on "Go to Items"
    const itemsCommand = shell.getCommandPaletteItem("Go to Items");
    await itemsCommand.click();

    // Should navigate to items page
    await expect(page).toHaveURL(/\/dashboard\/items/);

    // Palette should be closed
    await expect(shell.commandPalette).toBeHidden();
  });

  test("navigation commands are displayed", async ({ page }) => {
    await shell.openCommandPalette();

    // Check for navigation group heading
    const navigationHeading = shell.commandPalette.getByText("Navigation");
    await expect(navigationHeading).toBeVisible();

    // Check for key navigation commands
    const navigationCommands = [
      "Go to Dashboard",
      "Go to Items",
      "Go to Locations",
      "Go to Containers",
      "Go to Loans",
      "Go to Borrowers",
    ];

    for (const command of navigationCommands) {
      const item = shell.getCommandPaletteItem(command);
      await expect(item).toBeVisible();
    }
  });

  test("create commands are displayed", async ({ page }) => {
    await shell.openCommandPalette();

    // Check for create group heading
    const createHeading = shell.commandPalette.getByText("Create");
    await expect(createHeading).toBeVisible();

    // Check for create commands
    const createCommands = [
      "Create New Item",
      "Create New Loan",
      "Create New Borrower",
      "Create New Container",
    ];

    for (const command of createCommands) {
      const item = shell.getCommandPaletteItem(command);
      await expect(item).toBeVisible();
    }
  });

  test("theme commands are displayed", async ({ page }) => {
    await shell.openCommandPalette();

    // Check for theme group heading
    const themeHeading = shell.commandPalette.getByText("Theme");
    await expect(themeHeading).toBeVisible();

    // Check for theme commands
    const themeCommands = [
      "Switch to Light Theme",
      "Switch to Dark Theme",
      "Switch to System Theme",
    ];

    for (const command of themeCommands) {
      const item = shell.getCommandPaletteItem(command);
      await expect(item).toBeVisible();
    }
  });

  test("keyboard navigation works in palette", async ({ page }) => {
    await shell.openCommandPalette();

    // Press Arrow Down to select first item
    await page.keyboard.press("ArrowDown");

    // The first item should have some visual indicator of selection
    const firstItem = shell.commandPalette.locator("[cmdk-item]").first();
    await expect(firstItem).toHaveAttribute("data-selected", "true");

    // Press Arrow Down again
    await page.keyboard.press("ArrowDown");

    // First item should no longer be selected
    const secondItem = shell.commandPalette.locator("[cmdk-item]").nth(1);
    await expect(secondItem).toHaveAttribute("data-selected", "true");

    // Press Arrow Up to go back
    await page.keyboard.press("ArrowUp");
    await expect(firstItem).toHaveAttribute("data-selected", "true");
  });

  test("Enter key selects current item", async ({ page }) => {
    await shell.openCommandPalette();

    // Navigate to "Go to Items"
    await shell.searchCommandPalette("Go to Items");

    // Press Enter to select
    await page.keyboard.press("Enter");

    // Should navigate to items page
    await expect(page).toHaveURL(/\/dashboard\/items/);
  });

  test("theme switching works from command palette", async ({ page }) => {
    await shell.openCommandPalette();

    // Search for dark theme
    await shell.searchCommandPalette("dark");

    // Click dark theme option
    const darkThemeCommand = shell.getCommandPaletteItem("Switch to Dark Theme");
    await darkThemeCommand.click();

    // Theme should change - check html element has dark class
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Now switch to light
    await shell.openCommandPalette();
    await shell.searchCommandPalette("light");
    const lightThemeCommand = shell.getCommandPaletteItem("Switch to Light Theme");
    await lightThemeCommand.click();

    // Should no longer have dark class
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("shows empty state when no results", async ({ page }) => {
    await shell.openCommandPalette();

    // Search for something that doesn't exist
    await shell.searchCommandPalette("xyznonexistent123");

    // Should show "No results found"
    const emptyState = shell.commandPalette.getByText(/no results/i);
    await expect(emptyState).toBeVisible();
  });

  test("command palette can be reopened after closing", async ({ page }) => {
    // Open
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    // Close
    await shell.closeCommandPalette();
    await expect(shell.commandPalette).toBeHidden();

    // Open again
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();
  });

  test("clicking outside closes palette", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    // Click outside the dialog (on the overlay)
    await page.locator("[data-radix-dialog-overlay]").click({ force: true });

    // Palette should close
    await expect(shell.commandPalette).toBeHidden();
  });

  test("create new item command navigates with action param", async ({ page }) => {
    await shell.openCommandPalette();

    const createItemCommand = shell.getCommandPaletteItem("Create New Item");
    await createItemCommand.click();

    // Should navigate to items page with action=create param
    await expect(page).toHaveURL(/\/dashboard\/items\?action=create/);
  });
});
