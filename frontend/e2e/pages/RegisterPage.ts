import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class RegisterPage extends BasePage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly passwordToggle: Locator;
  readonly passwordRequirements: Locator;
  readonly formValidationError: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);

    this.nameInput = page.getByLabel(/full name|name/i);
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.getByLabel(/confirm password/i);
    this.submitButton = page.getByRole("button", { name: /create account|sign up|register/i });
    this.errorMessage = page.locator('[class*="destructive"]');
    this.loginLink = page.getByRole("link", { name: /sign in/i });
    this.passwordToggle = page.getByRole("button").filter({ has: page.locator('svg') }).last();
    this.passwordRequirements = page.locator('[class*="flex items-center gap-2 text-xs"]');
    this.formValidationError = page.locator(".text-destructive");
  }

  async goto(): Promise<void> {
    await super.goto("/register");
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }

  async fillRegistrationForm(
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
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

  async getPasswordRequirementStatus(): Promise<{ met: boolean; text: string }[]> {
    const requirements = await this.passwordRequirements.all();
    const statuses: { met: boolean; text: string }[] = [];

    for (const req of requirements) {
      const text = await req.textContent() ?? "";
      const hasGreenCheck = await req.locator(".text-green-500").count() > 0;
      statuses.push({ met: hasGreenCheck, text });
    }

    return statuses;
  }
}
