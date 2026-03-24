import { test, expect } from '../fixtures/auth.fixture';
import { MattersPage } from '../pages/matters.page';
import { DashboardPage } from '../pages/dashboard.page';

/**
 * Flow 6: SOL Deadline on Dashboard
 *
 * Validates that a matter's Statute of Limitations deadline
 * appears on the dashboard.
 *
 * Refs: SPR-003 (Matter Management — SOL tracking), SPR-009-ARCH (A-E2E-008)
 */
test.describe('Flow 6: SOL Deadline', () => {
  const solDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]; // 30 days from now

  const testMatter = {
    title: `SOL Test Matter ${Date.now()}`,
    description: 'E2E test for SOL deadline visibility',
    solDate,
  };

  test('should show SOL deadline on dashboard', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const mattersPage = new MattersPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create a matter with SOL date 30 days out
    await mattersPage.goto();
    await mattersPage.clickNewMatter();
    await mattersPage.fillMatterForm(testMatter);
    await mattersPage.submitForm();
    await page.waitForTimeout(2000);

    // Navigate to dashboard
    await dashboardPage.goto();
    await dashboardPage.verifyLoaded();

    // Look for SOL-related content on dashboard
    const solWidget = page.locator(
      '[data-testid*="sol"], [data-testid*="deadline"], [class*="sol"], [class*="deadline"], text=/statute/i, text=/SOL/i'
    ).first();

    // Verify SOL widget/section exists
    const hasSolWidget = await solWidget.isVisible().catch(() => false);
    expect(hasSolWidget).toBe(true);
  });
});
