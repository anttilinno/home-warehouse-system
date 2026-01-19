import type { Locator, Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;
  readonly locale: string;

  constructor(page: Page, locale = "en") {
    this.page = page;
    this.locale = locale;
  }

  async goto(path = ""): Promise<void> {
    const localizedPath = path.startsWith("/")
      ? `/${this.locale}${path}`
      : `/${this.locale}/${path}`;
    await this.page.goto(localizedPath);
  }

  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  getByTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}
