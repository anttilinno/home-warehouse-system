import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly passwordToggle: Locator;
  readonly formValidationError: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);

    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole("button", { name: /sign in|log in/i });
    this.errorMessage = page.locator('[class*="destructive"]');
    this.registerLink = page.getByRole("link", { name: /sign up/i });
    this.forgotPasswordLink = page.getByRole("link", { name: /forgot password/i });
    this.passwordToggle = page.getByRole("button").filter({ has: page.locator('svg') }).last();
    this.formValidationError = page.locator(".text-destructive");
  }

  async goto(): Promise<void> {
    await super.goto("/login");
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string | RegExp): Promise<void> {
    const errorLocator = this.page.locator(`text=${message}`).or(
      this.page.getByText(message)
    );
    await expect(errorLocator).toBeVisible();
  }

  async expectValidationError(): Promise<void> {
    await expect(this.formValidationError.first()).toBeVisible();
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute("type");
    return type === "text";
  }
}
