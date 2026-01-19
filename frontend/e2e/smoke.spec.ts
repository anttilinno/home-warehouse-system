import { test, expect } from "./fixtures/test";

test.describe("Smoke tests", () => {
  test("home page loads successfully", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Home Warehouse/);
  });

  test("home page contains main content", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();
  });
});
