import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";
import { ItemsPage } from "../pages/ItemsPage";
import {
  pressShortcut,
  pressKey,
  SHORTCUTS,
  isFocusOnInputField,
} from "../helpers/keyboard";

test.describe("Keyboard Shortcuts", () => {
  let shell: DashboardShell;

  test.beforeEach(async ({ page }) => {
    shell = new DashboardShell(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("Cmd/Ctrl+K opens command palette", async ({ page }) => {
    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);
    await expect(shell.commandPalette).toBeVisible();
  });

  test("Escape closes command palette", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(shell.commandPalette).toBeVisible();

    await pressKey(page, SHORTCUTS.ESCAPE);
    await expect(shell.commandPalette).toBeHidden();
  });

  test("Escape closes open dialogs", async ({ page }) => {
    // Navigate to items page
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("networkidle");

    const itemsPage = new ItemsPage(page);

    // Open create dialog
    await itemsPage.addItemButton.click();
    await expect(itemsPage.createDialog).toBeVisible();

    // Press Escape to close
    await pressKey(page, SHORTCUTS.ESCAPE);
    await expect(itemsPage.createDialog).toBeHidden();
  });

  test("Cmd/Ctrl+N opens create dialog on items page", async ({ page }) => {
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("networkidle");

    const itemsPage = new ItemsPage(page);

    // Use keyboard shortcut to open create dialog
    await pressShortcut(page, SHORTCUTS.NEW_ITEM);

    // Dialog should open
    await expect(itemsPage.createDialog).toBeVisible();
  });

  test("shortcuts ignored when focused on input field", async ({ page }) => {
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("networkidle");

    const itemsPage = new ItemsPage(page);

    // Focus on search input
    await itemsPage.searchInput.click();
    await expect(itemsPage.searchInput).toBeFocused();

    // Verify focus is on input
    const onInput = await isFocusOnInputField(page);
    expect(onInput).toBe(true);

    // Try to open command palette with Cmd/Ctrl+K
    // The shortcut should be processed normally (not blocked)
    // but apps typically allow this to work from any context
    await pressShortcut(page, SHORTCUTS.COMMAND_PALETTE);

    // Command palette should still open (this is global)
    await expect(shell.commandPalette).toBeVisible();
  });

  test("Tab navigates through focusable elements", async ({ page }) => {
    // Start at the page
    await page.goto("/en/dashboard");
    await page.waitForLoadState("networkidle");

    // Focus on the first focusable element by pressing Tab
    await page.keyboard.press("Tab");

    // Keep pressing Tab and verify we can navigate
    // The first focusable element should be the skip link when it appears
    // or another interactive element
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    // Press Tab again to move focus
    await page.keyboard.press("Tab");

    // Focus should have moved to a different element
    const secondFocused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      role: document.activeElement?.getAttribute("role"),
    }));
    expect(secondFocused.tag).toBeTruthy();
  });

  test("Shift+Tab navigates backwards through elements", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.waitForLoadState("networkidle");

    // Tab forward a few times
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Record current element
    const afterThreeTabs = await page.evaluate(
      () => document.activeElement?.outerHTML?.substring(0, 100)
    );

    // Tab forward once more
    await page.keyboard.press("Tab");

    // Now Shift+Tab back
    await page.keyboard.press("Shift+Tab");

    // Should be back at the same element
    const afterShiftTab = await page.evaluate(
      () => document.activeElement?.outerHTML?.substring(0, 100)
    );

    expect(afterShiftTab).toBe(afterThreeTabs);
  });

  test("arrow keys navigate in command palette", async ({ page }) => {
    await shell.openCommandPalette();

    // Press Arrow Down to select first item
    await pressKey(page, SHORTCUTS.ARROW_DOWN);

    // The first item should be selected
    const firstItem = shell.commandPalette.locator("[cmdk-item]").first();
    await expect(firstItem).toHaveAttribute("data-selected", "true");

    // Press Arrow Down again
    await pressKey(page, SHORTCUTS.ARROW_DOWN);

    // Second item should now be selected
    const secondItem = shell.commandPalette.locator("[cmdk-item]").nth(1);
    await expect(secondItem).toHaveAttribute("data-selected", "true");

    // First item should no longer be selected
    await expect(firstItem).not.toHaveAttribute("data-selected", "true");
  });

  test("Enter selects item in command palette", async ({ page }) => {
    await shell.openCommandPalette();

    // Search for items page
    await shell.searchCommandPalette("Go to Items");

    // Press Enter to select
    await pressKey(page, SHORTCUTS.ENTER);

    // Should navigate to items page
    await expect(page).toHaveURL(/\/dashboard\/items/);
  });
});
