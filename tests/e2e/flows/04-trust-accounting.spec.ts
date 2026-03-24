import { test, expect } from '../fixtures/auth.fixture';
import { TrustPage } from '../pages/trust.page';

/**
 * Flow 4: Trust Accounting — Deposit → Disburse → Verify Balance
 *
 * Validates the core trust accounting workflow: create account,
 * deposit funds, disburse funds, verify balance and ledger.
 *
 * Refs: SPR-004/005 (Trust Accounting), SPR-009-ARCH (A-E2E-006)
 */
test.describe('Flow 4: Trust Accounting', () => {
  const testAccount = {
    name: `E2E Trust Account ${Date.now()}`,
    bankName: 'E2E Test Bank',
    accountNumber: `TEST-${Date.now()}`,
  };

  test('should create a trust account and perform transactions', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const trustPage = new TrustPage(page);

    // Navigate to trust accounts
    await trustPage.goto();
    await trustPage.verifyLoaded();

    // Create new trust account
    await trustPage.clickNewAccount();
    await trustPage.fillAccountForm(testAccount);
    await trustPage.submitForm();
    await page.waitForTimeout(2000);

    // Deposit $1,000.00 (100000 cents)
    await trustPage.createDeposit(100000, 'E2E Test Deposit');
    await page.waitForTimeout(2000);

    // Verify balance shows $1,000.00
    const balanceAfterDeposit = await trustPage.getBalance();
    expect(balanceAfterDeposit).not.toBeNull();
    // Balance should contain "1,000" or "1000"
    expect(balanceAfterDeposit).toMatch(/1[,.]?000/);

    // Disburse $250.00 (25000 cents)
    await trustPage.createDisbursement(25000, 'E2E Test Payee');
    await page.waitForTimeout(2000);

    // Verify balance shows $750.00
    const balanceAfterDisburse = await trustPage.getBalance();
    expect(balanceAfterDisburse).not.toBeNull();
    expect(balanceAfterDisburse).toMatch(/750/);

    // Verify ledger has 2 entries
    const ledgerCount = await trustPage.getLedgerEntryCount();
    expect(ledgerCount).toBeGreaterThanOrEqual(2);
  });
});
