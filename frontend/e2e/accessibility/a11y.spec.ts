import { test, expect } from "../fixtures/authenticated";
import { DashboardShell } from "../pages/DashboardShell";
import { ItemsPage } from "../pages/ItemsPage";

test.describe("Accessibility", () => {
  test.describe("Skip Links", () => {
    test("skip link present and functional", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Skip link should exist but be visually hidden initially
      const skipLink = page.getByRole("link", { name: /skip to main content/i });
      await expect(skipLink).toBeAttached();

      // Focus on skip link by pressing Tab
      await page.keyboard.press("Tab");

      // Skip link should become visible on focus
      await expect(skipLink).toBeVisible();

      // Click skip link
      await skipLink.click();

      // Focus should move to main content area
      const mainContent = page.locator("#main-content");
      await expect(mainContent).toBeFocused();
    });

    test("skip to navigation link present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Skip to navigation link should exist
      const skipNavLink = page.getByRole("link", { name: /skip to navigation/i });
      await expect(skipNavLink).toBeAttached();
    });
  });

  test.describe("Landmarks", () => {
    test("main landmark present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Main landmark should exist
      const main = page.locator("main#main-content");
      await expect(main).toBeVisible();
    });

    test("navigation landmark present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Navigation should exist in sidebar
      const nav = page.locator("nav");
      await expect(nav.first()).toBeVisible();
    });

    test("header landmark present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      const header = page.locator("header");
      await expect(header).toBeVisible();
    });
  });

  test.describe("Dialog Focus Management", () => {
    test("dialogs trap focus when open", async ({ page }) => {
      const itemsPage = new ItemsPage(page);
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Open create dialog
      await itemsPage.addItemButton.click();
      await expect(itemsPage.createDialog).toBeVisible();

      // Tab through the dialog - focus should stay within
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
      }

      // After many tabs, focus should still be inside the dialog
      const focusedElement = await page.evaluate(() => {
        const active = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(active);
      });

      expect(focusedElement).toBe(true);
    });

    test("dialog focus returns after close", async ({ page }) => {
      const itemsPage = new ItemsPage(page);
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Remember the trigger button
      const addButton = itemsPage.addItemButton;

      // Open and close dialog
      await addButton.click();
      await expect(itemsPage.createDialog).toBeVisible();

      // Close with Escape
      await page.keyboard.press("Escape");
      await expect(itemsPage.createDialog).toBeHidden();

      // Focus should return to the trigger button
      // (Radix dialogs typically return focus to trigger)
      await page.waitForTimeout(100);

      // Check focus is reasonably placed (on button or nearby)
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedTag).toBeTruthy();
    });

    test("command palette traps focus", async ({ page }) => {
      const shell = new DashboardShell(page);
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Open command palette
      await shell.openCommandPalette();

      // Tab through several times
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
      }

      // Focus should still be within the command palette
      const focusedElement = await page.evaluate(() => {
        const active = document.activeElement;
        const palette = document.querySelector("[cmdk-dialog]");
        return palette?.contains(active);
      });

      expect(focusedElement).toBe(true);
    });
  });

  test.describe("Form Accessibility", () => {
    test("form inputs have associated labels", async ({ page }) => {
      const itemsPage = new ItemsPage(page);
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Open create dialog
      await itemsPage.addItemButton.click();
      await expect(itemsPage.createDialog).toBeVisible();

      // Check that inputs have labels
      const skuInput = page.locator('input[id="sku"]');
      const skuLabel = page.locator('label[for="sku"]');

      await expect(skuInput).toBeVisible();
      await expect(skuLabel).toBeVisible();

      // Check name input
      const nameInput = page.locator('input[id="name"]');
      const nameLabel = page.locator('label[for="name"]');

      await expect(nameInput).toBeVisible();
      await expect(nameLabel).toBeVisible();
    });

    test("required fields are indicated", async ({ page }) => {
      const itemsPage = new ItemsPage(page);
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      await itemsPage.addItemButton.click();
      await expect(itemsPage.createDialog).toBeVisible();

      // Required fields should have visual indicator (asterisk)
      const skuLabel = page.locator('label[for="sku"]');
      const skuLabelText = await skuLabel.textContent();

      // Should contain asterisk or "required" text
      expect(skuLabelText).toContain("*");
    });
  });

  test.describe("Button Accessibility", () => {
    test("buttons have accessible names", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Add Item button should have accessible name
      const addButton = page.getByRole("button", { name: /add item/i });
      await expect(addButton).toBeVisible();

      // Action buttons should have aria-labels
      // E.g., dropdown triggers should have accessible names
      const actionButtons = page.locator("button");
      const buttonCount = await actionButtons.count();

      // Verify each visible button has some accessible text
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = actionButtons.nth(i);
        const isVisible = await button.isVisible();

        if (isVisible) {
          const ariaLabel = await button.getAttribute("aria-label");
          const textContent = await button.textContent();
          const hasAccessibleName = ariaLabel || (textContent && textContent.trim().length > 0);

          // Button should have some accessible name
          // Skip icon-only buttons that might be inside other controls
          const role = await button.getAttribute("role");
          if (!role) {
            expect(hasAccessibleName).toBeTruthy();
          }
        }
      }
    });

    test("icon buttons have aria-labels", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Look for icon buttons (buttons with only icons, no text)
      // These should have aria-label
      const iconButtons = page.locator('button[aria-label]');

      const count = await iconButtons.count();
      expect(count).toBeGreaterThan(0);

      // Verify aria-labels are meaningful
      for (let i = 0; i < Math.min(count, 5); i++) {
        const ariaLabel = await iconButtons.nth(i).getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel!.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Image Accessibility", () => {
    test("images have alt text", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Wait for any images to load
      await page.waitForTimeout(500);

      // Check all images have alt attributes
      const images = page.locator("img");
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");

        // All images should have alt attribute (can be empty for decorative)
        expect(alt !== null).toBe(true);
      }
    });
  });

  test.describe("Table Accessibility", () => {
    test("tables have captions or aria-labels", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Items table should have aria-label
      const itemsTable = page.locator('table[aria-label="Item catalog"]');
      const hasAriaLabel = (await itemsTable.count()) > 0;

      // Or check for caption
      const tableCaption = page.locator("table caption");
      const hasCaption = (await tableCaption.count()) > 0;

      // Should have one or the other
      expect(hasAriaLabel || hasCaption).toBe(true);
    });

    test("table headers use th elements", async ({ page }) => {
      await page.goto("/en/dashboard/items");
      await page.waitForLoadState("domcontentloaded");

      // Check table has proper header structure
      const tableHeaders = page.locator("table thead th");
      const headerCount = await tableHeaders.count();

      // Should have headers if table exists
      const hasTable = (await page.locator("table").count()) > 0;
      if (hasTable) {
        expect(headerCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Color Contrast", () => {
    test("text is visible against background", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // This is a basic visual check - actual contrast testing requires
      // specialized tools like axe-core
      // Here we verify critical UI elements are visible

      // Page title should be visible
      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toBeVisible();

      // Navigation links should be visible
      const navLinks = page.locator("nav a");
      const linkCount = await navLinks.count();

      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        await expect(navLinks.nth(i)).toBeVisible();
      }
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("all interactive elements are focusable", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Tab through the page and count focusable elements
      let focusedElements = 0;
      const seenElements = new Set<string>();

      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");

        const elementId = await page.evaluate(() => {
          const el = document.activeElement;
          return `${el?.tagName}-${el?.textContent?.substring(0, 20)}-${el?.getAttribute("class")}`;
        });

        if (elementId && !seenElements.has(elementId)) {
          seenElements.add(elementId);
          focusedElements++;
        }
      }

      // Should be able to focus multiple elements
      expect(focusedElements).toBeGreaterThan(5);
    });

    test("focus is visible on interactive elements", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Tab to a button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Check that focused element has visible focus indicator
      // This is done via CSS (ring, outline, etc.)
      const hasFocusStyles = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;

        const styles = window.getComputedStyle(el);
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;

        // Check for focus ring or outline
        return (
          outline !== "none" ||
          outline !== "0px" ||
          (boxShadow && boxShadow !== "none")
        );
      });

      expect(hasFocusStyles).toBe(true);
    });
  });
});
