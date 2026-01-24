/**
 * PWA Screenshot Generation Script
 *
 * Generates screenshots for PWA manifest install prompts.
 * Uses Playwright to capture mobile and desktop views with realistic data.
 *
 * Usage: npx tsx e2e/scripts/generate-screenshots.ts
 *
 * Prerequisites:
 * - Backend server running (mise run dev)
 * - Frontend server running (mise run fe-dev)
 * - Auth setup completed (npx playwright test auth.setup.ts --project=setup)
 */

import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const AUTH_FILE = resolve(__dirname, "../../playwright/.auth/user.json");
const SCREENSHOTS_DIR = resolve(__dirname, "../../public/screenshots");

// Screenshot configurations matching manifest.json
const SCREENSHOTS = [
  {
    name: "mobile-dashboard",
    path: "/en/dashboard",
    viewport: { width: 1080, height: 1920 },
    isMobile: true,
  },
  {
    name: "desktop-inventory",
    path: "/en/dashboard/items",
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
  },
] as const;

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function waitForPageReady(context: BrowserContext, path: string): Promise<void> {
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}${path}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for main content to be visible
    await page.waitForSelector("main", { state: "visible", timeout: 10000 });

    // Additional wait for any lazy-loaded content
    await page.waitForTimeout(1000);
  } finally {
    await page.close();
  }
}

async function captureScreenshot(
  browser: Browser,
  config: (typeof SCREENSHOTS)[number]
): Promise<string> {
  const outputPath = resolve(SCREENSHOTS_DIR, `${config.name}.png`);
  await ensureDirectoryExists(outputPath);

  // Check if auth state exists
  if (!existsSync(AUTH_FILE)) {
    throw new Error(
      `Auth state not found at ${AUTH_FILE}. Run: npx playwright test auth.setup.ts --project=setup`
    );
  }

  // Create context with appropriate viewport and auth state
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    storageState: AUTH_FILE,
    isMobile: config.isMobile,
    hasTouch: config.isMobile,
  });

  try {
    const page = await context.newPage();

    // Navigate and wait for content
    await page.goto(`${BASE_URL}${config.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for main content to be visible
    await page.waitForSelector("main", { state: "visible", timeout: 15000 });

    // Wait for page to be fully loaded and rendered
    // Give time for React hydration and data fetching
    await page.waitForLoadState("load");

    // Wait for any data loading to complete
    // Check for loading states and wait for them to disappear
    try {
      await page.waitForSelector('[data-loading="true"]', {
        state: "detached",
        timeout: 5000,
      });
    } catch {
      // No loading indicator found, that's fine
    }

    // Additional wait for animations and lazy-loaded content to settle
    await page.waitForTimeout(2000);

    // Capture full-page screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: false, // Fixed viewport size, not full page
      type: "png",
    });

    console.log(`Generated: ${config.name}.png (${config.viewport.width}x${config.viewport.height})`);
    return outputPath;
  } finally {
    await context.close();
  }
}

export async function generateScreenshots(): Promise<string[]> {
  console.log("Starting PWA screenshot generation...\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth file: ${AUTH_FILE}`);
  console.log(`Output dir: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const paths: string[] = [];

    for (const config of SCREENSHOTS) {
      const outputPath = await captureScreenshot(browser, config);
      paths.push(outputPath);
    }

    console.log("\nScreenshot generation complete!");
    console.log(`Generated ${paths.length} screenshots in ${SCREENSHOTS_DIR}`);

    return paths;
  } finally {
    await browser.close();
  }
}

// Run directly when executed with tsx
if (require.main === module) {
  generateScreenshots()
    .then((paths) => {
      console.log("\nGenerated files:");
      paths.forEach((p) => console.log(`  - ${p}`));
      process.exit(0);
    })
    .catch((error) => {
      console.error("Screenshot generation failed:", error.message);
      process.exit(1);
    });
}
