import { test as setup, expect } from "@playwright/test";

const TEST_NAME = "Playwright Test User";
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@test.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "TestPassword123!";
const AUTH_FILE = "playwright/.auth/user.json";

// Set a 30 second total timeout for auth setup
// Note: Backend has rate limiting (5 requests/minute) on auth endpoints.
// Running auth setup multiple times rapidly may hit 429 errors.
// In normal E2E runs, auth setup runs once and state is reused.
setup.setTimeout(30000);

setup("authenticate", async ({ page }) => {
  console.log("[Auth Setup] Starting authentication...");

  try {
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

      // Navigate to login page
      await page.goto("/en/login");
      await page.waitForLoadState("domcontentloaded");

      // Wait for form to be fully loaded and hydrated
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible({ timeout: 5000 });

      // Type slowly to ensure form state updates properly
      await emailInput.click();
      await emailInput.fill(TEST_EMAIL);
      // Tab to trigger blur and mark field as "touched"
      await page.keyboard.press("Tab");

      const passwordInput = page.getByLabel(/password/i);
      await passwordInput.fill(TEST_PASSWORD);
      // Tab again to trigger validation
      await page.keyboard.press("Tab");

      // Wait for sign in button to be ready and form validation to complete
      const signInButton = page.getByRole("button", { name: /sign in|log in/i });
      await expect(signInButton).toBeEnabled({ timeout: 5000 });

      // Wait for form to be fully hydrated
      await page.waitForLoadState("domcontentloaded");

      console.log("[Auth Setup] Submitting login form...");

      // Submit login form by clicking the button
      // Note: Sometimes the first attempt doesn't work due to hydration, so we retry
      let loginSuccess = false;
      for (let attempt = 1; attempt <= 3 && !loginSuccess; attempt++) {
        try {
          // Set up monitoring for the login API call
          const responsePromise = page.waitForResponse(
            (response) => response.url().includes("/auth/login") && response.request().method() === "POST",
            { timeout: 8000 }
          );

          // Set up monitoring for navigation
          const navigationPromise = page.waitForURL(/\/dashboard/, { timeout: 10000 });

          // Click the sign in button
          await signInButton.click();

          console.log(`[Auth Setup] Attempt ${attempt}: Waiting for API response...`);

          // Wait for the API response first
          const response = await responsePromise;
          console.log(`[Auth Setup] Attempt ${attempt}: Got API response: ${response.status()}`);

          // Then wait for navigation
          await navigationPromise;
          loginSuccess = true;
        } catch (e) {
          console.log(`[Auth Setup] Login attempt ${attempt} failed, URL: ${page.url()}, error: ${e instanceof Error ? e.message : e}`);
          if (attempt === 3) throw e;
          // If we're still on login page, wait a bit and try again
          if (page.url().includes("/login")) {
            // Wait for DOM to settle before retry
            await page.waitForLoadState("domcontentloaded");
            continue;
          }
          throw e;
        }
      }
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
  } catch (error) {
    // On any failure, take a screenshot for debugging
    console.error("[Auth Setup] Authentication failed:", error);
    await page.screenshot({ path: "playwright/.auth/auth-setup-failure.png" });
    throw new Error(`Auth setup failed at URL ${page.url()}: ${error instanceof Error ? error.message : String(error)}`);
  }
});
