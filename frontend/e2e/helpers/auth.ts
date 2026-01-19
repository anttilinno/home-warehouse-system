import type { Browser, Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "test@example.com";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "testpassword123";

export async function login(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD
): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function setupAuthState(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);

  const storagePath = "playwright/.auth/user.json";
  await context.storageState({ path: storagePath });
  await context.close();

  return storagePath;
}
