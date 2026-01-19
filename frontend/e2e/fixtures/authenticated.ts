import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "test@example.com";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "testpassword123";

export type AuthenticatedFixtures = {
  locale: string;
  apiURL: string;
  authenticatedPage: Page;
  pageErrors: Error[];
};

export const test = base.extend<AuthenticatedFixtures>({
  locale: ["en", { scope: "test" }],
  apiURL: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", { scope: "test" }],

  // Use storage state from auth setup
  storageState: "playwright/.auth/user.json",

  authenticatedPage: async ({ page }, use) => {
    // The page is already authenticated via storageState
    await use(page);
  },

  // Collect page errors and fail test if any occur
  pageErrors: [async ({ page }, use) => {
    const errors: Error[] = [];

    page.on("pageerror", (error) => {
      errors.push(error);
    });

    await use(errors);

    // After test completes, fail if there were any JavaScript errors
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `${e.name}: ${e.message}`).join("\n");
      throw new Error(`Page had ${errors.length} JavaScript error(s):\n${errorMessages}`);
    }
  }, { auto: true }],
});

export { expect };
export { TEST_EMAIL, TEST_PASSWORD };
