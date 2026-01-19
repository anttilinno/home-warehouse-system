import { test as setup, expect } from "@playwright/test";

const TEST_NAME = "Playwright Test User";
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@test.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "TestPassword123!";
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // First, try to register a new user
  await page.goto("/en/register");

  // Fill in registration form
  await page.getByLabel(/full name|name/i).fill(TEST_NAME);
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);

  // Click register button
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();

  // Wait for either dashboard (success) or stay on page (user exists)
  await page.waitForTimeout(2000);

  // If we're still on register page or redirected to login, the user might exist
  // Try logging in instead
  if (!page.url().includes("/dashboard")) {
    await page.goto("/en/login");

    // Fill in credentials
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Click sign in button
    await page.getByRole("button", { name: /sign in|log in/i }).click();
  }

  // Wait for navigation to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
