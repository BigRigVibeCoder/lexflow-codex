import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_USERS } from '../fixtures/auth.fixture';

/**
 * Flow 1: Login → Dashboard
 *
 * Validates the authentication flow and dashboard rendering.
 * This is the most fundamental flow — if this fails, nothing else works.
 *
 * Refs: SPR-002 (Auth/RBAC), SPR-009-ARCH (A-E2E-003)
 */
test.describe('Flow 1: Login → Dashboard', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
    // Login form should be visible
    await expect(page.locator('input[type="email"], input[name="email"], [data-testid="email"]').first())
      .toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"], [data-testid="password"]').first())
      .toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login('wrong@example.com', 'WrongPassword123');

    // Should stay on login page
    await expect(page).toHaveURL(/.*login.*/);

    // Error message should appear
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).not.toBeNull();
  });

  test('should login with valid credentials and show dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Navigate to login
    await loginPage.goto();
    await expect(page).toHaveURL(/.*login.*/);

    // Login with admin credentials
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);

    // Verify redirect to dashboard
    await dashboardPage.verifyLoaded();

    // Verify navigation is present
    const hasSidebar = await dashboardPage.isSidebarVisible();
    expect(hasSidebar).toBe(true);
  });

  test('should logout and return to login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await dashboardPage.verifyLoaded();

    // Logout
    await dashboardPage.logout();

    // Should return to login
    const isOnLogin = await loginPage.isVisible();
    expect(isOnLogin).toBe(true);
  });
});
