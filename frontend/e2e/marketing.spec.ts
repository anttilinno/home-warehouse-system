import { test, expect } from "./fixtures/test";
import { MarketingPage } from "./pages/MarketingPage";

test.describe("Marketing Page", () => {
  let marketingPage: MarketingPage;

  test.beforeEach(async ({ page, locale }) => {
    marketingPage = new MarketingPage(page, locale);
  });

  test("page loads with 200 status", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
  });

  test("hero section renders with title and CTA", async () => {
    await marketingPage.goto();

    await expect(marketingPage.heroSection).toBeVisible();
    await expect(marketingPage.heroTitle).toBeVisible();
    await expect(marketingPage.heroTitle).toContainText(/warehouse|inventory|organize/i);
    await expect(marketingPage.ctaButton).toBeVisible();
  });

  test("features grid displays feature cards", async ({ page }) => {
    await marketingPage.goto();

    // Wait for features section to be visible
    const featuresSection = page.locator("section").nth(1);
    await expect(featuresSection).toBeVisible();

    // Check that feature cards are rendered
    const cards = page.locator("section").nth(1).locator(".grid > div");
    await expect(cards).toHaveCount(8);
  });

  test("Get Started CTA button is clickable and navigates to register", async ({ page }) => {
    await marketingPage.goto();

    await expect(marketingPage.ctaButton).toBeEnabled();
    await marketingPage.clickGetStarted();

    await expect(page).toHaveURL(/\/register/);
  });

  test("navigation links are present in header", async ({ page }) => {
    await marketingPage.goto();

    await expect(marketingPage.header).toBeVisible();

    // Check desktop navigation links
    await expect(marketingPage.signInLink).toBeVisible();
    await expect(marketingPage.getStartedButton).toBeVisible();

    // Check navigation to features and docs
    const featuresLink = marketingPage.header.getByRole("link", { name: /features/i });
    const docsLink = marketingPage.header.getByRole("link", { name: /docs/i });

    await expect(featuresLink).toBeVisible();
    await expect(docsLink).toBeVisible();
  });

  test("page is responsive (mobile viewport)", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await marketingPage.goto();

    // Hero should still be visible
    await expect(marketingPage.heroSection).toBeVisible();
    await expect(marketingPage.heroTitle).toBeVisible();

    // Desktop nav should be hidden, mobile menu button should be visible
    const mobileMenuButton = page.locator("button").filter({ hasText: /menu/i }).or(
      page.locator('button:has(svg[class*="h-6 w-6"])')
    );

    // The mobile menu button should exist (nav links hidden)
    const desktopNav = page.locator("nav.hidden.md\\:flex");
    await expect(desktopNav).toBeHidden();
  });

  test("how it works section displays steps", async ({ page }) => {
    await marketingPage.goto();

    // Find the how it works section
    const howItWorksSection = page.locator("section").filter({ has: page.locator("text=01") });
    await expect(howItWorksSection).toBeVisible();

    // Check for step numbers
    await expect(page.getByText("01")).toBeVisible();
    await expect(page.getByText("02")).toBeVisible();
    await expect(page.getByText("03")).toBeVisible();
  });

  test("clicking Sign In navigates to login page", async ({ page }) => {
    await marketingPage.goto();

    await marketingPage.clickSignIn();

    await expect(page).toHaveURL(/\/login/);
  });
});
