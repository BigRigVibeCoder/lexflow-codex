import { test, expect } from '../fixtures/auth.fixture';
import { TrustPage } from '../pages/trust.page';

/**
 * Flow 4: Trust Accounting — Create Account → Deposit → Verify
 *
 * Source-verified against: trust/page.tsx, trust/accounts/page.tsx,
 *   trust/accounts/new/page.tsx, trust/transactions/deposit/page.tsx
 *
 * Routes: /trust → /trust/accounts → /trust/accounts/new → /trust/transactions/deposit
 *
 * Refs: SPR-004/005 (Trust Accounting), SPR-009-ARCH (A-E2E-006)
 */
test.describe('Flow 4: Trust Accounting', () => {
  const ts = Date.now();

  test('should navigate to trust and create an account', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const trustPage = new TrustPage(page);

    // Navigate to trust dashboard (/trust)
    await trustPage.goto();
    await trustPage.verifyLoaded();

    // Navigate to accounts list
    await trustPage.gotoAccounts();
    await trustPage.verifyAccountsLoaded();

    // Click "New Account" → navigates to /trust/accounts/new
    await trustPage.clickNewAccount();

    // Fill account creation form
    await trustPage.fillAccountForm({
      bankName: 'E2E Test Bank',
      accountNumber: `IOLTA-${ts}`,
      routingNumber: '021000089',
      accountName: `E2E Trust Account ${ts}`,
      accountType: 'iolta',
    });

    // Submit
    await trustPage.submitAccountForm();
    await page.waitForTimeout(2000);
  });

  test('should record a deposit', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const trustPage = new TrustPage(page);

    // Navigate directly to deposit page
    await trustPage.gotoDeposit();

    // Fill deposit form
    await trustPage.fillDepositForm({
      amount: '1000.00',
      payorName: 'E2E Test Payor',
      description: 'E2E Test Deposit',
      paymentMethod: 'check',
    });

    // Submit deposit
    await trustPage.submitDeposit();
    await page.waitForTimeout(2000);
  });
});
