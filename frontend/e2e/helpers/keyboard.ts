import type { Page } from "@playwright/test";

/**
 * Detect if tests are running on macOS
 */
export function isMac(): boolean {
  return process.platform === "darwin";
}

/**
 * Get the modifier key for the current platform (Cmd on Mac, Ctrl on others)
 */
export function getModifierKey(): string {
  return isMac() ? "Meta" : "Control";
}

/**
 * Common keyboard shortcuts used throughout the application
 */
export const SHORTCUTS = {
  // Global shortcuts
  COMMAND_PALETTE: "k", // Cmd/Ctrl+K
  KEYBOARD_HELP: "/", // Cmd/Ctrl+/

  // Navigation shortcuts
  NEW_ITEM: "n", // Cmd/Ctrl+N

  // Selection shortcuts
  SELECT_ALL: "a", // Cmd/Ctrl+A

  // Export shortcuts
  EXPORT: "e", // Cmd/Ctrl+E

  // Common actions
  ESCAPE: "Escape",
  ENTER: "Enter",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  TAB: "Tab",
  SHIFT_TAB: "Shift+Tab",
} as const;

/**
 * Press a keyboard shortcut with the platform-appropriate modifier key
 *
 * @param page - Playwright page object
 * @param key - The key to press (without modifier)
 * @param options - Additional options
 * @param options.withModifier - Whether to press with Cmd/Ctrl modifier (default: true)
 * @param options.withShift - Whether to also press Shift
 */
export async function pressShortcut(
  page: Page,
  key: string,
  options: { withModifier?: boolean; withShift?: boolean } = {}
): Promise<void> {
  const { withModifier = true, withShift = false } = options;

  let keyCombo = "";

  if (withModifier) {
    keyCombo += `${getModifierKey()}+`;
  }

  if (withShift) {
    keyCombo += "Shift+";
  }

  keyCombo += key;

  await page.keyboard.press(keyCombo);
}

/**
 * Press a simple key without modifiers
 *
 * @param page - Playwright page object
 * @param key - The key to press
 */
export async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

/**
 * Type text into the currently focused element
 *
 * @param page - Playwright page object
 * @param text - The text to type
 */
export async function typeText(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/**
 * Press Tab multiple times to navigate through focusable elements
 *
 * @param page - Playwright page object
 * @param times - Number of times to press Tab
 * @param reverse - Whether to navigate in reverse (Shift+Tab)
 */
export async function tabNavigate(
  page: Page,
  times: number = 1,
  reverse: boolean = false
): Promise<void> {
  const key = reverse ? "Shift+Tab" : "Tab";
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
  }
}

/**
 * Check if an element is currently focused
 *
 * @param page - Playwright page object
 * @param selector - CSS selector for the element to check
 */
export async function isFocused(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element === document.activeElement;
  }, selector);
}

/**
 * Get the tag name of the currently focused element
 *
 * @param page - Playwright page object
 */
export async function getFocusedElementTag(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return document.activeElement?.tagName.toLowerCase() || null;
  });
}

/**
 * Check if focus is currently on an input field (input, textarea, select, contenteditable)
 *
 * @param page - Playwright page object
 */
export async function isFocusOnInputField(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return false;

    const tagName = active.tagName.toLowerCase();
    if (["input", "textarea", "select"].includes(tagName)) return true;

    if (active.getAttribute("contenteditable") === "true") return true;

    return false;
  });
}
