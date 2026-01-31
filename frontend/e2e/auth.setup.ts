import { test as setup, expect } from "@playwright/test";

const TEST_NAME = "Playwright Test User";
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@test.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "TestPassword123!";
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  console.log("[Auth Setup] Starting authentication...");

  // First, try to register a new user
  await page.goto("/en/register");
  console.log("[Auth Setup] Registration attempt...");

  // Fill in registration form
  await page.getByLabel(/full name|name/i).fill(TEST_NAME);
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByLabel(/confirm password/i).fill(TEST_PASSWORD);

  // Click register button
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();

  console.log("[Auth Setup] Submitted registration, waiting for response...");

  // Wait for either success redirect OR error (user exists) OR network error
  // Using Promise.race to handle all cases without arbitrary timeout
  try {
    await Promise.race([
      page.waitForURL(/\/dashboard/, { timeout: 10000 }),
      page.waitForURL(/\/login/, { timeout: 10000 }),
      expect(page.getByText(/already exists|already registered|email.*taken/i)).toBeVisible({ timeout: 10000 }),
    ]);
  } catch {
    // If none of the expected outcomes happened, log what we see
    console.log("[Auth Setup] Current URL after registration:", page.url());
  }

  console.log("[Auth Setup] After registration attempt, URL is:", page.url());

  // If not on dashboard, user exists - login instead
  if (!page.url().includes("/dashboard")) {
    console.log("[Auth Setup] User exists, logging in instead...");
    await page.goto("/en/login");

    // Fill in credentials
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Click sign in button
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }

  // CRITICAL: Verify authentication before saving state
  await expect(page).toHaveURL(/\/dashboard/);

  // Wait for the sidebar navigation to be visible
  // This ensures the page is fully loaded with authenticated content
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 5000 });

  console.log("[Auth Setup] Auth verified, saving state...");

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });

  console.log("[Auth Setup] Authentication complete.");
});
