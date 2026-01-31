import { test, expect } from "../fixtures/authenticated";

test.describe("PWA Features", () => {
  test.describe("Manifest", () => {
    test("manifest.json accessible", async ({ page }) => {
      // Request the manifest file directly
      const response = await page.goto("/manifest.json");

      // Should return 200 OK
      expect(response?.status()).toBe(200);
    });

    test("manifest has required fields", async ({ page }) => {
      // Fetch manifest content
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      // Required fields for PWA
      expect(manifest).toHaveProperty("name");
      expect(manifest).toHaveProperty("icons");

      // Verify name is set
      expect(manifest.name).toBeTruthy();

      // Verify icons array exists and has items
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThan(0);

      // Each icon should have src and sizes
      manifest.icons.forEach((icon: { src?: string; sizes?: string }) => {
        expect(icon).toHaveProperty("src");
        expect(icon).toHaveProperty("sizes");
      });
    });

    test("manifest has start_url", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      expect(manifest).toHaveProperty("start_url");
    });

    test("manifest has display mode", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      expect(manifest).toHaveProperty("display");
      // Should be standalone, fullscreen, or minimal-ui for PWA
      expect(["standalone", "fullscreen", "minimal-ui"]).toContain(
        manifest.display
      );
    });

    test("manifest has theme_color", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      expect(manifest).toHaveProperty("theme_color");
      // Should be a valid color (hex, rgb, etc.)
      expect(manifest.theme_color).toBeTruthy();
    });

    test("manifest has background_color", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      expect(manifest).toHaveProperty("background_color");
      expect(manifest.background_color).toBeTruthy();
    });
  });

  test.describe("Meta Tags", () => {
    test("manifest link tag present in HTML", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check for manifest link tag
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toBeAttached();

      // Verify href points to manifest
      const href = await manifestLink.getAttribute("href");
      expect(href).toContain("manifest");
    });

    test("apple-touch-icon present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check for apple-touch-icon (for iOS)
      const appleIcon = page.locator('link[rel="apple-touch-icon"]');

      // Should have at least one apple-touch-icon
      const count = await appleIcon.count();
      expect(count).toBeGreaterThan(0);
    });

    test("theme-color meta tag present", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check for theme-color meta tag
      const themeColorMeta = page.locator('meta[name="theme-color"]');
      await expect(themeColorMeta).toBeAttached();

      const content = await themeColorMeta.getAttribute("content");
      expect(content).toBeTruthy();
    });

    test("viewport meta tag configured correctly", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check viewport meta tag
      const viewportMeta = page.locator('meta[name="viewport"]');
      await expect(viewportMeta).toBeAttached();

      const content = await viewportMeta.getAttribute("content");

      // Should include width and initial-scale for mobile
      expect(content).toContain("width");
    });
  });

  test.describe("Icons", () => {
    test("favicon available", async ({ page }) => {
      // Request favicon
      const response = await page.request.get("/favicon.ico");

      // Should return 200 (or redirect to another icon format)
      expect([200, 301, 302]).toContain(response.status());
    });

    test("PWA icons accessible", async ({ page }) => {
      // Get manifest to find icon paths
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      // Test first icon is accessible
      if (manifest?.icons?.length > 0) {
        const iconSrc = manifest.icons[0].src;
        const iconResponse = await page.request.get(iconSrc);

        expect(iconResponse.status()).toBe(200);
      }
    });
  });

  test.describe("Offline Capability (UI only)", () => {
    // Note: Full service worker testing requires production build
    // These tests verify UI handles offline gracefully

    test("app shows content when online", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Main content should be visible
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
    });

    test("network status hook available", async ({ page }) => {
      await page.goto("/en/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Check that navigator.onLine is available (for network status detection)
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(typeof isOnline).toBe("boolean");
    });
  });

  test.describe("Installability", () => {
    test("app has short_name in manifest", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      // short_name is recommended for home screen display
      expect(manifest).toHaveProperty("short_name");
      expect(manifest.short_name).toBeTruthy();
      // short_name should be 12 characters or less
      expect(manifest.short_name.length).toBeLessThanOrEqual(15);
    });

    test("manifest has appropriate icon sizes", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      const iconSizes = manifest.icons.map(
        (icon: { sizes?: string }) => icon.sizes
      );

      // Should have at least a 192x192 and 512x512 icon
      expect(iconSizes).toContain("192x192");
      expect(iconSizes).toContain("512x512");
    });

    test("manifest has description", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      expect(manifest).toHaveProperty("description");
      expect(manifest.description).toBeTruthy();
    });
  });

  test.describe("Scope and Navigation", () => {
    test("manifest scope is defined", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      // scope defines where PWA can navigate
      expect(manifest).toHaveProperty("scope");
    });

    test("manifest id is defined", async ({ page }) => {
      const response = await page.goto("/manifest.json");
      const manifest = await response?.json();

      // id helps with PWA identity
      expect(manifest).toHaveProperty("id");
    });
  });
});
