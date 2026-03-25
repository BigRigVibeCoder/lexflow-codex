import { type Page, expect } from '@playwright/test';

/**
 * Trust Accounts Page Object Model
 *
 * Source: src/app/(dashboard)/trust/page.tsx, trust/accounts/page.tsx,
 *   trust/accounts/new/page.tsx, trust/transactions/deposit/page.tsx,
 *   trust/transactions/disburse/page.tsx
 *
 * Routes:
 *   /trust (dashboard), /trust/accounts (list), /trust/accounts/new (create),
 *   /trust/transactions/deposit, /trust/transactions/disburse
 *
 * Refs: SPR-004, SPR-005 (Trust Accounting)
 */
export class TrustPage {
  constructor(private page: Page) {}

  /** Navigate to trust dashboard */
  async goto(): Promise<void> {
    await this.page.goto('/trust');
  }

  /** Navigate to trust accounts list */
  async gotoAccounts(): Promise<void> {
    await this.page.goto('/trust/accounts');
  }

  /** Navigate directly to new account form */
  async gotoNewAccount(): Promise<void> {
    await this.page.goto('/trust/accounts/new');
  }

  /** Click "New Account" on the accounts list page */
  async clickNewAccount(): Promise<void> {
    await this.page.locator('[data-testid="new-trust-btn"]').click();
    await this.page.waitForURL('**/trust/accounts/new**', { timeout: 10_000 });
  }

  /**
   * Fill trust account creation form
   * Source: trust/accounts/new/page.tsx
   * testids: bank-name, account-number, routing-number, account-name, account-type, submit-account
   */
  async fillAccountForm(data: {
    bankName: string;
    accountNumber: string;
    routingNumber: string;
    accountName: string;
    accountType?: 'iolta' | 'operating';
  }): Promise<void> {
    await this.page.locator('[data-testid="bank-name"]').fill(data.bankName);
    await this.page.locator('[data-testid="account-number"]').fill(data.accountNumber);
    await this.page.locator('[data-testid="routing-number"]').fill(data.routingNumber);
    await this.page.locator('[data-testid="account-name"]').fill(data.accountName);
    if (data.accountType) {
      await this.page.locator('[data-testid="account-type"]').selectOption(data.accountType);
    }
  }

  /** Submit account form */
  async submitAccountForm(): Promise<void> {
    await this.page.locator('[data-testid="submit-account"]').click();
  }

  /**
   * Navigate to deposit page
   * Source: trust/transactions/deposit/page.tsx
   */
  async gotoDeposit(): Promise<void> {
    await this.page.goto('/trust/transactions/deposit');
  }

  /**
   * Fill deposit form
   * testids: deposit-amount, payor-name, deposit-desc, payment-method, ref-number, submit-deposit
   */
  async fillDepositForm(data: {
    amount: string;
    payorName: string;
    description?: string;
    paymentMethod?: string;
  }): Promise<void> {
    await this.page.locator('[data-testid="deposit-amount"]').fill(data.amount);
    await this.page.locator('[data-testid="payor-name"]').fill(data.payorName);
    if (data.description) {
      await this.page.locator('[data-testid="deposit-desc"]').fill(data.description);
    }
    if (data.paymentMethod) {
      await this.page.locator('[data-testid="payment-method"]').selectOption(data.paymentMethod);
    }
  }

  /** Submit deposit */
  async submitDeposit(): Promise<void> {
    await this.page.locator('[data-testid="submit-deposit"]').click();
  }

  /** Navigate to disburse page */
  async gotoDisburse(): Promise<void> {
    await this.page.goto('/trust/transactions/disburse');
  }

  /** Verify trust dashboard loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="trust-dashboard-page"]'))
      .toBeVisible({ timeout: 10_000 });
  }

  /** Verify accounts list loaded */
  async verifyAccountsLoaded(): Promise<void> {
    await expect(this.page.locator('[data-testid="trust-accounts-page"]'))
      .toBeVisible({ timeout: 10_000 });
  }
}
