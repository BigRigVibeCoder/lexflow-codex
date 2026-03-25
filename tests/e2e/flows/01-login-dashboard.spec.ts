import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_USERS } from '../fixtures/auth.fixture';

/**
 * Flow 1: Login → Dashboard
 *
 * Validates authentication flow and dashboard rendering.
 * Source-verified against: login/page.tsx, dashboard/page.tsx, dashboard-shell.tsx
 *
 * Refs: SPR-002 (Auth/RBAC), SPR-009-ARCH (A-E2E-003)
 */
test.describe('Flow 1: Login → Dashboard', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login.*/);
    await expect(page.locator('[data-testid="email"]')).toBeVisible();
    await expect(page.locator('[data-testid="password"]')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@example.com', 'WrongPassword123');

    // Should stay on login page
    await expect(page).toHaveURL(/.*login.*/);

    // Error message with data-testid="error-message" should appear
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).not.toBeNull();
  });

  test('should login with valid credentials and show dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);

    // Verify dashboard loaded
    await dashboardPage.verifyLoaded();

    // Verify sidebar navigation
    const hasSidebar = await dashboardPage.isSidebarVisible();
    expect(hasSidebar).toBe(true);

    // Verify KPI cards exist (4 cards in dashboard/page.tsx)
    const kpiCount = await dashboardPage.getKpiCards();
    expect(kpiCount).toBeGreaterThanOrEqual(4);
  });

  test('should logout and return to login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await dashboardPage.verifyLoaded();

    // Click Sign Out (data-testid="logout")
    // signOut({ callbackUrl: '/login' }) → redirects to /login
    await dashboardPage.logout();

    // Should return to login
    const isOnLogin = await loginPage.isVisible();
    expect(isOnLogin).toBe(true);
  });
});
