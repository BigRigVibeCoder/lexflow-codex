import { type Page } from '@playwright/test';

/**
 * Login Page Object Model
 *
 * Encapsulates all selectors and actions for the login page.
 * Per GOV-002 §14.2: selectors use data-testid, fallback to role/text.
 *
 * Refs: SPR-002 (Auth/RBAC), CON-001
 */
export class LoginPage {
  constructor(private page: Page) {}

  /** Navigate to login page */
  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  /** Fill credentials and submit the login form */
  async login(email: string, password: string): Promise<void> {
    // Try data-testid first, fall back to common selectors
    const emailInput = this.page.locator(
      '[data-testid="email"], input[name="email"], input[type="email"]'
    ).first();
    const passwordInput = this.page.locator(
      '[data-testid="password"], input[name="password"], input[type="password"]'
    ).first();
    const submitButton = this.page.locator(
      '[data-testid="sign-in"], button[type="submit"]'
    ).first();

    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitButton.click();
  }

  /** Get the error message text (if any) */
  async getErrorMessage(): Promise<string | null> {
    const errorEl = this.page.locator(
      '[data-testid="error-message"], [role="alert"], .text-red-500, .error-message'
    ).first();
    try {
      await errorEl.waitFor({ state: 'visible', timeout: 5000 });
      return await errorEl.textContent();
    } catch {
      return null;
    }
  }

  /** Check if we're on the login page */
  async isVisible(): Promise<boolean> {
    return this.page.url().includes('/login');
  }
}
