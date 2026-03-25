import { type Page } from '@playwright/test';

/**
 * Login Page Object Model
 *
 * Source: src/app/(auth)/login/page.tsx
 * Verified testids: email, password, sign-in, error-message, login-page
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
    await this.page.locator('[data-testid="email"]').fill(email);
    await this.page.locator('[data-testid="password"]').fill(password);
    await this.page.locator('[data-testid="sign-in"]').click();
  }

  /** Get the error message text (if any) */
  async getErrorMessage(): Promise<string | null> {
    const errorEl = this.page.locator('[data-testid="error-message"]');
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
