import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class MarketingPage extends BasePage {
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly ctaButton: Locator;
  readonly featuresGrid: Locator;
  readonly featureCards: Locator;
  readonly howItWorksSection: Locator;
  readonly navLinks: Locator;
  readonly header: Locator;
  readonly signInLink: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);

    this.header = page.locator("header");
    this.heroSection = page.locator("section").first();
    this.heroTitle = page.locator("h1");
    this.ctaButton = page.getByRole("link", { name: /get started/i }).first();
    this.featuresGrid = page.locator("section").filter({ has: page.locator(".grid") }).nth(1);
    this.featureCards = page.locator('[class*="Card"]').or(page.locator("section .grid > div"));
    this.howItWorksSection = page.locator("section").filter({ hasText: /how it works|step/i });
    this.navLinks = this.header.getByRole("link");
    this.signInLink = this.header.getByRole("link", { name: /sign in/i });
    this.getStartedButton = this.header.getByRole("link", { name: /get started/i });
  }

  async goto(): Promise<void> {
    await super.goto("/");
  }

  async clickGetStarted(): Promise<void> {
    await this.ctaButton.click();
  }

  async clickSignIn(): Promise<void> {
    await this.signInLink.click();
  }
}
