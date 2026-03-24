import { type Page, expect } from '@playwright/test';

/**
 * Trust Accounts Page Object Model
 *
 * Refs: SPR-004 (Trust Accounting Backend), SPR-005 (Trust Accounting Frontend)
 */
export class TrustPage {
  constructor(private page: Page) {}

  /** Navigate to trust accounts list */
  async goto(): Promise<void> {
    await this.page.goto('/trust');
  }

  /** Click "New Account" */
  async clickNewAccount(): Promise<void> {
    const newBtn = this.page.locator(
      '[data-testid="new-trust-account"], button:has-text("New Account"), button:has-text("Create Account")'
    ).first();
    await newBtn.click();
  }

  /** Fill trust account creation form */
  async fillAccountForm(data: {
    name: string;
    bankName: string;
    accountNumber: string;
  }): Promise<void> {
    await this.page.locator(
      '[data-testid="account-name"], input[name="name"]'
    ).first().fill(data.name);

    await this.page.locator(
      '[data-testid="bank-name"], input[name="bankName"]'
    ).first().fill(data.bankName);

    await this.page.locator(
      '[data-testid="account-number"], input[name="accountNumber"]'
    ).first().fill(data.accountNumber);
  }

  /** Submit account form */
  async submitForm(): Promise<void> {
    const submitBtn = this.page.locator(
      'button[type="submit"], button:has-text("Create"), button:has-text("Save")'
    ).first();
    await submitBtn.click();
  }

  /** Create a deposit transaction */
  async createDeposit(amountCents: number, source: string): Promise<void> {
    const depositBtn = this.page.locator(
      '[data-testid="new-deposit"], button:has-text("Deposit"), button:has-text("New Deposit")'
    ).first();
    await depositBtn.click();

    // Amount in dollars (display) — input as formatted string
    const amountDollars = (amountCents / 100).toFixed(2);
    await this.page.locator(
      '[data-testid="deposit-amount"], input[name="amount"]'
    ).first().fill(amountDollars);

    await this.page.locator(
      '[data-testid="deposit-source"], input[name="source"]'
    ).first().fill(source);

    await this.page.locator(
      'button[type="submit"], button:has-text("Submit"), button:has-text("Confirm")'
    ).first().click();
  }

  /** Create a disbursement transaction */
  async createDisbursement(amountCents: number, payee: string): Promise<void> {
    const disburseBtn = this.page.locator(
      '[data-testid="new-disbursement"], button:has-text("Disburse"), button:has-text("New Disbursement")'
    ).first();
    await disburseBtn.click();

    const amountDollars = (amountCents / 100).toFixed(2);
    await this.page.locator(
      '[data-testid="disbursement-amount"], input[name="amount"]'
    ).first().fill(amountDollars);

    await this.page.locator(
      '[data-testid="disbursement-payee"], input[name="payee"]'
    ).first().fill(payee);

    await this.page.locator(
      'button[type="submit"], button:has-text("Submit"), button:has-text("Confirm")'
    ).first().click();
  }

  /** Get the displayed balance text */
  async getBalance(): Promise<string | null> {
    const balanceEl = this.page.locator(
      '[data-testid="account-balance"], [class*="balance"]'
    ).first();
    return await balanceEl.textContent();
  }

  /** Get ledger entry count */
  async getLedgerEntryCount(): Promise<number> {
    const entries = this.page.locator(
      '[data-testid*="ledger-entry"], table tbody tr, [class*="ledger-row"]'
    );
    return await entries.count();
  }

  /** Verify trust page loaded */
  async verifyLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2, [data-testid="trust-heading"]').first())
      .toBeVisible({ timeout: 10_000 });
  }
}
