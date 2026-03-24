import { test, expect } from '../fixtures/auth.fixture';

/**
 * Flow 3: Time Entry → Invoice → Payment
 *
 * BLOCKED: Requires SPR-007 (Time & Billing) completion.
 * Placeholder spec — will be implemented in Phase 2.
 *
 * Refs: SPR-007 (Time & Billing), SPR-009-ARCH (A-E2E-005)
 */
test.describe('Flow 3: Time → Billing → Payment', () => {
  test.skip(true, 'Blocked on SPR-007 completion');

  test('should create a time entry', async ({ authenticatedPage }) => {
    // TODO: Implement after SPR-007
    expect(true).toBe(true);
  });

  test('should create an invoice from unbilled time', async ({ authenticatedPage }) => {
    // TODO: Implement after SPR-007
    expect(true).toBe(true);
  });

  test('should record payment and mark invoice PAID', async ({ authenticatedPage }) => {
    // TODO: Implement after SPR-007
    expect(true).toBe(true);
  });
});
