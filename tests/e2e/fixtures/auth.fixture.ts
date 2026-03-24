import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

/**
 * Authenticated Page Fixture
 *
 * Provides a pre-authenticated page for tests that need to be logged in.
 * Login happens once per test, ensuring clean state.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth.fixture';
 *   test('my test', async ({ authenticatedPage }) => { ... });
 */

/** Test credentials — must match seeded test data on lexflow-prod */
export const TEST_USERS = {
  admin: {
    email: 'admin@lexflow.test',
    password: 'TestAdmin123!',
  },
  attorney: {
    email: 'attorney@lexflow.test',
    password: 'TestAttorney123!',
  },
  staff: {
    email: 'staff@lexflow.test',
    password: 'TestStaff123!',
  },
} as const;

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);

    // Wait for redirect away from login
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
