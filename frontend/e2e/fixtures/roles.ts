import { test as base, expect } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";

// Role-specific credentials from environment variables
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "adminpassword123";

const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL ?? "member@example.com";
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD ?? "memberpassword123";

const VIEWER_EMAIL = process.env.TEST_VIEWER_EMAIL ?? "viewer@example.com";
const VIEWER_PASSWORD = process.env.TEST_VIEWER_PASSWORD ?? "viewerpassword123";

// Storage state paths for different roles
const ADMIN_AUTH_FILE = "playwright/.auth/admin.json";
const MEMBER_AUTH_FILE = "playwright/.auth/member.json";
const VIEWER_AUTH_FILE = "playwright/.auth/viewer.json";

export type RoleFixtures = {
  locale: string;
  apiURL: string;
  adminPage: Page;
  memberPage: Page;
  viewerPage: Page;
  adminContext: BrowserContext;
  memberContext: BrowserContext;
  viewerContext: BrowserContext;
  pageErrors: Error[];
};

/**
 * Authenticate a user and save storage state
 */
async function authenticateUser(
  page: Page,
  email: string,
  password: string,
  authFile: string
): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: authFile });
}

/**
 * Test fixture with role-specific authenticated pages
 */
export const test = base.extend<RoleFixtures>({
  locale: ["en", { scope: "test" }],
  apiURL: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", { scope: "test" }],

  // Admin context and page
  adminContext: async ({ browser }, use) => {
    // Try to use existing storage state, or authenticate
    let context: BrowserContext;
    try {
      context = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    } catch {
      // Storage state doesn't exist, need to authenticate
      context = await browser.newContext();
      const page = await context.newPage();
      await authenticateUser(page, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_AUTH_FILE);
      await page.close();
    }
    await use(context);
    await context.close();
  },

  adminPage: async ({ adminContext, pageErrors }, use) => {
    const page = await adminContext.newPage();
    page.on("pageerror", (error) => pageErrors.push(error));
    await use(page);
    await page.close();
  },

  // Member context and page
  memberContext: async ({ browser }, use) => {
    let context: BrowserContext;
    try {
      context = await browser.newContext({ storageState: MEMBER_AUTH_FILE });
    } catch {
      context = await browser.newContext();
      const page = await context.newPage();
      await authenticateUser(page, MEMBER_EMAIL, MEMBER_PASSWORD, MEMBER_AUTH_FILE);
      await page.close();
    }
    await use(context);
    await context.close();
  },

  memberPage: async ({ memberContext, pageErrors }, use) => {
    const page = await memberContext.newPage();
    page.on("pageerror", (error) => pageErrors.push(error));
    await use(page);
    await page.close();
  },

  // Viewer context and page
  viewerContext: async ({ browser }, use) => {
    let context: BrowserContext;
    try {
      context = await browser.newContext({ storageState: VIEWER_AUTH_FILE });
    } catch {
      context = await browser.newContext();
      const page = await context.newPage();
      await authenticateUser(page, VIEWER_EMAIL, VIEWER_PASSWORD, VIEWER_AUTH_FILE);
      await page.close();
    }
    await use(context);
    await context.close();
  },

  viewerPage: async ({ viewerContext, pageErrors }, use) => {
    const page = await viewerContext.newPage();
    page.on("pageerror", (error) => pageErrors.push(error));
    await use(page);
    await page.close();
  },

  // Collect page errors and fail test if any occur
  pageErrors: [async ({}, use) => {
    const errors: Error[] = [];
    await use(errors);

    // After test completes, fail if there were any JavaScript errors
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `${e.name}: ${e.message}`).join("\n");
      throw new Error(`Page had ${errors.length} JavaScript error(s):\n${errorMessages}`);
    }
  }, { auto: true }],
});

export { expect };
export { ADMIN_EMAIL, ADMIN_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD, VIEWER_EMAIL, VIEWER_PASSWORD };
export { ADMIN_AUTH_FILE, MEMBER_AUTH_FILE, VIEWER_AUTH_FILE };
