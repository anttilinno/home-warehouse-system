import { test as base, expect } from "@playwright/test";

type CustomFixtures = {
  locale: string;
  apiURL: string;
  pageErrors: Error[];
};

export const test = base.extend<CustomFixtures>({
  locale: ["en", { option: true }],
  apiURL: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", { option: true }],

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
